import { describe, expect, it } from 'vitest';
import { reduceModifierState, type ModifierState } from '../../apps/extension/lib/modifiers';

const initial: ModifierState = { held: false, keys: [] };

const transition = (state: ModifierState, key: 'AltLeft' | 'AltRight', type: 'keydown' | 'keyup', repeat = false) =>
  reduceModifierState(state, { type, key, ...(type === 'keydown' ? { repeat } : {}) });

describe('reduceModifierState', () => {
  it('requires a fresh non-repeat keydown after clear', () => {
    const held = transition(initial, 'AltLeft', 'keydown');
    expect(held.held).toBe(true);
    expect(reduceModifierState(held, { type: 'clear' })).toEqual(initial);
    expect(reduceModifierState(initial, { type: 'keydown', key: 'AltLeft', repeat: true })).toEqual(initial);
    expect(transition(initial, 'AltLeft', 'keydown').held).toBe(true);
  });

  it('keeps Option held while either side remains down', () => {
    const left = transition(initial, 'AltLeft', 'keydown');
    const both = transition(left, 'AltRight', 'keydown');
    const rightOnly = transition(both, 'AltLeft', 'keyup');
    expect(rightOnly).toEqual({ held: true, keys: ['AltRight'] });
    expect(transition(rightOnly, 'AltRight', 'keyup')).toEqual(initial);
  });

  it('ignores keyup for an already-cleared key', () => {
    const held = transition(initial, 'AltLeft', 'keydown');
    expect(reduceModifierState(held, { type: 'clear' })).toEqual(initial);
    expect(transition(initial, 'AltLeft', 'keyup')).toEqual(initial);
  });
});
