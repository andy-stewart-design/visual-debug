# Measurement Tools Implementation Plan

## Status and governing source

- Governing spec: [spec.md](spec.md).
- Delivery state: In progress. Official application scaffolds exist and Step 1.1 workspace wiring is verified; feature implementation and manual acceptance remain pending.
- Acceptance or release still pending: All feature implementation and acceptance gates. Store publication is out of scope.
- Blockers: No known product blocker. Event-safety feasibility is an explicit execution gate in Step 2.2. Browser availability and permission to load an unpacked extension must be established during execution, not assumed here. Scaffold check/build verification has run; no feature behavior has been exercised.

Step statuses below are the authoritative execution record. A phase is complete only when its step completion gates and phase exit gate are satisfied. Implementation verification does not imply live acceptance or release.

## Execution constraints

- All project paths are relative to `/Users/robestewart/Documents/Development/visual-debug`; commands run there unless stated otherwise.
- Preserve `plans/measurement-tools/spec.md` and unrelated work. The official application scaffolds now provide a runnable scaffold baseline; no feature behavior or known green unit suite is claimed.
- Step 1.1 scaffold/wiring execution was explicitly authorized and is recorded below. Do not begin later implementation steps, add dependencies/tests, commit, publish, or change a browser profile without their stated authorization.
- Proposed implementation assumptions follow the spec: WXT/TypeScript, Chrome MV3 first, pnpm workspace, Solid UI, Solid + TypeScript playground, Shadow DOM UI, and user-invoked `activeTab` access. Solid is the user's explicit UI choice; WXT, pnpm, and Chrome-first remain planning assumptions rather than newly explicit approvals. No framework/package extraction is needed.
- Use official create flows in new application directories. If a target already exists when execution begins, inspect it and stop rather than using overwrite/force flags. Do not scaffold into the populated repository root.
- Before executing create commands, inspect the selected releases' runtime requirements and CLI help. Use a compatible available Node/pnpm, record actual versions, and pin resolved dependencies in the workspace lockfile. Do not install a system toolchain or globally upgrade packages without approval.
- Browser validation requires user-provided approval/access to load an unpacked extension in installed Chrome and inspect real sites. Record unavailable checks as Blocked, not passed; an optional separate development profile may be used, but no disposable profile or browser-binary setup is required.
- Required safety fixtures cannot be removed merely to turn a failing gate green. If the scoped requirements cannot be met, stop at the safety gate and request a product decision rather than silently weakening the spec.

### Proposed tooling and verification commands

Step 1.1 adds the development/build/check scripts below; Step 1.2 adds only the lean unit-test script and any needed Vitest configuration. Preserve useful official scaffold scripts and expose these root aliases:

| Proposed root command | Intended implementation / proof |
| --- | --- |
| `pnpm dev:ext` | WXT development command in `apps/extension`; development aid, not artifact acceptance. |
| `pnpm dev:int` | Vite in `apps/playground`; development aid for the deterministic Solid fixture. |
| `pnpm check` | Runs `wxt prepare && tsc --noEmit` in `apps/extension`, then `tsc -b` in `apps/playground`. This is the sole root checking alias; no `typecheck`-named root alias. |
| `pnpm build` | Runs the production build in each application; WXT Chrome MV3 output is manually inspected, not assumed from a directory name. |
| `pnpm test:unit` | Lean Vitest runner, primarily for pure geometry/formatting and only useful cheap state/disposal tests; no browser harness. |

Focused Vitest invocations use `pnpm test:unit -- <file>` after the script exists. Expected source/test paths below are proposed additions, not observations about generated templates. Adapt template-dependent locations once in Step 1.1 and record the actual paths here; do not duplicate source trees to match guesses. Browser behavior is validated manually in installed Chrome; no Playwright, browser automation, browser test driver, helper/manifest-copy machinery, automatic Chromium/profile setup, or test-only host permission is planned.

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

