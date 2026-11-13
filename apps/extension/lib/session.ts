import { createSignal } from 'solid-js';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createPicker, type Picker } from './picking';
import { createModifierController } from './modifiers';
import { createSelectionController } from './selection';
import type { ElementSnapshot } from './element-snapshot';
import { applyPaddingStyleEdit, type PaddingSide } from './style-edit';
import { createTrackingController, type TrackingController } from './tracking';
import { mountSessionUi } from './ui';

export type PaddingPreview = Readonly<{
  selectionId: string;
}>;

export type PaddingPreviewIntent = Readonly<{
  selectionId: string;
  visible: boolean;
}>;

export type InspectionSession = {
  readonly isDisposed: boolean;
  setPaddingPreview?: (intent: PaddingPreviewIntent) => void;
  editStyle?: (request: { selectionId: string; side: PaddingSide; value: number }) => { ok: boolean; selection?: ElementSnapshot; error?: string };
  dispose: () => void;
};

export async function createInspectionSession(
  ctx: ContentScriptContext,
  onDisposed: () => void,
  signal?: AbortSignal,
  onSelection?: (selection: ElementSnapshot | undefined) => void,
): Promise<InspectionSession> {
  let disposed = false;
  let removeInvalidationListener: (() => void) | undefined;
  let sessionUi: Awaited<ReturnType<typeof mountSessionUi>> | undefined;
  let picker: Picker | undefined;
  let tracking: TrackingController | undefined;
  let removeSelectionListener: (() => void) | undefined;
  const [paddingPreview, setPaddingPreview] = createSignal<PaddingPreview | undefined>();
  const selection = createSelectionController();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener('abort', dispose);
    window.removeEventListener('keydown', onKeyDown, true);
    tracking?.dispose();
    tracking = undefined;
    picker?.dispose();
    picker = undefined;
    modifiers.dispose();
    selection.dispose();
    setPaddingPreview(undefined);
    removeSelectionListener?.();
    removeSelectionListener = undefined;
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
    if (ctx.isInvalid || signal?.aborted) throw new Error('The inspection page context is no longer valid.');

    signal?.addEventListener('abort', dispose, { once: true });
    window.addEventListener('keydown', onKeyDown, true);
    removeInvalidationListener = ctx.onInvalidated(dispose);
    const mountedUi = await mountSessionUi(ctx, selection, modifiers.held, paddingPreview);
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
    removeSelectionListener = selection.subscribeSelection((next) => {
      if (paddingPreview()?.selectionId !== next?.selectionId) setPaddingPreview(undefined);
      onSelection?.(next);
    });

    if (ctx.isInvalid || disposed) {
      dispose();
      throw new Error('The inspection page context became invalid during startup.');
    }

    return {
      get isDisposed() {
        return disposed;
      },
      setPaddingPreview(intent) {
        if (disposed) return;
        if (!intent.visible) {
          setPaddingPreview(undefined);
        } else if (selection.state().anchor?.selectionId === intent.selectionId) {
          setPaddingPreview({ selectionId: intent.selectionId });
        }
      },
      editStyle(request) {
        if (disposed) return { ok: false, error: 'The inspection session is no longer active.' };
        const target = selection.getTargets().anchor;
        if (!target || !target.isConnected || selection.state().anchor?.selectionId !== request.selectionId) {
          return { ok: false, error: 'The selected element is no longer current.' };
        }
        if (!applyPaddingStyleEdit(target, request.side, request.value)) {
          return { ok: false, error: 'The selected element is no longer editable.' };
        }
        // Refresh synchronously so the page-computed value, dimensions, outlines,
        // measurements, and padding preview all use the cascade's readback.
        selection.refresh();
        return { ok: true, selection: selection.state().anchor };
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
