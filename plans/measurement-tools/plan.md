# Measurement Tools Implementation Plan

## Status and governing source

- Governing spec: [spec.md](spec.md).
- Delivery state: Implemented; guided production acceptance recorded for the local integration/playground app, Pitchfork, and eBay. Manual outcomes are user-reported, not agent-observed browser results.
- Acceptance or release still pending: No further checks requested for this named first-slice sample. Broader compatibility, adversarial input cases, and distribution remain outside this acceptance. No publication or deployment was performed.
- Blockers: None for the recorded sample. See [manual acceptance evidence](evidence/manual-acceptance.md) for exercised checks, provenance gaps, and unclaimed coverage.

Step statuses below are the authoritative execution record. A phase is complete only when its step completion gates and phase exit gate are satisfied. Implementation verification does not imply live acceptance or release.

## Execution constraints

- All project paths are relative to `/Users/robestewart/Documents/Development/visual-debug`; commands run there unless stated otherwise.
- Preserve `plans/measurement-tools/spec.md` and unrelated work. Implementation and the lean unit suite are present; distinguish previous agent-run automated checks, the user's latest command results, static artifact review, and user-reported manual acceptance.
- The user authorized the recorded implementation increments and performed guided manual acceptance. This record is not permission for new features, dependencies, commits, publication, or browser-profile changes.
- Proposed implementation assumptions follow the spec: WXT/TypeScript, Chrome MV3 first, pnpm workspace, Solid UI, Solid + TypeScript playground, Shadow DOM UI, and user-invoked `activeTab` access. Solid is the user's explicit UI choice; WXT, pnpm, and Chrome-first remain planning assumptions rather than newly explicit approvals. No framework/package extraction is needed.
- Use official create flows in new application directories. If a target already exists when execution begins, inspect it and stop rather than using overwrite/force flags. Do not scaffold into the populated repository root.
- Before executing create commands, inspect the selected releases' runtime requirements and CLI help. Use a compatible available Node/pnpm, record actual versions, and pin resolved dependencies in the workspace lockfile. Do not install a system toolchain or globally upgrade packages without approval.
- Browser validation requires user-provided approval/access to load an unpacked extension in installed Chrome and inspect real sites. Record unavailable checks as Blocked, not passed; an optional separate development profile may be used, but no disposable profile or browser-binary setup is required.
- Required safety fixtures cannot be removed merely to turn a failing gate green. If the scoped requirements cannot be met, stop at the safety gate and request a product decision rather than silently weakening the spec.

### Tooling and verification commands

These scripts now exist. Step 1.1 introduced workspace wiring; Step 3.1 introduced the lean unit runner. See the root README for development and production loading.

| Root command | Implementation / proof |
| --- | --- |
| `pnpm dev` | Starts both workspace dev processes in parallel; WXT launches a development browser. |
| `pnpm dev:ext` | WXT development command in `apps/extension`; development aid, not artifact acceptance. |
| `pnpm dev:int` | Vite in `apps/playground`; development aid for the deterministic Solid fixture. |
| `pnpm check` | Runs `wxt prepare && tsc --noEmit` in `apps/extension`, then `tsc -b` in `apps/playground`. This is the sole root checking alias; no `typecheck`-named root alias. |
| `pnpm build` | Runs the production build in each application; WXT Chrome MV3 output is manually inspected, not assumed from a directory name. |
| `pnpm test:unit` | Lean Vitest runner, primarily for pure geometry/formatting and only useful cheap state/disposal tests; no browser harness. |

Focused Vitest invocations use `pnpm test:unit <file>` (or `pnpm exec vitest run <file>`) after the script exists. Expected source/test paths below are proposed additions, not observations about generated templates. Adapt template-dependent locations once in Step 1.1 and record the actual paths here; do not duplicate source trees to match guesses. Browser behavior is validated manually in installed Chrome; no Playwright, browser automation, browser test driver, helper/manifest-copy machinery, automatic Chromium/profile setup, or test-only host permission is planned.

## Phase overview and delivery boundary

| Phase | Outcome | Dependencies | Exit gate |
| --- | --- | --- | --- |
| 1 | Officially scaffolded workspace and deterministic manual fixtures/lightweight unit seams | Execution authorization and compatible tooling | Both apps build; unit checks and manual fixture smoke establish a useful baseline without claiming feature behavior. |
| 2 | Safe, reversible selection mode | Phase 1 | Required interactive fixtures cannot activate; activation/exit compose with picking and cleanup. |
| 3 | Quiet Option-held distance measurement | Phase 2 | Tested geometry renders correctly and survives input/layout/lifecycle changes. |
| 4 | Production-artifact and real-page acceptance | Phase 3 | All AC owners have evidence or explicit unresolved status; no hidden test permissions or unsupported compatibility claims. |

