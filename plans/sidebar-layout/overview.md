# Browser Sidebar Migration Overview

## Purpose and intended change

Move the extension's browser-facing controls from an injected page indicator into a browser sidebar. The sidebar will be the control plane for inspection status and lifecycle actions, while the existing in-page inspection engine continues to own DOM picking, geometry, modifiers, and page-local overlays. The toolbar opens or focuses the sidebar and starts inspection on the current tab; closing the sidebar stops inspection, and reopening does not resume it.

## How it is used

A user clicks the toolbar action to open or focus the sidebar and start inspection on the current tab, then uses the sidebar to see its actual state and exit. The sidebar follows the active tab's retained state without auto-activating another tab; navigation/reload requires activation again. Closing the sidebar stops inspection, while Escape and sidebar Exit remain explicit page-session exits. The page remains the canvas for selection and measurement; the sidebar does not become a selected-element details or style-editing panel in this migration.

## Mental model

The migration separates three responsibilities:

- **Sidebar:** browser-hosted status, instructions, and lifecycle controls.
- **Background:** recommended boundary for tab routing, browser API calls, permissions, request ordering, and stale-operation handling.
- **Page session:** the existing runtime-injected picker, selection/measurement state, modifier handling, and overlays.

The sidebar observes the actual page-session state through explicit, tab-aware messages. It must not treat an old or late response as the state of the currently selected tab. Closing the sidebar stops retained sessions controlled by that sidebar's window; switching tabs or merely losing focus is different.

## Scope and non-goals

- In scope: Chrome and Firefox sidebar packaging, validated on Chrome stable and Firefox Developer Edition on macOS; migration of control-plane UI and routing while preserving page-local inspection behavior.
- Out of scope: style editing such as selected-element padding, a new selected-element details/results panel, other Chromium variants, mobile or other operating systems, store publishing, and unrelated inspection features.

## Related documents

- Specification: [spec.md](spec.md)
- Implementation plan: [plan.md](plan.md)
