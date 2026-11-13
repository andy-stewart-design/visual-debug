export type ElementBoxSnapshot = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type BoxStyleSnapshot = Readonly<{
  top: string;
  right: string;
  bottom: string;
  left: string;
}>;

/**
 * Computed values captured in the page document. Keep this as data rather than
 * passing CSSStyleDeclaration across the extension boundary so future style
 * editors can add fields without retaining page objects.
 */
export type ComputedStyleSnapshot = Readonly<{
  padding: BoxStyleSnapshot;
}>;

/** A serializable description of one element in one inspection document. */
export type ElementSnapshot = Readonly<{
  selectionId: string;
  tagName: string;
  box: ElementBoxSnapshot;
  computedStyle: ComputedStyleSnapshot;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isBoxSnapshot(value: unknown): value is ElementBoxSnapshot {
  return isRecord(value) && isFiniteNumber(value.left) && isFiniteNumber(value.top) &&
    isFiniteNumber(value.width) && value.width >= 0 && isFiniteNumber(value.height) && value.height >= 0;
}

function isBoxStyleSnapshot(value: unknown): value is BoxStyleSnapshot {
  return isRecord(value) && isNonEmptyString(value.top) && isNonEmptyString(value.right) &&
    isNonEmptyString(value.bottom) && isNonEmptyString(value.left);
}

export function isElementSnapshot(value: unknown): value is ElementSnapshot {
  if (!isRecord(value) || !isNonEmptyString(value.selectionId) || !isNonEmptyString(value.tagName) ||
    !isBoxSnapshot(value.box) || !isRecord(value.computedStyle)) return false;
  return isBoxStyleSnapshot(value.computedStyle.padding);
}
