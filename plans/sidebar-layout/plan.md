# Browser Sidebar Migration Implementation Plan

## Governing source

- Governing spec: [spec.md](spec.md)
- Orientation: [overview.md](overview.md)

This plan is an execution contract, not authorization to start implementation. Routine execution changes only task checkboxes. Scope, IDs, dependencies, expected files, verification definitions, completion gates, and acceptance mappings require explicit user agreement to change. Record an agreed change, its rationale, and the actual agreement in `evidence/changes.md`; never invent approval. Checkboxes do not imply acceptance, approval, publication, deployment, or release. Supervised-workflow approvals remain in extension state.

## Execution constraints

- Paths are relative to this repository. Evidence paths below are relative to `plans/sidebar-layout/`.
- Preserve unrelated work. Expected files bound the change; they are not permission to edit unrelated code.
- Readiness of the spec does not establish runtime feasibility. Permission/user-gesture behavior and reliable sidebar-close shutdown must pass the Phase 1 gate in **both** browsers before dependent UI migration proceeds. If the contract cannot be met, stop and escalate; do not substitute broader host permissions or leave inspection active after close.
- Retain `activeTab` and `scripting`, with browser-specific sidebar declarations/permission generated as necessary by WXT. No persistent host grants or automatic all-sites content registration.
- Preserve page-local DOM references, picking, geometry, modifiers, overlays, Escape, and cleanup. Style editing and a new selected-element details UI are not part of this work.
- The user performs all manual browser checks on macOS, using Chrome stable and Firefox Developer Edition with test profiles. The assistant runs deterministic checks and records the user's runtime results; it does not launch browsers or alter profiles. Missing user verification blocks the relevant gate. Developer Edition evidence does not establish stable-Firefox support; no browser installation or publication is authorized.
- Use existing tooling and playground fixtures; do not introduce a browser automation framework for this migration. New unit-test files named below are proposed additions, not currently runnable tests.
- A verification checkbox is checked only after its checks and completion gate pass and concise evidence is recorded. Failed, blocked, skipped, or waived checks stay unchecked; a waiver is not a pass.
- Create evidence notes only when there is an outcome or blocker. Each completed step gets a few bullets or one to three sentences naming the check, outcome, and material caveat. Record blockers, actual approvals, deviations, and follow-up there, not as mutable plan status or transcripts. Phase outcomes belong in their final step's note.

### Inspected tooling and preconditions

Static inspection found the following existing root commands: `pnpm check`, `pnpm test:unit`, `pnpm build`, `pnpm dev:ext`, and `pnpm dev:int`. Extension scripts include `pnpm --filter @visual-debug/extension build:firefox` and `pnpm --filter @visual-debug/extension dev:firefox`. `vitest.config.ts` includes `tests/unit/**/*.test.ts`; focused tests can use `pnpm exec vitest run <test paths>` from the repository root.

The current background calls `enqueueToggle`; activation injects the top-frame runtime content script only when its receiver is missing. The content script serializes toggles, and `lib/session.ts` cleans up asynchronously mounted UI and page listeners. Existing tests cover geometry, formatting, measurement, modifiers, and tracking. There is no existing browser harness. These observations do not establish a green baseline. No checks or live acceptance were run to author this plan.

## Phase overview and delivery boundary

| Phase | Outcome | Dependencies | Exit gate |
| --- | --- | --- | --- |
| 0 | Reproducible baseline and available verification environment | None | Existing failures distinguished from regressions; target browser access available |
| 1 | Explicit lifecycle and minimal cross-browser sidebar integration proven | Phase 0 | Real toolbar-start, close-stop, permission fallback, and window isolation demonstrated in Chrome and Firefox |
| 2 | Complete sidebar control UI replaces injected controls without inspection regressions | Phase 1 | Replacement proven before cleanup; state, focus, geometry, and teardown compose correctly |
| 3 | Production artifacts and documented cross-browser acceptance | Phase 2 | All AC1–AC12 covered by recorded deterministic and real-browser evidence |

Delivery boundary: one feature-complete PR, with each step a bounded review/revert unit. Intermediate phases are not claims of a complete sidebar product.

Atomic groups: Step 1.1 changes protocol and all existing consumers together; Step 1.2 changes toolbar behavior and the minimal working sidebar together; Step 2.2 removes the old indicator and its affected props/consumers together. Do not merge or revert half of an atomic group. Retain the current indicator through Step 2.1 as a temporary fallback until the new consumer is proven.

