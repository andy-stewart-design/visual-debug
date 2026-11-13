export interface PaddingTarget {
  tabId: number;
  documentId: string;
  selectionId: string;
}

/** Stable identity for the local padding editor's selected target. */
export function paddingTargetKey(target: PaddingTarget | undefined): string | undefined {
  return target === undefined ? undefined : JSON.stringify([
    target.tabId,
    target.documentId,
    target.selectionId,
  ]);
}
