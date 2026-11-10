# Browser Sidebar Migration Specification

## Status

- Readiness: Ready for planning
- Blocking decisions: None. Product decisions for activation, per-tab state, navigation, and sidebar close behavior are resolved; browser/API behavior remains a technical validation gate.
- Overview: [overview.md](overview.md)
- Source: The user's request to convert the extension to a browser sidebar and request for this specification, the follow-up product decisions recorded in the task, plus static inspection of the current extension, repository README, existing measurement specification, unit tests, and WXT's installed sidepanel entrypoint/manifest support. No browser runtime evidence was collected for this specification.

## Problem and intended outcome

The extension currently exposes its control plane through the toolbar action and an injected `SessionIndicator` on the inspected page. That makes status, instructions, and exit controls part of the page composition even though they control a browser-level session. It also leaves the next control surface—future style editing such as selected-element padding—without a browser-hosted boundary.

The intended migration puts the browser-facing inspection controls in a sidebar while preserving the existing in-page inspection engine. A user should be able to see the actual state for the relevant tab, understand when activation is pending or unavailable, and exit safely without moving DOM/geometry/picking responsibilities into the sidebar. This migration does not itself add style editing or a selected-element details panel.

## Scope

Included (resolved migration boundary; browser/API behavior remains subject to technical validation):

- A WXT/Solid sidebar entrypoint and browser-specific manifest wiring for Chrome's `side_panel` and Firefox's `sidebar_action`, subject to confirming the supported API behavior in the target browsers.
- Sidebar-hosted inspection status, instructions, Start/restart when retained temporary access is available, and an Exit/Stop path replacing the injected `SessionIndicator`.
- Recommended background/tab routing and explicit start, stop, and state-query messages between the sidebar, background, and runtime-injected page session.
- Safe tab-aware state reconciliation, including pending, unavailable, error, cancellation, and stale-reply handling.
- Retaining the existing page-local inspection engine, including DOM picking, selection snapshots, rendered geometry, Option/Alt state, input suppression, and selection/measurement overlays.
- Focused regression and compatibility validation in Chrome stable and Firefox Developer Edition on macOS, covering the browser and page lifecycle cases listed in the acceptance criteria. These are technical validation gates, not additional product decisions.

Non-goals:

- A padding editor, style mutation, undo/redo, persistence, or any other style-editing feature.
- A new selected-element details/results UI. Existing `SelectionSnapshot` data is not a requirement to expose a details panel.
- Moving page DOM access, geometry calculation, picking, modifier state, or page overlays into the sidebar document.
- Broadening permissions to persistent host access or silently adding a fallback host grant when `activeTab` cannot be used from a sidebar gesture.
- Other Chromium variants unless explicitly named later, mobile, other operating systems, store publishing, or new inspection capabilities.

## Current behavior and evidence

- **Static source observation:** `apps/extension/wxt.config.ts` declares only `activeTab` and `scripting`; the toolbar action has no popup. `entrypoints/background.ts` queues a toggle from `browser.action.onClicked`, and `lib/activation.ts` sends a tab-scoped message or injects the runtime-only `content-scripts/inspect.js` on demand.
- **Static source observation:** `entrypoints/inspect.content.ts` accepts serialized toggles, owns at most one session, clears it on `wxt:locationchange` and context invalidation, and reports protocol success/failure. `lib/session.ts` owns Escape and cleanup. `lib/ui.tsx` mounts isolated Shadow DOM UI in the page.
- **Static source observation:** `App.tsx` currently composes `SelectionOverlay`, `MeasurementOverlay`, and `SessionIndicator`. The overlays, picker, geometry, and Option/Alt modifier state are page-local. The existing `SelectionSnapshot` contains a tag name and rectangle but there is no selected-element details UI.
- **Static source observation:** The root `README.md` describes Chrome-on-macOS manual use and current permission boundaries. Source paths in this section are relative to `apps/extension/` unless otherwise qualified. It does not establish Firefox success. Existing tests under `tests/unit/` are focused unit tests; there is no browser harness.
- **Static source observation:** The installed WXT sources recognize a `sidepanel` entrypoint and generate `side_panel.default_path` for Chromium and `sidebar_action.default_panel` for Firefox. Browser APIs and invocation/permission semantics differ, so this source support is not runtime proof of either browser's behavior.
- **Behavior to preserve:** Page-local picking, event-suppression safety, SelectionOverlay and MeasurementOverlay rendering, Option/Alt measurement state, Escape cleanup, navigation invalidation, and restricted-page failure must continue to be owned by the page session. The deliberate change is only the control plane and its routing.
- **Evidence boundary:** The repository's current runtime report is Chrome on macOS only. Static inspection of source, generated conventions, or WXT support is not evidence that Firefox works, that a sidebar click grants `activeTab`, or that the resolved close/reopen behavior is correctly detected.