## Phase 0 — Baseline and verification access

Outcome: Establish the current behavior and the ability to prove the replacement without changing product behavior.
Depends on: None.
Review boundary: Baseline inspection/evidence plus the explicitly approved Firefox MV2 action-API compatibility repair; no sidebar implementation or dependency installation. See `evidence/changes.md` for the user's approval.

### Step 0.1 — Record baseline and browser prerequisites

Requirements / acceptance: R5, R9, R10; AC8 and AC11 baseline only, final coverage belongs to Phase 3.
Depends on: None.
Review boundary: Existing scripts, current browser behavior, target-browser availability, and existing failures; repair only the confirmed Firefox action-API mismatch and add focused regression coverage.

Expected files:

- `plans/sidebar-layout/evidence/step-0.1.md` — baseline, repair verification, and user runtime evidence.
- `apps/extension/lib/action-api.ts` — shared modern/legacy action resolver.
- `apps/extension/entrypoints/background.ts`, `apps/extension/lib/activation.ts` — use the resolved API for click registration and badge/title feedback.
- `tests/unit/action-api.test.ts` — modern/legacy selection and behavior regression tests.
- `plans/sidebar-layout/evidence/changes.md` — actual approval for the repair, test-target change, and manual-check ownership.

Tasks:

- [x] Confirm working tree boundaries, current scripts, installed prerequisites, and browser/operator access; preserve unrelated changes.
- [x] Run existing deterministic checks and distinguish pre-existing failures from regressions rather than claiming an assumed green baseline.
- [x] Repair the approved Firefox MV2 action-API mismatch with a shared fallback covering click registration and feedback, and verify modern/legacy regression tests without changing permissions or toggle semantics.
- [x] With approved test-profile access, characterize current toolbar activation, Escape/Exit, and representative playground selection/measurement in Chrome; record browser/macOS versions and Firefox availability without claiming Firefox support.
- [x] Satisfy the verification and completion gate below and record concise evidence.

Verification:

- Automated, repository root: `pnpm check`, `pnpm test:unit`, `pnpm build`, and `pnpm --filter @visual-debug/extension build:firefox`. Record whether each succeeds; a Firefox build is not runtime acceptance. Dependencies must already be available; stop for missing prerequisites rather than install implicitly.
- Repair regression, repository root: `pnpm exec vitest run tests/unit/action-api.test.ts`; assert modern API preference, Firefox legacy fallback, working listener and tab-scoped feedback, and a clear error when neither exists. Repeat the existing check/unit/build commands above after the repair.
- Manual (user-owned): use `pnpm dev:int` and the production extension builds in Chrome and Firefox Developer Edition test profiles. Open the printed playground URL, activate via toolbar, select/measure, then Escape and Exit. Verify cleanup restores normal page interaction. Reload the repaired Firefox extension via `about:debugging` and reload the playground tab before retesting. Record the user's results; assistant-run browser automation is not required.

Completion gate: Baseline evidence identifies reproducible commands, current behavior, any known failures, and a real path to both-browser testing. A relevant existing failure or unavailable browser/operator blocks dependent work until resolved or explicitly addressed through an agreed plan change.
Evidence location: [evidence/step-0.1.md](evidence/step-0.1.md).

Phase exit gate: After Step 0.1 checks, inspect the recorded baseline and access prerequisites. Proceed only when there is no unexplained relevant failure and both-browser verification is available. Record the assessment in `evidence/step-0.1.md` before advancing or requesting supervised approval.

## Phase 1 — Lifecycle contract and browser feasibility

Outcome: A small working sidebar path proves the risky browser integration before presentation investment.
Depends on: Step 0.1 and Phase 0 exit gate.
Review boundary: Protocol, routing, cancellation, minimal controls, and real browser compatibility. Visual polish and retirement of the page indicator are excluded.

### Step 1.1 — Add explicit lifecycle operations without breaking the existing consumer

Requirements / acceptance: R2–R5, R8; AC4, AC5, AC7, AC10 deterministic portions. Actual sidebar/browser portions belong to Steps 1.2 and 3.1.
Depends on: Step 0.1 and Phase 0 exit gate.
Review boundary: Atomic protocol/content/activation update with injected services for deterministic tests; existing toolbar toggle remains usable at this boundary.

Expected files:

