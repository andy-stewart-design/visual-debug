# Browser Sidebar Migration Overview

## Purpose and intended change

Move the extension's browser-facing controls from an injected page indicator into a browser sidebar. The sidebar is the control plane for inspection status and lifecycle actions, while the existing in-page engine continues to own DOM picking, geometry, modifiers, and overlays. The toolbar opens/focuses the sidebar and starts inspection on the current tab; closing the sidebar stops inspection and reopening does not resume it.

## How it is used

For an ordinary HTTP/HTTPS site, the first use may require the browser's site-access approval in installation, update, or site settings. After that actual grant exists, click **Start** in the sidebar on a newly opened ordinary tab; no toolbar click is required. A toolbar start remains available and is the recovery path when access is missing. Query, reopen, and tab switching are passive: they never create a session. Navigation stops inspection, and an explicit Start may reinject into the new document when the grant still exists.

Browser-internal, `file:`, `ftp:`, and other protected pages can remain unavailable. Native protected HTTPS pages may refuse injection; the UI reports unavailable/error rather than claiming an active session. Persistent host access is limited to `http://*/*` and `https://*/*`; no automatic content registration or autoscripting on query/tab change is part of this feature.

## Mental model

- **Sidebar:** browser-hosted status, instructions, Start, and lifecycle controls.
- **Background:** tab routing, browser permission/access checks, injection, request ordering, and stale-operation handling.
- **Page session:** the existing runtime-injected picker, selection/measurement state, modifier handling, and overlays.

The sidebar observes actual page-session state through explicit, tab-aware messages. Retained state is per tab; closing the sidebar stops sessions owned by that browser window. The page remains the canvas for selection and measurement, not a selected-element details or style-editing panel.

## Scope and non-goals

- In scope: Chrome and Firefox Developer Edition sidebar controls on macOS, HTTP(S) website access, and direct sidebar Start after browser-granted site access.
- Out of scope: `<all_urls>`, `file:`, `ftp:`, browser-internal pages, automatic activation/content registration, style editing, a selected-element details/results panel, other Chromium variants, mobile, other operating systems, and store publishing.

## Related documents

- Specification: [spec.md](spec.md)
- Implementation plan: [plan.md](plan.md)