Status: In progress — implementation complete; awaiting explicit manual fixture smoke
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
- [x] Review the lean unit-test requirement and defer runner installation until Step 3.1 introduces pure measurement calculations; no empty test setup or dependency was added. Do not add Playwright, browser automation, test-driver endpoints, helper/manifest-copy machinery, extra test host permissions, or automatic browser/profile setup.

Verification:

- Automated: `pnpm check` passed on 2026-11-05 and `pnpm build` passed on 2026-11-05; both include the playground TypeScript/build output. No `pnpm test:unit` runner was added because pure measurement code is deferred to Step 3.1; no browser harness is planned.
- Manual: Pending explicit smoke in an ordinary installed Chrome tab. Start the deterministic playground with `pnpm dev:int`, exercise and reset every counter/outcome, then check the fixed geometry and dynamic controls, including page/nested scrolling. Confirm the fixture can reveal normal pointer-down and page-capture observations before inspection suppression is attempted. No automated UI or Chrome check is claimed.

Completion gate: The Solid fixture has observable, resettable outcomes for normal actions and dynamic geometry, and manual smoke confirms it can detect those actions. Implementation is complete, but the gate remains open awaiting the user's manual fixture smoke; no browser harness or feature safety claim is required.
Evidence: In progress — source implementation and root `pnpm check`/`pnpm build` passed on 2026-11-05; manual fixture smoke not run.

Phase exit gate: Fresh scaffold builds/checks and the deterministic fixture manual smoke are recorded together. Scripts, fixture paths, runtime versions, and any pre-existing environment failures are recorded.
Evidence: Pending — Step 1.2 manual smoke remains outstanding; Phase 1 stays incomplete.

## Phase 2 — Safe and reversible inspection

Outcome: One explicit session selects interactive elements without activating them, then exits cleanly.
Depends on: Phase 1.
Review boundary: Activation, permissions, event safety, selection and quiet outlines; measurements remain absent.

### Step 2.1 — Add explicit activation and complete session teardown

Status: In progress — implementation complete; awaiting manual lifecycle/permissions check
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

- Automated: `pnpm check`, `pnpm build`, and `git diff --check` passed on 2026-11-09. Production-output inspection confirmed the CSS Module class mappings and preserved host overrides in `.output/chrome-mv3/content-scripts/inspect.css`; the manifest contains only `activeTab` and `scripting`, has no `default_popup`, `content_scripts`, or `host_permissions`, and exposes only `content-scripts/inspect.css` to `http://*/*` and `https://*/*` for `cssInjectionMode: 'ui'`. The generated top-document runtime file is `.output/chrome-mv3/content-scripts/inspect.js`. No unit runner or browser harness was added.
- Manual prerequisite: Step 1.2's deterministic-playground smoke remains pending, so the Phase 1 exit gate is still open and is not silently treated as satisfied.
- Manual Step 2.1 check: Pending user-run Chrome verification. For development testing, stop/restart `pnpm dev` so WXT regenerates `.output/chrome-mv3-dev`; the currently generated dev output still reflects the starter popup/Google registration. Alternatively load a clean production output unpacked. WXT dev may add development-only permissions, so do not treat its manifest as an exact production-manifest check. Activate once and verify the indicator says selection is unavailable; activate again and verify it disappears; repeat rapid toggles; exit with Escape and the visible button; navigate and confirm there is no restoration; verify isolation in a second tab; activate on a restricted `chrome://` page and verify an extension-owned `!` badge and descriptive action title; inspect the clean production artifact for no broad host access. Record browser/OS/build versions and actual lifecycle/permission results. The CSS Module refactor also requires this visual/lifecycle recheck against the CSS-loaded production artifact; prior inline-style working evidence does not close that check.
- Static limitation: WXT shadow event isolation stops events once they reach the shadow root, but cannot prevent page capture listeners that ran earlier. This is not a universal hostile-page safety claim; Escape remains the only page-level keyboard listener in this lifecycle step.

