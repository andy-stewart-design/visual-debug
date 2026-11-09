/**
 * Formats a non-negative CSS-pixel value as a numeric label only. Values are
 * rounded to one decimal using the runtime's decimal formatter; no DPR/zoom
 * conversion is applied. Invalid or negative values produce no label.
 */
export function formatCssPixels(value: number): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;

  // Normalize -0 before formatting so a tiny/rounded gap never becomes "-0".
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized.toLocaleString('en-US', {
    maximumFractionDigits: 1,
    useGrouping: false,
  });
}

/** Formats the same numeric label with the optional CSS-pixel suffix. */
export function formatCssPixelsWithUnit(value: number): string | undefined {
  const formatted = formatCssPixels(value);
  return formatted === undefined ? undefined : `${formatted}px`;
}
