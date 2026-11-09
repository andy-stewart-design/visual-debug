import { describe, expect, it } from 'vitest';
import { measureRectangles, type Rectangle } from '../../apps/extension/lib/geometry';

const rectangle = (left: number, top: number, width: number, height: number): Rectangle => ({
  left,
  top,
  width,
  height,
});

describe('measureRectangles', () => {
  it.each([
    {
      name: 'horizontal gap',
      anchor: rectangle(0, 0, 100, 100),
      comparison: rectangle(140, 0, 100, 100),
      expected: {
        relationship: 'separation',
        gaps: [{ axis: 'horizontal', distance: 40, direction: 'right' }],
      },
    },
    {
      name: 'diagonal gaps',
      anchor: rectangle(0, 0, 100, 100),
      comparison: rectangle(140, 160, 100, 100),
      expected: {
        relationship: 'separation',
        gaps: [
          { axis: 'horizontal', distance: 40, direction: 'right' },
          { axis: 'vertical', distance: 60, direction: 'below' },
        ],
      },
    },
    {
      name: 'partial overlap',
      anchor: rectangle(0, 0, 100, 100),
      comparison: rectangle(50, 50, 100, 100),
      expected: {
        relationship: 'overlap',
        exact: false,
        bounds: { left: 50, top: 50, right: 100, bottom: 100 },
        size: { width: 50, height: 50 },
      },
    },
    {
      name: 'edge touching',
      anchor: rectangle(0, 0, 100, 100),
      comparison: rectangle(100, 0, 100, 100),
      expected: {
        relationship: 'separation',
        gaps: [{ axis: 'horizontal', distance: 0, direction: 'right' }],
      },
    },
    {
      name: 'vertical gap with negative viewport coordinates',
      anchor: rectangle(-50, 20, 20, 30),
      comparison: rectangle(-50, 70, 20, 10),
      expected: {
        relationship: 'separation',
        gaps: [{ axis: 'vertical', distance: 20, direction: 'below' }],
      },
    },
  ])('$name', ({ anchor, comparison, expected }) => {
    expect(measureRectangles(anchor, comparison)).toEqual(expected);
  });

  it('returns both axes for a corner touch deterministically', () => {
    expect(
      measureRectangles(rectangle(0, 0, 10, 10), rectangle(10, 10, 5, 5)),
    ).toEqual({
      relationship: 'separation',
      gaps: [
        { axis: 'horizontal', distance: 0, direction: 'right' },
        { axis: 'vertical', distance: 0, direction: 'below' },
      ],
    });
  });

  it('reports reversed separation directions', () => {
    expect(
      measureRectangles(rectangle(140, 160, 100, 100), rectangle(0, 0, 100, 100)),
    ).toEqual({
      relationship: 'separation',
      gaps: [
        { axis: 'horizontal', distance: 40, direction: 'left' },
        { axis: 'vertical', distance: 60, direction: 'above' },
      ],
    });
  });

  it.each([
    {
      name: 'fractional horizontal touching',
      anchor: rectangle(0.1, 0, 0.2, 1),
      comparison: rectangle(0.3, 0, 0.2, 1),
      gap: { axis: 'horizontal', distance: 0, direction: 'right' },
    },
    {
      name: 'fractional horizontal touching in reversed order',
      anchor: rectangle(0.3, 0, 0.2, 1),
      comparison: rectangle(0.1, 0, 0.2, 1),
      gap: { axis: 'horizontal', distance: 0, direction: 'left' },
    },
    {
      name: 'fractional vertical touching',
      anchor: rectangle(0, 0.1, 1, 0.2),
      comparison: rectangle(0, 0.3, 1, 0.2),
      gap: { axis: 'vertical', distance: 0, direction: 'below' },
    },
    {
      name: 'fractional vertical touching in reversed order',
      anchor: rectangle(0, 0.3, 1, 0.2),
      comparison: rectangle(0, 0.1, 1, 0.2),
      gap: { axis: 'vertical', distance: 0, direction: 'above' },
    },
  ])('$name is classified as touching', ({ anchor, comparison, gap }) => {
    expect(measureRectangles(anchor, comparison)).toEqual({
      relationship: 'separation',
      gaps: [gap],
    });
  });

  it('preserves a real fractional gap above the comparison tolerance', () => {
    const anchor = rectangle(0, 0, 0.2, 1);
    const comparison = rectangle(0.2000002, 0, 0.2, 1);

    expect(measureRectangles(anchor, comparison)).toEqual({
      relationship: 'separation',
      gaps: [{ axis: 'horizontal', distance: 0.2000002 - 0.2, direction: 'right' }],
    });
  });

  it.each([
    {
      name: 'anchor contains comparison',
      anchor: rectangle(0, 0, 200, 200),
      comparison: rectangle(20, 30, 50, 60),
      inner: 'comparison',
      outer: 'anchor',
      insets: { left: 20, top: 30, right: 130, bottom: 110 },
    },
    {
      name: 'comparison contains anchor in reversed order',
      anchor: rectangle(20, 30, 50, 60),
      comparison: rectangle(0, 0, 200, 200),
      inner: 'anchor',
      outer: 'comparison',
      insets: { left: 20, top: 30, right: 130, bottom: 110 },
    },
    {
      name: 'shared edges remain containment',
      anchor: rectangle(0, 0, 100, 100),
      comparison: rectangle(0, 20, 100, 40),
      inner: 'comparison',
      outer: 'anchor',
      insets: { left: 0, top: 20, right: 0, bottom: 40 },
    },
    {
      name: 'fractional shared edge remains containment',
      anchor: rectangle(0.1, 0, 0.5, 1),
      comparison: rectangle(0.2, 0.2, 0.4, 0.4),
      inner: 'comparison',
      outer: 'anchor',
      insets: { left: 0.2 - 0.1, top: 0.2, right: 0, bottom: 1 - (0.2 + 0.4) },
    },
  ])('$name', ({ anchor, comparison, inner, outer, insets }) => {
    expect(measureRectangles(anchor, comparison)).toEqual({
      relationship: 'containment',
      inner,
      outer,
      insets,
    });
  });

  it('represents equality as exact overlap', () => {
    expect(measureRectangles(rectangle(-10.5, 2.25, 40.5, 30.75), rectangle(-10.5, 2.25, 40.5, 30.75))).toEqual({
      relationship: 'overlap',
      exact: true,
      bounds: { left: -10.5, top: 2.25, right: 30, bottom: 33 },
      size: { width: 40.5, height: 30.75 },
    });
  });

  it('treats a roundoff-only edge difference as equality', () => {
    expect(measureRectangles(rectangle(0.1, 0.2, 0.2, 0.3), rectangle(0.1, 0.2, 0.3 - 0.1, 0.3))).toEqual({
      relationship: 'overlap',
      exact: true,
      bounds: { left: 0.1, top: 0.2, right: 0.30000000000000004, bottom: 0.5 },
      size: { width: 0.30000000000000004 - 0.1, height: 0.3 },
    });
  });

  it.each([
    { name: 'zero width', anchor: rectangle(0, 0, 0, 10), comparison: rectangle(0, 0, 10, 10), invalid: 'anchor' },
    { name: 'negative height', anchor: rectangle(0, 0, 10, -1), comparison: rectangle(0, 0, 10, 10), invalid: 'anchor' },
    { name: 'nonfinite position', anchor: rectangle(Number.NaN, 0, 10, 10), comparison: rectangle(0, 0, 10, 10), invalid: 'anchor' },
    { name: 'overflowing right edge', anchor: rectangle(Number.MAX_VALUE, 0, Number.MAX_VALUE, 10), comparison: rectangle(0, 0, 10, 10), invalid: 'anchor' },
    { name: 'both invalid', anchor: rectangle(0, 0, 10, Infinity), comparison: rectangle(0, 0, 0, 10), invalid: 'both' },
  ])('$name returns no measurement', ({ anchor, comparison, invalid }) => {
    expect(measureRectangles(anchor, comparison)).toEqual({ relationship: 'invalid', invalid });
  });
});
