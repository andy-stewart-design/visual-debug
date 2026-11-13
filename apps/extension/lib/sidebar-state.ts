import type { InspectionStatus, StyleEditResponse } from './inspection-protocol';
import type { SidebarView } from './sidebar-controller';

export type SidebarCommand = 'start' | 'stop' | 'query';
export type SidebarPending = SidebarCommand | 'connect';

export interface SidebarConnectionGuard {
  epoch: number;
  token: number;
}

export interface SidebarState {
  windowId?: number;
  epoch: number;
  token?: number;
  view?: SidebarView;
  pending?: SidebarPending;
  connectionError?: string;
}

export interface SidebarActions {
  canStart: boolean;
  canStop: boolean;
  canRefresh: boolean;
  startLabel: string;
  stopLabel: string;
  refreshLabel: string;
}

export interface SidebarPresentation {
  status: InspectionStatus;
  statusLabel: string;
  error?: string;
  guidance?: string;
  view?: SidebarView;
  actions: SidebarActions;
}

export const MISSING_ACCESS_GUIDANCE =
  'Allow this extension site access in the browser, then click Start (or the extension toolbar button). Browser-internal pages cannot be inspected.';

export function createSidebarState(windowId?: number): SidebarState {
  return { windowId, epoch: 0 };
}

export function setSidebarWindow(state: SidebarState, windowId: number): SidebarState {
  if (state.windowId === windowId) return state;
  const pending = state.pending ?? (state.token === undefined ? undefined : 'connect');
  return {
    ...state,
    windowId,
    view: undefined,
    connectionError: undefined,
    ...(pending === undefined ? {} : { pending }),
  };
}

export function beginSidebarConnection(
  state: SidebarState,
  guard: SidebarConnectionGuard,
): SidebarState {
  return {
    ...state,
    epoch: guard.epoch,
    token: guard.token,
    view: undefined,
    pending: 'connect',
    connectionError: undefined,
  };
}

export function failSidebarConnection(
  state: SidebarState,
  error: string,
  guard: SidebarConnectionGuard,
): SidebarState {
  if (state.epoch !== guard.epoch || state.token !== guard.token) return state;
  return { ...state, token: undefined, pending: undefined, view: undefined, connectionError: error };
}

export function retireSidebarConnection(
  state: SidebarState,
  guard: SidebarConnectionGuard,
  error?: string,
): SidebarState {
  if (state.epoch !== guard.epoch || state.token !== guard.token) return state;
  return {
    ...state,
    token: undefined,
    view: undefined,
    pending: undefined,
    ...(error === undefined ? { connectionError: undefined } : { connectionError: error }),
  };
}

function sameDocument(left: SidebarView | undefined, right: SidebarView): boolean {
  return left?.tabId === right.tabId && left?.state?.identity.documentId === right.state?.identity.documentId;
}

/**
 * Accept only a view from the current port/window. Background routing owns the
 * tab/document identity; this reducer only rejects retired callbacks and older
 * revisions within the same document.
 */
export function acceptSidebarView(
  state: SidebarState,
  view: SidebarView,
  guard: SidebarConnectionGuard,
): SidebarState {
  if (state.windowId === undefined || view.windowId !== state.windowId) return state;
  if (state.epoch !== guard.epoch || state.token !== guard.token) return state;
  const previous = state.view;
  if (sameDocument(previous, view) && previous?.state && view.state &&
    previous.state.revision > view.state.revision) return state;
  const sameTab = previous?.tabId !== undefined && previous.tabId === view.tabId &&
    (!previous.state || !view.state || previous.state.identity.documentId === view.state.identity.documentId);
  // An acknowledgement of startup is not an acknowledgement of the Stop that
  // followed it. Preserve cancellation intent until stopped or failed.
  const pending = sameTab && state.pending === 'stop' &&
    (view.status === 'active' || view.status === 'pending') ? 'stop' :
    sameTab && state.pending === 'start' && view.status === 'pending' ? 'start' : undefined;
  return { ...state, view, pending, connectionError: undefined };
}