Delivery boundary: One feature-complete review/PR when version control is available, with separately reviewable increments below. A phase is not a promise to publish. A scaffold-only or selection-only checkpoint may be reviewed but must not be described as the completed measurement feature.

Atomic groups: Each step includes its tests and affected consumers. No cross-step atomic migration is required. In particular, input suppression and the picking/session consumer that relies on it land and revert together in Step 2.2.

## Phase 1 — Workspace and reproducible verification seams

Outcome: Official application scaffolds run alongside a deterministic Solid playground, with lightweight source checks and manual browser verification.
Depends on: Execution authorization; compatible Node/pnpm and permission for scoped dependency installation.
Review boundary: Workspace, applications, fixtures, and lightweight unit setup only; no claims about safe inspection or measurements.

### Step 1.1 — Create applications through official CLIs

Status: Verified
Requirements / acceptance: R9, R10; AC12, foundation for AC11.
Depends on: None.
Review boundary: Official scaffolds and minimal workspace wiring; no extension feature code.

Expected files:

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitignore` — workspace configuration and generated-file exclusions.
- `apps/extension/` — official WXT Solid TypeScript scaffold, including its generated entrypoints and configuration.
- `apps/playground/` — official Vite Solid + TypeScript scaffold; generated JSX paths remain template-dependent.

Tasks:

- [x] Verify runtime/CLI requirements and empty targets, then use the official flows: `pnpm dlx wxt@latest init apps/extension --template solid --pm pnpm` and `pnpm create vite apps/playground --template solid-ts`. The user reported these official CLI scaffolds; the selected Solid templates and resolved versions were inspected without overwrite flags.
- [x] Consolidate to one workspace lockfile, use private workspace/application packages, and retain useful generated scripts. Avoid nested installs/lockfiles that accidentally create independent dependency trees.
- [x] Add the root development, check, and production-build aliases described above, using actual generated scripts/configuration and WXT prepare rather than inventing a WXT check command.
- [x] Keep both official applications buildable, retain Solid/TypeScript generated conventions, and ignore WXT output, generated types, and later test artifacts. Preserve planning documents.

Verification:

- Automated: From the root, `pnpm check` passed (`wxt prepare && tsc --noEmit` for the extension and `tsc -b` for the playground). `pnpm build` passed for both apps: WXT produced `.output/chrome-mv3/`, and Vite produced `apps/playground/dist/`. These checks prove scaffold wiring only.
- Manual: The user reported the official WXT Solid and Vite Solid TypeScript scaffolding flows. Inspected versions are Node `v24.19.0`, pnpm `11.28.11`, WXT `0.21.5`, Vite `8.3.5`, extension TypeScript `5.9.3`, and playground TypeScript `7.0.2`. The generated Chrome MV3 manifest and output entrypoints were inspected; generated output and types remain ignored. Exact root commands run for this increment were `pnpm dev:ext` and `pnpm dev:int` (both reached their dev-server startup probes and were then terminated), followed by `pnpm check` and `pnpm build` (both passed). Browser feature acceptance is not applicable yet.

Completion gate: Official-create provenance is recorded, both scaffolds build/check, and the root aliases resolve to real commands. Record initial failures honestly before correcting them.
Evidence: Verified — root `pnpm check` and `pnpm build` passed on 2026-11-05; scaffold wiring only, not measurement behavior.

### Step 1.2 — Add deterministic Solid playground fixtures and lightweight checks

Status: Verified — implementation and user-reported playground acceptance
Requirements / acceptance: R9; foundation for AC2, AC6–AC8, AC11.
Depends on: Step 1.1.
Review boundary: Deterministic fixtures and lightweight unit setup, not feature behavior.

Expected files:

- Template-dependent Solid files under `apps/playground/src/` (typically `App.tsx`, `index.tsx`, and styles) — fixture page and resettable telemetry.
- A minimal Vitest configuration and focused unit paths only if needed for pure calculations/state; no browser test configuration or harness.
- Root `package.json`, `pnpm-lock.yaml`, `.gitignore` — scoped test dependency, scripts, and artifact exclusions.

Tasks:

- [x] Add fixed-rectangle geometry examples from the spec, nested markup, scroll containers, moving/resizing targets, transforms, and removal controls. Keep fixture coordinates and reset state deterministic.
- [x] Add link, form, checkbox, input, draggable, and custom pointer-down controls with observable action counters, focus, drag, submission, and navigation outcomes. Register page capture/bubble handlers before inspection can activate, including pointer-down controls and page capture events.
- [x] Add simple observable counters/outcomes and a reset control so ordinary browsing behavior can be checked manually before suppression is implemented. Keep the fixture useful for detecting leaks without building a replacement browser test framework.
- [x] Review the lean unit-test requirement and defer runner installation until Step 3.1 introduces pure measurement calculations; no empty test setup or dependency was added at this step. Do not add Playwright, browser automation, test-driver endpoints, helper/manifest-copy machinery, extra test host permissions, or automatic browser/profile setup.

Verification:

- Automated: `pnpm check` passed on 2026-11-05 and `pnpm build` passed on 2026-11-05; both include the playground TypeScript/build output. The unit runner was intentionally deferred at this step and introduced with Step 3.1's pure measurement code; no browser harness is planned.
- Manual: The user reported normal controls working after inspection exit, required action counters unchanged during selection, correct fixture geometry, native page/nested scrolling, and dynamic invalidation. See [guided acceptance record](evidence/manual-acceptance.md). This is user-reported, not automated or agent-observed UI evidence.

Completion gate: Verified for the exercised fixture cases through guided user-run production checks; no browser harness.
Evidence: Verified — previous check/build results plus the reported playground outcomes in [guided acceptance record](evidence/manual-acceptance.md).

Phase exit gate: Fresh scaffold builds/checks and the deterministic fixture manual smoke are recorded together. Scripts, fixture paths, runtime versions, and any pre-existing environment failures are recorded.
Evidence: Verified for the implemented fixture scope — scaffold results and guided playground acceptance are recorded.

## Phase 2 — Safe and reversible inspection

Outcome: One explicit session selects interactive elements without activating them, then exits cleanly.
Depends on: Phase 1.
Review boundary: Activation, permissions, event safety, selection and quiet outlines; measurements remain absent.

### Step 2.1 — Add explicit activation and complete session teardown

Status: Verified — production lifecycle and permissions checks reported passed by the user
Requirements / acceptance: R1, R7, R8; AC1 lifecycle foundation, AC9, AC10.
Depends on: Step 1.2.
Review boundary: Runtime injection, idempotent toggle/cleanup, and extension-owned activation feedback; page selection is not yet exposed.

Expected files:

- `apps/extension/wxt.config.ts`, `apps/extension/entrypoints/background.ts`, `apps/extension/entrypoints/inspect.content.ts` — explicit runtime entrypoint and action activation.
- `apps/extension/lib/activation.ts`, `apps/extension/lib/session.ts`, `apps/extension/lib/ui.tsx`, `apps/extension/lib/ui.css` — activation controller, lifecycle, Shadow DOM mounting/host styling, and Solid-rendered isolated session UI.
- `apps/extension/components/session-indicator/index.tsx`, `apps/extension/components/session-indicator/styles.module.css` — presentational SessionIndicator component and CSS Module styles.
- Optional focused unit tests for activation state; no browser test paths or driver infrastructure.

Tasks:

- [x] Replace irrelevant starter UI/automatic injection with an action plus `activeTab` and `scripting`. Define the inspection content script as runtime-only with no broad matches or persistent all-sites host grant; inspect any generated CSS/web-accessible resources for least scope.
- [x] Route an action invocation through one activation controller to the actual generated script file. Serialize or otherwise make repeated/overlapping toggles deterministic; distinguish expected first injection from permission or page-access failure.
- [x] Make the runtime entrypoint maintain at most one page session, with an isolated active indicator/exit control and Escape cleanup. During this lifecycle-only checkpoint, clearly label selection unavailable; do not display a working inspection affordance before Step 2.2 makes it safe.
- [x] Tie Solid rendering cleanup to session teardown: invoke the `render()` disposer from `onRemove` and clear reactive effects, listeners, and session state on every exit or initialization failure.
- [x] Extract the presentational `SessionIndicator` into its approved component/CSS Module convention; keep Shadow DOM mounting, host positioning, disposal, and session lifetime in `lib/ui.tsx`/`lib/ui.css`.
- [x] Show denied/restricted-page activation in extension-owned action feedback, without relying on injecting an error UI into that page. Ensure partial initialization unwinds its own resources.

Verification:

- Automated: `pnpm check`, `pnpm build`, and `git diff --check` passed on 2026-11-09. Production-output inspection confirmed the CSS Module class mappings and preserved host overrides in `.output/chrome-mv3/content-scripts/inspect.css`; the manifest contains only `activeTab` and `scripting`, has no `default_popup`, `content_scripts`, or `host_permissions`, and exposes only `content-scripts/inspect.css` to `http://*/*` and `https://*/*` for `cssInjectionMode: 'ui'`. The generated top-document runtime file is `.output/chrome-mv3/content-scripts/inspect.js`. No browser harness was added; the focused unit runner was introduced later with Step 3.1 pure geometry.
- Manual prerequisite: The integration fixture was exercised during the guided production pass; see Step 1.2 and [guided acceptance record](evidence/manual-acceptance.md).
- Manual Step 2.1 check: The user loaded `.output/chrome-mv3` in regular Chrome with the older dev copy disabled, and confirmed loading, toolbar toggle, Escape/visible Exit, and no automatic restoration after reload. The final tab-isolation/restricted-page summary was also reported passed. This covers the CSS-Module/App composition version and direct `on:click` fix. Exact Chrome/macOS versions were not supplied; see [guided acceptance record](evidence/manual-acceptance.md).
- Static limitation: WXT shadow event isolation stops events once they reach the shadow root, but cannot prevent page capture listeners that ran earlier. This is not a universal hostile-page safety claim; Escape remains the only page-level keyboard listener in this lifecycle step.