- `apps/extension/lib/inspection-protocol.ts` — new shared message validation and correlated state types.
- `apps/extension/lib/inspection-controller.ts` — new testable lifecycle/operation ownership seam.
- `apps/extension/lib/activation.ts` — explicit start/stop/query transport and temporary legacy-toggle compatibility.
- `apps/extension/entrypoints/inspect.content.ts` — matching handlers, disposal reporting, and invalidation.
- `apps/extension/lib/session.ts` — disposal integration only if needed; do not move page responsibilities.
- `tests/unit/inspection-protocol.test.ts`, `tests/unit/inspection-controller.test.ts`, `tests/unit/activation.test.ts` — new focused tests.

Tasks:

- [x] Add validated start, stop, query, and state reporting with tab/document/request identity; validate extension sender/top-frame boundaries and reject malformed operations without side effects.
- [x] Make start/stop idempotent and operations deterministic; preserve on-demand injection and current toolbar-toggle usability while updating both ends atomically.
- [x] Invalidate pending starts on stop, navigation, or teardown; dispose a session that finishes mounting after invalidation rather than merely hiding its late response.
- [x] Test missing receivers, denied injection, invalid replies, duplicate starts/stops, superseded requests, Escape disposal, and navigation during asynchronous creation using injected transports/session factories.
- [x] Satisfy the verification and completion gate below and record concise evidence.

Verification:

- Automated, root: `pnpm exec vitest run tests/unit/inspection-protocol.test.ts tests/unit/inspection-controller.test.ts tests/unit/activation.test.ts`, then `pnpm --filter @visual-debug/extension check` and `pnpm --filter @visual-debug/extension build`. Tests assert actual session disposal, not just ignored UI updates; query must not create a session; an injection/protocol failure must not report active. These are proposed new tests to add in this step.
- Manual: In the approved Chrome test profile, reload the resulting extension and confirm the still-existing toolbar toggle and page indicator activate/exit the playground without duplicate overlays.

Completion gate: New protocol and existing consumer compose and build; focused failures/cancellation tests pass; the existing supported interaction remains usable. Mocked transport proves routing/lifecycle behavior only, not sidebar permission or closure compatibility.
Evidence location: [evidence/step-1.1.md](evidence/step-1.1.md).

### Step 1.2 — Prove minimal toolbar-start and sidebar-close shutdown in both browsers

Requirements / acceptance: R1, R3–R8; AC1, AC2, AC4–AC7, AC10 integration portions. Final production-artifact coverage remains in Step 3.1; AC3 awaits indicator removal in Step 2.2.
Depends on: Step 1.1.
Review boundary: Small functional vertical slice, not a placeholder panel. Keep the old indicator temporarily; the sidebar already has enough controls to prove start/stop and failure behavior.

Expected files:

- `apps/extension/entrypoints/sidepanel/index.html`, `main.tsx`, `sidepanel-app.tsx`, `use-sidebar-connection.ts` — minimal Solid sidebar, bootstrap, composition, and isolated connection lifecycle.
- `apps/extension/components/sidebar/`, `sidebar-status/`, `sidebar-instructions/`, `sidebar-controls/` — modular presentation using `index.tsx` and `styles.module.css` in each component directory.
- `apps/extension/lib/sidebar-browser.ts` — new browser-specific opening/lifetime adapter.
- `apps/extension/lib/sidebar-controller.ts` — new window/tab ownership, lifecycle coordination, and state routing.
- `apps/extension/entrypoints/background.ts`, `apps/extension/lib/activation.ts`, `apps/extension/wxt.config.ts` — toolbar integration, sender/target validation, and action metadata.
- `apps/extension/lib/inspection-controller.ts`, `apps/extension/entrypoints/inspect.content.ts` — extend lifecycle integration if needed for close cancellation.
- `tests/unit/sidebar-controller.test.ts`, `tests/unit/sidebar-browser.test.ts` — new adapter/controller tests.

Tasks:

