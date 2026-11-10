import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createInspectionSession } from '../lib/session';
import {
  INSPECTION_STATE_MESSAGE,
  LEGACY_TOGGLE_MESSAGE,
  makeRequest,
  type InspectionState,
  type LegacyToggleResponse,
  validateInspectionRequest,
  validateSender,
} from '../lib/inspection-protocol';
import { createInspectionController, type InspectionController } from '../lib/inspection-controller';

function randomId(): string {
  // getRandomValues also works on HTTP pages where randomUUID is unavailable.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default defineContentScript({
  registration: 'runtime',
  matches: [],
  allFrames: false,
  cssInjectionMode: 'ui',
  noScriptStartedPostMessage: true,
  main(ctx: ContentScriptContext) {
    let documentId = randomId();
    let controller: InspectionController | undefined;
    let shuttingDown = false;
    const reportState = (state: InspectionState) => {
      // No subscriber is required while the original toolbar is still in use.
      void Promise.resolve()
        .then(() => browser.runtime.sendMessage({ kind: INSPECTION_STATE_MESSAGE, state }))
        .catch(() => undefined);
    };
    const ensureController = (tabId: number) => {
      controller ??= createInspectionController({
        tabId,
        documentId,
        createSession: (onDisposed, signal) => createInspectionSession(ctx, onDisposed, signal),
        onState: reportState,
      });
      return controller;
    };

    // Do not make this listener async: unhandled messages must return undefined,
    // not a promise which claims the response channel from another listener.
    const onMessage = (message: unknown, sender: Browser.runtime.MessageSender) => {
      if (shuttingDown || !validateSender(sender, browser.runtime.id)) return undefined;
      const legacy = typeof message === 'object' && message !== null &&
        'kind' in message && message.kind === LEGACY_TOGGLE_MESSAGE;
      const boundTabId = controller?.getState().identity.tabId;
      const candidate = legacy
        ? makeRequest('toggle', (message as { tabId?: number }).tabId ?? boundTabId ?? -1, randomId(),
          (message as { documentId?: string }).documentId)
        : message;
      const request = validateInspectionRequest(candidate, boundTabId);
      if (!request) return undefined;
      const result = ensureController(request.tabId).handle(request);
      if (!legacy) return result;
      return result.then((response): LegacyToggleResponse => ({
        kind: LEGACY_TOGGLE_MESSAGE,
        ok: response.ok,
        ...(response.ok ? { active: response.state.status === 'active' } : { error: response.error ?? response.state.error }),
      }));
    };

    browser.runtime.onMessage.addListener(onMessage);
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      if (shuttingDown) return;
      controller?.dispose();
      controller = undefined;
      // Same-document navigation leaves the runtime listener alive but rotates
      // its identity. Old commands cannot restart the replacement page state.
      documentId = randomId();
    });
    ctx.onInvalidated(() => {
      shuttingDown = true;
      browser.runtime.onMessage.removeListener(onMessage);
      controller?.dispose();
      controller = undefined;
    });
  },
});