Completion gate: Verified for the user-reported production action, lifecycle, and permission cases; not exhaustive error-path or cross-browser proof.
Evidence: Verified — static artifact checks plus guided user-reported acceptance. The prior delegated-click bug was fixed and visible Exit was subsequently reported passed.

### Step 2.2 — Implement safe picking and quiet selection as one unit

Status: Verified — required primary-control safety cases reported passed by the user
Requirements / acceptance: R1–R3, R7; AC1–AC3.
Depends on: Step 2.1 build/check and manual lifecycle gates; installed-Chrome safety gate below must pass before Phase 3.
Review boundary: Input interception, hit testing, selected/hover state, and outline consumer are one review/revert unit.

Expected files:

- `apps/extension/lib/picking.ts`, `apps/extension/lib/selection.ts`, `apps/extension/lib/ui.tsx`, `apps/extension/lib/session.ts` — safe input/session integration; interception is consolidated in `picking.ts`.
- Optional focused unit tests for pure selection/state decisions; no browser test paths or safety driver.
- Template-dependent Solid playground files — only additional reproducible safety cases found necessary during this step.

Tasks:

- [x] Compare the event-routing approaches against the real fixture's source instrumentation. Capture interception with native `elementFromPoint()` was chosen over a full-screen input shield: the CSS overlays remain `pointer-events: none`, nested scrolling stays native, and no custom scroll emulation or shield hit-target translation is required. Shadow DOM event isolation alone is not treated as a safety proof.
- [x] Use capture interception while preserving scrolling and the direct accessible exit. Filter extension-owned events through the actual Shadow host's composed path and page targets through connected, finite, nonzero-area checks. No page element is modified for hit testing.
- [x] Integrate one anchor and one hover comparison using actual top-document hit elements, quiet solid/dashed outlines, and extension-UI exclusion. No resize handles, full-page guides, parent navigation, or measurement labels.
- [x] Suppress the relevant primary gesture sequence on `pointerdown`/fallback `mousedown`, including matching pressed `pointermove` and compatibility `mousemove`, then guard `pointerup`, compatibility click/double-click/auxclick, drag-start, and selection-start events. Hover snapshots still update quietly; wheel/scroll are intentionally not intercepted.
- [x] Treat activation leaks as defects. Guided required primary-control checks were reported passed. Earlier page capture handlers and pre-existing pointer capture remain compatibility limits, not claimed safe support.