- [x] Add the sidebar entrypoint and browser adapter; invoke gesture-dependent opening from the toolbar event without losing the browser's user-gesture context. Toolbar activation starts rather than toggles the current tab.
- [x] Route sidebar commands to its owning window's active tab, preserving per-tab state and preventing requests from controlling an unrelated window/tab.
- [x] Implement and test reliable close detection/shutdown in both browser APIs. Stop all retained sessions for the closing sidebar's window, invalidate queued/in-flight starts, and leave other windows unaffected; do not assume unload delivery alone is reliable.
- [x] Provide minimal real status, Start/restart, Stop, and toolbar-guidance controls. Query on reopen without auto-resume; denied access must not add host grants or leave partial page state.
- [x] Apply the user-requested conventions refactor: kebab-case entrypoint, CSS Modules, independent status/instructions/controls components, and isolated connection lifecycle; preserve behavior and satisfy the existing deterministic checks, with approval and evidence recorded.
- [ ] Test tab changes, stale replies, window isolation, repeated open/close, background reconnection, and delayed startup cancellation with fake services; perform the real-browser feasibility checks below.
- [ ] Satisfy the verification and completion gate below and record concise evidence.

Verification:

- Automated, root: `pnpm exec vitest run tests/unit/sidebar-controller.test.ts tests/unit/sidebar-browser.test.ts tests/unit/inspection-controller.test.ts tests/unit/activation.test.ts`, `pnpm --filter @visual-debug/extension check`, `pnpm --filter @visual-debug/extension build`, and `pnpm --filter @visual-debug/extension build:firefox`. Inspect the manifest paths emitted by WXT: appropriate sidebar declaration, no popup, retained permission baseline plus necessary browser sidebar permission, and no automatic all-sites content registration.
- Manual prerequisites: the user operating Chrome stable and Firefox Developer Edition test profiles on macOS; both builds and the running playground. Load the Chrome output as unpacked and the Firefox output temporarily via `about:debugging`, using paths printed by each build rather than assuming the same manifest version/output directory.
- Manual actions/outcomes in **each** browser: toolbar opens/focuses sidebar and starts tab A; another toolbar click does not toggle it off; switch to an unauthorized tab B without autoactivation and confirm guidance/failure, then authorize B through the toolbar; return to A and observe retained state. Close via browser UI: A and B must stop; reopen through browser sidebar UI: neither resumes. In another window, an active session must survive closing the first window's sidebar. Blur/switch tabs must not masquerade as closure. Repeat close while startup is delayed using debugger breakpoints in a disposable profile, then resume execution and verify no late hidden session remains. Check programmatic closure too if exposed by the target API, without adding a product close control solely to test it. Exercise a restricted page and ordinary navigation/reload.

Completion gate: Both real browsers demonstrate toolbar-start, least-privilege fallback, close-stop including pending creation, tab retention, and window isolation. Record versions, observed close-detection mechanism, and material limitations. If either browser cannot satisfy the contract, leave verification unchecked and stop dependent phases for a user decision; builds/fakes alone cannot pass this gate.
Evidence location: [evidence/step-1.2.md](evidence/step-1.2.md).

Phase exit gate: After Step 1.2 checks, run `pnpm check` and `pnpm test:unit` to establish composition with existing consumers, inspect both manifests, and assess the two-browser runtime feasibility results. Require no regression against Phase 0 and no unproven close/permission path. Record the phase assessment in `evidence/step-1.2.md` before Phase 2 or supervised approval.

## Phase 2 — Sidebar control surface and safe replacement

Outcome: The sidebar becomes the complete controls/status surface while page inspection retains its behavior.
Depends on: Step 1.2 and Phase 1 exit gate.
Review boundary: Sidebar presentation/state and parity-driven removal of the old control surface. No new inspection features or details editor.

### Step 2.1 — Complete sidebar state and interaction behavior

Requirements / acceptance: R1–R4, R7–R9; AC2–AC6 and AC9 sidebar portions; AC3 absence of the indicator belongs to Step 2.2, final runtime coverage to Step 3.1.
Depends on: Step 1.2 and Phase 1 exit gate.
Review boundary: Sidebar presentation and lifecycle subscription/recovery; the old page indicator stays available until parity proof.

Expected files:

- `apps/extension/entrypoints/sidepanel/sidepanel-app.tsx`, `use-sidebar-connection.ts` — complete state-driven composition and UI connection integration.
- `apps/extension/components/sidebar/`, `sidebar-status/`, `sidebar-instructions/`, `sidebar-controls/` — refine the existing modular controls, instructions, and CSS Modules; retain kebab-case component directories.
- `apps/extension/lib/sidebar-state.ts` — new pure presentation/state transitions for focused tests.
- `apps/extension/lib/sidebar-controller.ts` — subscriptions, reconciliation, and recovery integration.
- `tests/unit/sidebar-state.test.ts`, `tests/unit/sidebar-controller.test.ts` — new presentation-state tests and expanded routing tests.

