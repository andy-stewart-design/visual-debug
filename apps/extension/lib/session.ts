import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createPicker, type Picker } from './picking';
import { createSelectionController } from './selection';
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
  let refreshFrame: number | undefined;
  const selection = createSelectionController();

  const cancelRefresh = () => {
    if (refreshFrame !== undefined) {
      window.cancelAnimationFrame(refreshFrame);
      refreshFrame = undefined;
    }
  };

  const scheduleRefresh = () => {
    if (disposed || refreshFrame !== undefined) return;
    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = undefined;
      picker?.refreshPointer();
      selection.refresh();
    });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', scheduleRefresh, true);
    window.removeEventListener('resize', scheduleRefresh, true);
    cancelRefresh();
    picker?.dispose();
    picker = undefined;
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

  try {
    if (ctx.isInvalid) throw new Error('The inspection page context is no longer valid.');

    window.addEventListener('keydown', onKeyDown, true);
    removeInvalidationListener = ctx.onInvalidated(dispose);
    const mountedUi = await mountSessionUi(ctx, dispose, selection);
    if (disposed || ctx.isInvalid) {
      mountedUi.remove();
      throw new Error('The inspection page context became invalid during startup.');
    }

    sessionUi = mountedUi;
    picker = createPicker({
      isOwnEvent: mountedUi.isOwnEvent,
      isOwnElement: mountedUi.isOwnElement,
      onHover: selection.setHover,
      onSelect: selection.select,
    });
    window.addEventListener('scroll', scheduleRefresh, true);
    window.addEventListener('resize', scheduleRefresh, true);

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
