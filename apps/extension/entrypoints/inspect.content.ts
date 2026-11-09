import { browser } from 'wxt/browser';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createInspectionSession, type InspectionSession } from '../lib/session';

const TOGGLE_MESSAGE = 'visual-debug:toggle-inspection';

type ToggleResponse =
  | { kind: typeof TOGGLE_MESSAGE; ok: true; active: boolean }
  | { kind: typeof TOGGLE_MESSAGE; ok: false; error: string };

function messageIsToggle(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === TOGGLE_MESSAGE
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default defineContentScript({
  registration: 'runtime',
  matches: [],
  allFrames: false,
  cssInjectionMode: 'ui',
  noScriptStartedPostMessage: true,
  main(ctx: ContentScriptContext) {
    let session: InspectionSession | undefined;
    let shuttingDown = false;
    let toggleQueue = Promise.resolve();

    const clearSession = () => {
      session?.dispose();
      session = undefined;
    };

    const runToggle = async (): Promise<ToggleResponse> => {
      if (shuttingDown) {
        return {
          kind: TOGGLE_MESSAGE,
          ok: false,
          error: 'The inspection page context is no longer available.',
        };
      }

      if (session && !session.isDisposed) {
        clearSession();
        return { kind: TOGGLE_MESSAGE, ok: true, active: false };
      }

      session = undefined;
      let created: InspectionSession | undefined;
      try {
        created = await createInspectionSession(ctx, () => {
          if (session === created) session = undefined;
        });
        if (created.isDisposed) {
          throw new Error('The inspection session was disposed during startup.');
        }
        session = created;
        return { kind: TOGGLE_MESSAGE, ok: true, active: true };
      } catch (error) {
        created?.dispose();
        session = undefined;
        return { kind: TOGGLE_MESSAGE, ok: false, error: errorMessage(error) };
      }
    };

    const queueToggle = (): Promise<ToggleResponse> => {
      const operation = toggleQueue.then(runToggle, runToggle);
      toggleQueue = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    };

    const onMessage = (message: unknown, sender: Browser.runtime.MessageSender) => {
      if (
        !messageIsToggle(message) ||
        sender.id !== browser.runtime.id ||
        (sender.frameId !== undefined && sender.frameId !== 0)
      ) {
        return undefined;
      }
      return queueToggle();
    };

    browser.runtime.onMessage.addListener(onMessage);
    ctx.addEventListener(window, 'wxt:locationchange', clearSession);
    ctx.onInvalidated(() => {
      shuttingDown = true;
      browser.runtime.onMessage.removeListener(onMessage);
      clearSession();
      toggleQueue = Promise.resolve();
    });

    return { kind: TOGGLE_MESSAGE, ok: true, active: false };
  },
});
