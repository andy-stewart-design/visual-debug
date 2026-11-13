import type { BoxStyleSnapshot } from './element-snapshot';
import type { PaddingSide } from './style-edit';

export type PaddingMode = 'all' | 'axis' | 'independent';
export type PaddingField = 'all' | 'vertical' | 'horizontal' | PaddingSide;

export const PADDING_MODE_LABELS: Record<PaddingMode, string> = {
  all: 'All',
  axis: 'Axis',
  independent: 'Independent',
};

export function paddingFields(mode: PaddingMode): ReadonlyArray<{
  key: PaddingField;
  label: string;
  sides: readonly PaddingSide[];
}> {
  if (mode === 'all') return [{ key: 'all', label: 'Padding', sides: ['top', 'right', 'bottom', 'left'] }];
  if (mode === 'axis') return [
    { key: 'vertical', label: 'Vertical', sides: ['top', 'bottom'] },
    { key: 'horizontal', label: 'Horizontal', sides: ['left', 'right'] },
  ];
  return [
    { key: 'top', label: 'Top', sides: ['top'] },
    { key: 'right', label: 'Right', sides: ['right'] },
    { key: 'bottom', label: 'Bottom', sides: ['bottom'] },
    { key: 'left', label: 'Left', sides: ['left'] },
  ];
}

function computedValue(value: string): string | number {
  const text = value.trim().replace(/px$/i, '');
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : text;
}

function equalComputed(left: string, right: string): boolean {
  return computedValue(left) === computedValue(right);
}

export function choosePaddingMode(padding: BoxStyleSnapshot): PaddingMode {
  const { top, right, bottom, left } = padding;
  if (equalComputed(top, right) && equalComputed(top, bottom) && equalComputed(top, left)) return 'all';
  if (equalComputed(top, bottom) && equalComputed(right, left)) return 'axis';
  return 'independent';
}

export function paddingGroupText(
  padding: BoxStyleSnapshot,
  sides: readonly PaddingSide[],
): string {
  const firstSide = sides[0];
  if (!firstSide) return '';
  const first = padding[firstSide]?.trim().replace(/px$/i, '') ?? '';
  return sides.every((side) => equalComputed(padding[side], padding[firstSide])) ? first : '';
}
