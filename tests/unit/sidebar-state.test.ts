import { describe, expect, it } from 'vitest';
import {
  acceptSidebarEditAck,
  acceptSidebarView,
  beginSidebarCommand,
  beginSidebarConnection,
  createSidebarState,
  failSidebarConnection,
  getSidebarPresentation,
  retireSidebarConnection,
  setSidebarWindow,
  type SidebarState,
} from '../../apps/extension/lib/sidebar-state';
import type { SidebarView } from '../../apps/extension/lib/sidebar-controller';

const guard = { epoch: 1, token: 1 };
const selection = (id: string) => ({
  selectionId: id,
  tagName: 'div',
  box: { left: 0, top: 0, width: 10, height: 10 },
  computedStyle: { padding: { top: '1px', right: '2px', bottom: '3px', left: '4px' } },
});

function connected(): SidebarState {
  return beginSidebarConnection(createSidebarState(9), guard);
}

function view(status: SidebarView['status'], tabId = 3, revision = 1, documentId = 'doc-a'): SidebarView {
  return {
    windowId: 9,
    tabId,
    status,
    canStart: status === 'inactive' || status === 'error',
    state: {
      status,
      revision,
      identity: { tabId, documentId, requestId: `request-${revision}` },
    },
  };
}

function withView(next: SidebarView): SidebarState {
  return acceptSidebarView(connected(), next, guard);
}