Completion gate: Static checks and artifact review pass, but Step 2.1 remains In progress until the actual Chrome action, permission, and lifecycle check is run. Full Step 2.1 Verified status and AC9/AC10 claims are pending that manual evidence; Phase 1 also remains incomplete pending Step 1.2 manual smoke.
Evidence: In progress — explicit host stacking/pointer-event styling and WXT pointer/click event isolation added; production artifact remains clean. Confirmed bug: Solid `onClick` delegated to `document`, but isolated-shadow-root click handling stops it at the boundary; `SessionIndicator` now uses `on:click`, emitted as a direct listener in production `inspect.js`. Manual Step 1.2, Step 2.1, and visible Exit-click rechecks remain pending, and dev-output testing requires stopping/restarting `pnpm dev` first.

### Step 2.2 — Implement safe picking and quiet selection as one unit

Status: In progress — implementation complete; awaiting mandatory installed-Chrome safety gate
Requirements / acceptance: R1–R3, R7; AC1–AC3.
Depends on: Step 2.1 build/check and manual lifecycle gates; installed-Chrome safety gate below must pass before Phase 3.
Review boundary: Input interception, hit testing, selected/hover state, and outline consumer are one review/revert unit.

Expected files:

- `apps/extension/lib/input.ts`, `apps/extension/lib/picking.ts`, `apps/extension/lib/selection.ts`, `apps/extension/lib/ui.tsx`, `apps/extension/lib/session.ts` — safe input/session integration.
- Optional focused unit tests for pure selection/state decisions; no browser test paths or safety driver.
- Template-dependent Solid playground files — only additional reproducible safety cases found necessary during this step.

Tasks:

- [x] Compare the event-routing approaches against the real fixture's source instrumentation. Capture interception with native `elementFromPoint()` was chosen over a full-screen input shield: the CSS overlays remain `pointer-events: none`, nested scrolling stays native, and no custom scroll emulation or shield hit-target translation is required. Shadow DOM event isolation alone is not treated as a safety proof.
- [x] Use capture interception while preserving scrolling and the direct accessible exit. Filter extension-owned events through the actual Shadow host's composed path and page targets through connected, finite, nonzero-area checks. No page element is modified for hit testing.
- [x] Integrate one anchor and one hover comparison using actual top-document hit elements, quiet solid/dashed outlines, and extension-UI exclusion. No resize handles, full-page guides, parent navigation, or measurement labels.
- [x] Suppress the relevant primary gesture sequence on `pointerdown`/fallback `mousedown`, including matching pressed `pointermove` and compatibility `mousemove`, then guard `pointerup`, compatibility click/double-click/auxclick, drag-start, and selection-start events. Hover snapshots still update quietly; wheel/scroll are intentionally not intercepted.
- [x] Treat activation leaks as defects. The mandatory fixture safety gate remains outstanding; earlier page capture handlers and pre-existing pointer capture cannot be universally neutralized and will be recorded as compatibility limitations rather than claimed safe support. The manual gate must specifically exercise custom pointer-move controls and document page-established pointer capture as an unsupported limitation where relevant.

Implementation evidence: `apps/extension/lib/picking.ts`, `lib/selection.ts`, `lib/session.ts`, `lib/ui.tsx`, `components/selection-overlay/`, the updated window-capture fixture instrumentation in `apps/playground/src/App.tsx`, and the indicator copy. Static source/artifact review plus `pnpm check`, `pnpm build`, and `git diff --check` passed; native scrollbar exemption is limited to measurable common tracks, with other browser variants unverified; no browser safety result is claimed.

Verification:

