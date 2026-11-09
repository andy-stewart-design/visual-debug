import { describe, expect, it } from 'vitest';
import { formatCssPixels, formatCssPixelsWithUnit } from '../../apps/extension/lib/format';

describe('formatCssPixels', () => {
  it.each([
    [40, '40'],
    [40.04, '40'],
    [40.05, '40.1'],
    [1.25, '1.3'],
    [2.55, '2.6'],
    [100.0, '100'],
    [0, '0'],
    [-0, '0'],
    [0.04, '0'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatCssPixels(value)).toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.1])(
    'rejects invalid distance %s',
    (value) => {
      expect(formatCssPixels(value)).toBeUndefined();
    },
  );

  it('can add the optional CSS-pixel suffix', () => {
    expect(formatCssPixelsWithUnit(40.05)).toBe('40.1px');
    expect(formatCssPixelsWithUnit(-1)).toBeUndefined();
  });
});
