# Step 3.1 — Production artifacts and final acceptance evidence

## Scope and final gate

This note separates repository checks, artifact inspection, prior scoped proofs, installed metadata, and the user's final approval. No browser was launched and no profile was changed by the assistant; no native behavior is presented as assistant-observed.

**Final gate: PASS — current-production acceptance is user-reported.** The user approved the requested Chrome stable and Firefox Developer Edition production-check matrix at broad level with the exact statement: **“Yeah, this is solid”.** This is approval of the requested matrix, not an itemized test transcript or a separately attested runtime-version report. Phase 3 and final acceptance documentation are complete.

## Deterministic checks

The existing serialized root checks remain authoritative:

| Command | Result |
| --- | --- |
| `pnpm check` | PASS — WXT type generation and extension/playground TypeScript checks |
| `pnpm test:unit` | PASS — 14 files, 212 tests |
| `pnpm build` | PASS — Chrome MV3 extension and playground production builds; extension total 105.03 kB; playground generated `dist/` |
| `pnpm --filter @visual-debug/extension build:firefox` | PASS — Firefox MV2 output, total 104.96 kB |
| `git diff --check` | PASS — no whitespace errors |
| Read-only Node artifact assertion (manifests, HTML references, web resources, authored retired-consumer search) | PASS — both production roots satisfy the checked contract |

These are automated/static proofs, not native-browser observations. The genuine unexpected-failure/`!` branch is covered by deterministic unit/composition tests; no unsafe native failure was manufactured.

Tooling/environment inventory from the existing checks: Node `v24.19.0`, pnpm `11.28.11`, WXT `0.21.5`, and macOS `27.0.1` (Darwin build `26A434`). These are command-run environment details. The browser numbers below are installed Info.plist metadata only, not runtime versions separately attested by the user.

## Production artifact inspection

The production directories are:

- Chrome: `apps/extension/.output/chrome-mv3/`
- Firefox Developer Edition target: `apps/extension/.output/firefox-mv2/`

Both outputs contain `manifest.json`, `sidepanel.html`, `background.js`, the referenced sidebar JS/CSS, `content-scripts/inspect.js`, `content-scripts/inspect.css`, and referenced icons. The sidebar HTML references files present in each production root, and the page content script's extension CSS resource is present.

- Chrome is MV3 with `side_panel.default_path: "sidepanel.html"`, `host_permissions: ["http://*/*", "https://*/*"]`, and `permissions: ["activeTab", "scripting", "sidePanel"]`.
- Firefox is MV2 with `sidebar_action.default_panel: "sidepanel.html"` and `permissions: ["activeTab", "scripting", "http://*/*", "https://*/*"]`; the host origins are folded into MV2 permissions as expected.
- Neither manifest has a popup, `<all_urls>`, `file:`, `ftp:`, or automatic `content_scripts` registration. Firefox's `browser_action` has only the toolbar title.
- Chrome scopes the web-accessible inspection CSS to HTTP(S). Firefox MV2 emits the required bare resource-list form, which cannot encode MV3's per-resource `matches` field; the declared HTTP(S) permissions, authored WXT policy, and on-demand injection path remain unchanged.
- Sidebar CSS is bundled with the sidebar; the separately web-accessible CSS is only for the page-local overlay. Authored sidebar components retain CSS Modules.

Static routing review found explicit `start`, `stop`, and `query` operations. Toolbar invocation opens/focuses and starts, sidebar Start/Stop are explicit per-tab operations, query/reopen/tab change are passive, and navigation invalidates the old document. No authored `SessionIndicator` consumer or legacy-toggle consumer remains.

The Firefox build retained WXT warnings about `data_collection_permissions` for new extensions and a recommended extension ID. These are packaging/metadata warnings for unpacked/temporary verification; no store publishing or data-collection declaration was performed.

## Source-separated acceptance evidence

Prior scoped evidence remains authoritative and is linked by the plan: lifecycle and routing in Steps 1.1/1.2, sidebar state and modifier safeguards in Step 2.1, indicator retirement and page-local regression coverage in Step 2.2, and access/feedback/manifest checks in Step 2.3. Those records distinguish deterministic tests from user reports and do not claim assistant-observed browser sessions.

