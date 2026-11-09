import { formatCssPixelsWithUnit } from './format';
import { measureRectangles, type MeasurementResult, type Rectangle } from './geometry';

export type MeasurementPoint = Readonly<{ x: number; y: number }>;
export type MeasurementLine = Readonly<{
  axis: 'horizontal' | 'vertical';
  start: MeasurementPoint;
  end: MeasurementPoint;
}>;
export type MeasurementLabel = Readonly<{
  text: string;
  position: MeasurementPoint;
  axis?: 'horizontal' | 'vertical';
}>;
export type MeasurementLayout = Readonly<{
  lines: readonly MeasurementLine[];
  labels: readonly MeasurementLabel[];
}>;
export type MeasurementViewport = Readonly<{ width: number; height: number }>;

const LABEL_HEIGHT = 20;
const LABEL_HORIZONTAL_PADDING = 9;

function point(x: number, y: number): MeasurementPoint {
  return { x, y };
}

function midpoint(first: number, second: number): number {
  return (first + second) / 2;
}

function edges(rectangle: Rectangle) {
  return {
    left: rectangle.left,
    top: rectangle.top,
    right: rectangle.left + rectangle.width,
    bottom: rectangle.top + rectangle.height,
  };
}

function commonMidpoint(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number) {
  const start = Math.max(firstStart, secondStart);
  const end = Math.min(firstEnd, secondEnd);
  return end >= start ? midpoint(start, end) : undefined;
}

function labelWidth(text: string): number {
  return Math.max(30, text.length * 7 + LABEL_HORIZONTAL_PADDING * 2);
}

function clampLabel(
  label: MeasurementLabel,
  viewport: MeasurementViewport | undefined,
): MeasurementLabel {
  if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
    return label;
  }

  const halfWidth = labelWidth(label.text) / 2;
  const halfHeight = LABEL_HEIGHT / 2;
  return {
    ...label,
    position: point(
      Math.min(Math.max(label.position.x, halfWidth), Math.max(halfWidth, viewport.width - halfWidth)),
      Math.min(Math.max(label.position.y, halfHeight), Math.max(halfHeight, viewport.height - halfHeight)),
    ),
  };
}

function labeledLine(
  axis: 'horizontal' | 'vertical',
  start: MeasurementPoint,
  end: MeasurementPoint,
  text: string,
  position: MeasurementPoint,
  viewport: MeasurementViewport | undefined,
): { line: MeasurementLine; label: MeasurementLabel } {
  return {
    line: { axis, start, end },
    label: clampLabel({ text, position, axis }, viewport),
  };
}

function separationLayout(
  anchor: Rectangle,
  comparison: Rectangle,
  result: Extract<MeasurementResult, { relationship: 'separation' }>,
  viewport: MeasurementViewport | undefined,
): MeasurementLayout {
  const a = edges(anchor);
  const c = edges(comparison);
  const horizontal = result.gaps.find((gap) => gap.axis === 'horizontal');
  const vertical = result.gaps.find((gap) => gap.axis === 'vertical');
  const lines: MeasurementLine[] = [];
  const labels: MeasurementLabel[] = [];

  // With two separating axes, use a compact L at the nearest corners. Each
  // segment still measures exactly one CSS-pixel gap rather than a diagonal.
  if (horizontal && vertical) {
    const horizontalY = vertical.direction === 'below' ? a.bottom : a.top;
    const verticalY = vertical.direction === 'below' ? c.top : c.bottom;
    const horizontalStart = horizontal.direction === 'right' ? a.right : a.left;
    const horizontalEnd = horizontal.direction === 'right' ? c.left : c.right;
    const verticalX = horizontal.direction === 'right' ? c.left : c.right;
    const horizontalResult = labeledLine(
      'horizontal',
      point(horizontalStart, horizontalY),
      point(horizontalEnd, horizontalY),
      formatCssPixelsWithUnit(horizontal.distance) ?? '',
      point(midpoint(horizontalStart, horizontalEnd), horizontalY - 12),
      viewport,
    );
    const verticalResult = labeledLine(
      'vertical',
      point(verticalX, horizontalY),
      point(verticalX, verticalY),
      formatCssPixelsWithUnit(vertical.distance) ?? '',
      point(verticalX + 20, midpoint(horizontalY, verticalY)),
      viewport,
    );
    lines.push(horizontalResult.line, verticalResult.line);
    labels.push(horizontalResult.label, verticalResult.label);
    return { lines, labels };
  }

  if (horizontal) {
    const y = commonMidpoint(a.top, a.bottom, c.top, c.bottom) ?? midpoint(
      horizontal.direction === 'right' ? a.bottom : a.top,
      horizontal.direction === 'right' ? c.top : c.bottom,
    );
    const startX = horizontal.direction === 'right' ? a.right : a.left;
    const endX = horizontal.direction === 'right' ? c.left : c.right;
    const resultLine = labeledLine(
      'horizontal',
      point(startX, y),
      point(endX, y),
      formatCssPixelsWithUnit(horizontal.distance) ?? '',
      point(midpoint(startX, endX), y - 12),
      viewport,
    );
    lines.push(resultLine.line);
    labels.push(resultLine.label);
  }

  if (vertical) {
    const x = commonMidpoint(a.left, a.right, c.left, c.right) ?? midpoint(
      vertical.direction === 'below' ? a.right : a.left,
      vertical.direction === 'below' ? c.left : c.right,
    );
    const startY = vertical.direction === 'below' ? a.bottom : a.top;
    const endY = vertical.direction === 'below' ? c.top : c.bottom;
    const resultLine = labeledLine(
      'vertical',
      point(x, startY),
      point(x, endY),
      formatCssPixelsWithUnit(vertical.distance) ?? '',
      point(x + 20, midpoint(startY, endY)),
      viewport,
    );
    lines.push(resultLine.line);
    labels.push(resultLine.label);
  }

  return { lines, labels };
}

