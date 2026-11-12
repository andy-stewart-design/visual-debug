import {
  INSPECTION_MESSAGE,
  type InspectionIdentity,
  type InspectionRequest,
  type InspectionResponse,
  type InspectionState,
  type InspectionStatus,
  type InspectionPreviewRequest,
  type InspectionPreviewResponse,
  makePreviewResponse,
} from './inspection-protocol';
import type { ElementSnapshot } from './element-snapshot';

export interface ControllerSession {
  readonly isDisposed: boolean;
  setPaddingPreview?: (intent: { selectionId: string; visible: boolean; sequence: number; streamEpoch?: number }) => void;
  dispose(): void;
}

export interface InspectionControllerOptions {
  tabId: number;
  documentId: string;
  createSession: (
    onDisposed: () => void,
    signal: AbortSignal,
    onSelection: (selection: ElementSnapshot | undefined) => void,
  ) => Promise<ControllerSession>;
  onState?: (state: InspectionState) => void;
}

export interface InspectionController {
  handle(request: InspectionRequest): Promise<InspectionResponse>;
  invalidate(reason?: string): void;
  dispose(): void;
  getState(): InspectionState;
  handlePreview(request: InspectionPreviewRequest): InspectionPreviewResponse;
  selectionChanged(selection: ElementSnapshot | undefined): void;
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

  const publish = (status: InspectionStatus, error?: string, selection?: ElementSnapshot) => {
    state = {
      status,
      revision: state.revision + 1,
      identity: identity(lastRequestId),
      ...(selection === undefined ? {} : { selection }),
      ...(error === undefined ? {} : { error }),
    };
    // Observers must not break session ownership or turn successful creation
    // into an orphaned session when a receiver has gone away.
    try { options.onState?.(copy()); } catch { /* best-effort notification */ }
  };

  const respond = (request: InspectionRequest, superseded = false, error?: string): InspectionResponse => {
    const snapshot = copy();
    const { selection, ...withoutSelection } = snapshot;
    const status: InspectionStatus = error === undefined ? (superseded ? 'inactive' : snapshot.status) : 'error';
    const next: InspectionState = {
      ...withoutSelection,
      status,
      identity: identity(request.requestId),
      ...(status === 'active' && selection === undefined ? {} : status === 'active' ? { selection } : {}),
      ...(error === undefined ? {} : { error }),
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
        }, abort.signal, (selection) => {
          if (!disposed && epoch === startEpoch && session === created) publish('active', undefined, selection);
        });
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
    handlePreview: (request) => {
      if (disposed || request.tabId !== options.tabId || request.documentId !== options.documentId ||
        !session || session.isDisposed || state.status !== 'active') return makePreviewResponse(request, false);
      if (request.visible && state.selection?.selectionId !== request.selectionId) return makePreviewResponse(request, false);
      session.setPaddingPreview?.({ selectionId: request.selectionId, visible: request.visible,
        sequence: request.sequence, streamEpoch: request.streamEpoch });
      return makePreviewResponse(request, true);
    },
    selectionChanged: (selection) => {
      if (disposed || !session || session.isDisposed || state.status !== 'active') return;
      publish('active', undefined, selection);
    },
  };
}
