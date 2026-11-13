export type PreviewRect = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type PaddingPreviewLayout = Readonly<{
  top: PreviewRect;
  right: PreviewRect;
  bottom: PreviewRect;
  left: PreviewRect;
}>;

export type PaddingPreviewGeometry = Readonly<{
  outer: PreviewRect;
  content: PreviewRect;
  layout: PaddingPreviewLayout;
}>;

type BoxValues = Readonly<{ top: number; right: number; bottom: number; left: number }>;

const positive = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const rect = (left: number, top: number, right: number, bottom: number): PreviewRect => ({
  left,
  top,
  width: Math.max(0, right - left),
  height: Math.max(0, bottom - top),
});

/**
 * Computes physical padding geometry from one ordinary, axis-aligned element.
 * Border and padding are CSS pixels, so they are scaled into the rendered
 * border box before being inset. Rotated/skewed/fragmented elements are
 * intentionally suppressed rather than painted with misleading rectangles.
 */
export function createPaddingPreviewGeometry(target: Element): PaddingPreviewGeometry | undefined {
  if (!target.isConnected || target.getClientRects().length !== 1) return undefined;
  const bounds = target.getBoundingClientRect();
  if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return undefined;

  const style = getComputedStyle(target);
  const transform = style.transform;
  if (transform !== 'none') {
    const matrix = transform.match(/^matrix\(([^)]+)\)$/);
    if (!matrix) return undefined;
    const values = matrix[1]!.split(',').map((value) => Number.parseFloat(value.trim()));
    // b/c non-zero means rotation or skew. Negative axis scales are also
    // hidden because physical side ordering would no longer be trustworthy.
    if (values.length !== 6 || !values.every(Number.isFinite) || Math.abs(values[1]!) > 1e-6 ||
      Math.abs(values[2]!) > 1e-6 || values[0]! <= 0 || values[3]! <= 0) return undefined;
  }

  const readBox = (top: string, right: string, bottom: string, left: string): BoxValues | undefined => {
    const values = [positive(top), positive(right), positive(bottom), positive(left)];
    if (values.some((value) => value === undefined)) return undefined;
    return { top: values[0]!, right: values[1]!, bottom: values[2]!, left: values[3]! };
  };
  const border = readBox(style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth);
  const padding = readBox(style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft);
  if (!border || !padding) return undefined;

  // offsetWidth/Height are the untransformed border-box dimensions. The
  // ratio also covers ordinary CSS zoom and axis-aligned scale transforms.
  const offsetWidth = 'offsetWidth' in target && typeof target.offsetWidth === 'number' ? target.offsetWidth : 0;
  const offsetHeight = 'offsetHeight' in target && typeof target.offsetHeight === 'number' ? target.offsetHeight : 0;
  const scaleX = offsetWidth > 0 ? bounds.width / offsetWidth : 1;
  const scaleY = offsetHeight > 0 ? bounds.height / offsetHeight : 1;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) return undefined;

  const outerRight = bounds.left + bounds.width;
  const outerBottom = bounds.top + bounds.height;
  const innerLeft = Math.min(outerRight, bounds.left + border.left * scaleX);
  const innerRight = Math.max(innerLeft, outerRight - border.right * scaleX);
  const innerTop = Math.min(outerBottom, bounds.top + border.top * scaleY);
  const innerBottom = Math.max(innerTop, outerBottom - border.bottom * scaleY);
  const contentLeft = Math.min(innerRight, innerLeft + padding.left * scaleX);
  const contentRight = Math.max(contentLeft, innerRight - padding.right * scaleX);
  const contentTop = Math.min(innerBottom, innerTop + padding.top * scaleY);
  const contentBottom = Math.max(contentTop, innerBottom - padding.bottom * scaleY);
  const outer = rect(innerLeft, innerTop, innerRight, innerBottom);
  const content = rect(contentLeft, contentTop, contentRight, contentBottom);

  return {
    outer,
    content,
    layout: {
      top: rect(innerLeft, innerTop, innerRight, contentTop),
      right: rect(contentRight, contentTop, innerRight, contentBottom),
      bottom: rect(innerLeft, contentBottom, innerRight, innerBottom),
      left: rect(innerLeft, contentTop, contentLeft, contentBottom),
    },
  };
}

export function createPaddingPreviewPath(geometry: PaddingPreviewGeometry): string {
  const { outer, content } = geometry;
  const x = content.left - outer.left;
  const y = content.top - outer.top;
  return [
    `M 0 0 H ${outer.width} V ${outer.height} H 0 Z`,
    `M ${x} ${y} H ${x + content.width} V ${y + content.height} H ${x} Z`,
  ].join(' ');
}

export function createPaddingPreviewLayout(target: Element): PaddingPreviewLayout | undefined {
  return createPaddingPreviewGeometry(target)?.layout;
}
