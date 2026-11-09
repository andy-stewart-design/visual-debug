/** A viewport-aligned, rendered CSS-pixel rectangle. */
export type Rectangle = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type MeasurementSide = 'anchor' | 'comparison';

export type AxisGap = Readonly<{
  axis: 'horizontal' | 'vertical';
  distance: number;
  /** The comparison rectangle's position relative to the anchor. */
  direction: 'left' | 'right' | 'above' | 'below';
}>;

export type Insets = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

export type MeasurementResult =
  | Readonly<{
      relationship: 'invalid';
      invalid: 'anchor' | 'comparison' | 'both';
    }>
  | Readonly<{
      relationship: 'separation';
      gaps: readonly AxisGap[];
    }>
  | Readonly<{
      relationship: 'containment';
      inner: MeasurementSide;
      outer: MeasurementSide;
      insets: Insets;
    }>
  | Readonly<{
      relationship: 'overlap';
      /** Exact equality is represented as overlap, rather than four zero insets. */
      exact: boolean;
      bounds: Readonly<{
        left: number;
        top: number;
        right: number;
        bottom: number;
      }>;
      size: Readonly<{
        width: number;
        height: number;
      }>;
    }>;

type RectangleEdges = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

/**
 * CSS geometry is normally reported at sub-pixel precision, so derived edges
 * can differ by a few floating-point ulps even when they touch. This absolute
 * tolerance is 1e-7 CSS px: far below display precision, while meaningful
 * fractional distances remain unchanged.
 */
const EDGE_COMPARISON_TOLERANCE = 1e-7;

type EdgeComparison = -1 | 0 | 1;

function compareEdges(first: number, second: number): EdgeComparison {
  if (first === second) return 0;

  const difference = first - second;
  if (Math.abs(difference) <= EDGE_COMPARISON_TOLERANCE) return 0;
  return difference < 0 ? -1 : 1;
}

/** Clamp only a difference accepted as equal by compareEdges. */
function toleratedDifference(value: number): number {
  return Math.abs(value) <= EDGE_COMPARISON_TOLERANCE ? 0 : value;
}

function rectangleEdges(value: unknown): RectangleEdges | undefined {
  if (typeof value !== 'object' || value === null) return undefined;

  const rectangle = value as Partial<Rectangle>;
  const { left, top, width, height } = rectangle;
  if (
    typeof left !== 'number' ||
    typeof top !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined;
  }

  const right = left + width;
  const bottom = top + height;
  if (!Number.isFinite(right) || !Number.isFinite(bottom)) return undefined;

  return {
    left,
    top,
    right,
    bottom,
  };
}

function containment(
  inner: RectangleEdges,
  outer: RectangleEdges,
  innerSide: MeasurementSide,
  outerSide: MeasurementSide,
): MeasurementResult | undefined {
  if (
    compareEdges(inner.left, outer.left) >= 0 &&
    compareEdges(inner.top, outer.top) >= 0 &&
    compareEdges(inner.right, outer.right) <= 0 &&
    compareEdges(inner.bottom, outer.bottom) <= 0
  ) {
    return {
      relationship: 'containment',
      inner: innerSide,
      outer: outerSide,
      insets: {
        left: toleratedDifference(inner.left - outer.left),
        top: toleratedDifference(inner.top - outer.top),
        right: toleratedDifference(outer.right - inner.right),
        bottom: toleratedDifference(outer.bottom - inner.bottom),
      },
    };
  }

  return undefined;
}

function horizontalGap(anchor: RectangleEdges, comparison: RectangleEdges): AxisGap | undefined {
  if (compareEdges(anchor.right, comparison.left) <= 0) {
    return {
      axis: 'horizontal',
      distance: toleratedDifference(comparison.left - anchor.right),
      direction: 'right',
    };
  }
  if (compareEdges(comparison.right, anchor.left) <= 0) {
    return {
      axis: 'horizontal',
      distance: toleratedDifference(anchor.left - comparison.right),
      direction: 'left',
    };
  }
  return undefined;
}

function verticalGap(anchor: RectangleEdges, comparison: RectangleEdges): AxisGap | undefined {
  if (compareEdges(anchor.bottom, comparison.top) <= 0) {
    return {
      axis: 'vertical',
      distance: toleratedDifference(comparison.top - anchor.bottom),
      direction: 'below',
    };
  }
  if (compareEdges(comparison.bottom, anchor.top) <= 0) {
    return {
      axis: 'vertical',
      distance: toleratedDifference(anchor.top - comparison.bottom),
      direction: 'above',
    };
  }
  return undefined;
}

/**
 * Measures rendered rectangles in CSS pixels. Branch precedence is invalid,
 * equality, containment, separating/touching axes, then partial overlap.
 */
export function measureRectangles(anchor: Rectangle, comparison: Rectangle): MeasurementResult {
  const anchorEdges = rectangleEdges(anchor);
  const comparisonEdges = rectangleEdges(comparison);

  if (!anchorEdges || !comparisonEdges) {
    return {
      relationship: 'invalid',
      invalid: !anchorEdges && !comparisonEdges ? 'both' : !anchorEdges ? 'anchor' : 'comparison',
    };
  }

  const exact =
    compareEdges(anchorEdges.left, comparisonEdges.left) === 0 &&
    compareEdges(anchorEdges.top, comparisonEdges.top) === 0 &&
    compareEdges(anchorEdges.right, comparisonEdges.right) === 0 &&
    compareEdges(anchorEdges.bottom, comparisonEdges.bottom) === 0;

  if (exact) {
    return {
      relationship: 'overlap',
      exact: true,
      bounds: anchorEdges,
      size: {
        width: anchorEdges.right - anchorEdges.left,
        height: anchorEdges.bottom - anchorEdges.top,
      },
    };
  }

  const anchorContainsComparison = containment(anchorEdges, comparisonEdges, 'anchor', 'comparison');
  if (anchorContainsComparison) return anchorContainsComparison;

  const comparisonContainsAnchor = containment(comparisonEdges, anchorEdges, 'comparison', 'anchor');
  if (comparisonContainsAnchor) return comparisonContainsAnchor;

  const gaps = [
    horizontalGap(anchorEdges, comparisonEdges),
    verticalGap(anchorEdges, comparisonEdges),
  ].filter((gap): gap is AxisGap => gap !== undefined);

  if (gaps.length > 0) {
    return {
      relationship: 'separation',
      gaps,
    };
  }

  const left = Math.max(anchorEdges.left, comparisonEdges.left);
  const top = Math.max(anchorEdges.top, comparisonEdges.top);
  const right = Math.min(anchorEdges.right, comparisonEdges.right);
  const bottom = Math.min(anchorEdges.bottom, comparisonEdges.bottom);

  return {
    relationship: 'overlap',
    exact: false,
    bounds: { left, top, right, bottom },
    size: {
      width: right - left,
      height: bottom - top,
    },
  };
}
