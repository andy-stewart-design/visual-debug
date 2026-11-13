import { browser } from 'wxt/browser';
import { resolveActionApi } from './action-api';
import { errorMessage, isAccessDenied, isExpectedStopError, isExpectedUnavailableError, isMissingReceiver } from './inspection-feedback';
export { isMissingReceiver } from './inspection-feedback';
import {
  type InspectionOperation,
  type InspectionRequest,
  type InspectionResponse,
  type InspectionPreviewRequest,
  type StyleEditResponse,
  makeRequest,
  makeStyleEditResponse,
  validateInspectionResponse,
  validateInspectionPreviewResponse,
  validateStyleEditResponse,
} from './inspection-protocol';
import type { StyleEditRequest } from './style-edit';

const NEUTRAL_TITLE = 'Open sidebar and start inspection';

export interface ActivationTransport {
  send(tabId: number, message: InspectionRequest): Promise<unknown>;
  sendPreview?(tabId: number, message: InspectionPreviewRequest): Promise<unknown>;
  sendStyleEdit?(tabId: number, message: StyleEditRequest): Promise<unknown>;
  inject(tabId: number): Promise<void>;
}

export interface ActivationControllerOptions {
  transport: ActivationTransport;
  updateFeedback?: (tabId: number, error?: string) => Promise<void>;
  requestId?: () => string;
}

export interface ActivationController {
  /** Invalidate in-flight work after a document navigation without sending a stop. */
  invalidate(tabId: number): void;
  start(tabId: number, options?: { allowInjection?: boolean }): Promise<InspectionResponse>;
  stop(tabId: number): Promise<InspectionResponse>;
  query(tabId: number): Promise<InspectionResponse>;
  preview(tabId: number, request: InspectionPreviewRequest): Promise<void>;
  edit(tabId: number, request: StyleEditRequest): Promise<StyleEditResponse>;
}

export class InspectionSupersededError extends Error {
  constructor() { super('The inspection operation was superseded.'); }
}

