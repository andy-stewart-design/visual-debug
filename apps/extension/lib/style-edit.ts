import type { ElementSnapshot } from './element-snapshot';

export const PADDING_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type PaddingSide = (typeof PADDING_SIDES)[number];
export type PaddingValues = Readonly<Partial<Record<PaddingSide, number>>>;
export type StyleEditProperty = 'padding';

export type StyleEditRequest = Readonly<{
  kind: 'visual-debug:style-edit';
  tabId: number;
  documentId: string;
  selectionId: string;
  editId: string;
  property: StyleEditProperty;
  sides: PaddingValues;
}>;

export type StyleEditResult = Readonly<{
  ok: boolean;
  selection?: ElementSnapshot;
  error?: string;
}>;

/** Parse only complete, non-negative CSS pixel numbers. */
export function parsePaddingInput(value: string): number | undefined {
  const text = value.trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

export function adjustPaddingValue(value: string, direction: -1 | 1): number | undefined {
  const parsed = parsePaddingInput(value);
  if (parsed === undefined) return undefined;
  return Math.max(0, parsed + direction);
}

export function paddingProperty(side: PaddingSide): string {
  return `padding-${side}`;
}

/** Grouped padding edits are validated before any longhand is written. */
export function validatePaddingValues(value: unknown): value is PaddingValues {
  if (typeof value !== 'object' || value === null) return false;
  const entries = Object.entries(value);
  if (entries.length === 0) return false;
  return entries.every(([side, amount]) => PADDING_SIDES.includes(side as PaddingSide) &&
    typeof amount === 'number' && Number.isFinite(amount) && amount >= 0);
}

export function samePaddingValues(left: PaddingValues, right: PaddingValues): boolean {
  return PADDING_SIDES.every((side) => left[side] === right[side]);
}

export function applyPaddingStyleEdit(element: Element, sides: PaddingValues): boolean {
  if (!element.isConnected || !validatePaddingValues(sides)) return false;
  // Deliberately write only physical longhands without !important. The page's
  // cascade remains authoritative and is read again by the selection model.
  const styled = element as Element & { style: CSSStyleDeclaration };
  for (const side of PADDING_SIDES) {
    if (!Object.prototype.hasOwnProperty.call(sides, side)) continue;
    const value = sides[side];
    if (value !== undefined) styled.style.setProperty(paddingProperty(side), `${value}px`);
  }
  return true;
}

export function readComputedPadding(element: Element): ElementSnapshot['computedStyle']['padding'] {
  const style = getComputedStyle(element);
  return { top: style.paddingTop, right: style.paddingRight, bottom: style.paddingBottom, left: style.paddingLeft };
}