## Requirements and invariants

- R1: The extension provides a browser sidebar control plane for inspection. Its UI is hosted by the sidebar document and does not require an injected page `SessionIndicator` for status, instructions, or Exit.
- R2: The existing page-local inspection engine remains page-local. The sidebar must not perform page DOM picking, read page geometry directly, own Option/Alt state, intercept page gestures, or render page overlays; SelectionOverlay and MeasurementOverlay remain in the inspected tab's document.
- R3: Sidebar state is explicit and user-visible. It distinguishes at least `pending`, `active`, `inactive`, `unavailable`, and `error`, and does not display `active` solely because a request was sent. `unavailable` covers restricted pages or an unavailable permission/user-gesture path; `error` covers an unexpected or protocol failure.
- R4: Control-plane messages are explicit, tab-aware, and correlated. Start, stop, and state-query operations identify the target tab and an operation/session generation or equivalent request identity. A late response for an old tab, old generation, or superseded request is ignored and cannot overwrite newer sidebar state.
- R5: Browser activation retains the current least-privilege baseline of `activeTab` and `scripting`. The migration must not silently add persistent host permissions or automatic all-sites content registration when sidebar activation cannot obtain access; it must surface `unavailable` or `error` and leave the page inactive instead.
- R6: Chrome and Firefox use their supported sidebar manifest/API forms without claiming that one browser's sidebar API or permission behavior is portable to the other. Unsupported or failed browser API calls produce an extension-owned failure state rather than a partial active session.
- R7: While the page session is active, the sidebar provides status, concise inspection instructions, and an Exit/Stop action. It provides Start/restart when the target tab has retained temporary access; otherwise it directs the user to the toolbar. Escape remains a page-session exit path. The toolbar action opens or focuses the sidebar and starts inspection on the current tab.
- R8: Tab and page lifecycle transitions cannot leave stale controls or duplicate page sessions. State is reconciled when the active tab changes, when a target tab navigates or reloads, when the sidebar opens again, and when a session is stopped or invalidated. Sessions are retained per tab, the sidebar follows the active tab without auto-activating another tab, navigation/reload requires explicit activation again, and closing the sidebar stops inspection for every retained session controlled by that sidebar's browser window while leaving other windows unaffected. Closing or navigating while activation is pending invalidates/cancels that work so a late start cannot leave an active hidden session. At most one page session exists per target tab.
- R9: Existing inspection behavior and safety boundaries remain intact: overlays stay page-local, normal page interactions resume after Exit or sidebar close, Escape cleanup remains available, and modifier handling does not become stuck because focus moved between the page and sidebar. Switching tabs or merely losing focus is distinct from closing the sidebar and does not apply the close-stop behavior. Opening, resizing, or closing the browser sidebar may change the page viewport and responsive layout; picking and overlays must track the resulting current geometry rather than preserve pre-sidebar coordinates.
- R10: Verification evidence covers both Chrome stable and Firefox Developer Edition on macOS, explicitly names static versus runtime evidence, and does not generalize success to other browsers, platforms, restricted pages, frames, or Shadow DOM internals.

## Behavior and contracts

### State and message contract

The background is the broker between sidebar UI and a tab's runtime page session. The sidebar renders the latest state for its current target tab; it does not infer state from a button click or retain an optimistic `active` state after the request has failed.

| State | Meaning | Required sidebar behavior |
| --- | --- | --- |
| `inactive` | No inspection session is active for the target tab. | Show the inactive/instructional state and an activation affordance if the resolved UX provides one. |
| `pending` | A start, stop, or query is in flight for the target tab. | Show progress/disabled conflicting actions; closing the sidebar or navigating invalidates/cancels pending activation; do not accept a stale response as current. |
| `active` | The page session acknowledged activation for the target tab and remains current. | Show active status, instructions, and Exit; page overlays and page-local controls remain in the tab. |
| `unavailable` | The target is restricted, unsupported, or cannot obtain the retained permission through the allowed user gesture. | Explain that inspection is unavailable and do not leave a partial page session or silently request broad access. |
| `error` | An unexpected API, transport, protocol, or initialization failure occurred. | Show a recoverable error owned by the extension; reconcile with an actual query or later activation rather than claiming success. |