Implementation evidence: The picking/selection/session/UI modules, selection overlay, window-capture fixture instrumentation, and indicator copy. Previous check/build/diff and static artifact checks passed; later user-run production safety outcomes are recorded in [guided acceptance record](evidence/manual-acceptance.md). Native scrollbar/platform variants and bespoke pre-existing pointer capture were not separately verified.

Verification:

- Automated/static: The focused unit runner was added later for Step 3.1; no browser automation was added. `pnpm check`, `pnpm build`, and `git diff --check` passed. Production artifact review confirmed only `activeTab`/`scripting`, no `default_popup`/`content_scripts`/`host_permissions`, and only the HTTP(S) `inspect.css` web-accessible resource. Static review covered native hit testing, primary pointer/mouse/click safety guards, composed-path UI exclusion, cleanup, and the absence of wheel interception. Counters/focus/navigation must remain unchanged during the manual selection procedure, and page content/attributes/styles must remain unchanged except extension-owned insertion.
- Manual safety gate: The user reported no activation on the link, submit button, checkbox, input, pointer-down control, nested button, or draggable target; controls worked again after exit. Capture observations were distinguished from activation. Page/nested scrolling and visible/Escape exits also passed by user report; see [guided acceptance record](evidence/manual-acceptance.md).
- Residual characterization, not claimed by this pass: bespoke pointer-move editing controls, pre-existing pointer capture, hostile earlier listeners, and native scrollbar/touch variants.