- Automated/static: No focused unit runner or browser automation was added. `pnpm check`, `pnpm build`, and `git diff --check` passed. Production artifact review confirmed only `activeTab`/`scripting`, no `default_popup`/`content_scripts`/`host_permissions`, and only the HTTP(S) `inspect.css` web-accessible resource. Static review covered native hit testing, primary pointer/mouse/click safety guards, composed-path UI exclusion, cleanup, and the absence of wheel interception. Counters/focus/navigation must remain unchanged during the manual selection procedure, and page content/attributes/styles must remain unchanged except extension-owned insertion.
- Manual safety gate: Pending user approval/access. Use installed macOS Chrome and the unmodified production build through Chrome's official Load unpacked flow. In the deterministic playground, first confirm counters/outcomes work normally, then select links, inputs, form controls, nested button content, draggable elements, and the custom pointer-down control. Exercise the pre-registered window capture observer, native page and nested scrolling, pointer movement over the extension UI, repeated visible/Escape exit, and ordinary browsing after exit. Record any earlier-handler or pointer-capture variants as unsupported rather than claiming universal event suppression.
- Concise pending checklist: baseline/reset all counters; primary pointerdown selection of each required fixture and nested text; verify no click/checkbox/submit/focus-input/drag/hash outcome changes; compare page-capture observations separately; exercise custom pointer-move controls and note any page-established pointer-capture limitation; hover A/B/C without replacing A; move over indicator and click Exit; scroll page and nested scroller; repeat activate/select/Escape and visible exit; verify no page mutation and normal browsing after exit.

Completion gate: Required AC2 fixtures and selection invariants must pass in the explicit installed-Chrome manual safety gate. No measurement phase begins with an unaccepted safety failure. If browser access or a required safety property is unavailable, mark Blocked and name the affected gate.
Evidence: In progress — implementation/static evidence recorded above; mandatory manual gate not run.

Phase exit gate: Fresh `pnpm check`, `pnpm build`, and `git diff --check` pass, the mandatory installed-Chrome safety check is recorded, and repeated activate/select/exit restores normal interactions without page mutation or duplicate sessions.
Evidence: Pending manual safety gate.

## Phase 3 — Option-held measurement and resilient geometry

Outcome: A selected/hovered pair produces only the relevant temporary annotations and remains accurate as the page changes.
Depends on: Phase 2, including its safety gate.
Review boundary: Geometry, measurement presentation, and invalidation; no page editing or extra tools.

### Step 3.1 — Add pure rectangle measurement and formatting

Status: Pending
Requirements / acceptance: R5; AC6.
Depends on: Phase 2.
Review boundary: Pure geometry/formatting inside the extension; no DOM or framework dependency.

Expected files:

- `apps/extension/lib/geometry.ts`, `apps/extension/lib/format.ts`, `tests/unit/geometry.test.ts` — numeric contract and focused tests.

Tasks:

- [ ] Define a small rectangle input and discriminated result for axis gaps/touching, containment insets, and overlap. Keep this internal; no workspace package or public API is necessary.
- [ ] Implement the spec's examples, reversed target order, vertical/diagonal separation, equality, shared-edge containment, touching, and fractional coordinates. Reject non-finite or ineligible dimensions at the input boundary without producing labels.
- [ ] Format CSS-pixel labels to at most one decimal place, dropping trailing `.0` and avoiding negative-zero artifacts. No screen-density multiplication or diagonal Euclidean distance.

Verification:

- Automated: `pnpm test:unit -- tests/unit/geometry.test.ts` asserts numeric relation/value outputs before checking strings. Run `pnpm check`; no browser gate is needed for this pure calculation step.
- Manual: Not required for numerical correctness; visual interpretation is verified with rendering in Step 3.2.

Completion gate: Every geometry-table example and boundary case passes; outputs cannot imply a negative distance or CSS margin/padding declaration.
Evidence: Not run.

### Step 3.2 — Connect Option state to restrained annotations

Status: Pending
Requirements / acceptance: R3–R5; AC3–AC6, blur portion of AC8.
Depends on: Step 3.1.
Review boundary: Modifier state and its complete UI/geometry consumer; temporary state does not alter selection.

Expected files:

- `apps/extension/lib/modifiers.ts`, `apps/extension/lib/session.ts`, `apps/extension/lib/ui.tsx`, proposed `apps/extension/lib/overlay.css` — measurement state and isolated presentation.
- Optional focused unit tests for modifier/state transitions; manual Chrome procedures cover rendering and interaction.

Tasks:

- [ ] Handle Option/Alt down/up without requiring pointer movement. On blur, clear temporary state and require a newly observed modifier state; do not resurrect measurement merely on refocus.
- [ ] Read valid target rectangles and render geometry results only for distinct anchor/comparison pairs while Option is held. Include zero-gap and compact overlap presentation without unrelated neighbor measurements.
- [ ] Replace quiet outline color during measurement rather than stacking outlines; render legible labels and minimal extension lines within the viewport. Keep selection/hover distinguishable, with no resizing affordance or full-page guides.
- [ ] Implement Option-click's specified default: suppress page activation and preserve the anchor. Add modifier/no-anchor/self-target cases to the existing safety fixture checks.

Verification:

- Automated: `pnpm check` and any focused `pnpm test:unit` checks of pure modifier/selection state transitions. Unit tests do not claim to verify rendered labels, colors, or native key behavior; no UI/browser mocking harness is required.
- Manual: In macOS Chrome, select A, hover B, press/release the physical Option key without moving, then switch focus while held. Verify immediate reveal/hide, contrasting outlines without duplicates, correct readable labels, and no measurement resurrection on refocus. Hover another target and Option-click: A remains selected and the page does not activate. Try no anchor and a self-target: neither produces measurements. Review side-by-side, diagonal, containment, and overlap examples; record visual mismatches rather than silently changing the geometry contract.

Completion gate: The interaction and geometry compose in the runtime, the physical macOS modifier behavior is observed, and earlier input safety still passes manually.
Evidence: Not run.

### Step 3.3 — Keep bounds current and retire invalid targets

Status: Pending
Requirements / acceptance: R6, R7; AC7, AC8, lifecycle regression in AC1.
Depends on: Step 3.2.
Review boundary: Dynamic bounds and resource disposal; no persistent session restoration.

Expected files:

- `apps/extension/lib/tracking.ts`, `apps/extension/lib/session.ts`, `apps/extension/lib/ui.tsx` — observation/scheduling and invalidation.
- Optional focused unit tests for disposal/scheduling; dynamic layout and cleanup are checked manually in Chrome.

Tasks:

- [ ] Track viewport/nested scrolling, resize, target resizing, and position changes. Use a bounded scheduler; ResizeObserver alone is insufficient for position-only movement. If animation-frame sampling is used during measurement, suspend it when annotations are hidden or the session ends.
- [ ] Re-read bounds before drawing and use current hit testing when layout changes beneath a stationary pointer. Keep overlay/UI positioning in the same viewport coordinate system as the measured rectangles.
- [ ] Clear stale comparison/anchor state when removed, zero-area, or otherwise ineligible; clear comparison on pointer leave. Preserve a valid anchor through window blur without retaining temporary measurement state.
- [ ] Centralize disposal of listeners, observers, scheduled work, UI, and retained targets. Add rapid activate/exit and failure-during-initialization regression cases.

Verification:

- Automated: Any focused `pnpm test:unit` disposal/scheduling checks and `pnpm check`. Assert scheduled work/resources are cancelled on all disposal paths; no browser automation is planned.
- Manual: In installed Chrome, measure while scrolling the document and a nested container, resizing the viewport and targets, moving or transforming targets, and changing browser zoom. Compare current DOM rectangles with labels and line endpoints. Remove the comparison, then the anchor, and try zero-area targets and pointer leave: stale annotations clear and invalid anchors lose selection. Rapidly activate/exit and confirm no leftover overlays/interception; review disposal paths for cancelled tracking and released references. Synthetic viewport/DPR changes are not substituted for real browser zoom.

Completion gate: No stale numeric annotations survive invalidation, dynamic overlays align with current bounds, and hidden/exited sessions do not keep active tracking work or page references.
Evidence: Not run.

Phase exit gate: Fresh `pnpm build`, `pnpm check`, and the lean unit suite pass together. The installed-Chrome lifecycle, safety, physical Option, and browser-zoom manual gates are recorded; no unsupported geometric semantics have been introduced to hide a defect.
Evidence: Not run.

## Phase 4 — Production-artifact and real-page acceptance

