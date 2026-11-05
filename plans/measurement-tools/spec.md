# Measurement Tools Specification

## Status

- Readiness: Ready for planning.
- Blocking decisions: None; unconfirmed technical and geometry defaults are identified below rather than represented as user-approved decisions.
- Source: The project discussion about a quieter VisBug-inspired extension, the user's selection/Option-hover mockups, and the request to create this specification.
- Planning update: Before implementation, the user explicitly chose Solid for extension UI, requested `pnpm check` as the root validation command, deferred Playwright and automated browser testing, and requested lightweight tests plus extensive manual browser validation. This update changes the implementation/verification plan below; it does not claim any checks have run.
- Delivery: Specification only. No application has been scaffolded or implemented. Readiness is not authorization to implement or publish.

## Problem and intended outcome

A developer inspecting a web page wants to select an element and quickly check its distance from another element. VisBug's combination of selection outlines, measurement lines, and page-spanning dotted guides can make the measurement difficult to distinguish. Selecting interactive elements can also accidentally activate the underlying page.

The first feature provides an explicit inspection mode with quiet selection and hover outlines. Holding Option temporarily reveals measurements to the hovered element and changes the outlines' color. Releasing Option restores the quiet view. Selecting a link, button, or input must be a deliberate inspection action, not an accidental page interaction.

## Scope

Included:

- User-invoked inspection in a supported page's top-level document.
- One selected anchor and one hovered comparison element.
- Temporary Option-held measurement presentation.
- Safe pointer-based selection of interactive page elements.
- Exit, cleanup, and recovery when targets or modifier state become invalid.
- Validation on the user's own apps and a small set of representative public websites, supported by a controlled local playground.

Non-goals:

- Editing, resizing, moving, restyling, or replacing page content.
- Multi-selection, pinned comparisons, saved measurements, or persistence across navigation.
- Universal compatibility, iframe contents, or access inside closed Shadow DOM.
- Measuring text glyph outlines, CSS margin declarations, or design-system spacing tokens.
- A full VisBug toolbar or a generalized editing/plugin engine.
- Automatic execution on every website or publication to an extension store.

Page-spanning dotted alignment guides are deliberately excluded from the proposed initial slice. If added later, they must be independently toggleable rather than inseparable from measurements. This cut follows the earlier milestone recommendation; it does not replace the user's longer-term request for control over guides.

## Current behavior and evidence

- At initial specification authoring, `/Users/robestewart/Documents/Development/visual-debug` was empty. It now contains the feature's planning documents but no application source, configuration, tests, or project instructions.
- No local runtime behavior has been observed and no implementation verification has been performed.
- The user's VisBug screenshot illustrates competing page-spanning guides, selection indicators, and measurement annotations. This is visual evidence, not an audit of VisBug's event handling or geometry implementation.
- The user's two mockups establish the intended distinction: quiet blue selection/hover outlines without Option; contrasting outlines plus a labeled distance while Option is held.
- Reference materials supplied in the discussion: <https://github.com/GoogleChromeLabs/ProjectVisBug> and <https://wxt.dev/>. This is a new implementation inspired by the workflow, not a commitment to fork VisBug or preserve every reference behavior.
- Intentional differences from the reference experience: measurements are transient and modifier-gated; full-page guides do not compete with them; inspection explicitly prioritizes preventing accidental activation.

## Requirements and invariants

- R1: Inspection is explicitly activated and deactivated. When inactive, the tool has no page overlays or inspection input interception. Escape and a visible activation control provide exit paths.
- R2: While inspecting, a primary pointer gesture on a supported page element selects it without triggering its normal activation, focus, submission, navigation, dragging, or pointer-driven editing behavior. This applies to pointer-down handlers as well as click handlers. Inspection is not allowed to silently fall back to activating the target.
- R3: There is at most one selected anchor and one hovered comparison. Hovering alone does not replace the anchor. The tool's own UI is never a page measurement target.
- R4: Without Option, the anchor and hovered comparison have quiet, distinguishable outlines. While Option is held and both targets are valid and distinct, their outlines change to the measurement color and distance annotations appear. Option alone never changes selection. Releasing Option removes measurements immediately.
- R5: Distances describe rendered element border boxes in CSS pixels, not margin declarations or glyph bounds. Geometry and presentation follow the default rules below, including explicit handling of diagonal placement, containment, touching, and overlap.
- R6: Overlays remain aligned as supported page geometry changes. Invalid or detached targets must not leave stale measurements. Losing window focus clears temporary measurement state.
- R7: The tool must not modify the page's existing content, attributes, or styles to perform inspection or measurement. On exit, it removes its own UI and listeners and releases retained page-element references. Repeated activation must not accumulate duplicate sessions.
- R8: Access is user-invoked and limited to the page being inspected. If activation is denied or unsupported, the extension reports that state in its own UI without a partially active inspection session.
- R9: Validation must include reproducible local cases and representative real pages. Successful validation must not be described as support for every website or frame type.
- R10: If application scaffolding is needed later, use the relevant tool's official CLI create flow rather than hand-authoring a substitute scaffold. This specification itself must not install or scaffold anything.