Completion gate: Verified for the required primary-control sample via the user-run production safety gate. Do not retrospectively claim this gate had run before Phase 3 implementation.
Evidence: Verified — static implementation results plus guided production safety reports in [guided acceptance record](evidence/manual-acceptance.md).

Phase exit gate: Fresh `pnpm check`, `pnpm build`, and `git diff --check` pass, the mandatory installed-Chrome safety check is recorded, and repeated activate/select/exit restores normal interactions without page mutation or duplicate sessions.
Evidence: Verified for the reported primary-input sample — control safety, normal browsing after exit, lifecycle, and native scrolling.

## Phase 3 — Option-held measurement and resilient geometry

Outcome: A selected/hovered pair produces only the relevant temporary annotations and remains accurate as the page changes.
Depends on: Phase 2, including its safety gate.
Review boundary: Geometry, measurement presentation, and invalidation; no page editing or extra tools.

### Step 3.1 — Add pure rectangle measurement and formatting

Status: Verified — pure implementation and automated gates passed; no browser gate required
Requirements / acceptance: R5; AC6.
Depends on: Phase 2.
Review boundary: Pure geometry/formatting inside the extension; no DOM or framework dependency.

Expected files:

- `apps/extension/lib/geometry.ts`, `apps/extension/lib/format.ts`, `tests/unit/geometry.test.ts`, `tests/unit/format.test.ts`, `vitest.config.ts` — numeric contract, formatting contract, and focused tests.
- Root `package.json`, `pnpm-lock.yaml` — the scoped Vitest dependency and `pnpm test:unit` alias.

Tasks:

- [x] Define a small readonly rectangle input and discriminated result for axis gaps/touching, containment insets, and overlap. Keep this internal; no workspace package or public API is necessary.
- [x] Implement the spec's examples, reversed target order, vertical/diagonal separation, equality, shared-edge containment, touching, fractional and negative viewport coordinates. Reject non-finite or ineligible dimensions and overflowing derived edges at the input boundary without producing labels.
- [x] Format CSS-pixel labels to at most one decimal place, dropping trailing `.0` and avoiding negative-zero artifacts. No screen-density multiplication or diagonal Euclidean distance.
- [x] Add the minimal root Vitest runner with no DOM environment or browser harness.

Verification:

- Automated: `pnpm exec vitest run tests/unit/geometry.test.ts` passed (23 geometry tests); `pnpm test:unit` passed (37 tests across 2 files). Numeric relation/value outputs are asserted before formatting strings. Geometry uses one documented absolute `1e-7` CSS-pixel edge-comparison tolerance for floating-roundoff-only equality/touching/containment decisions; only corresponding near-zero gaps/insets are clamped, while meaningful fractional distances retain full precision. `pnpm check`, `pnpm build`, and `git diff --check` passed on 2026-11-09. Vitest `5.1.0`; no browser gate is needed for this pure calculation step.
- Manual: Not required for numerical correctness; visual interpretation is verified with rendering in Step 3.2.

Completion gate: Verified — geometry-table and tested boundary cases pass, with no negative-distance or CSS declaration claims. Later browser evidence is in Steps 3.2–4.1; pure tests alone do not prove input safety.
Evidence: Verified — 37 pure geometry/formatting tests, root check/build, and diff check passed on 2026-11-09; geometry edge comparisons use the documented `1e-7` CSS-pixel numerical tolerance without rounding meaningful outputs.

### Step 3.2 — Connect Option state to restrained annotations

Status: Verified — user-reported physical Option, geometry, and Option-click checks
Requirements / acceptance: R3–R5; AC3–AC6, blur portion of AC8.
Depends on: Step 3.1.
Review boundary: Modifier state and its complete UI/geometry consumer; temporary state does not alter selection.

Expected files:

- `apps/extension/lib/modifiers.ts`, `apps/extension/lib/measurement.ts`, `apps/extension/lib/session.ts`, `apps/extension/lib/ui.tsx`, and `apps/extension/components/measurement-overlay/` — measurement state and isolated presentation.
- `tests/unit/modifiers.test.ts`, `tests/unit/measurement.test.ts` — focused pure transition and layout checks; manual Chrome procedures cover rendering and interaction.

Tasks:

- [x] Handle Option/Alt down/up without requiring pointer movement. On blur or hidden visibility, clear temporary state and require a newly observed non-repeat modifier state; do not resurrect measurement merely on refocus. Track left/right Alt independently.
- [x] Read valid target rectangle snapshots and render geometry results only for distinct anchor/comparison pairs while Option is held. Include zero-gap, four-direction containment, and compact overlap presentation without unrelated neighbor measurements.
- [x] Replace quiet outline color during measurement rather than stacking outlines; render readable labels and minimal extension lines within the viewport. Keep selection/hover distinguishable, with no resizing affordance or full-page guides.
- [x] Implement Option-click's specified default: suppress page activation and preserve the anchor in both pointerdown and mousedown paths. Retain gesture guards even when no anchor is selected.