Every request/response must be associated with the target tab and a request/session identity. If the user switches tabs, closes/reopens the sidebar, starts a newer operation, or the target navigates, a response for the prior identity is stale. Stale responses are discarded, pending state is cleared only by the matching operation, cancellation, or a fresh query, and a stale failure must not show an error for the new tab. Closing or navigating while activation is pending must invalidate/cancel the operation; late replies must not start or leave an active hidden session.

The page session should continue to report actual lifecycle transitions, including activation failure, active session, explicit Exit, Escape, navigation invalidation, and content-context teardown. The exact wire format is an implementation concern, but a boolean toggle response alone is insufficient for sidebar reconciliation if it cannot identify the tab and operation that produced it.

### Activation, permissions, and browser differences

The current permission baseline is `activeTab` plus `scripting`. The toolbar action opens or focuses the sidebar and starts inspection on the current tab, preserving the toolbar permission gesture. A sidebar Start/restart may operate only when retained temporary access is available; otherwise it directs the user back to the toolbar rather than silently requesting broader access. If access is not available, the observable result is `unavailable` or `error`, with no half-mounted page session.

WXT's sidepanel entrypoint can produce the Chrome `side_panel` and Firefox `sidebar_action` manifest forms, but opening, targeting, lifetime, permission, and tab-change APIs must be treated as browser-specific technical contracts. The sidebar must use the supported API for each browser and keep browser-specific failures visible. Chrome runtime evidence must not be reused as Firefox evidence; neither sidebar-close detection nor permission behavior is proven by the current static evidence.

### Resolved product decisions

- Sessions are retained per tab, and the sidebar follows the currently active browser tab. Switching tabs does not auto-activate another tab or apply close behavior.
- The toolbar action opens or focuses the sidebar and starts inspection on the current tab, preserving the toolbar permission gesture.
- Navigation or reload stops inspection for that tab; explicit activation is required again.
- Closing the sidebar stops inspection. Reopening reconciles actual state and never automatically resumes inspection that close stopped.
- The sidebar offers Start/restart when retained temporary access is available, plus Stop/Exit. If temporary access is unavailable, it directs the user to the toolbar without silently requesting broader access.

These decisions define the product contract. The message/background/page separation remains a recommended technical boundary, and browser/API validation must confirm that it can satisfy this contract without claiming unproven permission or close-detection behavior.

### Focus and page behavior

The page session continues to receive page-local pointer, keyboard, modifier, scroll, resize, mutation, and lifecycle signals. A modifier held while the page is the relevant focus context must continue to drive existing measurement behavior. Sidebar focus must not create a stuck page modifier, accidentally select a sidebar element, or make an Exit control unavailable. Merely losing focus or switching tabs is not sidebar closure and does not stop a retained session; existing blur/visibility behavior may clear transient measurement state. Closing the sidebar is a separate stop boundary. Focus return details must preserve recovery through Escape, Exit, blur/visibility handling, and a fresh state query.

The sidebar is not a selected-element details surface. No tag, rectangle, padding, computed style, or measurement result needs to be added to it in this migration. Future style editing may use the sidebar as a command surface, but that future boundary must send explicit commands to the page session and is not part of this contract.

## Ownership and boundaries

The **sidebar document** owns browser-hosted presentation, status rendering, instructions, and the resolved Start/restart and Exit/Stop controls. It may request state and lifecycle operations through the background but must not read page DOM or become the source of truth for session state. Sidebar-close shutdown and its browser-specific detection remain technical validation concerns; no particular close-detection mechanism is prescribed here.

The **background** is the recommended technical boundary for browser API integration, sidebar opening/targeting, permission outcomes, tab identity, request correlation, queueing/serialization, stale-reply rejection, and coordination of window-scoped close shutdown. It must not calculate page geometry or duplicate the page picker. It reports unavailable/error outcomes without adding broad access as an implicit fallback. Reliable shutdown may require more than unload delivery, so late-start invalidation and actual state reconciliation are required regardless of mechanism.

The **runtime page session** owns the existing page-local DOM references, hit testing, pointer safety, selection snapshots, geometry, Option/Alt state, overlays, Escape handling, and cleanup. It reports lifecycle state to the background and must not depend on the sidebar document being open to keep page cleanup safe. The injected `SessionIndicator` is retired as the control-plane surface; page overlays remain.