Tasks:

- [ ] Render pending, active, inactive, unavailable, and error states from acknowledged page state; provide Start/restart, Stop/Exit, and explicit toolbar guidance when authorization is missing.
- [ ] Disable conflicting pending actions and reconcile state on tab changes, Escape, navigation, reconnect, and reopen. Clear stale errors/results without treating a query or reopen as activation.
- [ ] Provide concise existing inspection/Option/Escape instructions and usable labeled controls without introducing selected-element metadata or editing.
- [ ] Add pure-state tests for each rendered state, actions, stale correlation, and recoverable failures; verify actual Solid UI wiring manually rather than treating pure-state tests as a DOM-rendering test.
- [ ] Satisfy the verification and completion gate below and record concise evidence.

Verification:

- Automated, root: `pnpm exec vitest run tests/unit/sidebar-state.test.ts tests/unit/sidebar-controller.test.ts`, `pnpm --filter @visual-debug/extension check`, and both extension build commands from Step 1.2. Assert pending never implies active, stale errors cannot overwrite the new tab, missing authorization points to toolbar, and reopen does not start anything.
- Manual, both approved browser profiles: exercise active/inactive, pending, restricted-page guidance, failure/retry, Escape/Exit, tab switching, and sidebar close/reopen. Click and keyboard-focus sidebar controls, return to the page, hold/release Option, and confirm no stuck modifier or loss of the page Escape path. This proves the new consumer before removing the fallback.

Completion gate: Sidebar controls/status cover the existing indicator's instructions/Exit and new lifecycle states in both browsers; routing tests pass and close behavior remains intact. The temporary indicator's continued presence is intentional, not final acceptance.
Evidence location: [evidence/step-2.1.md](evidence/step-2.1.md).

### Step 2.2 — Retire injected controls and preserve page-only overlays

Requirements / acceptance: R1, R2, R7–R9; AC3, AC8, AC9, AC12 migration portions. Final production/browser evidence belongs to Step 3.1.
Depends on: Step 2.1.
Review boundary: Atomic removal of the obsolete indicator/legacy control path after replacement proof; narrowly scoped geometry/focus regression fixes only if demonstrated.

Expected files:

- `apps/extension/App.tsx`, `apps/extension/lib/ui.tsx`, `apps/extension/lib/session.ts` — remove obsolete indicator-only exit props while preserving session cleanup and overlay inputs.
- `apps/extension/components/session-indicator/` — delete only after checking consumers.
- `apps/extension/lib/activation.ts`, `apps/extension/entrypoints/inspect.content.ts`, `apps/extension/lib/inspection-protocol.ts` — remove temporary toggle compatibility after verifying no remaining callers.
- `apps/extension/lib/modifiers.ts`, `apps/extension/lib/tracking.ts` — focused fixes only if sidebar focus/viewport regression is reproduced.
- `tests/unit/modifiers.test.ts`, `tests/unit/tracking.test.ts`, `tests/unit/activation.test.ts`, `tests/unit/inspection-controller.test.ts` — preserve regression coverage and update retired-protocol expectations.

Tasks:

- [ ] Confirm Step 2.1 parity and search authored extension sources for indicator/legacy-toggle consumers before deleting them; update affected props/imports atomically.
- [ ] Keep selection/measurement overlays and the Shadow host required by picking/tracking; remove controls, not the overlay host or cleanup boundary.
- [ ] Exercise sidebar resizing and modifier/focus transitions; make only necessary page-local fixes with focused regression tests in the same step.
- [ ] Check the diff for accidental details/style-editing scope and for leftover legacy message consumers.
- [ ] Satisfy the verification and completion gate below and record concise evidence.

Verification:

- Automated, root: `pnpm exec vitest run tests/unit/modifiers.test.ts tests/unit/tracking.test.ts tests/unit/activation.test.ts tests/unit/inspection-controller.test.ts`, `pnpm check`, and both extension builds. Use a scoped `rg` over `apps/extension` authored source (exclude generated output/dependencies) to verify no `SessionIndicator` import or legacy toggle message remains; an expected zero-match search is not a test failure.
- Manual, both browsers on the playground: verify instructions/Exit only in sidebar; select and measure across scrolling, transforms, animated targets, target removal/zero area, links, forms, and drag/pointer fixtures. Resize the sidebar while inspecting and observe current hit testing/overlay geometry. Move focus page/sidebar/window and use Option/Escape. After Exit or close, normal page controls must work and no overlay/listener behavior may linger.

