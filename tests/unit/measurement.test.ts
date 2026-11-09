import { describe, expect, it } from 'vitest';
import { createMeasurementLayout } from '../../apps/extension/lib/measurement';
import type { Rectangle } from '../../apps/extension/lib/geometry';

const rectangle = (left: number, top: number, width: number, height: number): Rectangle => ({
  left,
  top,
  width,
  height,
});

describe('createMeasurementLayout', () => {
  it('places a horizontal neighbor line on the common projection midpoint', () => {
    expect(createMeasurementLayout(rectangle(0, 0, 100, 100), rectangle(140, 0, 100, 100))).toEqual({
      lines: [{ axis: 'horizontal', start: { x: 100, y: 50 }, end: { x: 140, y: 50 } }],
      labels: [{ text: '40px', position: { x: 120, y: 38 }, axis: 'horizontal' }],
    });
  });

  it('uses an L for diagonal separation and keeps each distance on its axis', () => {
    expect(createMeasurementLayout(rectangle(0, 0, 100, 100), rectangle(140, 160, 100, 100))).toEqual({
      lines: [
        { axis: 'horizontal', start: { x: 100, y: 100 }, end: { x: 140, y: 100 } },
        { axis: 'vertical', start: { x: 140, y: 100 }, end: { x: 140, y: 160 } },
      ],
      labels: [
        { text: '40px', position: { x: 120, y: 88 }, axis: 'horizontal' },
        { text: '60px', position: { x: 160, y: 130 }, axis: 'vertical' },
      ],
    });
  });

  it('reverses line endpoints for above-and-left comparisons', () => {
    expect(createMeasurementLayout(rectangle(140, 160, 100, 100), rectangle(0, 0, 100, 100))).toEqual({
      lines: [
        { axis: 'horizontal', start: { x: 140, y: 160 }, end: { x: 100, y: 160 } },
        { axis: 'vertical', start: { x: 100, y: 160 }, end: { x: 100, y: 100 } },
      ],
      labels: [
        { text: '40px', position: { x: 120, y: 148 }, axis: 'horizontal' },
        { text: '60px', position: { x: 120, y: 130 }, axis: 'vertical' },
      ],
    });
  });

  it('renders all four containment insets, including zero values', () => {
    const layout = createMeasurementLayout(rectangle(0, 0, 200, 200), rectangle(20, 30, 50, 60));
    expect(layout?.lines).toHaveLength(4);
    expect(layout?.labels.map(({ text }) => text)).toEqual(['20px', '30px', '130px', '110px']);
    expect(layout?.lines).toEqual([
      { axis: 'horizontal', start: { x: 0, y: 60 }, end: { x: 20, y: 60 } },
      { axis: 'vertical', start: { x: 45, y: 0 }, end: { x: 45, y: 30 } },
      { axis: 'horizontal', start: { x: 70, y: 60 }, end: { x: 200, y: 60 } },
      { axis: 'vertical', start: { x: 45, y: 90 }, end: { x: 45, y: 200 } },
    ]);

    const touchingInsets = createMeasurementLayout(rectangle(0, 0, 100, 100), rectangle(0, 20, 100, 40));
    expect(touchingInsets?.labels.map(({ text }) => text)).toEqual(['0px', '20px', '0px', '40px']);
  });

  it('uses a compact overlap label and suppresses invalid pairs', () => {
    expect(createMeasurementLayout(rectangle(0, 0, 100, 100), rectangle(50, 50, 100, 100))).toEqual({
      lines: [],
      labels: [{ text: 'Overlap', position: { x: 75, y: 75 } }],
    });
    expect(createMeasurementLayout(rectangle(0, 0, 0, 100), rectangle(1, 1, 10, 10))).toBeUndefined();
  });

  it('clamps approximate label bounds to the viewport', () => {
    const layout = createMeasurementLayout(rectangle(-100, -100, 10, 10), rectangle(200, -100, 10, 10), {
      width: 240,
      height: 120,
    });
    expect(layout?.labels[0].position).toEqual({ x: 55, y: 10 });
  });
});
