import { createSignal } from 'solid-js';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createPicker, type Picker } from './picking';
import { createModifierController } from './modifiers';
import { createSelectionController } from './selection';
import type { ElementSnapshot } from './element-snapshot';
import { createTrackingController, type TrackingController } from './tracking';
import { mountSessionUi } from './ui';

export type PaddingPreview = Readonly<{
  selectionId: string;
  sequence: number;
}>;

export type PaddingPreviewIntent = Readonly<{
  selectionId: string;
  visible: boolean;
  sequence: number;
  streamEpoch?: number;
}>;

export type InspectionSession = {
  readonly isDisposed: boolean;
  setPaddingPreview?: (intent: PaddingPreviewIntent) => void;
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
  // Preview ordering is a pair: the persisted background stream epoch fences
  // packets from a retired MV3 worker, while the sequence orders packets in
  // one worker stream.
  let lastPreviewEpoch = -1;
  let lastPreviewSequence = -1;
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
        const streamEpoch = intent.streamEpoch ?? 0;
        if (streamEpoch < lastPreviewEpoch ||
          (streamEpoch === lastPreviewEpoch && intent.sequence <= lastPreviewSequence)) return;
        lastPreviewEpoch = streamEpoch;
        lastPreviewSequence = intent.sequence;
        if (!intent.visible) {
          setPaddingPreview(undefined);
        } else if (selection.state().anchor?.selectionId === intent.selectionId) {
          setPaddingPreview({ selectionId: intent.selectionId, sequence: intent.sequence });
        }
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
