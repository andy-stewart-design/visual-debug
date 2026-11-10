import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInspectionController, type ControllerSession } from '../../apps/extension/lib/inspection-controller';
import { INSPECTION_STATE_MESSAGE, LEGACY_TOGGLE_MESSAGE, makeRequest } from '../../apps/extension/lib/inspection-protocol';

const wiring = vi.hoisted(() => {
  const api = { addListener: vi.fn(), removeListener: vi.fn(), sendMessage: vi.fn(), createSession: vi.fn() };
  vi.stubGlobal('browser', { runtime: {
    id: 'extension', onMessage: { addListener: api.addListener, removeListener: api.removeListener }, sendMessage: api.sendMessage,
  } });
  return api;
});
vi.mock('wxt/utils/define-content-script', () => ({ defineContentScript: (definition: unknown) => definition }));
vi.mock('../../apps/extension/lib/session', () => ({ createInspectionSession: wiring.createSession }));
import content from '../../apps/extension/entrypoints/inspect.content';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function session(onDispose?: () => void): ControllerSession {
  let disposed = false;
  return {
    get isDisposed() { return disposed; },
    dispose() { if (!disposed) { disposed = true; onDispose?.(); } },
  };
}
const request = (operation: 'start' | 'stop' | 'query' | 'toggle', id: string, documentId?: string) => makeRequest(operation, 7, id, documentId);
const options = (createSession: (onDisposed: () => void, signal: AbortSignal) => Promise<ControllerSession>) => ({ tabId: 7, documentId: 'doc-a', createSession });

