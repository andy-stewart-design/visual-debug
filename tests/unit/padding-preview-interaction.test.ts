import { describe, expect, it } from 'vitest';
import {
  isPaddingPreviewActive,
  updatePaddingPreviewInteraction,
  type PaddingPreviewInteraction,
} from '../../apps/extension/lib/padding-preview-interaction';

const transition = (state: PaddingPreviewInteraction, event: Parameters<typeof updatePaddingPreviewInteraction>[1]) =>
  updatePaddingPreviewInteraction(state, event);

const initial = (): PaddingPreviewInteraction => ({ hovered: false, focused: false });

describe('padding preview interaction', () => {
  it('hides after hover-only leave and focus-only blur', () => {
    expect(isPaddingPreviewActive(transition(initial(), { type: 'pointer-enter' }))).toBe(true);
    expect(isPaddingPreviewActive(transition({ hovered: true, focused: false }, { type: 'pointer-leave' }))).toBe(false);
    expect(isPaddingPreviewActive(transition(initial(), { type: 'focus-enter' }))).toBe(true);
    expect(isPaddingPreviewActive(transition({ hovered: false, focused: true }, { type: 'focus-leave', stillWithin: false }))).toBe(false);
  });

  it('keeps the preview while either hover or focus remains active', () => {
    const both = transition(transition(initial(), { type: 'pointer-enter' }), { type: 'focus-enter' });
    expect(isPaddingPreviewActive(both)).toBe(true);
    expect(isPaddingPreviewActive(transition(both, { type: 'pointer-leave' }))).toBe(true);
    expect(isPaddingPreviewActive(transition({ hovered: true, focused: true }, { type: 'focus-leave', stillWithin: false }))).toBe(true);
  });

  it('does not blur while focus moves between inputs in the section', () => {
    const focused = transition(initial(), { type: 'focus-enter' });
    const moved = transition(focused, { type: 'focus-leave', stillWithin: true });
    expect(moved.focused).toBe(true);
    expect(isPaddingPreviewActive(moved)).toBe(true);
    expect(transition(moved, { type: 'focus-leave', stillWithin: false }).focused).toBe(false);
  });
});
