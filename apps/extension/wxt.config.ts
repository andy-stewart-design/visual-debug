import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  manifest: {
    permissions: ['activeTab', 'scripting'],
    action: {
      default_title: 'Toggle inspection session',
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