describe('inspection controller', () => {
  it('queries without creation and coalesces concurrent/idempotent starts', async () => {
    const created = deferred<ControllerSession>();
    const factory = vi.fn(async () => created.promise);
    const controller = createInspectionController(options(factory));
    expect((await controller.handle(request('query', 'q'))).state.status).toBe('inactive');
    expect(factory).not.toHaveBeenCalled();
    const first = controller.handle(request('start', 'a'));
    const second = controller.handle(request('start', 'b'));
    await Promise.resolve();
    expect(factory).toHaveBeenCalledTimes(1);
    expect((await controller.handle(request('query', 'pending'))).state.status).toBe('pending');
    created.resolve(session());
    expect((await first).identity.requestId).toBe('a');
    expect((await second).state.status).toBe('active');
    expect((await controller.handle(request('start', 'c'))).state.status).toBe('active');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('aborts pending creation immediately and actually disposes its late result', async () => {
    const created = deferred<ControllerSession>();
    let signal!: AbortSignal;
    const controller = createInspectionController(options(async (_onDisposed, abort) => { signal = abort; return created.promise; }));
    const starting = controller.handle(request('start', 'start'));
    await Promise.resolve();
    expect((await controller.handle(request('stop', 'stop'))).state.status).toBe('inactive');
    expect(signal.aborted).toBe(true);
    const late = session();
    created.resolve(late);
    expect((await starting).superseded).toBe(true);
    expect(late.isDisposed).toBe(true);
    expect((await controller.handle(request('stop', 'again'))).state.status).toBe('inactive');
  });

  it('does not even run a factory cancelled before its microtask starts', async () => {
    const factory = vi.fn(async () => session());
    const controller = createInspectionController(options(factory));
    const starting = controller.handle(request('start', 'start'));
    await controller.handle(request('stop', 'stop'));
    expect((await starting).superseded).toBe(true);
    expect(factory).not.toHaveBeenCalled();
  });

  it('allows recovery while an obsolete factory is still pending', async () => {
    const old = deferred<ControllerSession>();
    const fresh = deferred<ControllerSession>();
    let calls = 0;
    const controller = createInspectionController(options(async () => (++calls === 1 ? old : fresh).promise));
    const first = controller.handle(request('start', 'old'));
    await Promise.resolve();
    await controller.handle(request('stop', 'stop'));
    const second = controller.handle(request('start', 'fresh'));
    await Promise.resolve();
    const live = session();
    fresh.resolve(live);
    expect((await second).state.status).toBe('active');
    const obsolete = session();
    old.resolve(obsolete);
    expect((await first).superseded).toBe(true);
    expect(obsolete.isDisposed).toBe(true);
    expect(live.isDisposed).toBe(false);
    expect(controller.getState().status).toBe('active');
  });

  it('reports Escape/self-disposal with increasing state revisions', async () => {
    const states: string[] = [];
    const revisions: number[] = [];
    let live!: ControllerSession;
    const controller = createInspectionController({ ...options(async (onDisposed) => { live = session(onDisposed); return live; }),
      onState: (state) => { states.push(state.status); revisions.push(state.revision); },
    });
    await controller.handle(request('start', 'start'));
    live.dispose();
    expect(states).toEqual(['pending', 'active', 'inactive']);
    expect(revisions).toEqual([1, 2, 3]);
    expect((await controller.handle(request('query', 'q'))).state.status).toBe('inactive');
    expect(states).toHaveLength(3);
  });

  it('never reports active if disposed before factory assignment', async () => {
    const controller = createInspectionController(options(async (onDisposed) => {
      const live = session(onDisposed); live.dispose(); return live;
    }));
    expect((await controller.handle(request('start', 'start'))).state.status).toBe('inactive');
  });

  it('invalidates navigation and shuts down permanently without late resurrection', async () => {
    const pending = deferred<ControllerSession>();
    const controller = createInspectionController(options(async () => pending.promise));
    const starting = controller.handle(request('start', 'nav'));
    await Promise.resolve();
    controller.invalidate('navigation');
    controller.dispose();
    const late = session();
    pending.resolve(late);
    expect((await starting).superseded).toBe(true);
    expect(late.isDisposed).toBe(true);
    expect((await controller.handle(request('start', 'after'))).ok).toBe(false);
  });

  it('rejects wrong tab/document without mutating an active session', async () => {
    const live = session();
    const controller = createInspectionController(options(async () => live));
    await controller.handle(request('start', 'good'));
    expect((await controller.handle(makeRequest('stop', 9, 'wrong-tab'))).ok).toBe(false);
    expect((await controller.handle(request('stop', 'wrong-doc', 'doc-b'))).ok).toBe(false);
    expect(live.isDisposed).toBe(false);
    expect(controller.getState().status).toBe('active');
  });

  it('reports factory failures and supports a fresh retry', async () => {
    let calls = 0;
    const controller = createInspectionController(options(async () => { if (++calls === 1) throw new Error('mount failed'); return session(); }));
    const failed = await controller.handle(request('start', 'fail'));
    expect(failed.ok).toBe(false);
    expect(failed.state.status).toBe('error');
    expect((await controller.handle(request('start', 'retry'))).state.status).toBe('active');
  });
});

describe('actual content-script wiring', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
  const setup = () => {
    vi.stubGlobal('window', new EventTarget());
    wiring.sendMessage.mockRejectedValue(new Error('no subscriber'));
    wiring.createSession.mockImplementation(async (_ctx, onDisposed) => session(onDisposed));
    let navigate!: () => void;
    let invalidate!: () => void;
    content.main({
      addEventListener: (_target: unknown, _event: unknown, callback: () => void) => { navigate = callback; },
      onInvalidated: (callback: () => void) => { invalidate = callback; },
    } as never);
    const listener = wiring.addListener.mock.calls.at(-1)![0];
    return { listener, navigate: () => navigate(), invalidate: () => invalidate() };
  };

  it('accepts real background senders and ignores malformed/foreign/content-frame messages', async () => {
    const { listener } = setup();
    expect(listener({ kind: 'unrelated' }, { id: 'extension' })).toBeUndefined();
    expect(listener(request('start', 'foreign'), { id: 'other' })).toBeUndefined();
    expect(listener(request('start', 'frame'), { id: 'extension', frameId: 1 })).toBeUndefined();
    expect(listener(request('start', 'tab'), { id: 'extension', frameId: 0, tab: { id: 7 } })).toBeUndefined();
    expect(wiring.createSession).not.toHaveBeenCalled();
    expect((await listener(request('start', 'real'), { id: 'extension' })).state.status).toBe('active');
    expect(wiring.createSession).toHaveBeenCalledTimes(1);
    expect(wiring.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: INSPECTION_STATE_MESSAGE }));
  });

  it('rotates SPA identity, rejects old commands, and allows explicit restart', async () => {
    const { listener, navigate, invalidate } = setup();
    const first = await listener(request('start', 'first'), { id: 'extension' });
    navigate();
    const stale = await listener(request('start', 'stale', first.identity.documentId), { id: 'extension' });
    expect(stale.ok).toBe(false);
    expect(wiring.createSession).toHaveBeenCalledTimes(1);
    const current = await listener(request('query', 'q'), { id: 'extension' });
    expect(current.identity.documentId).not.toBe(first.identity.documentId);
    expect(current.state.status).toBe('inactive');
    expect((await listener(request('start', 'again', current.identity.documentId), { id: 'extension' })).state.status).toBe('active');
    invalidate();
    expect(wiring.removeListener).toHaveBeenCalledWith(listener);
    expect(listener(request('start', 'shutdown'), { id: 'extension' })).toBeUndefined();
  });

  it('can initialize on an HTTP page without secure-context randomUUID', async () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal('crypto', { getRandomValues });
    const { listener } = setup();
    const result = await listener(request('query', 'http'), { id: 'extension' });
    expect(result.identity.documentId).toMatch(/^[0-9a-f]{32}$/);
    expect(wiring.createSession).not.toHaveBeenCalled();
  });

  it('retains legacy toggle response shape with an explicitly bound target', async () => {
    const { listener } = setup();
    const message = { kind: LEGACY_TOGGLE_MESSAGE, tabId: 7 };
    expect(await listener(message, { id: 'extension' })).toEqual({ kind: LEGACY_TOGGLE_MESSAGE, ok: true, active: true });
    expect(await listener(message, { id: 'extension' })).toEqual({ kind: LEGACY_TOGGLE_MESSAGE, ok: true, active: false });
  });
});