describe('sidebar state presentation', () => {
  it.each([
    ['pending', undefined, 'Working…'],
    ['active', view('active'), 'Inspection active'],
    ['inactive', view('inactive'), 'Inspection is stopped'],
    ['unavailable', { ...view('unavailable'), error: 'Use the toolbar.' }, 'Inspection unavailable'],
    ['error', { ...view('error'), error: 'Inspection failed.' }, 'Inspection error'],
  ])('presents %s from acknowledged state', (name, acknowledged, label) => {
    const state = acknowledged === undefined ? connected() : withView(acknowledged);
    expect(getSidebarPresentation(state).status).toBe(name);
    expect(getSidebarPresentation(state).statusLabel).toBe(label);
  });

  it('keeps authorization and action boundaries explicit', () => {
    const inactive = getSidebarPresentation(withView(view('inactive'))).actions;
    expect(inactive.canStart).toBe(true);
    expect(inactive.canStop).toBe(false);
    expect(inactive.canRefresh).toBe(true);

    const active = getSidebarPresentation(withView(view('active'))).actions;
    expect(active.canStart).toBe(false);
    expect(active.canStop).toBe(true);
  });

  it('uses acknowledged state for the Active toggle while commands are pending', () => {
    const inactive = getSidebarPresentation(withView(view('inactive')));
    expect(inactive.status).not.toBe('active');
    expect(inactive.actions.canStart).toBe(true);
    expect(inactive.actions.canStop).toBe(false);

    const starting = beginSidebarCommand(withView(view('inactive')), 'start');
    const startingPresentation = getSidebarPresentation(starting);
    expect(startingPresentation.status).toBe('pending');
    expect(startingPresentation.status).not.toBe('active');
    expect(startingPresentation.actions.canStart).toBe(false);

    const active = getSidebarPresentation(withView(view('active')));
    expect(active.status).toBe('active');
    expect(active.actions.canStart).toBe(false);
    expect(active.actions.canStop).toBe(true);

    const stopping = beginSidebarCommand(withView(view('active')), 'stop');
    expect(getSidebarPresentation(stopping).status).toBe('pending');
  });

  it('allows Stop to cancel pending startup and disables conflicting pending actions', () => {
    const starting = beginSidebarCommand(withView(view('inactive')), 'start');
    expect(getSidebarPresentation(starting).actions.canStop).toBe(true);
    const stopping = beginSidebarCommand(starting, 'stop');
    expect(stopping.pending).toBe('stop');

    const actions = getSidebarPresentation(stopping).actions;
    expect(actions.canStop).toBe(false);
    expect(actions.canStart).toBe(false);
    expect(actions.canRefresh).toBe(false);
  });

  it('guides missing access to the toolbar without offering Start', () => {
    const unavailable = withView({ ...view('unavailable'), error: 'Browser page.' });
    const presentation = getSidebarPresentation(unavailable);
    expect(presentation.guidance).toBe('Browser page.');
    expect(presentation.actions.canStart).toBe(false);
    expect(presentation.actions.canRefresh).toBe(true);
  });

  it('refresh/retry only enters query or reconnect state and never starts', () => {
    const failed = failSidebarConnection(connected(), 'Background unavailable.', guard);
    expect(getSidebarPresentation(failed).actions.canRefresh).toBe(true);
    const reopened = beginSidebarConnection(failed, { epoch: 2, token: 2 });
    expect(reopened.pending).toBe('connect');
    expect(reopened.view).toBeUndefined();

    const queried = beginSidebarCommand(withView(view('inactive')), 'query');
    expect(queried.pending).toBe('query');
    expect(queried.view?.status).toBe('inactive');
    expect(getSidebarPresentation(queried).status).toBe('pending');
  });

  it('reconciles an edit acknowledgement before its lifecycle state event', () => {
    const initial = view('active', 3, 2);
    const selected = selection('selected');
    const current = withView({ ...initial, selection: selected, state: { ...initial.state!, selection: selected } });
    const acknowledged = selection('selected');
    acknowledged.computedStyle.padding.top = '8px';
    const next = acceptSidebarEditAck(current, {
      kind: 'visual-debug:style-edit', ok: true, tabId: 3, documentId: 'doc-a', selectionId: 'selected',
      editId: 'edit-top', property: 'padding', sides: { top: 8 },
      state: { ...current.view!.state!, revision: 3, selection: acknowledged },
    }, guard);
    expect(next.view?.state?.revision).toBe(3);
    expect(next.view?.selection?.computedStyle.padding.top).toBe('8px');
  });

  it('ignores a stale rejected acknowledgement without changing selection', () => {
    const old = selection('old');
    const currentSelection = selection('current');
    const currentView = view('active', 3, 5);
    const current = withView({ ...currentView, selection: currentSelection, state: { ...currentView.state!, selection: currentSelection } });
    const next = acceptSidebarEditAck(current, {
      kind: 'visual-debug:style-edit', ok: false, tabId: 3, documentId: 'doc-a', selectionId: 'old',
      editId: 'edit-old', property: 'padding', sides: { top: 4 }, error: 'The selected element is no longer current.',
      state: { ...current.view!.state!, revision: 6, selection: old },
    }, guard);
    expect(next).toBe(current);
    expect(next.view?.selection?.selectionId).toBe('current');
  });

  it('keeps selection snapshots aligned with the newest document revision', () => {
    const first = withView({ ...view('active', 3, 2), selection: selection('first'), state: {
      ...view('active', 3, 2).state!, selection: selection('first'),
    } });
    const older = acceptSidebarView(first, { ...view('active', 3, 1), selection: selection('older'), state: {
      ...view('active', 3, 1).state!, selection: selection('older'),
    } }, guard);
    expect(older).toBe(first);
    const newer = acceptSidebarView(first, { ...view('active', 3, 3), selection: selection('newer'), state: {
      ...view('active', 3, 3).state!, selection: selection('newer'),
    } }, guard);
    expect(newer.view?.selection?.selectionId).toBe('newer');
  });

  it('ignores retired connection views and older revisions in one document', () => {
    const retired = retireSidebarConnection(connected(), guard, 'Connection lost.');
    const oldConnection = acceptSidebarView(retired, view('active'), guard);
    expect(oldConnection).toBe(retired);

    const current = withView(view('active', 3, 4));
    const older = acceptSidebarView(current, view('inactive', 3, 3), guard);
    expect(older).toBe(current);
  });

  it('renders failed connections as errors and ignores obsolete failure callbacks', () => {
    const failed = failSidebarConnection(connected(), 'Offline', guard);
    expect(getSidebarPresentation(failed).status).toBe('error');
    expect(getSidebarPresentation(failed).actions.refreshLabel).toBe('Retry connection');
    const newer = beginSidebarConnection(failed, { epoch: 2, token: 2 });
    expect(failSidebarConnection(newer, 'old failure', guard)).toBe(newer);
    expect(retireSidebarConnection(newer, guard, 'old disconnect')).toBe(newer);
  });

  it('keeps Stop pending across late startup acknowledgements until stopped', () => {
    const starting = beginSidebarCommand(withView(view('inactive')), 'start');
    const stopping = beginSidebarCommand(starting, 'stop');
    const lateActive = acceptSidebarView(stopping, view('active', 3, 2), guard);
    expect(lateActive.pending).toBe('stop');
    expect(getSidebarPresentation(lateActive).status).toBe('pending');
    expect(getSidebarPresentation(lateActive).actions.canStop).toBe(false);
    const stopped = acceptSidebarView(lateActive, view('inactive', 3, 3), guard);
    expect(stopped.pending).toBeUndefined();
    expect(getSidebarPresentation(stopped).actions.canStart).toBe(true);
  });

  it('does not carry an old tab or document cancellation into a replacement', () => {
    const stopping = beginSidebarCommand(withView(view('active')), 'stop');
    expect(acceptSidebarView(stopping, view('inactive', 4), guard).pending).toBeUndefined();
    const replacement = acceptSidebarView(stopping, view('active', 3, 0, 'replacement'), guard);
    expect(replacement.pending).toBeUndefined();
    expect(getSidebarPresentation(replacement).status).toBe('active');
  });

  it('hides stale retry errors while pending and does not duplicate authorization guidance', () => {
    const failed = withView({ ...view('error'), error: 'Old failure' });
    const querying = beginSidebarCommand(failed, 'query');
    expect(getSidebarPresentation(querying).status).toBe('pending');
    expect(getSidebarPresentation(querying).error).toBeUndefined();
    const missing = withView({ ...view('unavailable'), error: 'Use the toolbar' });
    expect(getSidebarPresentation(missing).guidance).toBe('Use the toolbar');
    expect(getSidebarPresentation(missing).error).toBeUndefined();
  });

  it('clears previous-window state and rejects the wrong window', () => {
    const failed = failSidebarConnection(connected(), 'Old window', guard);
    const changed = setSidebarWindow(failed, 10);
    expect(changed.view).toBeUndefined();
    expect(changed.connectionError).toBeUndefined();
    expect(acceptSidebarView(connected(), { ...view('active'), windowId: 10 }, guard)).toEqual(connected());
  });

  it('clears errors when a new tab or matching acknowledged state arrives', () => {
    const failed = withView({ ...view('error', 3), error: 'Failed.' });
    const newTab = acceptSidebarView(failed, view('inactive', 4), guard);
    expect(newTab.view?.tabId).toBe(4);
    expect(newTab.view?.error).toBeUndefined();

    const matching = acceptSidebarView(failed, view('inactive', 3, 2), guard);
    expect(matching.view?.status).toBe('inactive');
    expect(matching.view?.error).toBeUndefined();
    expect(matching.connectionError).toBeUndefined();
  });
});
