import { render } from 'solid-js/web';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import App from '../App';
import type { SelectionController } from './selection';
import type { PaddingPreview } from './session';
import type { Accessor } from 'solid-js';
import './ui.css';

type MountedUi = {
  dispose: () => void;
};

export type SessionUi = {
  remove: () => void;
  isUiConnected: () => boolean;
  isOwnEvent: (event: Event) => boolean;
  isOwnElement: (element: Element) => boolean;
};

export async function mountSessionUi(
  ctx: ContentScriptContext,
  selection: SelectionController,
  held: Accessor<boolean>,
  preview: Accessor<PaddingPreview | undefined>,
): Promise<SessionUi> {
  let solidDisposed = false;
  const mounted: MountedUi = {
    dispose: () => {
      if (solidDisposed) return;
      solidDisposed = true;
      solidDispose?.();
      solidDispose = undefined;
    },
  };
  let solidDispose: (() => void) | undefined;
  let removed = false;

  const ui = await createShadowRootUi(ctx, {
    name: 'visual-debug-inspection',
    position: 'overlay',
    zIndex: 2147483647,
    isolateEvents: [
      'keydown',
      'keyup',
      'keypress',
      'pointerdown',
      'pointerup',
      'pointermove',
      'pointercancel',
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'auxclick',
      'contextmenu',
      'touchstart',
      'touchend',
      'touchcancel',
    ],
    onMount(uiContainer) {
      solidDispose = render(
        () => <App selection={selection.state} held={held} preview={preview} getAnchor={() => selection.getTargets().anchor} />,
        uiContainer,
      );
      return mounted;
    },
    onRemove(mountedUi) {
      removed = true;
      mountedUi?.dispose();
    },
  });
  try {
    if (ctx.isInvalid) throw new Error('The inspection page context became invalid.');
    ui.mount();
  } catch (error) {
    if (!removed) {
      removed = true;
      ui.remove();
    }
    throw error;
  }

  const shadowHost = ui.shadowHost;
  const isOwnEvent = (event: Event) => event.composedPath().includes(shadowHost);
  const isOwnElement = (element: Element) => element === shadowHost || shadowHost.contains(element);

  return {
    isUiConnected: () => shadowHost.isConnected,
    isOwnEvent,
    isOwnElement,
    remove: () => {
      if (removed) return;
      removed = true;
      ui.remove();
    },
  };
}