WXT and Solid may provide a shared UI and build convention for the sidebar and existing extension UI, but shared presentation code must not blur the document boundary. Future style editing can depend on this separation; it does not authorize mutations now. The playground and existing unit tests remain verification aids, not runtime dependencies or browser evidence.

## Acceptance criteria

| ID | Requirement(s) | Starting condition / action | Expected outcome | Verification approach |
| --- | --- | --- | --- | --- |
| AC1 | R1, R6 | Build/load the extension in Chrome stable and Firefox Developer Edition on macOS and inspect the generated browser-specific sidebar declarations. | Each target browser exposes the sidebar entrypoint in its supported manifest form; no browser is declared supported from static output alone. | Proposed browser builds/manifest inspection plus real-browser manual check; not performed during specification authoring. |
| AC2 | R3, R4, R5, R6, R7 | Click the toolbar action on an ordinary supported page in each target browser, then try sidebar Start/restart with and without retained temporary access. | The toolbar opens/focuses the sidebar and starts the current tab, showing `pending` then actual `active` or failure; sidebar Start/restart works only with retained access and otherwise directs the user to the toolbar; activation does not silently add host access. | Manual Chrome and Firefox activation/permission check with manifest review. |
| AC3 | R1, R7 | With inspection active, view the sidebar and page. | Status, instructions, and Exit are in the sidebar; the old injected `SessionIndicator` is absent; page selection and measurement overlays remain visible in the page when applicable. | Manual browser UI check and static source review. |
| AC4 | R4, R8 | Activate or query tab A, switch to tab B, perform an operation on B, then deliver/observe a late result from A. Switch back and repeat with rapid start/stop requests. | Per-tab state is retained and the sidebar follows the active tab without auto-activating another tab; stale replies cannot activate, stop, error, or overwrite the wrong tab. | Focused unit tests for pure routing/state seams plus manual two-tab checks in Chrome and Firefox. |
| AC5 | R3, R8 | Start inspection, navigate or reload the target page, then reopen/query the sidebar. | Navigation/reload stops inspection for that tab, the sidebar reconciles with the actual inactive state, and explicit activation is required again; no stale active controls or duplicate page session remains. | Manual navigation/reload and reopen checks in both browsers; static inspection is not sufficient. |
| AC6 | R7, R8, R9 | With inspection active, close the sidebar through browser UI and, if the browser provides it, extension programmatic closure; then reopen it. Also use Exit and press Escape from the page. | Closing the sidebar stops inspection, including every retained session controlled by that sidebar's browser window, while other windows remain unaffected; reopening reconciles as inactive and never resumes the stopped session. Exit and Escape clean up the page session. | Manual lifecycle check in both browsers, including both close paths where available; browser close detection is not proven by static inspection. |
| AC7 | R3, R5, R6 | Attempt activation on restricted pages and in a permission/user-gesture failure case. | The sidebar shows `unavailable` or `error`, no partial page session remains, and no broad host permission is silently requested or added. | Manual restricted-page/permission checks plus manifest inspection in Chrome and Firefox. |
| AC8 | R2, R9 | Use the existing playground fixtures: selection, measurement, Escape, Exit, scrolling, transforms, and removal/zero-area cases. While inspecting, open and resize the sidebar, then inspect geometry before closing it. | Existing page-local interaction semantics are preserved; the sidebar is not a page-picking target. If the sidebar changes the page viewport or responsive layout, hit testing and overlays follow the updated geometry without stale coordinates; closing then stops the session as in AC6. | Existing unit suite where applicable and manual regression on the playground in both browsers. |
| AC9 | R2, R9 | Hold/release Option or Alt with focus in the page, move focus to sidebar controls, switch tabs or merely blur/restore the window, return to the page, and separately close the sidebar. | Modifier state is page-local, does not get stuck or spuriously activate from sidebar focus, switching tabs or focus loss does not masquerade as sidebar closure, and a fresh modifier state recovers after blur/visibility changes; actual sidebar closure stops inspection. | Manual modifier/focus and close-boundary regression in Chrome and Firefox on macOS. |
| AC10 | R4, R8 | Repeatedly start/stop, close the sidebar or navigate during pending activation, switch tabs during pending operations, and disconnect/reload the page context. | Operations are serialized or otherwise deterministic; close or navigation invalidates/cancels pending work so no late start activates a hidden session; no duplicate sessions, stale indicators, orphaned listeners, or unhandled late replies remain. | Focused unit tests for correlation/transition logic plus manual lifecycle checks. |
| AC11 | R10 | Record the focused Chrome and Firefox macOS matrix, including toolbar start, second-tab permissions, tab switching, navigation/reload, browser-UI and programmatic sidebar close where available, close during pending activation, close/reopen, restricted pages, Escape/Exit, modifiers/focus, viewport geometry changes, stale-reply invalidation, and existing interactions. | Evidence distinguishes static review, unit tests, browser builds, and real-browser results; Firefox success is claimed only after Firefox runtime checks pass, and no unsupported browser/platform claim is made. | Manual acceptance record and proposed automated/static checks; no such checks were run for this specification. |
| AC12 | R2, R9 | Review the migration scope for selected-element details or style-editing requests. | No padding editor, mutation/undo/persistence contract, or new results panel is required or shipped as part of the sidebar migration. | Specification and implementation-scope review. |

