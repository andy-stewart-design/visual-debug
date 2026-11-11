# Visual Debug extension

The extension is a WXT/Solid browser sidebar. Use the repository [README](../../README.md) for the current development workflow, production build/load instructions, permission policy, support boundaries, and verification status.

Implementation notes:

- `entrypoints/sidepanel/` owns the browser-hosted status, instructions, Start, and Stop/Exit controls.
- `entrypoints/inspect.content.ts` and `lib/` retain page-local picking, geometry, modifiers, overlays, and cleanup.
- `components/*/styles.module.css` are CSS Modules; the sidebar stylesheet is bundled with `sidepanel.html`, while the inspected-page overlay stylesheet is the separately web-accessible `content-scripts/inspect.css` resource.
- Production outputs are generated under `.output/chrome-mv3/` and `.output/firefox-mv2/`; do not load the `chrome-mv3-dev` directory for production checks.
