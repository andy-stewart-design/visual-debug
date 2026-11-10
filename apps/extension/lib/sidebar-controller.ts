import type { ActivationController } from './activation';
import {
  INSPECTION_STATE_MESSAGE, isInspectionStatus, isTabId, validateInspectionStateMessage,
  type InspectionState, type InspectionStatus,
} from './inspection-protocol';

export const SIDEBAR_PORT = 'visual-debug:sidebar';
export type SidebarOperation = 'start' | 'stop' | 'query';
export interface SidebarView {
  windowId: number;
  tabId?: number;
  status: InspectionStatus;
  canStart: boolean;
  error?: string;
  state?: InspectionState;
}

type Tab = { id: number; windowId: number };
type Connection = { id: number; publish(view: SidebarView): void };
type Pending = { tabId: number };
type WindowRecord = {
  epoch: number;
  viewVersion: number;
  closed: boolean;
  connection?: Connection;
  waiters: Set<{ resolve(connection: Connection): void; reject(error: Error): void }>;
  owned: Set<number>;
  pending: Set<Pending>;
  known: Map<number, InspectionState>;
  cleanup: Promise<void>;
  tabCleanup: Map<number, Promise<void>>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isSidebarView(value: unknown): value is SidebarView {
  if (!record(value) || !isTabId(value.windowId) || !isInspectionStatus(value.status) || typeof value.canStart !== 'boolean') return false;
  if (value.tabId !== undefined && !isTabId(value.tabId)) return false;
  if (value.error !== undefined && typeof value.error !== 'string') return false;
  if (value.state !== undefined) {
    const event = validateInspectionStateMessage({ kind: INSPECTION_STATE_MESSAGE, state: value.state });
    if (!event || event.state.identity.tabId !== value.tabId || event.state.status !== value.status) return false;
  }
  return true;
}
export function validateSidebarView(value: unknown): SidebarView | undefined {
  return isSidebarView(value) ? value : undefined;
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function missing(error: unknown): boolean {
  return ['Receiving end does not exist.', 'Could not establish connection. Receiving end does not exist.'].includes(message(error));
}
const GUIDANCE = 'Click the extension toolbar button to authorize and start this tab. Browser-internal pages cannot be inspected.';

export function createSidebarController(options: {
  activation: Pick<ActivationController, 'start' | 'stop' | 'query'>;
  getActiveTab(windowId: number): Promise<Tab | undefined>;
  getTabs(windowId: number): Promise<Tab[]>;
  getTab(tabId: number): Promise<Tab | undefined>;
  readyTimeoutMs?: number;
}) {
  const windows = new Map<number, WindowRecord>();
  let connectionId = 0;
  const get = (id: number): WindowRecord => {
    let value = windows.get(id);
    if (!value) {
      value = { epoch: 0, viewVersion: 0, closed: false, waiters: new Set(), owned: new Set(), pending: new Set(), known: new Map(), cleanup: Promise.resolve(), tabCleanup: new Map() };
      windows.set(id, value);
    }
    return value;
  };
  const current = (value: WindowRecord, epoch: number, connection?: number) =>
    value.epoch === epoch && !value.closed && (connection === undefined || value.connection?.id === connection);
  const publish = (value: WindowRecord, view: SidebarView) => {
    try { value.connection?.publish(view); } catch { /* native lifetime handling owns dead ports */ }
  };
  const fromState = (id: number, state: InspectionState): SidebarView => ({
    windowId: id, tabId: state.identity.tabId, status: state.status,
    canStart: state.status === 'inactive' || state.status === 'error', state,
    ...(state.error ? { error: state.error } : {}),
  });
  const remember = (value: WindowRecord, state: InspectionState, previous?: InspectionState): InspectionState => {
    const known = value.known.get(state.identity.tabId);
    // A query initiated before an event cannot roll back a newer document or
    // revision. Only a fresh query may establish a replacement document.
    if (known && ((known.identity.documentId === state.identity.documentId && known.revision > state.revision) ||
      (known !== previous && known.identity.documentId !== state.identity.documentId))) return known;
    value.known.set(state.identity.tabId, state);
    if (state.status === 'active' || state.status === 'pending') value.owned.add(state.identity.tabId);
    else value.owned.delete(state.identity.tabId);
    return state;
  };
  const render = async (id: number, tab: number, epoch: number, version: number, view: SidebarView) => {
    const value = get(id);
    if (!current(value, epoch) || value.viewVersion !== version) return;
    let active: Tab | undefined;
    try { active = await options.getActiveTab(id); } catch { return; }
    if (!current(value, epoch) || value.viewVersion !== version || active?.id !== tab || active.windowId !== id) return;
    const known = value.known.get(tab);
    // Prefer a lifecycle event which arrived while the active-tab lookup ran.
    if (view.state && known && (known.identity.documentId !== view.state.identity.documentId || known.revision > view.state.revision)) {
      publish(value, fromState(id, known));
    } else publish(value, view);
  };
  const query = async (id: number, tab: number, epoch: number): Promise<InspectionState | undefined> => {
    const value = get(id);
    const previous = value.known.get(tab);
    const response = await options.activation.query(tab);
    if (!current(value, epoch) || response.identity.tabId !== tab || response.superseded) return undefined;
    return remember(value, response.state, previous);
  };
  const showFailure = async (id: number, tab: number | undefined, epoch: number, version: number, error: unknown) => {
    const value = get(id);
    if (!current(value, epoch) || value.viewVersion !== version) return;
    const view: SidebarView = {
      windowId: id, ...(tab === undefined ? {} : { tabId: tab }),
      status: missing(error) ? 'unavailable' : 'error', canStart: false,
      error: missing(error) ? GUIDANCE : message(error),
    };
    if (tab !== undefined) await render(id, tab, epoch, version, view);
    else publish(value, view);
  };
  const waitForConnection = (value: WindowRecord, epoch: number): Promise<Connection> => {
    if (!current(value, epoch)) return Promise.reject(new Error('Sidebar was closed.'));
    if (value.connection) return Promise.resolve(value.connection);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { value.waiters.delete(waiter); reject(new Error('Timed out waiting for the sidebar.')); }, options.readyTimeoutMs ?? 5_000);
      const waiter = {
        resolve(connection: Connection) { clearTimeout(timer); value.waiters.delete(waiter); resolve(connection); },
        reject(error: Error) { clearTimeout(timer); value.waiters.delete(waiter); reject(error); },
      };
      value.waiters.add(waiter);
    });
  };

  const refresh = async (id: number): Promise<void> => {
    const value = get(id);
    if (!value.connection || value.closed) return;
    const epoch = value.epoch;
    const version = ++value.viewVersion;
    publish(value, { windowId: id, status: 'pending', canStart: false });
    let tab: Tab | undefined;
    try {
      await value.cleanup;
      if (!current(value, epoch) || value.viewVersion !== version) return;
      tab = await options.getActiveTab(id);
      if (!current(value, epoch) || value.viewVersion !== version) return;
      if (!tab || tab.windowId !== id) {
        publish(value, { windowId: id, status: 'unavailable', canStart: false, error: 'No active tab is available.' });
        return;
      }
      const state = await query(id, tab.id, epoch);
      if (state) await render(id, tab.id, epoch, version, fromState(id, state));
    } catch (error) { await showFailure(id, tab?.id, epoch, version, error); }
  };
  const connect = (id: number, callback: (view: SidebarView) => void) => {
    const value = get(id);
    value.closed = false;
    const connection = { id: ++connectionId, publish: callback };
    value.connection = connection;
    for (const waiter of [...value.waiters]) waiter.resolve(connection);
    void refresh(id);
    return { id: connection.id, disconnect() { if (value.connection === connection) value.connection = undefined; } };
  };
  const stop = (value: WindowRecord, tab: number) => {
    // Invocation is synchronous: activation invalidates queued/in-flight starts
    // before the first await, even if no content receiver exists yet.
    const result = options.activation.stop(tab);
    const cleanup = result.then(() => undefined, (error) => { if (!missing(error)) throw error; });
    value.tabCleanup.set(tab, cleanup);
    void cleanup.finally(() => { if (value.tabCleanup.get(tab) === cleanup) value.tabCleanup.delete(tab); }).catch(() => undefined);
    return result;
  };
  const mutate = async (id: number, tab: number, epoch: number, connection: number, version: number, allowInjection: boolean, pending: Pending) => {
    const value = get(id);
    await value.cleanup;
    await value.tabCleanup.get(tab);
    if (!current(value, epoch, connection) || !value.pending.has(pending)) return;
    const active = await options.getActiveTab(id);
    if (!current(value, epoch, connection) || !value.pending.has(pending) || active?.id !== tab || active.windowId !== id) return;
    value.owned.add(tab);
    publish(value, { windowId: id, tabId: tab, status: 'pending', canStart: false });
    const previous = value.known.get(tab);
    try {
      const response = await options.activation.start(tab, { allowInjection });
      if (!current(value, epoch, connection) || !value.pending.has(pending)) return;
      const state = remember(value, response.state, previous);
      await render(id, tab, epoch, version, fromState(id, state));
    } finally { value.pending.delete(pending); }
  };
  const command = async (id: number, token: number, operation: SidebarOperation): Promise<void> => {
    const value = get(id);
    const epoch = value.epoch;
    if (!current(value, epoch, token)) throw new Error('Sidebar connection is no longer active.');
    if (operation === 'query') return refresh(id);
    const version = ++value.viewVersion;
    let active: Tab | undefined;
    try {
      active = await options.getActiveTab(id);
      if (!current(value, epoch, token)) return;
      if (!active || active.windowId !== id) return;
      if (operation === 'stop') {
        for (const pending of value.pending) if (pending.tabId === active.id) value.pending.delete(pending);
        const response = await stop(value, active.id);
        if (!current(value, epoch, token)) return;
        value.owned.delete(active.id);
        const state = remember(value, response.state, value.known.get(active.id));
        await render(id, active.id, epoch, version, fromState(id, state));
      } else {
        // Discovery proves an existing receiver; additionally forbid injection
        // inside activation in case navigation races this initial query.
        const pending: Pending = { tabId: active.id };
        value.pending.add(pending);
        try {
          const state = await query(id, active.id, epoch);
          if (!state || state.status === 'unavailable') return;
          await mutate(id, active.id, epoch, token, version, false, pending);
        } finally { value.pending.delete(pending); }
      }
    } catch (error) { await showFailure(id, active?.id, epoch, version, error); }
  };
  const openAndStart = async (id: number, tab: number, open: () => Promise<void>): Promise<void> => {
    const value = get(id);
    value.closed = false;
    const epoch = value.epoch;
    const version = ++value.viewVersion;
    const pending: Pending = { tabId: tab };
    value.pending.add(pending);
    try {
      const opening = open(); // No await before the gesture-dependent call.
      await opening;
      if (!current(value, epoch) || !value.pending.has(pending)) return;
      const connection = await waitForConnection(value, epoch);
      await value.cleanup;
      if (!current(value, epoch, connection.id) || !value.pending.has(pending)) return;
      const actual = await options.getTab(tab);
      if (!actual || actual.windowId !== id) return;
      await mutate(id, tab, epoch, connection.id, ++value.viewVersion, true, pending);
    } catch (error) {
      await showFailure(id, tab, epoch, version, error);
      if (current(value, epoch)) throw error;
    } finally { value.pending.delete(pending); }
  };
  const close = async (id: number): Promise<void> => {
    const value = get(id);
    const captured = new Set([...value.owned, ...[...value.pending].map((pending) => pending.tabId)]);
    value.epoch += 1;
    value.viewVersion += 1;
    value.closed = true;
    value.connection = undefined;
    value.pending.clear();
    value.owned.clear();
    for (const waiter of [...value.waiters]) waiter.reject(new Error('Sidebar was closed.'));
    const stopOwned = async (tab: number) => {
      const actual = await options.getTab(tab);
      if (actual?.windowId !== id) return;
      try {
        const response = await stop(value, tab);
        value.known.set(tab, response.state);
      } catch (error) { if (!missing(error)) throw error; }
    };
    // Stop known pending work without waiting for a slower full-window sweep.
    const immediate = Promise.all([...captured].map(stopOwned));
    const previous = value.cleanup;
    const cleanup = Promise.all([
      previous.catch(() => undefined), immediate,
      options.getTabs(id).then((tabs) => Promise.all(tabs.filter((tab) => tab.windowId === id && !captured.has(tab.id)).map((tab) => stopOwned(tab.id)))),
    ]).then(() => undefined);
    value.cleanup = cleanup;
    void cleanup.catch(() => undefined);
    await cleanup;
  };
  const navigated = async (tab: number, id: number): Promise<void> => {
    const value = get(id);
    const pending = [...value.pending].filter((item) => item.tabId === tab);
    for (const item of pending) value.pending.delete(item);
    const shouldStop = value.owned.delete(tab) || pending.length > 0;
    value.known.delete(tab);
    if (shouldStop) {
      try { await stop(value, tab); } catch (error) { if (!missing(error)) throw error; }
    }
    await refresh(id);
  };
  const stateChanged = async (state: InspectionState, sender: { tabId: number; windowId: number }): Promise<void> => {
    if (state.identity.tabId !== sender.tabId) return;
    const value = get(sender.windowId);
    const epoch = value.epoch;
    const actual = await options.getTab(sender.tabId);
    if (value.epoch !== epoch || actual?.windowId !== sender.windowId) return;
    if (value.closed) {
      if (state.status === 'active' || state.status === 'pending') {
        try { await stop(value, sender.tabId); } catch (error) { if (!missing(error)) throw error; }
      }
      return;
    }
    const known = value.known.get(sender.tabId);
    if (known && known.identity.documentId !== state.identity.documentId) {
      // Verify a new document through the receiver, not a delayed state event.
      await refresh(sender.windowId);
      return;
    }
    if (known && known.revision >= state.revision) return;
    const accepted = remember(value, state, known);
    await render(sender.windowId, sender.tabId, epoch, value.viewVersion, fromState(sender.windowId, accepted));
  };
  return { connect, command, openAndStart, refresh, close, navigated, stateChanged };
}