## Assumptions

- The user's requested product direction is a browser-sidebar migration, and the activation, per-tab, navigation, and close-stop decisions recorded above are resolved product requirements.
- Chrome stable and Firefox Developer Edition on macOS are the bounded verification target. The repository currently provides Chrome-on-macOS runtime evidence only; Firefox behavior is unverified, and no new runtime evidence was collected for this specification.
- The existing `activeTab` and `scripting` permissions are retained. The toolbar gesture and sidebar temporary-access behavior must be validated in real browsers; inability to use `activeTab` from a sidebar is a fallback-to-toolbar condition, not permission to add broad host access.
- WXT/Solid shared UI, background/tab routing, explicit start/stop messages, and sidebar status/instructions/Exit are recommended technical boundaries grounded in the current WXT/Solid codebase and discussion. They do not require separate product approval and must not blur the page/sidebar ownership boundary.
- **Inference (safety default, not an explicit user decision):** closing a sidebar stops every retained session controlled by that sidebar's browser window, while other windows remain unaffected. This prevents hidden inspection from continuing after the user closes its control surface; it is not a product blocker unless repository inspection exposes a genuine contradiction.
- Current page-local state is authoritative for DOM/geometry/picking/modifier/overlay behavior. A browser sidebar may observe and command that session only through explicit messages.
- Existing tests are unit tests without a browser harness. Browser builds, manifest checks, and real Chrome stable/Firefox Developer Edition manual checks are proposed verification work, not completed evidence.
- Future style editing may use the sidebar as a control surface after a separate contract defines mutation safety, undo, and persistence. It does not add requirements here.

## Risks and open decisions

- Blocking: None. Product decisions are resolved; the following are technical validation gates for planning and implementation.
- Non-blocking: Technical validation gate—verify the toolbar-start permission gesture, second-tab permissions, sidebar Start/restart fallback, and browser-specific API behavior in Chrome stable and Firefox Developer Edition on macOS. Do not claim permission behavior proven from static source or WXT support.
- Non-blocking: Technical validation gate—verify sidebar closure through browser UI and extension programmatic closure where provided, including close during pending activation and close/reopen. Reliable shutdown may require more than unload delivery; preserve cancellation and stale-reply invalidation without prescribing a particular mechanism.
- Non-blocking: Pending operations and tab switching can produce stale replies or out-of-order failures. Correlation IDs/generations, cancellation, and a fresh state query mitigate this risk.
- Non-blocking: Chrome and Firefox expose different sidebar APIs and may differ in focus, opening, tab targeting, viewport effects, and lifecycle behavior. Keep browser-specific adapters and record divergences rather than masking them.
- Non-blocking: A sidebar document has its own focus and keyboard event context. Preserve page-local modifier and Escape handling, and use explicit recovery on blur/visibility changes.
- Non-blocking: Restricted pages and unusual page lifecycles may reject runtime injection. Keep failure extension-owned and never turn a failed activation into a broad permission request.
- Non-blocking: Future style editing may pressure the sidebar to expose selected-element details. Keep that work deferred until a separate mutation/undo/persistence decision exists.

## Deferred work

- Selected-element style editing, including padding controls, mutation safety, undo/redo, and persistence.
- Selected-element details/results UI, computed-style presentation, and richer inspection panels.
- Multi-element editing, new inspection tools, and changes to the existing measurement/overlay feature.
- Support for other Chromium variants not explicitly named, mobile, other operating systems, store publishing, and distribution/privacy work.
- Iframe traversal, closed-Shadow-DOM inspection, broader host access, and automatic all-sites activation.
