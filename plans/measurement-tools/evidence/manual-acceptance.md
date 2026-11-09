# Guided production acceptance

Recorded: 2026-11-09.

## Provenance and scope

- The user ran the manual Chrome session with step-by-step guidance; the agent did not operate or independently observe Chrome.
- The user reported `pnpm check`, `pnpm test:unit`, and `pnpm build` all passing before loading production. Full command logs/counts were not supplied for this rerun.
- Prior implementation evidence records 53 passing unit tests across 5 files, plus passing check/build. The unit suite proves pure calculations and injected tracking/state behavior, not native browser event ordering.
- The user confirmed successful Load unpacked of `apps/extension/.output/chrome-mv3` in regular Chrome after disabling an older development copy; this was not acceptance of WXT's development launcher.
- Named tested sample: this repository's owned local integration/playground app, Pitchfork, and eBay. Exact external URLs/routes and authenticated states were not supplied.
- An additional existing user app was proposed in the original plan but was not separately identified. It is not counted as a fourth tested app/site; the owned local app in this record is the integration playground.
- Chrome on macOS is the guided environment. Exact browser and OS versions and screenshots were not supplied. Do not invent them.
- Current checkout at documentation time: `67d7521428c0e7e5b2095dfc3b5b843d9da35755`. This identifies the recording context, not a hash independently captured during the user's browser session. No application code was changed during this documentation pass.
- Local toolchain at documentation time: Node `v24.19.0`, pnpm `11.28.11`. Historical scaffold/implementation records retain their dependency versions; no dependencies were changed here.

## Reported guided outcomes

Each result below is **reported passed by the user**, not agent-observed runtime evidence.

| Checkpoint | Actions and expected behavior acknowledged by the user | Related acceptance |
| --- | --- | --- |
| 1 | All three root validation commands passed before production loading. | Automated prerequisites |
| 2 | Production unpacked extension loaded without an error; development copy disabled. | AC1, AC10 |
| 3 | Toolbar activates and deactivates; Escape and visible Exit work; reloading does not restore inspection. | AC1, AC9 |
| 4 | Link does not navigate/change hash; submit does not submit; checkbox does not toggle; input does not focus/change; pointer-down and nested-button action counters do not change; native drag does not start. Controls work again after exit. Capture observation was distinguished from actual activation. | AC1, AC2 |
| 5 | No-anchor and self-target cases show no measurement; stationary Option press/release reveals/hides a 40px gap; Option-click preserves the anchor; quiet outlines return without duplicates or lingering labels. | AC3, AC4, AC5, AC6 |
| 6 | Diagonal 40px/60px, containment insets 20/30/130/110px, touching zero, compact overlap, reversed selection order, readable labels, and current-pair-only measurement reported correct. | AC3, AC6 |
| 7 | Animated selected anchor and measurements update under a stationary cursor; document/nested scrolling remains usable and aligned. Comparison may legitimately change if a different element moves under the pointer. | AC7 |
| 8 | Fixed gap remains 40 CSS px at 125% and 80% browser zoom; overlays stay aligned. Switching windows while holding Option, releasing elsewhere, and returning leaves measurements hidden, retains a valid anchor, and requires a fresh Option press. | AC4, AC7, AC8 |
| 9 | Timed removal of the dynamic anchor clears selection/measurements. Timed comparison removal and zero-area class application remove stale target outlines/distances; re-hit-testing may identify a new underlying comparison. | AC8 |
| Final summary | User reported tab isolation, clear restricted-page failure, and final real-site smoke successful. When asked for site names, the user supplied Pitchfork and eBay. Per-page/control/route details were not supplied. | AC9, AC10, AC11 |

The original responses were short confirmations (`yep`, `all good`, or equivalent). This record preserves their scope without expanding them into exhaustive screenshots, logs, memory profiling, or independently reproduced browser tests.

## Static production review during documentation

The agent inspected the current built manifest, runtime entrypoint source, configuration, and artifact references, without launching a browser or rerunning the user's tests.

- Manifest V3; extension package version `0.0.0`.
- Permissions exactly `activeTab` and `scripting`.
- No `host_permissions`, automatic `content_scripts`, or action `default_popup`.
- Runtime content entrypoint uses `registration: 'runtime'`, `matches: []`, `allFrames: false`, and `cssInjectionMode: 'ui'`.
- Only `content-scripts/inspect.css` is listed as web-accessible, matched to HTTP(S) pages. This resource exposure is not a host permission.
- All eight checked referenced/runtime files exist, including the service worker, icons, runtime JS, and generated CSS.
- Application source/configuration was not changed and dependencies were not installed.

The manifest retains scaffold branding/name/description/icons. That is not a functional acceptance failure for this local first slice, and this pass does not declare it ready for store publication.

## Limits and unclaimed coverage

- Public-site smoke does not establish every route, component, consent state, account, or interaction on Pitchfork or eBay.
- No additional existing user app, other browser/OS, touch platform, iframe/shadow-root internals, or store installation was established.
- Hostile earlier capture handlers, pre-existing pointer capture, bespoke pointer-move editing controls, native scrollbar variants, all transform/sticky/visibility cases, and browser memory-leak profiling were not separately reported as tested.
- Tracker cancellation, observer replacement, partial-startup cleanup, and detached-UI-host behavior have focused injected unit coverage/static review; this is not the same as a browser memory audit.
- No Playwright/browser automation, publication, deployment, commit, or push was performed as part of this acceptance documentation.