function containmentLayout(
  anchor: Rectangle,
  comparison: Rectangle,
  result: Extract<MeasurementResult, { relationship: 'containment' }>,
  viewport: MeasurementViewport | undefined,
): MeasurementLayout {
  const a = edges(anchor);
  const c = edges(comparison);
  const outer = result.outer === 'anchor' ? a : c;
  const inner = result.inner === 'anchor' ? a : c;
  const innerCenterX = midpoint(inner.left, inner.right);
  const innerCenterY = midpoint(inner.top, inner.bottom);
  const linesAndLabels = [
    labeledLine(
      'horizontal',
      point(outer.left, innerCenterY),
      point(inner.left, innerCenterY),
      formatCssPixelsWithUnit(result.insets.left) ?? '',
      point(midpoint(outer.left, inner.left), innerCenterY - 12),
      viewport,
    ),
    labeledLine(
      'vertical',
      point(innerCenterX, outer.top),
      point(innerCenterX, inner.top),
      formatCssPixelsWithUnit(result.insets.top) ?? '',
      point(innerCenterX + 20, midpoint(outer.top, inner.top)),
      viewport,
    ),
    labeledLine(
      'horizontal',
      point(inner.right, innerCenterY),
      point(outer.right, innerCenterY),
      formatCssPixelsWithUnit(result.insets.right) ?? '',
      point(midpoint(inner.right, outer.right), innerCenterY - 12),
      viewport,
    ),
    labeledLine(
      'vertical',
      point(innerCenterX, inner.bottom),
      point(innerCenterX, outer.bottom),
      formatCssPixelsWithUnit(result.insets.bottom) ?? '',
      point(innerCenterX + 20, midpoint(inner.bottom, outer.bottom)),
      viewport,
    ),
  ];
  return {
    lines: linesAndLabels.map(({ line }) => line),
    labels: linesAndLabels.map(({ label }) => label),
  };
}

/** Creates a viewport-safe, pair-only annotation layout from rectangle snapshots. */
export function createMeasurementLayout(
  anchor: Rectangle,
  comparison: Rectangle,
  viewport?: MeasurementViewport,
): MeasurementLayout | undefined {
  const result = measureRectangles(anchor, comparison);
  if (result.relationship === 'invalid') return undefined;

  if (result.relationship === 'separation') {
    return separationLayout(anchor, comparison, result, viewport);
  }
  if (result.relationship === 'containment') {
    return containmentLayout(anchor, comparison, result, viewport);
  }

  const center = point(
    midpoint(result.bounds.left, result.bounds.right),
    midpoint(result.bounds.top, result.bounds.bottom),
  );
  return {
    lines: [],
    labels: [clampLabel({ text: 'Overlap', position: center }, viewport)],
  };
}
