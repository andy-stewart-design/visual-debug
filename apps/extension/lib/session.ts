import type { ContentScriptContext } from 'wxt/utils/content-script-context';
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

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('keydown', onKeyDown, true);
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
    sessionUi = await mountSessionUi(ctx, dispose);

    if (ctx.isInvalid || disposed) {
      sessionUi?.remove();
      sessionUi = undefined;
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