## Behavior and contracts

### Activation and interaction

The proposed default is an extension-action toggle: activate inspection on the current supported tab, or deactivate an existing session. An on-page indicator/control makes active inspection and the exit action discoverable. Exact control styling is left to implementation.

| State | Input or condition | Observable result |
| --- | --- | --- |
| Inactive | Activate on a supported page | One inspection session appears, with no initial selection. |
| Inspecting, no anchor | Move over a page element | A quiet hover outline identifies the candidate. No distance is displayed. |
| Inspecting | Primary click without Option | The target becomes the anchor; the page gesture is suppressed. |
| Inspecting, anchor selected | Hover a different element | Anchor remains selected; the comparison has a quiet hover outline. |
| Inspecting, two distinct targets | Hold Option | Contrasting outlines and relevant distance annotations appear, even if the pointer has not moved. |
| Measuring | Move to another supported element | The comparison and annotations update; the anchor remains unchanged. |
| Measuring | Release Option | Distance annotations disappear and quiet outlines return. |
| Inspecting | Hold Option with no anchor, no comparison, or the anchor itself hovered | No inter-element measurement is displayed. |
| Inspecting | Option-click | As a proposed safety default, suppress page activation without changing the anchor. |
| Inspecting | Escape or explicit deactivate | Remove the session UI and interception; normal browsing resumes. |
| Inspecting | Window loses focus | Clear temporary Option/measurement state; retain a valid anchor. A fresh modifier state is required to measure again. |

Option is the macOS presentation name for the Alt modifier. Chrome on macOS is the proposed first validation target; broader platform key behavior is not an initial compatibility promise.

The selected outline must remain distinguishable from hover without relying only on the measurement color, for example through different line treatment. No resize handles appear because this feature cannot resize elements. Change the outline color during measurement rather than layering duplicate colored outlines. Page-spanning dotted guides are absent.

### Picking defaults

Use the actual eligible hit-tested element rather than heuristics that guess a semantic button or card. Small nested targets are an acknowledged usability risk. A parent-selection affordance was recommended in discussion but not explicitly approved; its inclusion and keybinding are non-blocking planning choices, not prerequisites for basic measurement.

Zero-area elements and the extension's own overlay/UI are ineligible. Unsupported embedded content is not traversed; an iframe or closed-shadow host may be treated as an outer element, without claiming access to its contents.

### Geometry defaults

The following are inferred defaults to make the initial contract implementable, not individually user-approved geometry decisions:

- Use viewport-aligned rendered border-box rectangles, including their position after CSS transforms. Rotated shapes are measured by their axis-aligned bounding rectangles, not rotated edges.
- For disjoint rectangles, show the nonzero edge-to-edge gap on each separating axis. Horizontal neighbors yield one horizontal distance; diagonal neighbors can yield horizontal and vertical distances. Do not show a Euclidean diagonal distance.
- For full containment, show four edge insets from the inner rectangle to the outer rectangle. These are geometric insets, not claims about CSS padding.
- For partial overlap with no containment, show a compact overlap indication instead of a misleading negative gap. For touching edges, show a zero distance on the touching axis. Identical rectangles may show the overlap indication rather than four zero inset labels.
- Labels use CSS pixels, rounded to at most one decimal place with trailing `.0` omitted. Browser zoom and display pixel density do not multiply values into physical screen pixels.
- The current target pair controls the annotations; do not measure unrelated neighbors. Use short extension lines only when necessary to explain a distance. Favor the relevant gap/inset over ornamental geometry.

Illustrative geometry cases:

| Anchor rectangle | Comparison rectangle | Expected interpretation |
| --- | --- | --- |
| left 0, top 0, width 100, height 100 | left 140, top 0, width 100, height 100 | Horizontal gap: 40 CSS px. |
| left 0, top 0, width 100, height 100 | left 140, top 160, width 100, height 100 | Horizontal gap 40; vertical gap 60. |
| left 0, top 0, width 200, height 200 | left 20, top 30, width 50, height 60 | Insets: left 20, top 30, right 130, bottom 110. |
| left 0, top 0, width 100, height 100 | left 50, top 50, width 100, height 100 | Partial overlap, not a negative gap. |
| left 0, top 0, width 100, height 100 | left 100, top 0, width 100, height 100 | Touching: horizontal distance 0. |