Outcome: Evidence establishes exactly what works in the shipping build and what remains unsupported.
Depends on: Phase 3.
Review boundary: Acceptance evidence, artifact isolation, and bounded fixes with regression tests; no release work.

### Step 4.1 — Validate the production build and record support limits

Status: Pending
Requirements / acceptance: R1–R9; final AC1–AC11 verification.
Depends on: Phase 3.
Review boundary: Production artifact/manual boundary and final acceptance record. Substantial discovered fixes return to the owning step rather than accumulating an unrelated cleanup change.

Expected files:

- `plans/measurement-tools/plan.md` — execution evidence/status, or linked nonempty evidence notes once useful.
- `README.md` — actual development/activation instructions and validated support limits.
- Owning source/unit tests only for bounded defects found by acceptance; retain their original step ownership. No artifact browser test suite is required.

Tasks:

- [ ] Build production afresh, then run the implemented lightweight checks. Inspect the production manifest/output for runtime-only activation, required minimal permissions, no test grants or driver, and no automatic page-wide content registration. Verify referenced scripts/styles exist; manual output review is sufficient.
- [ ] Load that unmodified production output through Chrome's official Load unpacked flow with user-provided approval/access. A separate development profile is optional, not mandatory. Exercise the actual toolbar, visible exit, restricted-page feedback, tab isolation, rapid toggling, navigation cleanup, and control safety without test-granted host access.
- [ ] Complete the physical Option, focus-loss, visual readability, real zoom, and dynamic-layout checks not already evidenced against this build. Include styles hostile to ordinary in-page UI to validate isolation.
- [ ] Select and record a small concrete sample: the controlled playground, at least one accessible app the user works on, and two representative public sites. Use non-destructive inspection only; do not log in, submit forms, or touch sensitive data without explicit authorization. If the user's app is unavailable, leave that acceptance portion Blocked rather than silently replacing it.
- [ ] Record browser/OS and build/dependency versions, pages/cases checked, observed results, screenshots where useful, unsupported iframe/shadow boundaries, and residual event-safety limitations. Update actual run instructions and each owning step's evidence/status.

Verification:

- Automated: From the root, `pnpm check`, `pnpm build`, and lean `pnpm test:unit` are the only planned commands. Manual manifest/output review plus `pnpm build` is sufficient for artifact integrity; there is no browser harness or automated browser gate.
- Manual: With user/machine access, run the production-output procedure above in installed Chrome. All required controls remain safely selectable; measurement values match inspected DOM bounds; denied activation is visible; normal browsing resumes after exit; tested support boundaries are stated honestly.

Completion gate: Every acceptance ID below points to recorded passing evidence or is explicitly Blocked/Accepted deviation/Deferred with its impact and actual approval owner if any. The feature is not labeled implementation-verified while a required gate is merely skipped. No release or publication is performed.
Evidence: Not run.

Phase exit gate: Unmodified production-artifact checks and required live acceptance pass, with accurate documentation of the tested sample. Outstanding required checks prevent a completed-feature claim; waivers are recorded as deviations, not passes.
Evidence: Not run.

## Final acceptance

This table assigns ownership; execution results belong in the named step, not a second independently maintained progress record. Every criterion is currently Pending; not run.

