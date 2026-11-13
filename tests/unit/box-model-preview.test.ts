import { describe, expect, it, vi } from 'vitest';
import { createPaddingPreviewGeometry, createPaddingPreviewLayout, createPaddingPreviewPath } from '../../apps/extension/lib/box-model-preview';

type Style = Record<string, string>;

function target(style: Style, rect = { left: 0, top: 0, width: 100, height: 80 }, offset = { width: 100, height: 80 }) {
  vi.stubGlobal('getComputedStyle', () => style);
  return {
    isConnected: true,
    getClientRects: () => [rect],
    getBoundingClientRect: () => rect,
    offsetWidth: offset.width,
    offsetHeight: offset.height,
  } as unknown as Element;
}

function style(values: Partial<Style> = {}): Style {
  return {
    transform: 'none',
    borderTopWidth: '10px', borderRightWidth: '5px', borderBottomWidth: '8px', borderLeftWidth: '3px',
    paddingTop: '12px', paddingRight: '9px', paddingBottom: '6px', paddingLeft: '7px',
    ...values,
  };
}

describe('createPaddingPreviewLayout', () => {
  it('excludes border and content, leaving four physical padding strips', () => {
    expect(createPaddingPreviewLayout(target(style()))).toEqual({
      top: { left: 3, top: 10, width: 92, height: 12 },
      right: { left: 86, top: 22, width: 9, height: 44 },
      bottom: { left: 3, top: 66, width: 92, height: 6 },
      left: { left: 3, top: 22, width: 7, height: 44 },
    });
  });

  it('describes one outer ring and one content hole for rendering', () => {
    const geometry = createPaddingPreviewGeometry(target(style()));
    expect(geometry?.outer).toEqual({ left: 3, top: 10, width: 92, height: 62 });
    expect(geometry?.content).toEqual({ left: 10, top: 22, width: 76, height: 44 });
    expect(Object.keys(geometry?.layout ?? {})).toEqual(['top', 'right', 'bottom', 'left']);
    expect(createPaddingPreviewPath(geometry!)).toMatch(/^M [^M]+ M /);
    expect(createPaddingPreviewPath(geometry!).match(/M /g)).toHaveLength(2);
  });

  it('preserves zero-width padding without inventing geometry', () => {
    const layout = createPaddingPreviewLayout(target(style({
      borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px',
      paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
    })));
    expect(layout).toEqual({
      top: { left: 0, top: 0, width: 100, height: 0 },
      right: { left: 100, top: 0, width: 0, height: 80 },
      bottom: { left: 0, top: 80, width: 100, height: 0 },
      left: { left: 0, top: 0, width: 0, height: 80 },
    });
  });

  it('scales CSS insets into the rendered border box', () => {
    expect(createPaddingPreviewLayout(target(style({
      borderTopWidth: '2px', borderRightWidth: '2px', borderBottomWidth: '2px', borderLeftWidth: '2px',
      paddingTop: '3px', paddingRight: '4px', paddingBottom: '5px', paddingLeft: '6px',
    }), { left: 10, top: 20, width: 200, height: 160 }, { width: 100, height: 80 }))).toEqual({
      top: { left: 14, top: 24, width: 192, height: 6 },
      right: { left: 198, top: 30, width: 8, height: 136 },
      bottom: { left: 14, top: 166, width: 192, height: 10 },
      left: { left: 14, top: 30, width: 12, height: 136 },
    });
  });

  it('suppresses rotated or skewed transforms', () => {
    expect(createPaddingPreviewLayout(target(style({ transform: 'matrix(0, 1, -1, 0, 0, 0)' })))).toBeUndefined();
    expect(createPaddingPreviewLayout(target(style({ transform: 'matrix(2, 0, 0, 2, 0, 0)' }), { left: 0, top: 0, width: 200, height: 160 }, { width: 100, height: 80 }))).toBeDefined();
  });
});
