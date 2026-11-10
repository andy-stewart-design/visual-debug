/** Browser APIs needed to check whether a tab's current HTTP(S) page is
 * covered by an already-granted host permission. This deliberately does not
 * request permission: installation/browser settings own the grant flow. */
export interface SiteAccessBrowser {
  tabs: { get(tabId: number): Promise<{ url?: string } | undefined> };
  permissions: { contains(details: { origins: string[] }): Promise<boolean> };
}

export function siteAccessPattern(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    // Extension match patterns omit ports (a host grant covers every port).
    // Keep credentials, paths and queries out of the permission check too.
    // file:, ftp:, and browser pages never pass.
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return undefined;
  }
}

export async function hasGrantedSiteAccess(
  browserApi: SiteAccessBrowser,
  tabId: number,
): Promise<boolean> {
  let tab: { url?: string } | undefined;
  try {
    tab = await browserApi.tabs.get(tabId);
  } catch {
    return false;
  }
  const pattern = siteAccessPattern(tab?.url);
  if (!pattern) return false;
  try {
    return await browserApi.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}