| Spec acceptance ID | Owning step / gate | Verification and expected result | Evidence / status |
| --- | --- | --- | --- |
| AC1 | Steps 2.1, 2.2, 3.3; Phase 4 exit | One reversible session; safe selection composes with Escape/visible exit and no duplicate resources. | See owning steps; Pending, not run. |
| AC2 | Step 2.2 safety gate; Step 4.1 production check | Required controls do not activate or focus during inspection, including pointer-down behavior; page content/styles are preserved. | See owning steps; Pending, not run. |
| AC3 | Steps 2.2 and 3.2 | One unchanged anchor, one eligible comparison, extension UI excluded, no unrequested measurements. | See owning steps; Pending, not run. |
| AC4 | Step 3.2 | Manual physical Option transitions show only the valid pair's measurements and return to quiet outlines. | See owning step; Pending, not run. |
| AC5 | Step 3.2 | Option-click preserves the anchor and suppresses page activation. | See owning step; Pending, not run. |
| AC6 | Steps 3.1 and 3.2 | Geometry table/boundaries produce correct CSS-pixel values and render consistent annotations. | See owning steps; Pending, not run. |
| AC7 | Step 3.3 | Scroll, dynamic movement, resize, transforms, and real zoom keep bounds/labels current. | See owning step; Pending, not run. |
| AC8 | Steps 3.2 and 3.3 | Removal, pointer leave, and focus changes clear stale/temporary state without losing a valid anchor on blur. | See owning steps; Pending, not run. |
| AC9 | Step 2.1 manual gate; Step 4.1 | Actual restricted-page denial is visible and navigation does not auto-restore inspection. | See owning steps; Pending, not run. |
| AC10 | Step 2.1 manual gate; Step 4.1 artifact/live gate | Production access is explicit and current-tab scoped, with no inherited test or broad site grants. | See owning steps; Pending, not run. |
| AC11 | Step 4.1 | Recorded own/public-site sample, observed limitations, and no universal iframe/shadow compatibility claim. | See owning step; Pending, not run. |
| AC12 | Step 1.1 | Official CLI provenance, preserved spec, and no hand-rolled replacement scaffold. | Verified — user-reported official CLI scaffolding and inspected generated templates/wiring; see Step 1.1. |

## Rollback and recovery

- All planned product changes are local and reversible; no database migration, remote deployment, or public release is involved. Revert only feature-owned changes and preserve unrelated work and evidence. Do not delete a populated app directory on a failed create attempt without inspecting what was created.
- A failed scaffold/install is a partial setup, not a working baseline. Preserve logs, inspect generated files, and retry only in a known empty target or explicitly reviewed partial scaffold. Avoid force/overwrite and global package changes.
- Step 2.2's interception, hit testing, and selection consumers form one rollback unit. Do not retain selectable UI while reverting only the safety layer. If later measurement work fails, the verified selection-only checkpoint can remain, clearly described as incomplete.
- Runtime initialization failures dispose only extension-owned resources and report failure; exiting never rewrites the page from a stale snapshot. Recovery from a broken manual session is unloading the unpacked extension; use page reload only as an explicit last resort because unsaved page work may be lost.
- If an optional separate development profile is used, keep it user-controlled and do not automate creation or cleanup. Never point cleanup at a personal browser profile. If unexpected permission leakage is discovered, stop, inspect the production output, and rebuild before any further manual acceptance.
- For defects discovered in Phase 4, return to the relevant owning step, add a focused regression, and rerun dependent phase gates. Do not preserve stale Verified claims after changing the behavior they covered.

## Deferred checks and accepted deviations

- Accepted deviations: None. No waiver or permission to bypass a required check has been granted.
- Required but unexecuted checks: Every lightweight unit and manual gate above, except the Step 1.1 scaffold check/build gate recorded above. Unavailable unpacked-extension access or the user's app must be recorded as blockers at execution time, not assumed available. No feature runtime checks have been run.
- Deliberately out of scope: Playwright and automated browser testing for this slice, browser harnesses/drivers, publication/store packaging acceptance, cross-browser/platform matrices, iframe/closed-shadow traversal, editing/undo, parent navigation, pinned/exported measurements, and dotted-guide controls. Broader automation is explicitly deferred by the user, not a waiver of manual behavior acceptance and not a required unperformed browser test. These items must not appear as accidentally skipped first-slice acceptance.
- Research used for planning, not execution evidence: [WXT installation](https://wxt.dev/guide/installation), [WXT CLI](https://wxt.dev/api/cli/wxt), [runtime active-tab example](https://github.com/wxt-dev/examples/tree/main/examples/active-tab-content-script), [Vite create flow](https://vite.dev/guide/), [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), and [Solid render](https://docs.solidjs.com/reference/rendering/render). Recheck selected versions before implementation; official unpacked production/dev loading in installed Chrome is the intended browser procedure.