Completion gate: Replacement is usable without the old indicator; page picking/measurement and cleanup preserve their prior semantics across sidebar-induced layout/focus changes; retired consumers are absent and no deferred feature was added.
Evidence location: [evidence/step-2.2.md](evidence/step-2.2.md).

Phase exit gate: After Step 2.2 checks, run `pnpm test:unit`, `pnpm check`, and both extension builds. Recheck toolbar-start, multi-tab sidebar close, and Escape/Exit in both profiles with no injected indicator. All replacement behavior must compose without the fallback. Record the assessment in `evidence/step-2.2.md` before Phase 3 or supervised approval.

## Phase 3 — Production-artifact acceptance and documentation

Outcome: Demonstrate the feature using production outputs in both target browsers and document only the support actually established.
Depends on: Step 2.2 and Phase 2 exit gate.
Review boundary: Acceptance evidence and usage/build documentation. A discovered application regression returns to its owning step; do not silently redefine a gate.

### Step 3.1 — Verify production outputs and document supported behavior

Requirements / acceptance: R1–R10; final acceptance for AC1–AC12, combining prior deterministic proof with this real-browser/artifact gate.
Depends on: Step 2.2 and Phase 2 exit gate.
Review boundary: Production builds, target-browser matrix, final scope review, and truthful usage/support documentation.

Expected files:

- `README.md` — sidebar workflow, per-tab/navigation/close semantics, Chrome/Firefox build/load instructions, verified support boundaries and limitations.
- `apps/extension/README.md` — align extension-specific documentation or point to the root instructions.
- `plans/sidebar-layout/evidence/step-3.1.md` — final artifact/runtime evidence and phase/final assessment, linking prior evidence rather than duplicating it.

Tasks:

- [ ] Run final regression/build checks and inspect the emitted Chrome/Firefox manifests and referenced sidebar/content assets.
- [ ] With operator approval, load each production output into its target test profile and repeat AC1–AC10, including delayed-start closure/navigation, two tabs, two windows, focus, viewport, and restricted pages.
- [ ] Record browser/macOS versions, artifact directories printed by WXT, actual results, and any blocker/limitation; distinguish build/unit/static evidence from live acceptance.
- [ ] Update usage/support documentation to match the observed workflow; do not claim other browsers/platforms or style editing.
- [ ] Satisfy the verification and completion gate below and record concise evidence.

Verification:

- Automated, root: `pnpm check`, `pnpm test:unit`, `pnpm build`, and `pnpm --filter @visual-debug/extension build:firefox`. Inspect generated manifests/assets for correct browser-specific sidebar entry, no popup, permission boundary, and on-demand content registration. Build success does not stand in for installed-artifact behavior.
- Manual: Keep `pnpm dev:int` serving fixtures, but load the **production** extension outputs, not dev/HMR builds. Chrome uses Load unpacked; Firefox uses a temporary extension from the generated manifest through `about:debugging`. Execute the spec's AC1–AC10 starting conditions and expected outcomes; use debugger-controlled delay for pending-start cases. Confirm reopening via native sidebar UI alone stays inactive, whereas toolbar invocation explicitly starts inspection. Record separate results for both browsers and verify documentation against those results.
- Review: Compare the final change scope with AC12 and review README support claims against the actual evidence. Check all final acceptance owners below have evidence; a missing/blocked check cannot be counted as success.

Completion gate: All final acceptance mappings have their required deterministic and real-browser evidence, no relevant unexplained regression, and accurate docs. Browser/operator unavailability or a failed close/permission test blocks completion. No store submission or release is implied.
Evidence location: [evidence/step-3.1.md](evidence/step-3.1.md).

Phase exit gate: After Step 3.1 checks, assess complete AC1–AC12 coverage against the actual production-artifact results and previous step evidence. Record the final assessment in `evidence/step-3.1.md`; assess it before requesting supervised acceptance. Do not create a second progress checklist or substitute a waiver for a passed gate.

## Final acceptance

Step 3.1 owns final artifact/browser acceptance; earlier steps provide the named scoped proofs. Planned evidence links need not exist until execution.