Verification:

- Automated: `pnpm test:unit` passed with 46 tests across 4 files; `pnpm check`, `pnpm build`, and `git diff --check` passed. Pure tests cover fresh-after-clear/repeat/left-right modifier transitions, horizontal/diagonal/containment/touching/overlap/invalid layout, and viewport label clamping. These checks do not claim to verify rendered labels, colors, or native key behavior; no UI/browser mocking harness was added.
- Artifact: The production manifest remains limited to `activeTab` and `scripting`, with no popup, automatic content registration, or broad host permissions. Emitted `inspect.css` contains the measurement line/label and measurement outline classes.
- Manual acceptance: Stationary Option press/release, no-anchor/self cases, unchanged anchor on Option-click, quiet outline restoration, current-pair-only labels, 40px gap, 40/60px diagonal, 20/30/130/110px insets, touching, overlap, and reversed order were reported correct. Focus loss/release elsewhere/refocus did not resurrect measurements; see [guided acceptance record](evidence/manual-acceptance.md).

Completion gate: Verified for the guided macOS Chrome modifier/visual/input cases as reported by the user; no independent browser instrumentation.
Evidence: Verified — previous unit/artifact results plus guided user-reported production acceptance in [guided acceptance record](evidence/manual-acceptance.md).

### Step 3.3 — Keep bounds current and retire invalid targets

Status: Verified — tracking tests and user-reported dynamic/zoom/invalidation acceptance
Requirements / acceptance: R6, R7; AC7, AC8, lifecycle regression in AC1.
Depends on: Step 3.2.
Review boundary: Dynamic bounds and resource disposal; no persistent session restoration.

Expected files:

- `apps/extension/lib/tracking.ts`, `apps/extension/lib/session.ts`, `apps/extension/lib/picking.ts`, `apps/extension/lib/selection.ts` — observation/scheduling, stationary-pointer hit testing, target tracking, invalidation, and cleanup.
- `tests/unit/tracking.test.ts` — injected scheduler/observer lifecycle and coalescing checks; dynamic layout and cleanup remain manual Chrome checks.

Tasks:

- [x] Track viewport/nested scrolling and resize with one coalesced RAF; observe only the current anchor/comparison with `ResizeObserver`, replace/unobserve targets as identities change, and use a filtered document `MutationObserver` for removal, zero-area, and discrete layout/style invalidation. Observers disconnect while hidden and on disposal.
- [x] Re-hit-test the retained pointer before reading selection snapshots, so stationary pointers follow current page hit testing after movement, transforms, scrolling, or removal. Use viewport `getBoundingClientRect()` snapshots for the existing overlay coordinate system.
- [x] Clear stale comparison/anchor state through selection refresh when targets become detached, zero-area, or otherwise ineligible; retain a valid anchor through real window blur while picker/modifier state clears temporary measurement and pointer presence. Option-held RAF sampling continues while an anchor and known page pointer remain, including transient missing/self comparisons, and stops on release, leave, blur, hidden state, or disposal.
- [x] Centralize tracker listener, observer, scheduled-frame, subscription, picker, selection, and UI teardown in session disposal. Preserve the asynchronous mount guard and cover partial observer-startup failure without leaving allocated observers behind.

Verification:

- Automated: `pnpm test:unit` passed with 53 tests across 5 files, including 7 focused tracking tests for coalesced invalidation, bounded sampling cancellation, observer replacement, hidden/dispose cancellation, partial setup failure, and detached owned-UI-host exit/disposal. The tracker now checks UI-host connectivity before filtering owned mutations and during refresh/resume; session startup owns mounted UI before picker construction, and picker listener setup rolls back on failure. `pnpm check` and `git diff --check` passed. No browser automation or DOM harness was added.
- Manual acceptance: The user reported stationary-pointer animation tracking, native document/nested scrolling, 125%/80% zoom retaining the 40 CSS-pixel gap, and fresh-Option behavior after focus loss. Timed anchor/comparison removal and zero-area comparison tests cleared stale targets. Earlier lifecycle checks covered exit and reload. See [guided acceptance record](evidence/manual-acceptance.md); exhaustive transform/sticky/hidden-document/host-removal variants were not separately attested.

