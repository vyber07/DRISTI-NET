# P2.1 UI/UX audit and consistency pass (2026-11-13)

Branch `worktree-auth-login-ratelimit`. Builds on the 2026-11-04 redesign (`frontend-design/DESIGN_SYSTEM.md`). This pass
measures the app against that design system and fixes the drift. Most of it came from pages added since: Users,
Permission overrides, Case assignments, Requests and the global Audit log.

## 1. Method

- **Static scan of `apps/web/src`:**
  - Tailwind palette colours instead of tokens;
  - hard-coded hex colours;
  - text under 12 px (including the `text-micro` token);
  - uppercase headings;
  - `window.confirm`/`prompt`/`alert`;
  - swallowed `.catch(() => {})`;
  - ad-hoc spinners;
  - pages without `PageHeader`/`CaseTabBody`/`<h1>`.
- **Browser sweep** (`scripts/reliability/ui_audit_sweep.mjs`): real Chromium over CDP against an isolated server on a
  throwaway store (seeded and ingested).
  - Coverage: 21 routes, each as the role that uses it (anonymous login, investigator for the case and user pages,
    admin for administration and the global audit), at 1440×900 and 390×844. That is 42 page views.
  - Measured per page: axe-core 4.10.2 (WCAG 2.0/2.1/2.2 A and AA rules, the same version and tags as the 2026-11-04
    audit), number of `<h1>`, horizontal page overflow, visible text under 12 px (computed font size), and console
    errors, exceptions and HTTP 5xx.
  - Raw results: `p21-sweep-before.json`, `p21-sweep-after.json`.
- Screenshots of every page were reviewed for visual consistency.

## 2. Results

| Measure (42 page views) | Before | After |
| --- | --- | --- |
| axe WCAG A/AA violations | 8 elements in 4 rules | **0** |
| Pages without exactly one `<h1>` | 6 (Users, Case assignments, global Audit log; both widths) | **0** |
| Visible text under 12 px | 8,624 elements (Timeline 1,571; case Audit log 1,773; global Audit 885; Patterns 45; …) | **0** |
| Horizontal page overflow | 0 | 0 |
| Pages with console errors / exceptions / 5xx | 0 | 0 |
| Static: Tailwind palette colour classes | 47 | **0** |
| Static: `window.confirm` | 3 | **0** |
| Static: uppercase headings | 9 | **0** |
| Static: ad-hoc spinners | 7 | 1 (inside the login button, intentional) |

axe before, by rule:
- `scrollable-region-focusable` 3: the global audit list and the request detail scroll area could not be scrolled
  from the keyboard;
- `select-name` 2: the global audit action filter had no label;
- `link-in-text-block` 2: the "review queue" link in a sentence on Decisions was marked by colour only;
- `button-name` 1: the graph's Organize button was icon-only below 640 px, with no name.

## 3. Changes

- **Typography floor.**
  - `--text-micro` goes from 11 px to 12 px (75 uses).
  - 28 hard-coded `text-[9|10|10.5|11px]` sizes become `text-xs` (12 px), and an SVG map label goes from 9 to 12.
  - This meets the design system's "minimum text size is 12 px".
- **One page structure.** Users, Case assignments and the global Audit log now use `PageHeader` (icon, `<h1>`,
  description, actions) and `PageBody`. They had ad-hoc uppercase monospace `<h2>` bars and no H1. Patterns uses
  `CaseTabBody` and `Section`.
- **Shared states.**
  - Ad-hoc spinners are replaced by `LoadingState` (Users, Case assignments, Permission overrides, Locations, Patterns,
    global Audit).
  - Load errors use `ErrorState` (with Retry), and empty lists use `EmptyState` (Permission overrides, Case
    assignments, Patterns, global Audit).
  - The Users action-error banner uses tokens and `role="alert"`.
- **Global Audit log redesigned as a semantic table:**
  - time in the configured display time zone, action, outcome as words ("Allowed", "Denied", "Error", plus the failure
    reason), who (username, role, office), target, and the case as a link;
  - labelled search, action and outcome filters.
  - Before, each event named its actor by internal `USR-…` key, outcome was colour only, and the action select had no
    label.
- **Patterns:**
  - plain-language headings with the technical measure as secondary text: "Most connected entities (degree
    centrality)", "Possible bridges between groups (betweenness centrality)", "Groups (community detection)",
    "Repeated activity to review";
  - a fixed-width type badge, so "Organization" no longer runs into the entity name;
  - link counts in words;
  - tokens instead of `amber-400`/`purple-400`/`red-400`.
- **`ConfirmDialog` (`components/ui/confirm-dialog.tsx`, `useConfirm()`)** replaces `window.confirm` for retiring a
  user ID, removing a case member and handing a case over.
  - It is a Radix dialog: focus trap, Esc/Cancel resolve "no", a destructive style for access-removing actions, and it
    nests inside the dialog that opened it.
  - It portals into the full-screen element when one is active.
- **Colours to tokens.** All 28 remaining palette classes are replaced by design tokens: emerald → `verified-emerald`,
  red → `critical-red`, amber → `amber` (text `amber-dim`), purple → `court-purple`. The files are the reveal dialog,
  audit drawer, card, header and view, edge drawer, map and overrides. This also raises contrast: `emerald-400` and
  `amber-400` on white were below 3:1.
- **Headings.** Dialog and drawer section labels are sentence-case `text-sm font-semibold`, not small uppercase
  (uppercase is for table headers only).
- **Keyboard and naming.**
  - `PageBody` and `CaseTabBody` scroll areas are focusable (`tabIndex=0`, inset focus ring), so keyboard users can
    scroll content that has no controls.
  - The Organize button has an `aria-label`.
  - The in-text link on Decisions is underlined.

Role-based visibility is unchanged: the same `can()` checks and `DeniedState`s, and the server still decides every
request. No API or permission change; no new dependency (axe-core is fetched for the audit only, as in 2026-11-04).

## 4. Regression evidence (same session, isolated server)

- After sweep: 0 / 0 / 0 / 0 / 0, as in §2.
- Graph walkthrough 16 of 16; full-screen walkthrough 27 of 27; user-ID walkthrough 12 of 12.
- Case-team walkthrough 22 of 22. It now goes through the confirmation dialog and includes "Cancel keeps the member".
- `tsc -b --noEmit` clean; `oxlint` exit 0 (63 warnings, all existing patterns, no errors).
- Screenshots reviewed: global Audit log, Users, Patterns (1440), and Timeline at 390 px with the 12 px floor (wraps
  cleanly, no overflow).
- The Python e2e suite (`tests/e2e`) was not run (Playwright for Python is not installed here). Its selectors on the
  changed pages were checked by reading: the global audit test waits for the heading text "Audit" and
  `[data-testid=access-denied]`, both still present.

## 5. Not done, and why

- **Sidebar and login hex colours** (21 occurrences) are the redesign's deliberate dark brand surfaces, and
  `PageHeader`'s icon tile uses a gradient and shadow. These conflict with design principle 1 ("no gradients, glow"),
  but changing the brand look is the owner's call, so they were left as they are.
- **No user research or screen-reader session.** These are engineering measurements, as in the 2026-11-04 audit. axe
  passing is a target, not a WCAG conformance claim.
- **Firefox, Safari and real mobile devices were not tested**; Chromium only.
- **63 lint warnings** remain (unused variables, setState in effects), unchanged by this pass.
- **The case Audit log tab** still uses its card list (now 12 px, token colours). Turning it into the same table as the
  global log is a candidate for a later pass.