/**
 * Apply the state carried by an edit acknowledgement only when the
 * acknowledgement still belongs to the selected tab, document, and element.
 * Unlike a lifecycle view, an acknowledgement is not allowed to establish a
 * replacement active target: it may have been queued before a tab/document or
 * selection change.
 */
export function acceptSidebarEditAck(
  state: SidebarState,
  response: StyleEditResponse,
  guard: SidebarConnectionGuard,
): SidebarState {
  const current = state.view;
  const currentState = current?.state;
  const acknowledged = response.state;
  if (state.windowId === undefined || current === undefined || currentState === undefined || acknowledged === undefined ||
    current.tabId !== response.tabId || currentState.identity.documentId !== response.documentId ||
    acknowledged.identity.tabId !== response.tabId || acknowledged.identity.documentId !== response.documentId) return state;
  const currentSelection = current.selection ?? currentState.selection;
  if (currentSelection?.selectionId !== response.selectionId) return state;
  // Rejected edits may carry an inactive/error state without a selection. An
  // active state must still describe the element targeted by this edit.
  if (acknowledged.status === 'active' && acknowledged.selection?.selectionId !== response.selectionId) return state;
  const view: SidebarView = {
    windowId: state.windowId,
    tabId: acknowledged.identity.tabId,
    status: acknowledged.status,
    canStart: acknowledged.status === 'inactive' || acknowledged.status === 'error',
    ...(acknowledged.selection === undefined ? {} : { selection: acknowledged.selection }),
    state: acknowledged,
    ...(acknowledged.error === undefined ? {} : { error: acknowledged.error }),
  };
  return acceptSidebarView(state, view, guard);
}

export function beginSidebarCommand(state: SidebarState, command: SidebarCommand): SidebarState {
  const actions = getSidebarPresentation(state).actions;
  if (command === 'start' && !actions.canStart) return state;
  if (command === 'stop' && !actions.canStop) return state;
  if (command === 'query' && !actions.canRefresh) return state;
  return { ...state, pending: command, connectionError: undefined };
}

function statusFor(state: SidebarState): InspectionStatus {
  if (state.pending !== undefined) return 'pending';
  if (state.connectionError !== undefined) return 'error';
  return state.view?.status ?? 'pending';
}

function statusLabel(status: InspectionStatus): string {
  switch (status) {
    case 'active': return 'Inspection active';
    case 'inactive': return 'Inspection is stopped';
    case 'pending': return 'Working…';
    case 'unavailable': return 'Inspection unavailable';
    case 'error': return 'Inspection error';
  }
}

export function getSidebarPresentation(state: SidebarState): SidebarPresentation {
  const status = statusFor(state);
  const view = state.view;
  const knownTab = view?.tabId !== undefined;
  const stopping = state.pending === 'stop';
  const busy = state.pending !== undefined;
  const canStop = state.token !== undefined && !stopping && knownTab &&
    (state.pending === 'start' || (!busy && (view?.status === 'active' || view?.status === 'pending')));
  const canStart = state.token !== undefined && !busy && view?.canStart === true && view.status !== 'pending' && view.status !== 'unavailable';
  const canRefresh = !busy && (state.token !== undefined || state.connectionError !== undefined) &&
    view?.status !== 'pending';
  const error = busy ? undefined : state.connectionError ?? (status === 'unavailable' ? undefined : view?.error);
  const guidance = status === 'unavailable' ? (view?.error || MISSING_ACCESS_GUIDANCE) : undefined;

  return {
    status,
    statusLabel: statusLabel(status),
    ...(error === undefined ? {} : { error }),
    ...(guidance === undefined ? {} : { guidance }),
    view,
    actions: {
      canStart,
      canStop,
      canRefresh,
      startLabel: 'Start/restart',
      stopLabel: 'Stop/Exit',
      refreshLabel: state.connectionError ? 'Retry connection' : 'Refresh status',
    },
  };
}