# Relationship graph: full-screen investigation mode (P1.5)

Status: **IMPLEMENTED — NOT DEPLOYED** (branch `worktree-auth-login-ratelimit`, 2026-11-13). Frontend only; no API,
database or permission change.
Code:
- `apps/web/src/lib/fullscreen.ts` (`useElementFullscreen`);
- `apps/web/src/stores/portalStore.ts`;
- `apps/web/src/features/cases/case-graph-page.tsx`;
- `apps/web/src/components/ui/{dialog,tooltip}.tsx`;
- `apps/web/src/components/graph/engine/GraphEngine.ts` (resize);
- `apps/web/src/components/graph/GraphToolbar.tsx` (fit icon).

Verification: `scripts/reliability/verify_graph_fullscreen.mjs`.

## 1. Before

There was no full-screen mode. The toolbar's ⤢ (Maximize) button only re-fitted the camera ("Fit to Screen"). The
engine also re-fitted the camera on every resize, so any change of size (rotating a tablet, opening a panel) threw away
where the investigator had zoomed to.

## 2. Behaviour

- **What goes full screen:** the whole graph tab. That is the counts and view switch, any bounds or "no WebGL"
  banners, the canvas with its toolbar, filters and legend, the details panel, and the time slider. It is the same DOM
  element, nothing remounts, and no request is repeated. The graph engine, camera (zoom, pan), selection, filters,
  search and time position all carry over in both directions.
- **Controls:**
  - **Full screen** in the graph header (icon only on small screens). It shows `aria-pressed` and is labelled
    "Exit full screen" while active.
  - **F** toggles, ignored while typing in a field, with Ctrl, Cmd or Alt held, or while a dialog is open.
  - **Esc** leaves. In browser full screen the browser handles Esc; when a dialog is open, Esc closes the dialog first.
  - A polite live region announces the change for screen readers.
  - Focus stays on the toggle.
- **Modes:**
  - **Native:** the browser Fullscreen API, including the WebKit-prefixed variant for older iPadOS Safari. Exits made
    by the browser itself (Esc, its own exit UI) are followed through `fullscreenchange`.
  - **Full window:** used where the API is missing or refused (iPhone Safari, sandboxed iframes). The workspace is
    `fixed inset-0` above the app shell at `100dvh`, page scroll is locked, and Esc leaves.
- **Dialogs and tooltips stay usable.** In browser full screen only the full-screen element is drawn, so anything
  portalled to `<body>` disappears. The reveal-reason dialog (mounted in the app shell) and the toolbar tooltips did.
  While full screen is on, `portalStore.container` points at the workspace, and `DialogContent` and `TooltipContent`
  portal into it. Outside full screen it is `null` (portals go to `<body>`, as before). Proof: with the dialog change
  removed, the walkthrough found the reveal dialog open but outside the full-screen element, so not visible.
- **Resizing keeps the camera.** The engine resizes Sigma without re-fitting. An un-zoomed view still fits the new size
  (the custom bounding box is unchanged), while a zoomed or panned view stays where it was. "Fit graph to view" (now a
  Focus icon, not Maximize) re-fits on demand.
- **Leaving the page** (navigation or case switch) always exits full screen and resets the portal container.
- Authorization and masking are unchanged: the same data and the same masked labels; nothing new is fetched.

## 3. Verification (2026-11-13; isolated server, throwaway store, real Chromium over CDP)

`verify_graph_fullscreen.mjs`: 27 of 27 checks, using real mouse and keyboard events (the Fullscreen API needs a user
gesture). The run was:
1. On CASE-0001 the investigator zoomed in, selected a phone, set a confidence filter, then entered full screen.
2. Checked in full screen:
   - native full screen on the workspace, which fills the full-screen viewport;
   - camera, selection and filter unchanged; same Sigma instance; 0 additional `/graph` requests;
   - the toggle labelled and pressed;
   - controls visible, not overlapping, inside the screen;
   - the reveal-reason dialog opens inside the full-screen element, and Esc closes it while staying full screen;
   - tooltips render inside the element.
3. Left with **F**: zoom, pan, selection, filters, size and drawn-node count are all restored. Enter on the focused
   toggle enters and leaves, and focus stays on the toggle.
4. Tablet (820×1180) and phone (390×844): resizing the window keeps the zoom; in full screen the controls don't
   overlap and stay inside the screen; the exit button works.
5. Fallback (Fullscreen API disabled): covers the whole window, locks page scroll, same engine and zoom; Esc leaves and
   restores scroll.
6. Large graph (CASE-BIG, 100 of 418 entities): enters in 149 ms with 100/100 nodes drawn.
7. No page errors in any step.

Regression on the same build:
- `verify_graph_ui.mjs` 16 of 16;
- user-ID dialog walkthrough 12 of 12 and case-team dialog walkthrough 21 of 21 (dialogs outside full screen still
  portal to `<body>`);
- `tsc -b --noEmit` clean.

**Environment notes:**
- Headless Chromium sizes its full-screen window independently of the emulated screen, so the check asserts that the
  workspace fills the full-screen viewport rather than a particular screen size.
- Firefox, Safari and real iOS/iPadOS devices were not tested (no such browsers here). The WebKit path and the
  full-window fallback exist for them; the fallback is exercised in Chromium by disabling the API.

## 4. Known limitations

- Below 1024 px wide, a selected entity's details panel covers the graph, in full screen as well. That is the existing
  narrow-screen layout; "Hide details" shows the graph again.
- The case header and tabs are hidden in full screen by design. Leave full screen to switch tabs.
- Native dialogs (`window.confirm`) are not used on the graph tab; elsewhere they would still work but may leave
  browser full screen.
