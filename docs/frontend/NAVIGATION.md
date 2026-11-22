# Navigation (sidebar and top bar)

Current as of P2.2 (2026-11-13, branch `worktree-auth-login-ratelimit`).
Code:
- `apps/web/src/constants/navigation.ts` (items and sections);
- `layouts/AppShell/sidebar.tsx`;
- `components/security/security-status-bar.tsx` (menu button);
- `stores/uiStore.ts`.

Verification: `scripts/reliability/verify_sidebar.mjs`. The pre-redesign map is kept as history in
`frontend-audit/EXISTING_NAVIGATION_MAP.md`.

## 1. Items, sections and who sees them

| Section | Item | Route | Shown to (capability) |
| --- | --- | --- | --- |
| Workspace | Home | `/command-center` | everyone |
| Workspace | Cases | `/cases` (current on every `/cases/...` page) | everyone |
| Workspace | Requests | `/requests` (current on `/requests/:id`) | everyone |
| Oversight | Audit log | `/audit` | ADMIN, AUDITOR (`globalAudit`) |
| Administration | Users | `/admin/users` | ADMIN (`manageUsers`) |
| Administration | Case assignments | `/admin/case-assignments` | ADMIN, AUDITOR (`viewCaseAssignments`; read-only for AUDITOR) |
| Administration | Permission overrides | `/admin/overrides` | ADMIN, AUDITOR (`viewOverrides`; read-only for AUDITOR) |
| (bottom) | Account | `/profile` | everyone |

- A section with nothing the user may open is not shown. Investigators, evidence officers, reviewers and analysts see
  Workspace only.
- Visibility is a convenience: every page and API call is still authorized by the server, and denied pages show
  `DeniedState`.
- Only implemented pages appear: every item is a route in `app/router/router.tsx`.
- Everything about one case (evidence, review, graph, timeline, …) is in the case tabs, not the sidebar.
- Nesting is the case tabs and the request detail. The sidebar itself has one level, plus section headings.

## 2. Behaviour

| Width | Behaviour |
| --- | --- |
| ≥ 1024 px | Fixed column, 224 px wide. **Collapse/Expand** (bottom, `aria-expanded`, `aria-controls="app-sidebar"`) shrinks it to a 56 px icon rail. The choice is remembered per browser (`localStorage` `drishti.sidebarCollapsed`; nothing sensitive, survives sign-out). Collapsed icons keep an accessible name and show it, with a one-line description, in a tooltip on hover **and on keyboard focus**. Sections are separated by dividers. |
| < 1024 px | The top bar's **menu** button (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls="mobile-nav"`) opens a drawer. The drawer is a Radix modal dialog: focus moves in and is trapped. Esc, the **Close navigation** button or the backdrop close it, and focus returns to the menu button (set explicitly, because a tap does not focus it). Following a link, or any route change, closes it. |

- The current page's item is highlighted (white, inset bar) and carries `aria-current="page"`. Exactly one item is
  current: section prefixes match, so a case tab keeps **Cases** current.
- Keyboard: the skip link goes to `main`; links and buttons have a visible focus ring on the dark sidebar.

## 3. Verification (2026-11-13; isolated server, throwaway store, real Chromium)

`verify_sidebar.mjs`: 44 of 44 (the baseline on the previous build was 28 of 43). It checks:
- for investigator, evidence officer, reviewer, analyst, auditor and admin: exactly the expected items in the expected
  sections; no duplicate links; every link opens a page with one `<h1>`, not "not found" and not "access denied", and
  is the single current item;
- nested routes (a case tab, a request) keep their section current;
- collapse to icons; contrast of collapsed icons ≥ 3:1 (measured 9.8:1, current item 14.8:1); names kept; the tooltip
  on keyboard focus; collapse remembered across reloads, and expand remembered too;
- on a phone: the menu reports its state; the drawer takes focus and traps Tab; no axe violations in the open drawer;
  Esc closes it and focus returns to the menu button; the close button works; a link navigates and closes the drawer;
- no page exceptions.

A defect found and fixed during this work: wrapping links in a tooltip trigger dropped `NavLink`'s className
function, so collapsed icons rendered dark on dark (contrast about 1.2:1). The checks passed and the screenshot
showed it. The class is now computed with `useMatch`, and the contrast check above was added so it cannot return.

Regression on the same build: UI audit sweep (42 page views, 0 axe, 0 missing H1, 0 overflow, 0 small text, 0
errors), graph 16/16, full screen 27/27, user ID 12/12, case team 22/22.

## 4. Not done

- No badge counts on items, such as open requests (the notification bell covers request updates).
- The sidebar's brand colours are hard-coded hex values (the design system's dark brand surface), as before.
- Chromium only; not tested with a real screen reader or on real touch devices.