| Spec acceptance ID | Owning step / gate | Verification and expected result | Evidence location |
| --- | --- | --- | --- |
| AC1 | 3.1 / Phase 3 gate; 1.2 feasibility | Both production manifests/assets and actual sidebar loading in Chrome/Firefox | [Final](evidence/step-3.1.md), [feasibility](evidence/step-1.2.md) |
| AC2 | 3.1; 1.2 and 2.1 focused proof | Toolbar opens/starts; pending reflects actual result; sidebar restart respects temporary permission | [Final](evidence/step-3.1.md), [1.2](evidence/step-1.2.md), [2.1](evidence/step-2.1.md) |
| AC3 | 3.1; 2.2 replacement gate | Sidebar owns instructions/status/Exit; indicator absent; overlays remain on page | [Final](evidence/step-3.1.md), [replacement](evidence/step-2.2.md) |
| AC4 | 3.1; 1.1/1.2 and 2.1 scoped tests | Retained per-tab state and correlation prevent stale cross-tab results/actions | [Final](evidence/step-3.1.md), [protocol](evidence/step-1.1.md), [routing](evidence/step-1.2.md), [UI state](evidence/step-2.1.md) |
| AC5 | 3.1; 1.1/1.2 lifecycle proof | Reload/navigation ends inspection; query/reopen cannot resume it | [Final](evidence/step-3.1.md), [lifecycle](evidence/step-1.1.md), [browser](evidence/step-1.2.md) |
| AC6 | 3.1; 1.2 feasibility and 2.2 parity | Actual close stops all owned-window sessions, not other windows; Escape/Exit clean up; reopen stays inactive | [Final](evidence/step-3.1.md), [close integration](evidence/step-1.2.md), [parity](evidence/step-2.2.md) |
| AC7 | 3.1; 1.1/1.2 failure proof | Restricted/unauthorized activation fails clearly without partial state or broad grants | [Final](evidence/step-3.1.md), [transport](evidence/step-1.1.md), [permissions](evidence/step-1.2.md) |
| AC8 | 3.1; 2.2 regression gate | Playground interaction/geometry semantics preserved as sidebar changes viewport | [Final](evidence/step-3.1.md), [regression](evidence/step-2.2.md) |
| AC9 | 3.1; 2.1/2.2 focus proof | Page-local modifiers recover; focus/tab changes are not closure; real close stops inspection | [Final](evidence/step-3.1.md), [controls](evidence/step-2.1.md), [regression](evidence/step-2.2.md) |
| AC10 | 3.1; 1.1/1.2 cancellation proof | Delayed startup after close/navigation cannot leave hidden session; no duplicate sessions | [Final](evidence/step-3.1.md), [cancellation](evidence/step-1.1.md), [integration](evidence/step-1.2.md) |
| AC11 | 3.1 / Phase 3 gate | Separate versioned Chrome/Firefox runtime evidence, distinct from static/build/unit checks | [Final](evidence/step-3.1.md) |
| AC12 | 3.1; 2.2 scope review | No style editing, persistence/undo, or new selected-element results UI in migration | [Final](evidence/step-3.1.md), [scope](evidence/step-2.2.md) |

## Rollback and recovery

- No persistent data migration, publication, or irreversible operation is planned. Use the PR or the named atomic groups as code rollback units; never restore one side of a message contract alone.
- Before reverting browser integration, stop sessions in all affected test tabs/windows. If transport or close cleanup is broken, reload/close the inspected test pages to destroy their runtime contexts, then reload the prior extension build. Reverting source alone does not remove already-injected sessions.
- Step 1.1 retains the existing consumer; Step 1.2 switches to a functional minimal sidebar with the indicator temporarily retained; Step 2.2 removes compatibility only after parity. If later acceptance fails, retain evidence, leave the verification task unchecked, and fix the owning implementation or seek agreement to a material plan change.
- Missing browser access blocks dependent acceptance; it never permits calling unit/build results cross-browser proof. Do not roll back to broader permissions or close-leaves-running as an unapproved fallback.

## Planned deferred checks

- Other Chromium variants, other operating systems, mobile, store submission, and publication are outside the supported/tested boundary of this plan.
- Style mutation, undo/persistence, a details editor, and broader frame/Shadow DOM inspection require separate contracts; no verification for those features is implied here.
- No Chrome/Firefox acceptance criterion is intentionally deferred. If unavailable or unsuccessful during execution, its gate remains blocked and the concise evidence identifies the limitation, known approval owner, and follow-up.