### Safety, invalidation, and recovery

Inspection intercepts relevant pointer and click gestures before ordinary page handlers wherever the extension execution model permits. Controls that act on pointer-down are mandatory validation cases. Suppressing only a trailing click is insufficient.

This is not a promise to freeze arbitrary page JavaScript, prevent every page hover effect, or neutralize hostile/earlier-registered event handlers. A reproducible activation leak is a compatibility defect, not permission to call the target safely supported. Remove unsupported page/control cases from the validated support set until resolved; retain an accessible exit even when a case fails.

Re-evaluate overlay geometry during document or nested-container scrolling, viewport resizing, and changes to the selected or hovered target's rendered bounds while measurement is visible. Clear the comparison on pointer leave. If the comparison disappears or becomes ineligible, clear its measurement; if the anchor disappears or becomes ineligible, clear selection and return to hover-only inspection. Do not retain the last numeric labels as if still current.

Navigation discards the session and does not automatically restore it. Exiting restores the tool's interception state, not a snapshot of the page: the page's own scripts are free to change its content during inspection. No persistence, network service, or measurement data upload is required.

## Ownership and boundaries

Proposed technical baseline, subject to the assumptions below:

- WXT and TypeScript provide extension development and packaging. The background/action layer owns explicit activation and permission outcomes; it does not own measurement geometry.
- The content-side session owns page-element references, hit testing, input interception, and reading geometry. It must not edit inspected elements as a shortcut for drawing outlines.
- A WXT `createShadowRootUi`-backed isolated Shadow DOM UI, rendered with Solid, owns the tool's controls and annotations. Solid lifetime cleanup is tied to session/UI teardown: the disposer returned by `render()` is invoked from `onRemove`, along with cleanup of reactive effects, listeners, and session state. Its events and styles must not masquerade as inspected page content. UI isolation is not a guarantee that arbitrary page scripts cannot interfere.
- Geometry calculations consume rectangle values and return measurement descriptions independently of extension lifecycle or UI rendering. No separate shared package is required.
- A local Solid + TypeScript playground owns deterministic fixtures, not production measurement logic. The extension must not depend on a running playground to inspect other pages.
- A lightweight pnpm workspace with `apps/extension` and `apps/playground` is a recommended repository organization, not an explicitly approved product requirement. No Turborepo/Nx or speculative package extraction is required.

## Acceptance criteria

These are proposed verification obligations, not checks already executed.

| ID | Requirement(s) | Starting condition / action | Expected outcome | Verification approach |
| --- | --- | --- | --- | --- |
| AC1 | R1, R7 | On a supported page, activate, exit with Escape, then activate and exit with the visible control; repeat. | One session at a time; exit removes overlays and interception. Ordinary page interaction works afterward, without duplicate handlers. | Manual installed-Chrome extension smoke check. |
| AC2 | R2, R7 | In inspection, select fixtures containing a link, submit button, checkbox, input, draggable element, and custom pointer-down control. | The intended target is selected; navigation, submission, toggling, input focus, dragging, and custom activation counters do not occur. Existing content/styles remain unchanged apart from extension-owned UI insertion. | Manual installed-Chrome fixture procedure with observable counters and page review. |
| AC3 | R3, R4 | Select A, hover B, then C without clicking; move over extension controls. | A remains the sole anchor. Only the current eligible page comparison is outlined; extension UI is never measured. No measurements appear without Option. | Manual installed-Chrome interaction and visual review. |
| AC4 | R4 | With A selected and B already hovered, press and release Option without moving the pointer. Repeat with no anchor and with A itself hovered. | Valid pairs immediately gain contrasting outlines and measurements, then return to quiet outlines on release. Invalid/self pairs show no inter-element measurement. No stacked duplicate outlines, resize handles, or full-page guides appear. | Manual macOS Chrome check. |
| AC5 | R2, R3, R4 | With A selected, Option-click B during measurement. | Under the proposed default, A remains selected and B's page action does not execute. | Manual installed-Chrome safety check. |
| AC6 | R5 | Supply the rectangle pairs in the geometry table and fractional-coordinate cases. | Values and relation types match the contract, units are CSS px, and labels use the specified rounding without negative-gap artifacts. | Pure geometry/formatting unit tests plus manual fixture review. |
| AC7 | R5, R6 | Measure fixtures while scrolling the page and a nested container, resizing, changing target size/position, and applying transforms or browser zoom. | Annotations track current viewport-aligned boxes and CSS-pixel distances, not stale coordinates or physical pixels. | Manual installed-Chrome scroll, transform, and zoom checks. |
| AC8 | R6, R7 | While measuring, remove the comparison, remove the anchor, leave the page with the pointer, or switch window focus. | Invalid comparison measurements disappear; invalid anchors clear selection; pointer leave clears comparison; blur clears temporary measurement state. No stuck annotations reappear merely on refocus. | Manual installed-Chrome lifecycle and focus checks. |
| AC9 | R1, R7, R8 | Activate on a restricted/denied page; separately navigate away from an active page. | Activation failure is visible in extension-owned UI with no partial session. Navigation does not restore inspection automatically. | Manual extension permission/navigation checks. |
| AC10 | R8 | Inspect the requested permissions and activate on one supported tab. | Under the proposed permission default, activation uses temporary current-tab access without a broad persistent all-sites grant or automatic activation on other pages. | Manifest/API review and manual multi-tab check. |
| AC11 | R9 | Exercise the feature on controlled fixtures and a recorded small sample of own/public sites, including unsupported embedded content. | Evidence names the tested environments and limitations; no claim is made to inspect iframe/closed-shadow internals or to support all sites. | Later validation report and manual exploratory checks. |
| AC12 | R10 | A later implementation plan calls for creating extension/playground applications. | The plan uses the tools' official CLI create flows, preserves this specification, and does not replace scaffolding with an invented equivalent. | Implementation-plan review; no scaffolding performed for this spec. |

