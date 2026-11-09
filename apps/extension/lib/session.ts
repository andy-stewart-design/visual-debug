import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createPicker, type Picker } from './picking';
import { createModifierController } from './modifiers';
import { createSelectionController } from './selection';
import { createTrackingController, type TrackingController } from './tracking';
import { mountSessionUi } from './ui';

export type InspectionSession = {
  readonly isDisposed: boolean;
  dispose: () => void;
};

export async function createInspectionSession(
  ctx: ContentScriptContext,
  onDisposed: () => void,
): Promise<InspectionSession> {
  let disposed = false;
  let removeInvalidationListener: (() => void) | undefined;
  let sessionUi: Awaited<ReturnType<typeof mountSessionUi>> | undefined;
  let picker: Picker | undefined;
  let tracking: TrackingController | undefined;
  const selection = createSelectionController();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('keydown', onKeyDown, true);
    tracking?.dispose();
    tracking = undefined;
    picker?.dispose();
    picker = undefined;
    modifiers.dispose();
    selection.dispose();
    removeInvalidationListener?.();
    removeInvalidationListener = undefined;
    sessionUi?.remove();
    sessionUi = undefined;
    onDisposed();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') dispose();
  };

  // Register before the asynchronous Shadow UI mount so an invalidated
  // startup cannot leave modifier listeners or held state behind.
  const modifiers = createModifierController(() => {
    if (disposed) return;
    picker?.refreshPointer();
    selection.refresh();
    tracking?.invalidate();
  });

  try {
    if (ctx.isInvalid) throw new Error('The inspection page context is no longer valid.');

    window.addEventListener('keydown', onKeyDown, true);
    removeInvalidationListener = ctx.onInvalidated(dispose);
    const mountedUi = await mountSessionUi(ctx, dispose, selection, modifiers.held);
    if (disposed || ctx.isInvalid) {
      mountedUi.remove();
      throw new Error('The inspection page context became invalid during startup.');
    }

    // Own the mounted UI before any later synchronous setup can fail.
    sessionUi = mountedUi;
    picker = createPicker({
      isOwnEvent: mountedUi.isOwnEvent,
      isOwnElement: mountedUi.isOwnElement,
      onHover: selection.setHover,
      onSelect: selection.select,
    });
    const createdTracking = createTrackingController({
      selection,
      picker,
      isMeasuring: modifiers.held,
      isOwnElement: mountedUi.isOwnElement,
      isUiConnected: mountedUi.isUiConnected,
      onUiDisconnected: dispose,
    });
    if (disposed) {
      // A detached-host check can synchronously exit during tracker creation,
      // before this session has a tracking reference to dispose.
      createdTracking.dispose();
      throw new Error('The inspection UI was removed during startup.');
    }
    tracking = createdTracking;

    if (ctx.isInvalid || disposed) {
      dispose();
      throw new Error('The inspection page context became invalid during startup.');
    }

    return {
      get isDisposed() {
        return disposed;
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
