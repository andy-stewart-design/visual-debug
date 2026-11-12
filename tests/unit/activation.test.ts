import { beforeEach, describe, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => {
  const api = { send: vi.fn(), inject: vi.fn(), badge: vi.fn(), title: vi.fn() };
  vi.stubGlobal('browser', {
    runtime: { id: 'extension' },
    tabs: { sendMessage: api.send }, scripting: { executeScript: api.inject },
    action: { onClicked: { addListener: vi.fn() }, setBadgeText: api.badge, setTitle: api.title },
  });
  return api;
});
import { createActivationController, inspectionActivation, updateActionFeedback, InspectionSupersededError, type ActivationTransport } from '../../apps/extension/lib/activation';
import { createInspectionController, type ControllerSession } from '../../apps/extension/lib/inspection-controller';
import { type InspectionRequest, type InspectionResponse, type InspectionPreviewRequest } from '../../apps/extension/lib/inspection-protocol';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}
function session(onDisposed?: () => void): ControllerSession {
  let disposed = false;
  return { get isDisposed() { return disposed; }, dispose() { if (!disposed) { disposed = true; onDisposed?.(); } } };
}
function setup(createSession = async (onDisposed: () => void, _signal: AbortSignal) => session(onDisposed)) {
  const page = createInspectionController({ tabId: 3, documentId: 'doc-a', createSession });
  const transport: ActivationTransport = {
    send: vi.fn(async (_tabId, request) => page.handle(request)), inject: vi.fn(async () => undefined),
  };
  const feedback = vi.fn(async () => undefined);
  return { page, transport, feedback, activation: createActivationController({ transport, updateFeedback: feedback }) };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('activation transport', () => {
  it('discovers the document and pins mutation to it; repeated start/stop are idempotent', async () => {
    const createSession = vi.fn(async (onDisposed) => session(onDisposed));
    const { activation, transport, page } = setup(createSession);
    expect((await activation.start(3)).state.status).toBe('active');
    expect((await activation.start(3)).state.status).toBe('active');
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(transport.send).toHaveBeenCalledWith(3, expect.objectContaining({ operation: 'start', documentId: 'doc-a' }));
    expect((await activation.stop(3)).state.status).toBe('inactive');
    expect((await activation.stop(3)).state.status).toBe('inactive');
    expect(page.getState().status).toBe('inactive');
  });

  it('injects on a missing start receiver and retries discovery without creating on query', async () => {
    const { page } = setup();
    let available = false;
    const inject = vi.fn(async () => { available = true; });
    const transport: ActivationTransport = {
      send: vi.fn(async (_tabId, request) => {
        if (!available) throw new Error('Receiving end does not exist.');
        return page.handle(request);
      }), inject,
    };
    const activation = createActivationController({ transport });
    await expect(activation.query(3)).rejects.toThrow('Receiving end');
    expect(inject).not.toHaveBeenCalled();
    expect((await activation.start(3)).state.status).toBe('active');
    expect(inject).toHaveBeenCalledTimes(1);
  });

  it('forbids sidebar injection when a receiver disappears after initial discovery', async () => {
    const inject = vi.fn(async () => undefined);
    const activation = createActivationController({ transport: {
      send: async () => { throw new Error('Receiving end does not exist.'); }, inject,
    } });
    await expect(activation.start(3, { allowInjection: false })).rejects.toThrow('Receiving end');
    expect(inject).not.toHaveBeenCalled();
  });

  it('passive queries do not replace toolbar feedback with permission errors', async () => {
    const feedback = vi.fn(async () => undefined);
    const activation = createActivationController({ transport: {
      send: async () => { throw new Error('Receiving end does not exist.'); }, inject: async () => undefined,
    }, updateFeedback: feedback });
    await expect(activation.query(3)).rejects.toThrow('Receiving end');
    expect(feedback).not.toHaveBeenCalled();
  });

  it('passive reconciliation does not suppress successful toolbar feedback clearing', async () => {
    const { page } = setup();
    const held = deferred<InspectionResponse>();
    let acknowledgement: InspectionResponse | undefined;
    const feedback = vi.fn(async () => undefined);
    const activation = createActivationController({ transport: {
      async send(_tabId, request) {
        const reply = await page.handle(request);
        if (request.operation === 'start') { acknowledgement = reply; return held.promise; }
        return reply;
      }, inject: async () => undefined,
    }, updateFeedback: feedback });
    const starting = activation.start(3);
    await vi.waitFor(() => expect(acknowledgement).toBeDefined());
    await activation.query(3);
    if (!acknowledgement) throw new Error('Missing startup acknowledgement');
    held.resolve(acknowledgement);
    await starting;
    expect(feedback).toHaveBeenCalledExactlyOnceWith(3, undefined);
  });

  it.each(['Receiving end does not exist.', 'The message port closed before a response was received.'])(
    'clears feedback for expected cleanup instead of reporting an error: %s', async (reason) => {
      const feedback = vi.fn(async () => undefined);
      const activation = createActivationController({ transport: {
        send: async () => { throw new Error(reason); }, inject: vi.fn(),
      }, updateFeedback: feedback });
      await expect(activation.stop(3)).rejects.toThrow(reason);
      expect(feedback).toHaveBeenCalledExactlyOnceWith(3, undefined);
    },
  );

  it('invalidates old work on navigation without allowing its error feedback to return', async () => {
    const { page } = setup();
    const held = deferred<InspectionResponse>();
    const feedback = vi.fn(async () => undefined);
    let sent = false;
    const activation = createActivationController({ transport: {
      async send(_tabId, request) { sent = true; await held.promise; return page.handle(request); },
      inject: vi.fn(),
    }, updateFeedback: feedback });
    const starting = activation.start(3).catch((error) => error);
    await vi.waitFor(() => expect(sent).toBe(true));
    activation.invalidate(3);
    held.resolve(await page.handle({ kind: 'visual-debug:inspection', operation: 'query', tabId: 3, requestId: 'released' }));
    expect(await starting).toBeInstanceOf(InspectionSupersededError);
    expect(feedback).not.toHaveBeenCalled();
  });

  it.each([
    'Cannot access a helium:// URL',
    'Missing host permission for the tab',
    'The extensions gallery cannot be scripted.',
    'Receiving end does not exist.',
    'The inspection operation was superseded.',
  ])('does not put an error badge on an expected outcome: %s', async (reason) => {
    await updateActionFeedback(3, reason);
    expect(runtime.badge).toHaveBeenLastCalledWith({ tabId: 3, text: '' });
    expect(runtime.title).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('Inspection error:') }));
  });

  it.each([
    "Cannot access 'state' before initialization",
    'Inspection content script returned an invalid or stale protocol response.',
    'Unexpected initialization failure',
  ])('retains the badge and an error tooltip for unexpected failures: %s', async (reason) => {
    await updateActionFeedback(3, reason);
    expect(runtime.badge).toHaveBeenLastCalledWith({ tabId: 3, text: '!' });
    expect(runtime.title).toHaveBeenLastCalledWith({ tabId: 3, title: `Inspection error: ${reason}` });
  });

  it('reports denied injection and never claims active', async () => {
    const feedback = vi.fn(async () => undefined);
    const activation = createActivationController({ transport: {
      send: async () => { throw new Error('Could not establish connection. Receiving end does not exist.'); },
      inject: async () => { throw new Error('Cannot access this page'); },
    }, updateFeedback: feedback });
    await expect(activation.start(3)).rejects.toThrow('Cannot access this page');
    expect(feedback).toHaveBeenCalledWith(3, 'Cannot access this page');
  });

  it('does not inject for arbitrary transport failures or missing stop receivers', async () => {
    const inject = vi.fn(async () => undefined);
    const activation = createActivationController({ transport: { send: async () => { throw new Error('Message port closed'); }, inject } });
    await expect(activation.start(3)).rejects.toThrow('Message port closed');
    const missing = createActivationController({ transport: { send: async () => { throw new Error('Receiving end does not exist.'); }, inject } });
    await expect(missing.stop(3)).rejects.toThrow('Receiving end');
    expect(inject).not.toHaveBeenCalled();
  });

  it.each(['malformed', 'request', 'tab', 'document', 'operation'] as const)('rejects %s responses', async (mismatch) => {
    const { page } = setup();
    const activation = createActivationController({ transport: {
      async send(_tabId, request) {
        const response = await page.handle(request);
        if (request.operation === 'query') return response;
        if (mismatch === 'malformed') return {};
        if (mismatch === 'operation') return { ...response, operation: 'query' };
        const identity = { ...response.identity, ...(mismatch === 'tab' ? { tabId: 9 } : mismatch === 'document' ? { documentId: 'old' } : { requestId: 'old' }) };
        return { ...response, identity, state: { ...response.state, identity } };
      }, inject: async () => undefined,
    } });
    await expect(activation.start(3)).rejects.toThrow('invalid or stale protocol response');
  });

  it('lets stop bypass a pending start and cancels already queued starts', async () => {
    const pending = deferred<ControllerSession>();
    const factory = vi.fn(async () => pending.promise);
    const { activation, page } = setup(factory);
    const starting = activation.start(3).catch((error) => error);
    const queued = activation.start(3).catch((error) => error);
    await vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(1));
    expect((await activation.stop(3)).state.status).toBe('inactive');
    const late = session();
    pending.resolve(late);
    expect(await starting).toBeInstanceOf(InspectionSupersededError);
    expect(await queued).toBeInstanceOf(InspectionSupersededError);
    expect(late.isDisposed).toBe(true);
    expect(page.getState().status).toBe('inactive');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('cancels a start during injection before it can create a hidden session', async () => {
    const injected = deferred<void>();
    let available = false;
    const { page } = setup();
    const send = vi.fn(async (_tabId: number, request: InspectionRequest) => {
      if (!available) throw new Error('Receiving end does not exist.');
      return page.handle(request);
    });
    const inject = vi.fn(async () => { await injected.promise; available = true; });
    const activation = createActivationController({ transport: { send, inject } });
    const starting = activation.start(3).catch((error) => error);
    await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(1));
    await expect(activation.stop(3)).rejects.toThrow('Receiving end');
    injected.resolve();
    expect(await starting).toBeInstanceOf(InspectionSupersededError);
    expect(send.mock.calls.some(([, message]) => message.operation === 'start')).toBe(false);
    expect(page.getState().status).toBe('inactive');
  });

  it('rejects mutation across navigation and discovers the replacement on retry', async () => {
    const original = createInspectionController({ tabId: 3, documentId: 'doc-a', createSession: async () => session() });
    const replacementFactory = vi.fn(async () => session());
    const replacement = createInspectionController({ tabId: 3, documentId: 'doc-b', createSession: replacementFactory });
    let current = original;
    const activation = createActivationController({ transport: {
      async send(_tabId, request) {
        const response = await current.handle(request);
        if (current === original && request.operation === 'query') { original.dispose(); current = replacement; }
        return response;
      }, inject: async () => undefined,
    } });
    await expect(activation.start(3)).rejects.toThrow('invalid or stale');
    expect(replacementFactory).not.toHaveBeenCalled();
    expect((await activation.start(3)).identity.documentId).toBe('doc-b');
    expect(replacementFactory).toHaveBeenCalledTimes(1);
  });

  it('reports page failure without false active state and permits retry', async () => {
    let attempts = 0;
    const { activation, feedback } = setup(async () => { if (++attempts === 1) throw new Error('mount failed'); return session(); });
    const failed = await activation.start(3);
    expect(failed.ok).toBe(false);
    expect(failed.state.status).toBe('error');
    expect(feedback).toHaveBeenCalledWith(3, 'mount failed');
    expect((await activation.start(3)).state.status).toBe('active');
  });

  it('rejects a negative preview acknowledgement instead of treating it as active', async () => {
    const { page } = setup();
    const transport: ActivationTransport = {
      send: vi.fn(async (_tabId, request) => page.handle(request)),
      sendPreview: vi.fn(async (_tabId, request) => ({
        kind: 'visual-debug:inspection-preview' as const, ok: false,
        tabId: request.tabId, documentId: request.documentId, sequence: request.sequence,
      })),
      inject: vi.fn(async () => undefined),
    };
    const activation = createActivationController({ transport });
    await activation.start(3);
    const request: InspectionPreviewRequest = {
      kind: 'visual-debug:inspection-preview', tabId: 3, documentId: 'doc-a',
      selectionId: 'selection-1', preview: 'padding', visible: true, sequence: 1,
    };
    await expect(activation.preview(3, request)).rejects.toThrow('rejected');
    expect(transport.sendPreview).toHaveBeenCalledOnce();
  });

  it('preserves idempotent toolbar starts and shared action feedback', async () => {
    const { page } = setup();
    runtime.send.mockImplementation((_tabId: number, request: InspectionRequest) => page.handle(request));
    expect((await inspectionActivation.start(3)).state.status).toBe('active');
    expect((await inspectionActivation.start(3)).state.status).toBe('active');
    expect(page.getState().status).toBe('active');
    expect(runtime.send).toHaveBeenCalledWith(3, expect.objectContaining({ operation: 'start' }), { frameId: 0 });
    expect(runtime.title).toHaveBeenCalledWith({ tabId: 3, title: 'Open sidebar and start inspection' });
    expect(runtime.badge).toHaveBeenCalledWith({ tabId: 3, text: '' });
  });

  it('allows explicit recovery before an obsolete startup response arrives', async () => {
    const { page } = setup();
    const held = deferred<InspectionResponse>();
    let oldResult!: InspectionResponse;
    let holdFirstStart = true;
    const activation = createActivationController({ transport: {
      async send(_tabId, request) {
        const response = await page.handle(request);
        if (request.operation === 'start' && holdFirstStart) {
          holdFirstStart = false;
          oldResult = response;
          return held.promise;
        }
        return response;
      }, inject: async () => undefined,
    } });
    const first = activation.start(3).catch((error) => error);
    await vi.waitFor(() => expect(oldResult).toBeDefined());
    await activation.stop(3);
    expect((await activation.start(3)).state.status).toBe('active');
    held.resolve(oldResult);
    expect(await first).toBeInstanceOf(InspectionSupersededError);
    expect(page.getState().status).toBe('active');
  });

  it('does not publish an obsolete start result as active after a stop', async () => {
    const { page } = setup();
    const held = deferred<InspectionResponse>();
    let result!: InspectionResponse;
    const feedback = vi.fn(async () => undefined);
    const activation = createActivationController({ transport: {
      async send(_tabId, request) {
        const response = await page.handle(request);
        if (request.operation === 'start') { result = response; return held.promise; }
        return response;
      }, inject: async () => undefined,
    }, updateFeedback: feedback });
    const starting = activation.start(3).catch((error) => error);
    await vi.waitFor(() => expect(result).toBeDefined());
    await activation.stop(3);
    held.resolve(result);
    expect(await starting).toBeInstanceOf(InspectionSupersededError);
    expect(feedback).toHaveBeenCalledTimes(1);
    expect(page.getState().status).toBe('inactive');
  });
});
