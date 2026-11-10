# Visual Debug

A browser sidebar extension for quiet, on-page layout inspection, built with WXT, Solid, and TypeScript. Select an element, then hold Option while hovering another to measure their border-box distances.

## Development

Use Node 24 and pnpm `11.28.11` (pinned in `package.json`). The recorded local Node version is `24.19.0`.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts both apps: WXT launches a development Chrome window, and Vite serves the local integration/playground app. Open the playground URL printed by Vite in that Chrome window.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run both apps in parallel |
| `pnpm dev:ext` | Run only the WXT extension |
| `pnpm dev:int` | Run only the integration/playground app |
| `pnpm check` | Prepare WXT types and check both apps |
| `pnpm test:unit` | Run the focused Vitest suite |
| `pnpm build` | Build both apps for production |

Stop the dev processes with Ctrl+C. WXT's launcher may show a Chrome warning about an unsupported automation-related flag; that launcher flag is not part of the built extension.

## Inspect and measure

1. Open the sidebar with the extension toolbar icon; this also starts inspection on the current page. Opening through the browser's sidebar UI only shows status.
2. On an ordinary HTTP/HTTPS tab with browser-granted site access, use **Start/restart** in the sidebar. New tabs show **Stopped** with Start available; they do not need a separate toolbar click.
3. Hover to preview an element; click to select an anchor. Primary pointer actions select instead of activating page controls.
4. Hover a different element and hold **Option/Alt** to measure. Release the key to return to quiet outlines. Option-click does not replace the anchor; Alt+wheel is consumed while inspecting to prevent Firefox history navigation.
5. Stop with **Escape** on the page or **Stop/Exit** in the sidebar. Closing the sidebar stops all retained inspection sessions in that window, without affecting another window. Clicking the toolbar again starts/focuses inspection; it is not a Stop toggle.

Hovering the anchor itself or measuring without an anchor shows no inter-element measurement. Losing window focus clears measurement mode; press Option freshly after returning. Switching tabs preserves each tab's state without starting inspection elsewhere. Reloading stops inspection; with site access still granted, sidebar Start can inspect the replacement page without a toolbar click. Refresh status and native sidebar reopening never start inspection.

Measurements use CSS pixels and rendered, axis-aligned border boxes—not text glyph edges, physical screen pixels, or CSS margin/padding declarations. Containment shows edge insets, touching can show zero, and overlapping boxes show an overlap indication. Rotation is measured by the resulting axis-aligned bounds.

## Test the production extension manually

Stop `pnpm dev`, then:

```sh
pnpm check
pnpm test:unit
pnpm build
pnpm dev:int
```

In regular Chrome:

1. Open `chrome://extensions` and enable Developer mode.
2. Disable any older development copy to avoid duplicate extensions.
3. Click **Load unpacked** and select `apps/extension/.output/chrome-mv3` from this repository.
4. Pin the extension and open the playground URL.

Use **`chrome-mv3`**, not `chrome-mv3-dev`. In the folder picker, Cmd+Shift+G lets you enter the hidden output path. After rebuilding production, reload the unpacked extension through `chrome://extensions` and reload test pages.

For Firefox Developer Edition, build with `pnpm --filter @visual-debug/extension build:firefox`, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `apps/extension/.output/firefox-mv2/manifest.json`. Use **Reload** there after rebuilding and reload test tabs. Temporary installation ends when Firefox closes.

The browser may require approval for the new website-access permission during installation/update or in the extension's site-access settings. An unpacked/temporary reload does not necessarily show a prompt. If an ordinary site is unavailable, allow the extension access to that site (or all HTTP/HTTPS sites), then use **Refresh status** and **Start/restart**. The toolbar remains a temporary-access fallback where the browser permits it.

The integration app contains geometry examples, resettable action/event counters, and dynamic-layout controls. Configure animation or other cases before inspection, because inspection intentionally blocks page pointer controls. Use explicit keyboard/DevTools stimulus for changes during inspection. Capture-event observation counters can increase without an activation leak; check action outcomes separately.

## Boundaries and permissions

- Verification targets are Chrome and Firefox Developer Edition on macOS; other browsers/platforms are not promised. Feature-specific native results and pending checks are recorded in the linked evidence.
- Top-document inspection only. Iframe contents and shadow-root internals are not traversed.
- Browser-internal pages such as `chrome://` and `about:` cannot be inspected; protected HTTPS pages may also reject injection. The sidebar reports unavailable/error; toolbar activation failures can additionally show a `!` badge with details in the tooltip.
- Uses `activeTab`, `scripting`, and persistent host access limited to `http://*/*` and `https://*/*` (Chrome MV3 `host_permissions`; Firefox MV2 `permissions`). This permits on-demand sidebar Start without another toolbar click after the browser grants access. It does not include `file:`, `ftp:`, browser-internal origins, or automatic content registration. No extension code calls `permissions.request`; browser controls own approval. Merely loading a page or switching tabs does not inject or inspect it.
- The generated `inspect.css` is web-accessible on HTTP(S) pages so WXT can load it into the Shadow DOM. This exposes only that CSS resource; it does not grant page-reading/injection permission.
- Earlier page capture handlers, pre-existing pointer capture, unusual controls, native scrollbar variants, and touch input are not universally protected. Exit inspection if a page behaves unexpectedly.
- No page editing, saved measurements, iframe support, resize handles, or page-spanning alignment grid.

## Layout and verification

```text
apps/extension/    WXT extension, Solid UI, CSS Modules, pure measurement logic
apps/playground/   Solid integration app and manual fixtures
tests/unit/        Geometry, modifier, tracking, sidebar state/routing, and site-access tests
plans/measurement-tools/  Specification, plan, and acceptance evidence
```

Components use `components/kebab-case/index.tsx` with a default PascalCase export and `styles.module.css` imported as `s`. `App.tsx` composes UI; session/Shadow DOM lifecycle remains in `lib/`. Use direct Solid event handlers such as `on:click` inside the isolated UI: document-delegated `onClick` cannot pass WXT's event isolation.

Historical measurement-tool acceptance covered the local integration app, **Pitchfork**, and **eBay**; see the original [manual acceptance evidence](plans/measurement-tools/evidence/manual-acceptance.md). Sidebar and website-access verification is recorded separately in [sidebar feature evidence](plans/sidebar-layout/evidence/step-2.3.md), including the new website-access checks still awaiting user confirmation. These are bounded checks, not universal compatibility guarantees. No store publication has been performed.
