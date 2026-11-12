import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createInspectionSession } from '../lib/session';
import {
  INSPECTION_STATE_MESSAGE,
  type InspectionState,
  validateInspectionPreviewRequest,
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
        createSession: (onDisposed, signal, onSelection) => createInspectionSession(ctx, onDisposed, signal, onSelection),
        onState: reportState,
      });
      return controller;
    };

    // Do not make this listener async: unhandled messages must return undefined,
    // not a promise which claims the response channel from another listener.
    const onMessage = (message: unknown, sender: Browser.runtime.MessageSender) => {
      if (shuttingDown || !validateSender(sender, browser.runtime.id)) return undefined;
      const boundTabId = controller?.getState().identity.tabId;
      const preview = validateInspectionPreviewRequest(message, boundTabId);
      if (preview) {
        if (!controller) return { kind: preview.kind, ok: false, tabId: preview.tabId, documentId: preview.documentId, sequence: preview.sequence };
        return controller.handlePreview(preview);
      }
      const request = validateInspectionRequest(message, boundTabId);
      if (!request) return undefined;
      return ensureController(request.tabId).handle(request);
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
