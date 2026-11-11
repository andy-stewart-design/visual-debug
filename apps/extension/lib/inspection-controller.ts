import {
  INSPECTION_MESSAGE,
  type InspectionIdentity,
  type InspectionRequest,
  type InspectionResponse,
  type InspectionState,
  type InspectionStatus,
} from './inspection-protocol';

export interface ControllerSession {
  readonly isDisposed: boolean;
  dispose(): void;
}

export interface InspectionControllerOptions {
  tabId: number;
  documentId: string;
  createSession: (onDisposed: () => void, signal: AbortSignal) => Promise<ControllerSession>;
  onState?: (state: InspectionState) => void;
}

export interface InspectionController {
  handle(request: InspectionRequest): Promise<InspectionResponse>;
  invalidate(reason?: string): void;
  dispose(): void;
  getState(): InspectionState;
}

type PendingStart = { epoch: number; abort: AbortController; promise: Promise<void> };

export function createInspectionController(options: InspectionControllerOptions): InspectionController {
  let disposed = false;
  let epoch = 0;
  let session: ControllerSession | undefined;
  let pending: PendingStart | undefined;
  let lastRequestId = 'initial';
  const identity = (requestId: string): InspectionIdentity => ({ tabId: options.tabId, documentId: options.documentId, requestId });
  let state: InspectionState = { status: 'inactive', revision: 0, identity: identity(lastRequestId) };
  const copy = (): InspectionState => ({ ...state, identity: { ...state.identity } });

  const publish = (status: InspectionStatus, error?: string) => {
    state = { status, revision: state.revision + 1, identity: identity(lastRequestId), ...(error === undefined ? {} : { error }) };
    // Observers must not break session ownership or turn successful creation
    // into an orphaned session when a receiver has gone away.
    try { options.onState?.(copy()); } catch { /* best-effort notification */ }
  };

  const respond = (request: InspectionRequest, superseded = false, error?: string): InspectionResponse => {
    const next: InspectionState = {
      ...copy(),
      identity: identity(request.requestId),
      ...(superseded ? { status: 'inactive' as const } : {}),
      ...(error === undefined ? {} : { status: 'error' as const, error }),
    };
    return {
      kind: INSPECTION_MESSAGE,
      operation: request.operation,
      identity: next.identity,
      state: next,
      ok: next.status !== 'error' && next.status !== 'unavailable',
      ...(superseded ? { superseded: true } : {}),
      ...(next.error ? { error: next.error } : {}),
    };
  };

  const clear = () => {
    epoch += 1;
    const oldPending = pending;
    pending = undefined;
    // Detach ownership before dispose callbacks fire.
    const oldSession = session;
    session = undefined;
    oldPending?.abort.abort();
    oldSession?.dispose();
  };

  const create = (startEpoch: number): PendingStart => {
    const abort = new AbortController();
    const creation: PendingStart = { epoch: startEpoch, abort, promise: Promise.resolve() };
    creation.promise = Promise.resolve().then(async () => {
      if (disposed || epoch !== startEpoch) return;
      let created: ControllerSession | undefined;
      let selfDisposed = false;
      try {
        created = await options.createSession(() => {
          selfDisposed = true;
          if (created !== undefined && session === created) {
            session = undefined;
            if (!disposed) publish('inactive');
          }
        }, abort.signal);
        if (disposed || epoch !== startEpoch || selfDisposed || created.isDisposed) {
          created.dispose();
          if (!disposed && epoch === startEpoch) publish('inactive');
          return;
        }
        session = created;
        publish('active');
      } catch (error) {
        created?.dispose();
        if (!disposed && epoch === startEpoch) publish('error', error instanceof Error ? error.message : String(error));
      } finally {
        if (pending === creation) pending = undefined;
      }
    });
    pending = creation;
    return creation;
  };

  const handle = async (request: InspectionRequest): Promise<InspectionResponse> => {
    if (request.tabId !== options.tabId || (request.documentId !== undefined && request.documentId !== options.documentId)) {
      return respond(request, true, 'The inspection document identity is no longer current.');
    }
    if (disposed) return respond(request, true, 'The inspection page context is no longer available.');
    if (request.operation === 'query') return respond(request);
    lastRequestId = request.requestId;
    if (request.operation === 'stop') {
      clear();
      publish('inactive');
      return respond(request);
    }
    if (session && !session.isDisposed) return respond(request);
    const startEpoch = epoch;
    if (!pending) publish('pending');
    const creation = pending ?? create(startEpoch);
    await creation.promise;
    return respond(request, disposed || startEpoch !== epoch);
  };

  return {
    handle,
    invalidate: (reason = 'The inspection page context changed.') => {
      if (disposed) return;
      clear();
      lastRequestId = `invalidated-${epoch}`;
      publish('inactive', reason);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clear();
      lastRequestId = `disposed-${epoch}`;
      publish('inactive');
    },
    getState: copy,
  };
}
