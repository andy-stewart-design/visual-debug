import { describe, expect, it, vi } from 'vitest';
import { hasGrantedSiteAccess, siteAccessPattern } from '../../apps/extension/lib/site-access';

describe('site access', () => {
  it('only creates patterns for HTTP(S) pages', () => {
    expect(siteAccessPattern('https://example.test/path?q=1')).toBe('https://example.test/*');
    expect(siteAccessPattern('http://localhost:8080/')).toBe('http://localhost/*');
    expect(siteAccessPattern('https://user:password@example.test:8443/path')).toBe('https://example.test/*');
    expect(siteAccessPattern('ftp://example.test/file')).toBeUndefined();
    expect(siteAccessPattern('not a URL')).toBeUndefined();
    expect(siteAccessPattern('file:///tmp/page.html')).toBeUndefined();
    expect(siteAccessPattern('chrome://extensions/')).toBeUndefined();
  });

  it('checks the browser grant without requesting it', async () => {
    const contains = vi.fn(async () => true);
    const browserApi = {
      tabs: { get: vi.fn(async () => ({ url: 'https://example.test/page' })) },
      permissions: { contains },
    };
    await expect(hasGrantedSiteAccess(browserApi, 4)).resolves.toBe(true);
    expect(contains).toHaveBeenCalledWith({ origins: ['https://example.test/*'] });
  });

  it('uses a valid port-free origin pattern for local development sites', async () => {
    const contains = vi.fn(async () => true);
    await expect(hasGrantedSiteAccess({
      tabs: { get: async () => ({ url: 'http://localhost:3000/playground' }) }, permissions: { contains },
    }, 4)).resolves.toBe(true);
    expect(contains).toHaveBeenCalledWith({ origins: ['http://localhost/*'] });
  });

  it('denies missing metadata or failed browser checks without requesting permission', async () => {
    const contains = vi.fn(async () => true);
    await expect(hasGrantedSiteAccess({ tabs: { get: async () => ({}) }, permissions: { contains } }, 4)).resolves.toBe(false);
    await expect(hasGrantedSiteAccess({ tabs: { get: async () => { throw new Error('gone'); } }, permissions: { contains } }, 4)).resolves.toBe(false);
    expect(contains).not.toHaveBeenCalled();
    await expect(hasGrantedSiteAccess({
      tabs: { get: async () => ({ url: 'https://example.test/' }) },
      permissions: { contains: async () => { throw new Error('restricted'); } },
    }, 4)).resolves.toBe(false);
  });

  it('denies a revoked grant', async () => {
    await expect(hasGrantedSiteAccess({
      tabs: { get: async () => ({ url: 'https://example.test/page' }) },
      permissions: { contains: async () => false },
    }, 4)).resolves.toBe(false);
  });

  it.each(['chrome://settings/', 'about:blank', 'file:///tmp/page.html'])('denies restricted URL %s', async (url) => {
    const contains = vi.fn(async () => true);
    await expect(hasGrantedSiteAccess({
      tabs: { get: async () => ({ url }) }, permissions: { contains },
    }, 4)).resolves.toBe(false);
    expect(contains).not.toHaveBeenCalled();
  });
});