Completion gate: Verified for the documented dynamic/invalidation cases through focused unit checks and user-reported production behavior. Disposal tests/static review support internal cleanup, not a browser memory-leak audit.
Evidence: Verified — 53 previously recorded tests across 5 files plus the user's fresh command-pass report and guided outcomes in [guided acceptance record](evidence/manual-acceptance.md).

Phase exit gate: Automated measurement/tracking results compose with guided production lifecycle, input safety, Option, animation, invalidation, and zoom acceptance.
Evidence: Verified for the documented first-slice sample; see [guided acceptance record](evidence/manual-acceptance.md) for exact checks and limits.

## Phase 4 — Production-artifact and real-page acceptance

Outcome: Evidence establishes exactly what works in the shipping build and what remains unsupported.
Depends on: Phase 3.
Review boundary: Acceptance evidence, artifact isolation, and bounded fixes with regression tests; no release work.

### Step 4.1 — Validate the production build and record support limits

Status: Verified for the documented production sample — manual results reported by the user
Requirements / acceptance: R1–R9; final AC1–AC11 verification.
Depends on: Phase 3.
Review boundary: Production artifact/manual boundary and final acceptance record. Substantial discovered fixes return to the owning step rather than accumulating an unrelated cleanup change.

Expected files:

- `plans/measurement-tools/plan.md` — execution evidence/status, or linked nonempty evidence notes once useful.
- `README.md` — actual development/activation instructions and validated support limits.
- Owning source/unit tests only for bounded defects found by acceptance; retain their original step ownership. No artifact browser test suite is required.

Tasks:

- [x] Build production afresh and run lightweight checks: user-reported `pnpm check`, `pnpm test:unit`, and `pnpm build` all passed before production loading. Later static review confirmed referenced output files, minimal permissions, CSS-only exposure, no popup, and no automatic content registration.
- [x] Load `.output/chrome-mv3` through regular Chrome's Load unpacked flow with the older dev copy disabled; user confirmed loading, toggle, Escape/visible Exit, reload cleanup, and final permissions/tab isolation.
- [x] Record guided Option, label/outline, focus-loss, zoom, animation, scrolling, and invalidation outcomes. Do not reinterpret these as exhaustive hostile-style, transform, or compatibility testing.
- [x] Record the actual named sample: the owned local integration/playground app, Pitchfork, and eBay. The earlier proposed additional existing user app was not separately identified; no fourth app, exact external route, authenticated state, or embedded-content traversal is claimed.
- [x] Record known source/toolchain context, reported Chrome-on-macOS outcomes, the named pages, and provenance/coverage gaps in `evidence/manual-acceptance.md`; exact browser/OS versions and screenshots were not supplied. Add root README and update owning statuses without publishing.

Verification:

- Automated/static: The user reported all three root commands passed during Checkpoint 1; the previous agent-run implementation suite recorded 53 tests. During documentation, static assertions confirmed all eight referenced/runtime files exist, only `activeTab`/`scripting` permissions, and only HTTP(S) `inspect.css` exposure. No browser test or new full-suite rerun was performed by the agent; user command logs were not supplied.
- Manual: The user performed guided production checks and reported each checkpoint successful, then named Pitchfork and eBay for public-site smoke. See [guided acceptance record](evidence/manual-acceptance.md). The agent did not operate or independently observe Chrome.

Completion gate: Verified for the documented first-slice sample and reported guided checks; every AC points to evidence below. This is scoped manual acceptance, not universal site support or permission to publish.
Evidence: Verified — user-reported production acceptance plus static artifact review and root README. Named sample: local integration app, Pitchfork, eBay; no separate additional app reported.

Phase exit gate: Static production review and user-reported guided acceptance pass on the documented sample; broader characterization is not claimed.
Evidence: Verified for this sample — see [guided acceptance record](evidence/manual-acceptance.md). No publication, deployment, or browser automation.

## Final acceptance

This table assigns ownership; detailed results and provenance are in the owning steps and [guided acceptance record](evidence/manual-acceptance.md). Manual criteria are verified by user report for the guided scope, not agent-operated Chrome or exhaustive compatibility testing.

