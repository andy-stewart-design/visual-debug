import { createSignal, type Accessor } from 'solid-js';

export type ModifierKey = 'Alt' | 'AltLeft' | 'AltRight';

export type ModifierState = Readonly<{
  readonly held: boolean;
  readonly keys: readonly ModifierKey[];
}>;

export type ModifierTransition =
  | Readonly<{ type: 'keydown'; key: ModifierKey; repeat?: boolean }>
  | Readonly<{ type: 'keyup'; key: ModifierKey }>
  | Readonly<{ type: 'clear' }>;

const emptyState: ModifierState = { held: false, keys: [] };

/** Pure Option/Alt state transition. A clear requires a fresh keydown. */
export function reduceModifierState(
  state: ModifierState,
  transition: ModifierTransition,
): ModifierState {
  if (transition.type === 'clear') return emptyState;
  if (transition.type === 'keydown' && transition.repeat) return state;

  const keys = new Set(state.keys);
  if (transition.type === 'keydown') keys.add(transition.key);
  else keys.delete(transition.key);

  const nextKeys = [...keys];
  return { held: nextKeys.length > 0, keys: nextKeys };
}

function eventModifierKey(event: KeyboardEvent): ModifierKey | undefined {
  if (event.code === 'AltLeft') return 'AltLeft';
  if (event.code === 'AltRight') return 'AltRight';
  return event.key === 'Alt' ? 'Alt' : undefined;
}

export type ModifierController = Readonly<{
  held: Accessor<boolean>;
  dispose: () => void;
}>;

/** Owns temporary Option/Alt state for one inspection session. */
export function createModifierController(onChange?: () => void): ModifierController {
  const [held, setHeld] = createSignal(false);
  let state: ModifierState = emptyState;
  let disposed = false;

  const publish = (next: ModifierState) => {
    if (disposed || (next.held === state.held && next.keys.join('|') === state.keys.join('|'))) return;
    state = next;
    setHeld(next.held);
    onChange?.();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const key = eventModifierKey(event);
    if (key) publish(reduceModifierState(state, { type: 'keydown', key, repeat: event.repeat }));
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const key = eventModifierKey(event);
    if (key) publish(reduceModifierState(state, { type: 'keyup', key }));
  };

  const clear = () => publish(reduceModifierState(state, { type: 'clear' }));
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') clear();
  };

  const wheelOptions = { capture: true, passive: false } as const;
  const onWheel = (event: WheelEvent) => {
    if (!disposed && event.altKey) event.preventDefault();
  };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  // Only actual window blur clears this state; descendant focus changes do not.
  window.addEventListener('blur', clear, false);
  document.addEventListener('visibilitychange', onVisibilityChange, true);
  window.addEventListener('wheel', onWheel, wheelOptions);

  return {
    held,
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', clear, false);
      document.removeEventListener('visibilitychange', onVisibilityChange, true);
      window.removeEventListener('wheel', onWheel, wheelOptions);
      state = emptyState;
      setHeld(false);
    },
  };
}
