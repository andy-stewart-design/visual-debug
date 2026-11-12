import type { ElementSnapshot } from './element-snapshot';

export const PADDING_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type PaddingSide = (typeof PADDING_SIDES)[number];
export type StyleEditProperty = 'padding';

export type StyleEditRequest = Readonly<{
  kind: 'visual-debug:style-edit';
  tabId: number;
  documentId: string;
  selectionId: string;
  editId: string;
  order: number;
  property: StyleEditProperty;
  side: PaddingSide;
  value: number;
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

export function applyPaddingStyleEdit(element: Element, side: PaddingSide, value: number): boolean {
  if (!Number.isFinite(value) || value < 0 || !element.isConnected) return false;
  // Deliberately write one physical longhand without !important. The page's
  // cascade remains authoritative and is read again by the selection model.
  const styled = element as Element & { style: CSSStyleDeclaration };
  styled.style.setProperty(paddingProperty(side), `${value}px`);
  return true;
}

export function readComputedPadding(element: Element): ElementSnapshot['computedStyle']['padding'] {
  const style = getComputedStyle(element);
  return { top: style.paddingTop, right: style.paddingRight, bottom: style.paddingBottom, left: style.paddingLeft };
}