## Assumptions

- Chrome-first, initially on macOS, is an inferred compatibility default. Validate the intended browser/platform matrix during planning; other browsers need not block the first slice.
- WXT, pnpm workspaces, Chrome-first validation, explicit extension-action activation, `activeTab` plus necessary scripting permission, and a separate playground remain planning assumptions/recommendations rather than newly explicit user approvals. Confirm practical fit through official documentation and the later scaffold, not by installing anything during specification work.
- Solid is the user's explicit choice for extension UI. Solid + TypeScript is the sensible default for the playground using the same stack, and TypeScript remains the default language. The Solid UI must cleanly dispose its `render()` lifetime with the session; this does not make Shadow DOM a universal input-safety guarantee.
- Border-box measurement, geometry edge-case rules, rounding, quiet-outline styling, zero-area exclusion, and Option-click behavior are proposed defaults. Validate them against playground examples; none should be portrayed as an explicit answer from the interview.
- Parent navigation and a selected-element dimensions badge are useful follow-ups suggested by discussion/mockups, but neither is required for the first measurement contract.
- Top-document support is the initial compatibility boundary. Traversing open Shadow DOM is not promised; if supported later, define picking/event behavior explicitly.

## Risks and open decisions

- Blocking: None for planning the scoped first slice. The defaults above permit a concrete plan without reopening the interview.
- Non-blocking — event safety: capture-order, page scripts, browser-default behaviors, and gesture variants can defeat naive suppression. Validate pointer-down and click sequences early; document unsupported cases rather than claiming universal protection.
- Non-blocking — target picking: deeply nested markup can make useful anchors hard to select. Revisit parent navigation once basic hit testing can be tried on real pages.
- Non-blocking — measurement meaning: containment/overlap presentation is inferred. Review those fixtures before spending time polishing labels; do not silently substitute margin or text metrics.
- Non-blocking — dynamic layouts: transforms, animation, sticky positioning, layout shifts, and nested scrollers can produce stale geometry or excessive work. Verify alignment without claiming to freeze the page.
- Non-blocking — visibility and usability: labels can overlap or become unreadable on varied backgrounds. Resolve label placement, contrast, and any necessary viewport clipping in UI validation without adding unrelated measurements.
- Non-blocking — scaffolding integration: official create flows may assume an empty target directory. The implementation plan must preserve existing planning documents and use appropriate application subdirectories rather than overwriting the project root.

## Deferred work

- Independently toggleable page-spanning alignment guides, if real use shows they add value.
- Parent/ancestor navigation and more sophisticated nested-element picking, if basic selection is insufficient.
- Editing interactive elements; this requires its own mutation, undo, and event-safety contract.
- Multi-selection, pinned/screenshot-friendly measurements, persistent sessions, and export.
- Iframe traversal, explicit open-Shadow-DOM traversal, broader browser/platform coverage, rotated-edge geometry, and text-fragment/glyph measurements.
- Public distribution, extension-store permissions/privacy documentation, and reuse of reference code with the corresponding licensing review.
