export type PaddingPreviewInteraction = Readonly<{
  hovered: boolean;
  focused: boolean;
}>;

export type PaddingPreviewInteractionEvent =
  | { type: 'pointer-enter' }
  | { type: 'pointer-leave' }
  | { type: 'focus-enter' }
  | { type: 'focus-leave'; stillWithin: boolean };

export function isPaddingPreviewActive(state: PaddingPreviewInteraction): boolean {
  return state.hovered || state.focused;
}

export function updatePaddingPreviewInteraction(
  state: PaddingPreviewInteraction,
  event: PaddingPreviewInteractionEvent,
): PaddingPreviewInteraction {
  switch (event.type) {
    case 'pointer-enter': return { ...state, hovered: true };
    case 'pointer-leave': return { ...state, hovered: false };
    case 'focus-enter': return { ...state, focused: true };
    case 'focus-leave': return { ...state, focused: event.stillWithin };
  }
}
