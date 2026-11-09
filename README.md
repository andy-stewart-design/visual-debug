# Visual Debug

A Chrome extension for quiet, on-page layout inspection, built with WXT, Solid, and TypeScript. Select an element, then hold Option while hovering another to measure their border-box distances.

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

1. Click the extension's toolbar icon to start inspection.
2. Hover to preview an element; click to select an anchor. Primary pointer actions select instead of activating page controls.
3. Hover a different element and hold **Option** to see measurements. Release Option to return to quiet outlines.
4. Option-click does not replace the anchor.
5. Exit with **Escape**, **Exit inspection**, or another click on the toolbar icon.

Hovering the anchor itself or measuring without an anchor shows no inter-element measurement. Losing window focus clears measurement mode; press Option freshly after returning. Reloading the page does not restore inspection automatically.

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

The integration app contains geometry examples, resettable action/event counters, and dynamic-layout controls. Configure animation or other cases before inspection, because inspection intentionally blocks page pointer controls. Use explicit keyboard/DevTools stimulus for changes during inspection. Capture-event observation counters can increase without an activation leak; check action outcomes separately.

## Boundaries and permissions

- Chrome on macOS is the manually exercised environment; other browser/platform behavior is not promised.
- Top-document inspection only. Iframe contents and shadow-root internals are not traversed.
- Restricted pages such as `chrome://` cannot be inspected. Activation failure is shown as a toolbar `!` badge with details in its tooltip.
- Uses `activeTab` and `scripting`, without persistent all-sites host access or automatic content-script registration.
- The generated `inspect.css` is web-accessible on HTTP(S) pages so WXT can load it into the Shadow DOM. This exposes only that CSS resource; it does not grant page-reading/injection permission.
- Earlier page capture handlers, pre-existing pointer capture, unusual controls, native scrollbar variants, and touch input are not universally protected. Exit inspection if a page behaves unexpectedly.
- No page editing, saved measurements, iframe support, resize handles, or page-spanning alignment grid.

## Layout and verification

```text
apps/extension/    WXT extension, Solid UI, CSS Modules, pure measurement logic
apps/playground/   Solid integration app and manual fixtures
tests/unit/        Focused geometry, formatting, modifier, layout, tracking tests
plans/measurement-tools/  Specification, plan, and acceptance evidence
```

Components use `components/kebab-case/index.tsx` with a default PascalCase export and `styles.module.css` imported as `s`. `App.tsx` composes UI; session/Shadow DOM lifecycle remains in `lib/`. Use direct Solid event handlers such as `on:click` inside the isolated UI: document-delegated `onClick` cannot pass WXT's event isolation.

The user reported production acceptance on the local integration app, **Pitchfork**, and **eBay**. The last recorded agent-run unit suite passed 53 tests. See [manual acceptance evidence](plans/measurement-tools/evidence/manual-acceptance.md) for the exact reported checks, artifact review, and untested boundaries. This is a small tested sample, not a site-wide or universal compatibility guarantee. No store publication has been performed.
