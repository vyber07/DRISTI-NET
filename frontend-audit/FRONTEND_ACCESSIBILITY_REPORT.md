# Frontend accessibility report

**Target:** WCAG 2.2 AA, as a design and test target. This report does **not** claim conformance. Conformance needs a
manual audit (screen readers, keyboard-only walkthroughs, zoom/reflow, cognitive review), which has not been done.

## 1. Automated scan: axe-core 4.10.2, WCAG 2.0/2.1/2.2 A and AA rules
The login page plus 13 signed-in pages, investigator role, 1440×900, Chromium. Script: `tests/ui-evaluation/axe_scan.py`.
Raw results: `a11y-before.json`, `a11y-after.json`.

| Rule | Before: failing elements | After |
|---|---|---|
| `color-contrast` | 385 | 0 |
| `button-name` (icon-only buttons without an accessible name) | 181 | 0 |
| `select-name` (unlabelled selects) | 5 | 0 |
| `label` (unlabelled inputs) | 1 | 0 |
| **Total** | **572 elements, 24 rule hits** | **0** |

**How they were fixed:**
- **Contrast** (`styles/tokens.css`, ratios computed, not estimated):
  - muted text #788896 → #5D6B78: 3.2–3.6:1 → ≥4.8:1 on every surface;
  - brand teal #287C7A → #21706E: 4.3 → 5.1:1 on tinted fills;
  - emerald and red darkened slightly;
  - amber and orange badges use their dark variants for text (light amber was 2.96:1).
- **Names:**
  - 177 audit-card "copy trace ID" buttons and the inspect chevron got labels;
  - icon-only buttons in the new pages carry `aria-label`;
  - the audit filter selects got labels;
  - new form fields use `<label for>`.

## 2. Structure and keyboard (manual code review plus E2E)
- A "Skip to content" link targets `<main id="main">`. Landmarks are `header`, `nav` (Main / Case sections / Breadcrumb) and `main`.
- One H1 per page: the page title, or the case title on case pages. Tabs and sections use H2/H3.
- Case tabs are links with `aria-current`, so each tab has a URL and works with the back button.
- Review filters use `role=tab` with `aria-selected`.
- Dialogs (reason, source viewer, evidence drawer, reveal) are Radix dialogs: labelled, focus trapped and restored, Escape closes. They replace a `window.prompt`, a hand-made modal and a non-dialog overlay.
- Tables have `<caption>` and `scope=col`. Sortable headers expose `aria-sort`. The first cell of each row is a real link, so keyboard users don't depend on the row's click handler.
- Status is never colour alone: every evidence and review state has a text label and an icon.
- Async results are announced (`role=status` / `role=alert`, `aria-live`).
- `prefers-reduced-motion` turns motion tokens off. Loading skeletons use `motion-safe:`.

## 3. Known gaps (not fixed)
- The graph canvas (Sigma/WebGL) can't be operated with a keyboard or screen reader. The same relationships are available as text through the Timeline, Patterns and the evidence claims, but there is no accessible table view of the graph itself.
- Audit event cards are clickable `<div>`s with a button inside. The button works with the keyboard, but the card-level click target is mouse-only.
- Zoom to 400% and reflow were not tested. The 390 px phone captures show no horizontal page scroll (`FRONTEND_RESPONSIVE_REPORT.md`).
- No screen-reader session (NVDA, VoiceOver) was run.

## 4. Keyboard and structure audit (added 2026-11-04, `tests/ui-evaluation/keyboard_audit.py`)
Investigator role, 1280×900, Chromium. Raw results are in `keyboard-audit.json`.

| Check (per page) | Result on 13 pages |
|---|---|
| First Tab stop is "Skip to content" | 13/13 |
| Every Tab stop (first 120) shows a visible focus indicator (outline or ring) | 13/13 after one fix (below) |
| No keyboard trap (focus stuck on one element) | 13/13 |
| Exactly one H1; `main`, `nav` and `header` landmarks present | 13/13 |
| Focusable controls without an accessible name | 0 |
| Reflow at 320 CSS px (WCAG 1.4.10, the equivalent of 400% zoom): no horizontal page scroll | 13/13 |
| axe-core (WCAG 2.x A/AA) | 0 violations |

| Dialog | Focus moves in | Focus stays in (Tab ×15) | Escape closes | axe |
|---|---|---|---|---|
| New case | yes | yes | yes | 0 |
| Add person | yes | yes | yes | 0 |

**Found and fixed during the audit:**
- Chromium's date input contains a focusable calendar button with no visible focus. Fixed with an `input[type=date]:focus-within` outline.
- The Home "See all" link inside a sentence was distinguished only by colour (axe `link-in-text-block`). It is now underlined.

The first run's "keyboard trap" and "no indicator" reports came from the audit script itself: element identity and timing. They were fixed and re-verified by tracing the Tab order and taking screenshots.

**Graph:** the canvas remains mouse and touch only. The **List view** (`/graph?view=list`) is the keyboard and screen-reader equivalent. It is E2E-tested by keyboard only: Tab to "Sources", Enter, Tab to a claim, Enter, then the source line is highlighted and Escape closes it.

**Still not done:** a session with a person using a screen reader (NVDA, JAWS or VoiceOver).
