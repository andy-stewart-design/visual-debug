import { describe, expect, it, vi } from 'vitest';
import { createSidebarController, validateSidebarView, type SidebarView } from '../../apps/extension/lib/sidebar-controller';
import { createInspectionController, type ControllerSession } from '../../apps/extension/lib/inspection-controller';
import { makeRequest, type InspectionResponse, type InspectionState } from '../../apps/extension/lib/inspection-protocol';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function session(onDisposed?: () => void): ControllerSession {
  let disposed = false;
  return { get isDisposed() { return disposed; }, dispose() { if (!disposed) { disposed = true; onDisposed?.(); } } };
}
function setup() {
  const tabs = new Map([[7, { id: 7, windowId: 1 }], [8, { id: 8, windowId: 1 }], [9, { id: 9, windowId: 2 }]]);
  const active = new Map([[1, 7], [2, 9]]);
  const factory = vi.fn(async (onDisposed: () => void, _signal: AbortSignal) => session(onDisposed));
  const pages = new Map([7, 8, 9].map((id) => [id, createInspectionController({ tabId: id, documentId: `doc-${id}`, createSession: factory })]));
  let requestId = 0;
  const execute = async (id: number, operation: 'start' | 'stop' | 'query') => {
    const page = pages.get(id);
    if (!page) throw new Error('Receiving end does not exist.');
    return page.handle(makeRequest(operation, id, `r-${++requestId}`));
  };
  const activation = {
    start: vi.fn((id: number, _options?: { allowInjection?: boolean }) => execute(id, 'start')),
    stop: vi.fn((id: number) => execute(id, 'stop')),
    query: vi.fn((id: number) => execute(id, 'query')),
  };
  const getActiveTab = vi.fn(async (windowId: number) => tabs.get(active.get(windowId) ?? -1));
  const getTabs = vi.fn(async (windowId: number) => [...tabs.values()].filter((tab) => tab.windowId === windowId));
  const getTab = vi.fn(async (id: number) => tabs.get(id));
  const controller = createSidebarController({ activation, getActiveTab, getTabs, getTab, readyTimeoutMs: 20 });
  const connect = (windowId = 1) => {
    const views: SidebarView[] = [];
    const connection = controller.connect(windowId, (view) => views.push(view));
    return { views, connection };
  };
  return { controller, activation, tabs, active, pages, factory, getActiveTab, getTabs, getTab, connect };
}
async function tick() { await new Promise((resolve) => setTimeout(resolve, 0)); }

function state(tabId: number, status: InspectionState['status'], revision: number, documentId = `doc-${tabId}`): InspectionState {
  return { identity: { tabId, documentId, requestId: `event-${revision}` }, status, revision };
}
function response(value: InspectionState): InspectionResponse {
  return { kind: 'visual-debug:inspection', operation: 'query', ok: true, identity: value.identity, state: value };
}