| Spec acceptance ID | Owning step / gate | Verification and expected result | Evidence / status |
| --- | --- | --- | --- |
| AC1 | Steps 2.1, 2.2, 3.3; Phase 4 exit | One reversible session; safe selection composes with Escape/visible exit and no duplicate resources. | Verified — owning steps and guided user report; see evidence. |
| AC2 | Step 2.2 safety gate; Step 4.1 production check | Required controls do not activate or focus during inspection, including pointer-down behavior; page content/styles are preserved. | Verified — owning steps and guided user report; see evidence. |
| AC3 | Steps 2.2 and 3.2 | One unchanged anchor, one eligible comparison, extension UI excluded, no unrequested measurements. | Verified — owning steps and guided user report; see evidence. |
| AC4 | Step 3.2 | Manual physical Option transitions show only the valid pair's measurements and return to quiet outlines. | Verified — owning step and guided user report; see evidence. |
| AC5 | Step 3.2 | Option-click preserves the anchor and suppresses page activation. | Verified — owning step and guided user report; see evidence. |
| AC6 | Steps 3.1 and 3.2 | Geometry table/boundaries produce correct CSS-pixel values and render consistent annotations. | Verified — owning steps and guided user report; see evidence. |
| AC7 | Step 3.3 | Scroll, dynamic movement, resize, transforms, and real zoom keep bounds/labels current. | Verified — owning step and guided user report; see evidence. |
| AC8 | Steps 3.2 and 3.3 | Removal, pointer leave, and focus changes clear stale/temporary state without losing a valid anchor on blur. | Verified — owning steps and guided user report; see evidence. |
| AC9 | Step 2.1 manual gate; Step 4.1 | Actual restricted-page denial is visible and navigation does not auto-restore inspection. | Verified — owning steps and guided user report; see evidence. |
| AC10 | Step 2.1 manual gate; Step 4.1 artifact/live gate | Production access is explicit and current-tab scoped, with no inherited test or broad site grants. | Verified — owning steps and guided user report; see evidence. |
| AC11 | Step 4.1 | Recorded own/public-site sample, observed limitations, and no universal iframe/shadow compatibility claim. | Verified — owning step and guided user report; see evidence. |
| AC12 | Step 1.1 | Official CLI provenance, preserved spec, and no hand-rolled replacement scaffold. | Verified — user-reported official CLI scaffolding and inspected generated templates/wiring; see Step 1.1. |

## Rollback and recovery

- All planned product changes are local and reversible; no database migration, remote deployment, or public release is involved. Revert only feature-owned changes and preserve unrelated work and evidence. Do not delete a populated app directory on a failed create attempt without inspecting what was created.
- A failed scaffold/install is a partial setup, not a working baseline. Preserve logs, inspect generated files, and retry only in a known empty target or explicitly reviewed partial scaffold. Avoid force/overwrite and global package changes.
- Step 2.2's interception, hit testing, and selection consumers form one rollback unit. Do not retain selectable UI while reverting only the safety layer. If later measurement work fails, the verified selection-only checkpoint can remain, clearly described as incomplete.
- Runtime initialization failures dispose only extension-owned resources and report failure; exiting never rewrites the page from a stale snapshot. Recovery from a broken manual session is unloading the unpacked extension; use page reload only as an explicit last resort because unsaved page work may be lost.
- If an optional separate development profile is used, keep it user-controlled and do not automate creation or cleanup. Never point cleanup at a personal browser profile. If unexpected permission leakage is discovered, stop, inspect the production output, and rebuild before any further manual acceptance.
- For defects discovered in Phase 4, return to the relevant owning step, add a focused regression, and rerun dependent phase gates. Do not preserve stale Verified claims after changing the behavior they covered.

## Deferred checks and accepted deviations

- Sample clarification: Actual named manual sample is the owned integration/playground app, Pitchfork, and eBay. An additional existing app was proposed but not separately identified; do not count one as tested. No wider compatibility waiver/publication approval is inferred.
- Recorded evidence: Prior agent-run unit/check/build results, fresh user command-pass report, static production artifact assertions, and guided user-reported Chrome outcomes. Exact browser/OS versions, full user command logs, external routes, screenshots, and a separate additional app were not supplied.
- Unclaimed characterization: hostile earlier handlers, pre-existing pointer capture, native scrollbar/touch variants, browser memory profiling, exhaustive transform/sticky/visibility cases, and external iframe/shadow internals. Named-site smoke does not establish every control/state on those sites.
- Deliberately out of scope: Playwright and automated browser testing for this slice, browser harnesses/drivers, publication/store packaging acceptance, cross-browser/platform matrices, iframe/closed-shadow traversal, editing/undo, parent navigation, pinned/exported measurements, and dotted-guide controls. Broader automation is explicitly deferred by the user, not a waiver of manual behavior acceptance and not a required unperformed browser test. These items must not appear as accidentally skipped first-slice acceptance.
- Research used for planning, not execution evidence: [WXT installation](https://wxt.dev/guide/installation), [WXT CLI](https://wxt.dev/api/cli/wxt), [runtime active-tab example](https://github.com/wxt-dev/examples/tree/main/examples/active-tab-content-script), [Vite create flow](https://vite.dev/guide/), [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), and [Solid render](https://docs.solidjs.com/reference/rendering/render). Recheck selected versions before implementation; official unpacked production/dev loading in installed Chrome is the intended browser procedure.