export function createActivationController(options: ActivationControllerOptions): ActivationController {
  const queues = new Map<number, Promise<unknown>>();
  const epochs = new Map<number, number>();
  const observations = new Map<number, number>();
  const epoch = (tabId: number) => epochs.get(tabId) ?? 0;
  const nextId = options.requestId ?? (() => crypto.randomUUID());

  const run = <T>(tabId: number, operation: () => Promise<T>): Promise<T> => {
    const previous = queues.get(tabId) ?? Promise.resolve();
    const next = previous.then(operation, operation);
    queues.set(tabId, next);
    const release = () => { if (queues.get(tabId) === next) queues.delete(tabId); };
    void next.then(release, release);
    return next;
  };

  const invoke = (tabId: number, operation: InspectionOperation, allowInjection = true): Promise<InspectionResponse> => {
    if (!Number.isSafeInteger(tabId) || tabId < 0) return Promise.reject(new Error('Invalid inspection tab ID.'));
    if (operation === 'stop') {
      epochs.set(tabId, epoch(tabId) + 1);
      // New user intent must not wait for an obsolete/hung startup response.
      // Previously queued work still carries its old epoch and cannot mutate.
      queues.delete(tabId);
    }
    const issuedEpoch = epoch(tabId);
    // Read-only reconciliation neither writes toolbar feedback nor supersedes
    // a mutation's ability to clear its previous error badge after success.
    const observation = (observations.get(tabId) ?? 0) + (operation === 'query' ? 0 : 1);
    if (operation !== 'query') observations.set(tabId, observation);
    const guard = () => { if (issuedEpoch !== epoch(tabId)) throw new InspectionSupersededError(); };
    const feedback = async (error?: string) => {
      if (operation === 'query' || issuedEpoch !== epoch(tabId) || observation !== observations.get(tabId)) return;
      try { await options.updateFeedback?.(tabId, error); } catch { /* feedback cannot change the operation outcome */ }
    };
    const send = async (request: InspectionRequest): Promise<InspectionResponse> => {
      guard();
      const raw = await options.transport.send(tabId, request);
      guard();
      const response = validateInspectionResponse(raw);
      if (!response || response.operation !== request.operation || response.identity.tabId !== tabId ||
        response.identity.requestId !== request.requestId ||
        (request.documentId !== undefined && response.identity.documentId !== request.documentId)) {
        throw new Error('Inspection content script returned an invalid or stale protocol response.');
      }
      if (response.superseded) throw new InspectionSupersededError();
      return response;
    };
    const execute = async () => {
      try {
        guard();
        // Discover the current document without mutating it. Each mutation is
        // then pinned to that identity, not a cached identity from an old page.
        const discovery = makeRequest('query', tabId, nextId());
        let current: InspectionResponse;
        try {
          current = await send(discovery);
        } catch (error) {
          guard();
          if (!allowInjection || operation !== 'start' || !isMissingReceiver(error)) throw error;
          await options.transport.inject(tabId);
          guard(); // A stop during injection must prevent the eventual start.
          current = await send(discovery);
        }
        guard();
        const response = operation === 'query' ? current : await send(
          makeRequest(operation, tabId, nextId(), current.identity.documentId),
        );
        await feedback(response.ok ? undefined : response.error ?? response.state.error);
        return response;
      } catch (error) {
        if (!(error instanceof InspectionSupersededError)) {
          await feedback(operation === 'stop' && isExpectedStopError(error) ? undefined : errorMessage(error));
        }
        throw error;
      }
    };
    // Stops must reach the content controller while its factory is pending.
    // Queued starts capture the epoch at issuance, so stop cancels them too.
    return operation === 'start' ? run(tabId, execute) : execute();
  };

  const invalidate = (tabId: number): void => {
    if (!Number.isSafeInteger(tabId) || tabId < 0) return;
    epochs.set(tabId, epoch(tabId) + 1);
    observations.set(tabId, (observations.get(tabId) ?? 0) + 1);
    // Do not send a stop to the new document, and do not let old queued work
    // run after navigation. The sidebar owns any subsequent explicit cleanup.
    queues.delete(tabId);
  };

  const edit = (tabId: number, request: StyleEditRequest): Promise<StyleEditResponse> => {
    if (!options.transport.sendStyleEdit || !Number.isSafeInteger(tabId) || tabId < 0 || request.tabId !== tabId) {
      return Promise.reject(new Error('Style editing is unavailable.'));
    }
    const issuedEpoch = epoch(tabId);
    const sendStyleEdit = options.transport.sendStyleEdit;
    return run(tabId, async () => {
      const guard = () => { if (issuedEpoch !== epoch(tabId)) throw new InspectionSupersededError(); };
      guard();
      const discovery = validateInspectionResponse(await options.transport.send(tabId, makeRequest('query', tabId, nextId())));
      guard();
      if (!discovery || !discovery.ok || discovery.identity.tabId !== tabId || discovery.state.identity.documentId !== request.documentId ||
        discovery.state.status !== 'active' || discovery.state.selection?.selectionId !== request.selectionId) {
        return makeStyleEditResponse(request, false, 'The selected element is no longer current.', discovery?.state);
      }
      const raw = await sendStyleEdit(tabId, request);
      guard();
      const response = validateStyleEditResponse(raw);
      if (!response || response.tabId !== tabId || response.documentId !== request.documentId || response.selectionId !== request.selectionId ||
        response.editId !== request.editId || response.side !== request.side) throw new Error('Style edit returned an invalid or stale response.');
      return response;
    });
  };

  const preview = (tabId: number, request: InspectionPreviewRequest): Promise<void> => {
    if (!options.transport.sendPreview) return Promise.resolve();
    if (!Number.isSafeInteger(tabId) || tabId < 0 || request.tabId !== tabId) {
      return Promise.reject(new Error('Invalid inspection preview tab ID.'));
    }
    const issuedEpoch = epoch(tabId);
    return run(tabId, async () => {
      const guard = () => {
        if (issuedEpoch !== epoch(tabId)) throw new InspectionSupersededError();
      };
      guard();
      const discovery = await options.transport.send(tabId, makeRequest('query', tabId, nextId()));
      guard();
      const current = validateInspectionResponse(discovery);
      if (!current || !current.ok || current.identity.tabId !== tabId || current.state.identity.documentId !== request.documentId ||
        current.state.status !== 'active') return;
      const response = await options.transport.sendPreview!(tabId, request);
      guard();
      const validated = validateInspectionPreviewResponse(response);
      if (!validated || validated.tabId !== tabId || validated.documentId !== request.documentId ||
        validated.sequence !== request.sequence) {
        throw new Error('Inspection preview returned an invalid response.');
      }
      if (!validated.ok) throw new Error('Inspection preview was rejected by the content script.');
    });
  };

  return {
    invalidate,
    start: (tabId, startOptions) => invoke(tabId, 'start', startOptions?.allowInjection ?? true),
    stop: (tabId) => invoke(tabId, 'stop'),
    query: (tabId) => invoke(tabId, 'query'),
    edit,
    preview,
  };
}

export async function updateActionFeedback(tabId: number, error?: string): Promise<void> {
  const expected = error !== undefined && isExpectedUnavailableError(error);
  const alarming = error !== undefined && !expected;
  try {
    await resolveActionApi(browser).setBadgeText({ tabId, text: alarming ? '!' : '' });
  } catch (feedbackError) {
    console.warn('Unable to update inspection badge.', feedbackError);
  }
  try {
    await resolveActionApi(browser).setTitle({
      tabId,
      title: alarming ? `Inspection error: ${error}` :
        expected && isAccessDenied(error) ? 'Inspection unavailable on this page' : NEUTRAL_TITLE,
    });
  } catch (feedbackError) {
    console.warn('Unable to update inspection action title.', feedbackError);
  }
}

export const inspectionActivation = createActivationController({
  transport: {
    send: (tabId, message) => browser.tabs.sendMessage(tabId, message, { frameId: 0 }),
    sendPreview: (tabId, message) => browser.tabs.sendMessage(tabId, message, { frameId: 0 }),
    sendStyleEdit: (tabId, message) => browser.tabs.sendMessage(tabId, message, { frameId: 0 }),
    inject: async (tabId) => {
      await browser.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ['/content-scripts/inspect.js'] });
    },
  },
  updateFeedback: updateActionFeedback,
});