describe('sidebar controller', () => {
  it('validates the complete view and preserves its identity', () => {
    const view = { windowId: 1, tabId: 7, status: 'inactive', canStart: true, state: state(7, 'inactive', 1), extra: 'kept' };
    expect(validateSidebarView(view)).toBe(view);
    for (const bad of [null, { ...view, status: 'bad' }, { ...view, canStart: 1 }, { ...view, state: state(8, 'active', 1) }]) {
      expect(validateSidebarView(bad)).toBeUndefined();
    }
  });

  it('opens synchronously, then starts only once the real panel is connected', async () => {
    const { controller, activation, connect } = setup();
    let opened = false;
    const starting = controller.openAndStart(1, 7, async () => { opened = true; connect(); });
    expect(opened).toBe(true);
    expect(activation.start).not.toHaveBeenCalled();
    await starting;
    expect(activation.start).toHaveBeenCalledWith(7, { allowInjection: true });
    await controller.openAndStart(1, 7, async () => undefined);
    expect(activation.start).toHaveBeenCalledTimes(2); // content start is idempotent
  });

  it('does not start if opening fails or the panel never becomes ready', async () => {
    const { controller, activation } = setup();
    await expect(controller.openAndStart(1, 7, async () => { throw new Error('blocked'); })).rejects.toThrow('blocked');
    await expect(controller.openAndStart(1, 7, async () => undefined)).rejects.toThrow('Timed out');
    expect(activation.start).not.toHaveBeenCalled();
  });

  it('cancels an opening attempt when the user closes before readiness', async () => {
    const { controller, activation } = setup();
    const opening = deferred<void>();
    const starting = controller.openAndStart(1, 7, () => opening.promise);
    await controller.close(1);
    opening.resolve();
    await starting;
    expect(activation.start).not.toHaveBeenCalled();
  });

  it('stops a factory pending in the content controller and disposes its late result', async () => {
    const { controller, factory, pages, activation, connect } = setup();
    const pending = deferred<ControllerSession>();
    let signal!: AbortSignal;
    factory.mockImplementation(async (_onDisposed, abort) => { signal = abort; return pending.promise; });
    const starting = controller.openAndStart(1, 7, async () => { connect(); });
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce());
    await controller.close(1);
    expect(signal.aborted).toBe(true);
    expect(activation.stop).toHaveBeenCalledWith(7);
    const late = session();
    pending.resolve(late);
    await starting;
    expect(late.isDisposed).toBe(true);
    expect(pages.get(7)?.getState().status).toBe('inactive');
  });

  it('never grants access or starts when the sidebar query has no receiver', async () => {
    const { controller, activation, pages, connect } = setup();
    pages.delete(7);
    const { connection, views } = connect();
    await controller.command(1, connection.id, 'start');
    expect(activation.start).not.toHaveBeenCalled();
    expect(views.at(-1)?.status).toBe('unavailable');
    expect(views.at(-1)?.error).toContain('toolbar');
  });

  it('a stop cancels a sidebar start whose initial discovery is still pending', async () => {
    const { controller, activation, connect } = setup();
    const { connection } = connect();
    await tick();
    const discovery = deferred<InspectionResponse>();
    activation.query.mockImplementationOnce(() => discovery.promise);
    const starting = controller.command(1, connection.id, 'start');
    await vi.waitFor(() => expect(activation.query).toHaveBeenCalledTimes(2));
    await controller.command(1, connection.id, 'stop');
    discovery.resolve(response(state(7, 'inactive', 1)));
    await starting;
    expect(activation.start).not.toHaveBeenCalled();
  });

  it('starts an existing receiver without permission to inject after a query race', async () => {
    const { controller, activation, connect } = setup();
    const { connection } = connect();
    await controller.command(1, connection.id, 'start');
    expect(activation.start).toHaveBeenCalledWith(7, { allowInjection: false });
  });

  it('clears a query error when a matching retry succeeds', async () => {
    const { controller, activation, connect } = setup();
    const { connection, views } = connect();
    await tick();
    activation.query.mockRejectedValueOnce(new Error('temporary transport failure'));
    await controller.command(1, connection.id, 'query');
    expect(views.at(-1)?.status).toBe('error');
    await controller.command(1, connection.id, 'start');
    expect(activation.start).toHaveBeenCalledWith(7, { allowInjection: false });
    expect(views.at(-1)?.status).toBe('active');
    expect(views.at(-1)?.error).toBeUndefined();
  });

  it('resolves the active tab on each command and does not autoactivate on switching', async () => {
    const { controller, activation, active, connect } = setup();
    const { connection, views } = connect();
    await controller.openAndStart(1, 7, async () => undefined);
    active.set(1, 8);
    await controller.refresh(1);
    expect(views.at(-1)?.tabId).toBe(8);
    expect(activation.start).toHaveBeenCalledTimes(1);
    await controller.command(1, connection.id, 'stop');
    expect(activation.stop).toHaveBeenLastCalledWith(8);
  });

  it('does not publish a delayed query for a tab the user left', async () => {
    const { controller, activation, active, connect } = setup();
    const { views } = connect();
    await tick();
    const pending = deferred<InspectionResponse>();
    activation.query.mockImplementationOnce(() => pending.promise);
    const oldRefresh = controller.refresh(1);
    await vi.waitFor(() => expect(activation.query).toHaveBeenCalledTimes(2));
    active.set(1, 8);
    await controller.refresh(1);
    pending.resolve(response(state(7, 'active', 10)));
    await oldRefresh;
    expect(views.at(-1)?.tabId).toBe(8);
    expect(views.at(-1)?.status).toBe('inactive');
  });

  it('does not let a delayed tab failure replace the newly active tab', async () => {
    const { controller, activation, active, connect } = setup();
    const { views } = connect();
    await tick();
    const pending = deferred<InspectionResponse>();
    activation.query.mockImplementationOnce(() => pending.promise);
    const oldRefresh = controller.refresh(1);
    await vi.waitFor(() => expect(activation.query).toHaveBeenCalledTimes(2));
    active.set(1, 8);
    await controller.refresh(1);
    pending.reject(new Error('old tab failed'));
    await oldRefresh;
    expect(views.at(-1)?.tabId).toBe(8);
    expect(views.at(-1)?.status).toBe('inactive');
    expect(views.at(-1)?.error).toBeUndefined();
  });

  it('does not let a delayed query failure hide acknowledged Escape state', async () => {
    const { controller, activation, connect } = setup();
    const { views } = connect();
    await tick();
    const pending = deferred<InspectionResponse>();
    activation.query.mockImplementationOnce(() => pending.promise);
    const oldRefresh = controller.refresh(1);
    await vi.waitFor(() => expect(activation.query).toHaveBeenCalledTimes(2));
    await controller.stateChanged(state(7, 'active', 2), { tabId: 7, windowId: 1 });
    await controller.stateChanged(state(7, 'inactive', 3), { tabId: 7, windowId: 1 });
    pending.reject(new Error('stale query failed'));
    await oldRefresh;
    expect(views.at(-1)?.status).toBe('inactive');
    expect(views.at(-1)?.state?.revision).toBe(3);
    expect(views.at(-1)?.error).toBeUndefined();
  });

  it('old connections cannot issue commands or disconnect replacements', async () => {
    const { controller, connect } = setup();
    const old = connect().connection;
    const fresh = connect().connection;
    old.disconnect();
    await expect(controller.command(1, old.id, 'start')).rejects.toThrow('no longer active');
    await controller.command(1, fresh.id, 'query');
    await expect(controller.command(2, fresh.id, 'start')).rejects.toThrow('no longer active');
  });

  it('reconnecting and reopening query state without starting inspection', async () => {
    const { controller, activation, connect } = setup();
    connect().connection.disconnect();
    connect();
    await tick();
    await controller.close(1);
    const { views } = connect();
    await controller.refresh(1);
    expect(views.at(-1)?.status).toBe('inactive');
    expect(activation.start).not.toHaveBeenCalled();
  });

  it('closes all retained and untracked tabs in one window, not another window', async () => {
    const { controller, activation, active, pages, connect } = setup();
    connect(1); connect(2);
    await controller.openAndStart(1, 7, async () => undefined);
    active.set(1, 8);
    await controller.openAndStart(1, 8, async () => undefined);
    await controller.openAndStart(2, 9, async () => undefined);
    await controller.close(1);
    expect(pages.get(7)?.getState().status).toBe('inactive');
    expect(pages.get(8)?.getState().status).toBe('inactive');
    expect(pages.get(9)?.getState().status).toBe('active');
    expect(activation.stop).not.toHaveBeenCalledWith(9);
  });

  it('sweeps a window after background restart even with no tracked sessions', async () => {
    const { controller, pages } = setup();
    await pages.get(8)?.handle(makeRequest('start', 8, 'old-background'));
    await controller.close(1);
    expect(pages.get(8)?.getState().status).toBe('inactive');
  });

  it('does not stop a tab moved into a different window before closure', async () => {
    const { controller, pages, tabs, connect } = setup();
    connect();
    await controller.openAndStart(1, 7, async () => undefined);
    tabs.set(7, { id: 7, windowId: 2 });
    await controller.close(1);
    expect(pages.get(7)?.getState().status).toBe('active');
  });

  it('starts stopping known pending work before a slow untracked sweep completes', async () => {
    const { controller, factory, getTabs, activation, connect } = setup();
    const pending = deferred<ControllerSession>();
    factory.mockImplementation(async () => pending.promise);
    const starting = controller.openAndStart(1, 7, async () => { connect(); });
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce());
    const sweep = deferred<Array<{ id: number; windowId: number }>>();
    getTabs.mockImplementationOnce(() => sweep.promise);
    const closing = controller.close(1);
    await vi.waitFor(() => expect(activation.stop).toHaveBeenCalledWith(7));
    sweep.resolve([]);
    await closing;
    pending.resolve(session());
    await starting;
  });

  it('serializes cleanup before a reopened toolbar start', async () => {
    const { controller, activation, connect, pages } = setup();
    const held = deferred<void>();
    const realStop = activation.stop.getMockImplementation()!;
    activation.stop.mockImplementation(async (id) => { await held.promise; return realStop(id); });
    const closing = controller.close(1);
    const reopening = controller.openAndStart(1, 7, async () => { connect(); });
    await tick();
    expect(activation.start).not.toHaveBeenCalled();
    held.resolve();
    await closing; await reopening;
    expect(pages.get(7)?.getState().status).toBe('active');
  });

  it('surfaces unexpected shutdown errors rather than claiming successful cleanup', async () => {
    const { controller, activation } = setup();
    activation.stop.mockRejectedValue(new Error('transport failure'));
    await expect(controller.close(1)).rejects.toThrow('transport failure');
  });

  it('handles navigation without autoresume, including a pending factory', async () => {
    const { controller, factory, activation, connect } = setup();
    const pending = deferred<ControllerSession>();
    factory.mockImplementation(async () => pending.promise);
    const starting = controller.openAndStart(1, 7, async () => { connect(); });
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce());
    await controller.navigated(7, 1);
    const late = session(); pending.resolve(late);
    await starting;
    expect(late.isDisposed).toBe(true);
    expect(activation.start).toHaveBeenCalledOnce();
  });

  it('reflects Escape, ignores stale revisions, and verifies new documents via query', async () => {
    const { controller, activation, connect } = setup();
    const { views } = connect();
    await tick();
    await controller.stateChanged(state(7, 'active', 2), { tabId: 7, windowId: 1 });
    await controller.stateChanged(state(7, 'inactive', 3), { tabId: 7, windowId: 1 });
    await controller.stateChanged(state(7, 'active', 2), { tabId: 7, windowId: 1 });
    expect(views.at(-1)?.status).toBe('inactive');
    activation.query.mockResolvedValue(response(state(7, 'inactive', 0, 'replacement')));
    await controller.stateChanged(state(7, 'active', 100, 'old-delayed-document'), { tabId: 7, windowId: 1 });
    expect(views.at(-1)?.state?.identity.documentId).toBe('replacement');
  });

  it('does not accept an old-document event during navigation reconciliation', async () => {
    const { controller, activation, connect } = setup();
    const { views } = connect();
    await tick();
    await controller.stateChanged(state(7, 'active', 2), { tabId: 7, windowId: 1 });
    const replacement = deferred<InspectionResponse>();
    activation.query.mockImplementation(() => replacement.promise);
    const navigating = controller.navigated(7, 1);
    await vi.waitFor(() => expect(activation.query).toHaveBeenCalledTimes(2));
    const staleEvent = controller.stateChanged(state(7, 'active', 99, 'old-document'), { tabId: 7, windowId: 1 });
    await vi.waitFor(() => expect(activation.query).toHaveBeenCalledTimes(3));
    replacement.resolve(response(state(7, 'inactive', 0, 'new-document')));
    await Promise.all([navigating, staleEvent]);
    expect(views.at(-1)?.status).toBe('inactive');
    expect(views.at(-1)?.state?.identity.documentId).toBe('new-document');
  });

  it('rejects mismatched senders and never renders hidden tabs as current', async () => {
    const { controller, connect } = setup();
    const { views } = connect();
    await tick();
    await controller.stateChanged(state(8, 'active', 2), { tabId: 7, windowId: 1 });
    await controller.stateChanged(state(8, 'active', 2), { tabId: 8, windowId: 1 });
    expect(views.at(-1)?.tabId).toBe(7);
  });

  it('rechecks the acknowledgement after the failure-render active-tab lookup', async () => {
    const { controller, activation, getActiveTab, connect } = setup();
    const { views } = connect();
    await tick();
    const lookup = deferred<{ id: number; windowId: number }>();
    let reads = 0;
    getActiveTab.mockImplementation(async () => ++reads === 2 ? lookup.promise : { id: 7, windowId: 1 });
    activation.query.mockRejectedValueOnce(new Error('old transport failure'));
    const refreshing = controller.refresh(1);
    await vi.waitFor(() => expect(reads).toBe(2));
    await controller.stateChanged(state(7, 'active', 10), { tabId: 7, windowId: 1 });
    lookup.resolve({ id: 7, windowId: 1 });
    await refreshing;
    expect(views.at(-1)?.status).toBe('active');
    expect(views.at(-1)?.error).toBeUndefined();
  });

  it('shows toolbar startup failures rather than leaving the sidebar pending', async () => {
    const { controller, activation, connect } = setup();
    const { views } = connect();
    await tick();
    activation.start.mockRejectedValueOnce(new Error('injection denied'));
    await expect(controller.openAndStart(1, 7, async () => undefined)).rejects.toThrow('injection denied');
    expect(views.at(-1)?.status).toBe('error');
    expect(views.at(-1)?.error).toBe('injection denied');
  });

  it('cannot restore an old document from a query issued before navigation', async () => {
    const { controller, activation, pages, connect, factory } = setup();
    const { views } = connect();
    await tick();
    const oldQuery = deferred<InspectionResponse>();
    activation.query.mockImplementationOnce(() => oldQuery.promise);
    const refreshing = controller.refresh(1);
    await vi.waitFor(() => expect(activation.query).toHaveBeenCalledTimes(2));
    pages.set(7, createInspectionController({ tabId: 7, documentId: 'replacement', createSession: factory }));
    await controller.navigated(7, 1);
    oldQuery.resolve(response(state(7, 'active', 999)));
    await refreshing;
    activation.query.mockClear();
    await controller.stateChanged(state(7, 'active', 1, 'replacement'), { tabId: 7, windowId: 1 });
    expect(activation.query).not.toHaveBeenCalled();
    expect(views.at(-1)?.state?.identity.documentId).toBe('replacement');
    expect(views.at(-1)?.status).toBe('active');
  });

  it('stops a late active event after confirmed browser closure', async () => {
    const { controller, activation } = setup();
    await controller.close(1);
    activation.stop.mockClear();
    await controller.stateChanged(state(7, 'active', 20), { tabId: 7, windowId: 1 });
    expect(activation.stop).toHaveBeenCalledWith(7);
  });

  it('publishes the startup acknowledgement even if a passive refresh ran during startup', async () => {
    const { controller, activation, pages, connect } = setup();
    const { views } = connect();
    await tick();
    pages.delete(7);
    await controller.navigated(7, 1);
    const acknowledgement = deferred<InspectionResponse>();
    activation.start.mockImplementationOnce(() => acknowledgement.promise);
    const starting = controller.openAndStart(1, 7, async () => undefined);
    await vi.waitFor(() => expect(activation.start).toHaveBeenCalledOnce());
    activation.query.mockResolvedValueOnce(response(state(7, 'pending', 1, 'replacement')));
    await controller.refresh(1);
    expect(views.at(-1)?.status).toBe('pending');
    acknowledgement.resolve(response(state(7, 'active', 2, 'replacement')));
    await starting;
    expect(views.at(-1)?.status).toBe('active');
    expect(views.at(-1)?.state?.identity.documentId).toBe('replacement');
  });

  it('preserves a newer Escape event delivered before the replacement startup reply', async () => {
    const { controller, activation, pages, factory, connect } = setup();
    const { views } = connect();
    await tick();
    pages.delete(7);
    await controller.navigated(7, 1);
    let live!: ControllerSession;
    factory.mockImplementation(async (onDisposed) => { live = session(onDisposed); return live; });
    const events: Promise<void>[] = [];
    const replacement = createInspectionController({
      tabId: 7, documentId: 'replacement', createSession: factory,
      onState: (next) => { events.push(controller.stateChanged(next, { tabId: 7, windowId: 1 })); },
    });
    pages.set(7, replacement);
    activation.start.mockImplementationOnce(async () => {
      const reply = await replacement.handle(makeRequest('start', 7, 'start-before-escape'));
      live.dispose();
      await Promise.all(events);
      return reply;
    });
    await controller.openAndStart(1, 7, async () => undefined);
    expect(replacement.getState().status).toBe('inactive');
    expect(views.at(-1)?.status).toBe('inactive');
    expect(views.at(-1)?.state?.revision).toBe(3);
    expect(views.at(-1)?.canStart).toBe(true);
  });

  it('does not report an intentionally cancelled toolbar startup as an error', async () => {
    const { controller, activation, connect } = setup();
    const { connection, views } = connect();
    await tick();
    const pending = deferred<InspectionResponse>();
    activation.start.mockImplementationOnce(() => pending.promise);
    const starting = controller.openAndStart(1, 7, async () => undefined);
    await vi.waitFor(() => expect(activation.start).toHaveBeenCalledOnce());
    await controller.command(1, connection.id, 'stop');
    pending.reject(new Error('The inspection operation was superseded.'));
    await expect(starting).resolves.toBeUndefined();
    expect(views.at(-1)?.status).toBe('inactive');
    expect(views.at(-1)?.error).toBeUndefined();
  });

  it('recovers after reload when toolbar start and the new active event race reconciliation', async () => {
    const { controller, activation, pages, factory, connect } = setup();
    const { views } = connect();
    await controller.openAndStart(1, 7, async () => undefined);
    expect(views.at(-1)?.status).toBe('active');

    pages.delete(7);
    await controller.navigated(7, 1);
    const creation = deferred<ControllerSession>();
    factory.mockImplementation(async () => creation.promise);
    const replacement = createInspectionController({
      tabId: 7,
      documentId: 'replacement',
      createSession: factory,
      onState: (next) => { void controller.stateChanged(next, { tabId: 7, windowId: 1 }); },
    });
    pages.set(7, replacement);
    activation.query.mockRejectedValue(new Error('Receiving end does not exist.'));
    activation.start.mockImplementation(async () => replacement.handle(makeRequest('start', 7, 'toolbar-start')));

    const starting = controller.openAndStart(1, 7, async () => undefined);
    await vi.waitFor(() => expect(replacement.getState().status).toBe('pending'));
    creation.resolve(session());
    await starting;
    await vi.waitFor(() => expect(views.at(-1)?.state?.status).toBe('active'));
    expect(views.at(-1)?.status).toBe('active');
    expect(views.at(-1)?.canStart).toBe(false);
    expect(views.at(-1)?.state?.identity.documentId).toBe('replacement');
    expect(views.at(-1)?.error).toBeUndefined();
  });
});
