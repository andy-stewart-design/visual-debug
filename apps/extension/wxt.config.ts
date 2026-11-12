import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  manifest: {
    // Persistent web access is intentionally limited to HTTP(S). WXT emits
    // this as MV3 host_permissions and folds it into MV2 permissions for
    // Firefox; no content script is registered by this declaration.
    host_permissions: ['http://*/*', 'https://*/*'],
    permissions: ['activeTab', 'scripting', 'storage'],
    action: {
      default_title: 'Open sidebar and start inspection',
    },
  },
  hooks: {
    'build:manifestGenerated'(_wxt, manifest) {
      const cssResource = 'content-scripts/inspect.css';
      const resources = manifest.web_accessible_resources ?? [];
      type WebAccessibleResource = Exclude<(typeof resources)[number], string>;
      const existingResources = resources.filter(
        (entry): entry is WebAccessibleResource =>
          typeof entry === 'object' && entry !== null,
      );

      manifest.web_accessible_resources = [
        ...existingResources.filter(
          (entry) => !entry.resources.includes(cssResource),
        ),
        {
          resources: [cssResource],
          matches: ['http://*/*', 'https://*/*'],
          use_dynamic_url: true,
        },
      ];
    },
  },
});
