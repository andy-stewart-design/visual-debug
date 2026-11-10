import { browser } from 'wxt/browser';
import { resolveActionApi } from './action-api';
import {
  type InspectionOperation,
  type InspectionRequest,
  type InspectionResponse,
  makeRequest,
  validateInspectionResponse,
} from './inspection-protocol';

const NEUTRAL_TITLE = 'Open sidebar and start inspection';

export interface ActivationTransport {
  send(tabId: number, message: InspectionRequest): Promise<unknown>;
  inject(tabId: number): Promise<void>;
}

export interface ActivationControllerOptions {
  transport: ActivationTransport;
  updateFeedback?: (tabId: number, error?: string) => Promise<void>;
  requestId?: () => string;
}

export interface ActivationController {
  start(tabId: number, options?: { allowInjection?: boolean }): Promise<InspectionResponse>;
  stop(tabId: number): Promise<InspectionResponse>;
  query(tabId: number): Promise<InspectionResponse>;
  toggle(tabId: number): Promise<{ active: boolean }>;
}

export class InspectionSupersededError extends Error {
  constructor() { super('The inspection operation was superseded.'); }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isMissingReceiver(error: unknown): boolean {
  return [
    'Could not establish connection. Receiving end does not exist.',
    'Receiving end does not exist.',
  ].includes(errorMessage(error));
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
          if (!allowInjection || (operation !== 'start' && operation !== 'toggle') || !isMissingReceiver(error)) throw error;
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
        if (!(error instanceof InspectionSupersededError)) await feedback(errorMessage(error));
        throw error;
      }
    };
    // Stops must reach the content controller while its factory is pending.
    // Queued starts capture the epoch at issuance, so stop cancels them too.
    return operation === 'start' || operation === 'toggle' ? run(tabId, execute) : execute();
  };

  return {
    start: (tabId, startOptions) => invoke(tabId, 'start', startOptions?.allowInjection ?? true),
    stop: (tabId) => invoke(tabId, 'stop'),
    query: (tabId) => invoke(tabId, 'query'),
    toggle: async (tabId) => {
      const response = await invoke(tabId, 'toggle');
      if (!response.ok) throw new Error(response.error ?? response.state.error ?? 'Inspection toggle failed.');
      return { active: response.state.status === 'active' };
    },
  };
}

export async function updateActionFeedback(tabId: number, error?: string): Promise<void> {
  try {
    await resolveActionApi(browser).setBadgeText({ tabId, text: error ? '!' : '' });
  } catch (feedbackError) {
    console.warn('Unable to update inspection badge.', feedbackError);
  }
  try {
    await resolveActionApi(browser).setTitle({ tabId, title: error ? `Inspection unavailable: ${error}` : NEUTRAL_TITLE });
  } catch (feedbackError) {
    console.warn('Unable to update inspection action title.', feedbackError);
  }
}

export const inspectionActivation = createActivationController({
  transport: {
    send: (tabId, message) => browser.tabs.sendMessage(tabId, message, { frameId: 0 }),
    inject: async (tabId) => {
      await browser.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ['/content-scripts/inspect.js'] });
    },
  },
  updateFeedback: updateActionFeedback,
});

/** Preserve the existing background consumer until the sidebar replaces it. */
export function enqueueToggle(tabId: number): void {
  void inspectionActivation.toggle(tabId).catch((error) => {
    console.error(`Inspection activation failed for tab ${tabId}: ${errorMessage(error)}`, error);
  });
}