The final user report above covers the requested current-production matrix at broad level, including the matrix's toolbar/direct-Start, per-tab/navigation, close/cancellation/window, focus/viewport/geometry, restricted/withheld-page, passive-reopen, Alt/Option-wheel, Escape/Exit, and no-false-badge checks. It is not expanded into invented browser-by-browser observations. The user report is the source for current-production signoff; commands, manifests, prior tests, and artifact paths are separate sources for their respective proofs.

## Installed metadata inventory (not runtime-version evidence)

Read-only application metadata found on this Mac:

- `/Applications/Google Chrome.app/Contents/Info.plist`: `157.0.8103.39`
- `/Applications/Firefox Developer Edition.app/Contents/Info.plist`: `160.0`
- `/Applications/Helium.app/Contents/Info.plist`: `0.19.2.1`

These values establish installed Info.plist metadata only. They do **not** establish that the user tested the current artifacts in those versions, are not a separately attested runtime-version report, do not establish Firefox stable support, and do not turn Helium into Chrome acceptance evidence. Exact browser-version/build-string provenance therefore remains installed metadata, not user-verified version proof.

## Acceptance coverage index

| AC | Evidence source and final status |
| --- | --- |
| AC1 | Prior Step 1.2 feasibility, current MV3/MV2 manifests/assets, and user-reported approval of the current production matrix. |
| AC2 | Prior Steps 1.2/2.1/2.3 routing, state, access tests, and user-reported matrix approval. |
| AC3 | Step 2.2 replacement proof and current source/output review; user-reported matrix approval. |
| AC4 | Steps 1.1/1.2/2.1 correlation/routing tests plus user-reported two-tab matrix approval. |
| AC5 | Steps 1.1/2.3 lifecycle/navigation tests plus user-reported reload/reopen matrix approval. |
| AC6 | Step 1.2/2.2 close and cleanup proof plus user-reported close/window matrix approval. |
| AC7 | Steps 1.1/1.2/2.3 denied/protected/access tests and manifest review plus user-reported restricted/withheld matrix approval. |
| AC8 | Step 2.2 geometry/regression proof plus user-reported viewport/fixture matrix approval. |
| AC9 | Steps 2.1/2.2 modifier/focus proof plus user-reported focus/Escape matrix approval. |
| AC10 | Steps 1.1/1.2 cancellation tests plus user-reported delayed-start/close matrix approval. |
| AC11 | Current-production signoff is user-reported. Installed browser numbers above are Info.plist metadata only, not separate runtime-version attestation; no Firefox stable claim is made. |
| AC12 | Step 2.2 scope review and current docs; no style editing, persistence/undo, or details UI is claimed. |
| AC13 | Step 2.1 safeguard tests, Step 2.2 regression proof, and user-reported Alt/Option-wheel matrix approval. |
| AC14 | Step 2.3 grant-aware Start/no-autostart tests and exact manifests plus user-reported fresh-site/passive-flow matrix approval. |
| AC15 | Step 2.3 feedback tests and user-reported quiet expected-outcome matrix approval; genuine positive failure remains deterministic/composition-only. |

## Support boundaries and limitations

Support claims remain limited to Chrome stable and Firefox Developer Edition on macOS as the requested targets. Firefox Developer Edition evidence is not Firefox stable evidence. Browser-internal/protected/withheld pages, `file:`, `ftp:`, frames, shadow-root internals, touch/unusual controls, other browsers/platforms, Helium, and store publication are not promised. The Firefox MV2 resource-list caveat and packaging warnings remain. No native failure was fabricated; the genuine positive `!` branch remains covered by unit/composition tests.

**Phase 3 / final acceptance assessment: COMPLETE.** The production artifact/static checks and prior scoped proofs passed, documentation matches the supported workflow, and the user's exact broad current-production approval closes the user-owned final gate. The signoff is user-reported; browser version strings remain installed metadata only, not separately attested runtime observations.
