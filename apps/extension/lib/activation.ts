import { browser } from 'wxt/browser';

const TOGGLE_MESSAGE = 'visual-debug:toggle-inspection';
const NEUTRAL_TITLE = 'Toggle inspection session';
const queues = new Map<number, Promise<void>>();

type ToggleResponse =
  | { kind: typeof TOGGLE_MESSAGE; ok: true; active: boolean }
  | { kind: typeof TOGGLE_MESSAGE; ok: false; error: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingReceiver(error: unknown): boolean {
  const message = errorMessage(error);
  return [
    'Could not establish connection. Receiving end does not exist.',
    'Receiving end does not exist.',
  ].includes(message);
}

function validateResponse(response: unknown): ToggleResponse {
  if (typeof response !== 'object' || response === null) {
    throw new Error('Inspection content script returned no protocol response.');
  }

  const candidate = response as Partial<ToggleResponse>;
  if (candidate.kind !== TOGGLE_MESSAGE || typeof candidate.ok !== 'boolean') {
    throw new Error('Inspection content script returned an invalid protocol response.');
  }

  if (candidate.ok === true && typeof candidate.active === 'boolean') {
    return candidate as ToggleResponse;
  }

  if (candidate.ok === false && typeof candidate.error === 'string') {
    return candidate as ToggleResponse;
  }

  throw new Error('Inspection content script returned an incomplete protocol response.');
}

async function sendToggle(tabId: number): Promise<ToggleResponse> {
  const response = await browser.tabs.sendMessage(
    tabId,
    { kind: TOGGLE_MESSAGE },
    { frameId: 0 },
  );
  return validateResponse(response);
}

async function updateActionFeedback(
  tabId: number,
  error: string | undefined,
): Promise<void> {
  try {
    await browser.action.setBadgeText({ tabId, text: error ? '!' : '' });
  } catch (feedbackError) {
    console.warn('Unable to update inspection badge.', feedbackError);
  }

  try {
    await browser.action.setTitle({
      tabId,
      title: error ? `Inspection unavailable: ${error}` : NEUTRAL_TITLE,
    });
  } catch (feedbackError) {
    console.warn('Unable to update inspection action title.', feedbackError);
  }
}

async function toggleTab(tabId: number): Promise<void> {
  try {
    let response: ToggleResponse;

    try {
      response = await sendToggle(tabId);
    } catch (error) {
      if (!isMissingReceiver(error)) throw error;

      await browser.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        files: ['/content-scripts/inspect.js'],
      });
      response = await sendToggle(tabId);
    }

    if (!response.ok) throw new Error(response.error);
    await updateActionFeedback(tabId, undefined);
  } catch (error) {
    const message = errorMessage(error);
    console.error(`Inspection activation failed for tab ${tabId}: ${message}`, error);
    await updateActionFeedback(tabId, message);
  }
}

export function enqueueToggle(tabId: number): void {
  const previous = queues.get(tabId) ?? Promise.resolve();
  const next = previous.then(
    () => toggleTab(tabId),
    () => toggleTab(tabId),
  );
  queues.set(tabId, next);

  void next.then(
    () => {
      if (queues.get(tabId) === next) queues.delete(tabId);
    },
    () => {
      if (queues.get(tabId) === next) queues.delete(tabId);
    },
  );
}
