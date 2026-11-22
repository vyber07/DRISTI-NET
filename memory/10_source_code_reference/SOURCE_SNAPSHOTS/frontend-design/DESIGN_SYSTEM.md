# DRISTI-NET design system

Builds on what already exists. The colour, radius, shadow and motion tokens in
`apps/web/src/styles/tokens.css` are mapped into Tailwind by `apps/web/src/index.css`, and the
Radix/cva primitives live in `components/ui`. This document adds rules and the missing shared pieces; it does not
introduce a second component system.

## 1. Principles
1. **Operational, calm, readable.** This is a working tool, not a marketing page: no gradients, glow, decorative motion
   or oversized cards.
2. **Status is never colour alone.** Every status has a text label, and a shape or icon where it helps. Red is reserved for
   *failure* and *blocked* states. It is never used for a person, an entity or a "suspicion" (docs/context.md §16).
3. **Show only what the data says.** No status text that isn't derived from an API response ("SYSTEM ONLINE",
   "PII Masking: Strict", "CONFIDENTIAL // LEA SENSITIVE" were removed for this reason).
4. **Candidate language.** Unreviewed output reads *candidate*, *possible*, *review required*. It never reads *verified*
   or *confirmed* unless a human decision exists.
5. **Technical details stay available, one level down.** SHA-256, claim IDs, trace IDs and method versions sit in an
   "Integrity" or "Details" section in monospace. They are never removed and never lead the page.

## 2. Tokens (from `styles/tokens.css`)

| Role | Token / utility | Use |
|---|---|---|
| Page background | `bg-background` (#F6F7F5) | behind content |
| Surface | `bg-surface-1` (#FFF), `bg-surface-2` (#EEF2F3) | cards and tables / table headers, inputs, subtle fills |
| Borders | `border-border-subtle`, `border-border-strong` | dividers / inputs and buttons |
| Text | `text-text-primary` #17324D, `text-text-secondary` #526273, `text-text-muted` #788896 | body / supporting / metadata |
| Brand / primary action | `electric-blue` (teal #287C7A) | primary buttons, active tab, links |
| Success | `verified-emerald` | completed, integrity match, human-approved |
| Warning / review required | `amber` | needs human review, pending, deferred |
| In progress | `electric-blue-soft` | scanning, processing |
| Failure / blocked | `critical-red` | infected, integrity mismatch, failed, errors |
| Quarantine / held | `court-purple` | quarantined, scanner unavailable (held, not failed) |
| Inactive | `inactive-gray` | stale, historical, rejected candidate |

`text-text-muted` on `surface-1` is 3.6:1, which is too low for body text. It is used only for ≥12px metadata labels next to
higher-contrast values. Body and table text use `text-primary` or `text-secondary` (≥ 6:1).

## 3. Typography
Inter for UI, JetBrains Mono for identifiers and hashes (both self-hosted; works offline).

| Element | Size / weight | Class |
|---|---|---|
| Page title (H1) | 20px / 600 | `text-xl font-semibold` |
| Section title (H2) | 15px / 600 | `text-[15px] font-semibold` |
| Body, table cells | 14px / 400 | `text-sm` |
| Labels, metadata | 12px / 500 | `text-xs font-medium text-text-secondary` |
| Identifiers, hashes | 12px mono | `font-mono text-xs` |
| Badges | 12px / 500 | `Badge` |

The minimum text size is **12px**. The previous 10–10.5px labels were raised. All-caps letter-spaced labels are kept only for
table headers, never for sentences.

## 4. Layout
- **App shell**:
  - top bar (40px): signed-in user, role, jurisdiction, masking state, Sign out;
  - sidebar (240px, collapses to 56px);
  - below 1024px the sidebar becomes an overlay drawer opened from a menu button.
- **Page**: `PageHeader` (breadcrumb, H1, one-line description, actions on the right), then content in a centred
  column (`max-w-6xl`, 24px padding, 16px on small screens).
- **Case workspace**:
  - `CaseHeader`: breadcrumb "Cases / CASE-0001", title, key facts;
  - one row of tabs that scrolls horizontally when it doesn't fit;
  - tab content below;
  - full-bleed tabs (graph) use the whole remaining height.
- Spacing comes from Tailwind's 4px scale: 16px between cards, 12px inside dense tables.
- **Breakpoints**:
  - ≥1280 is the full layout;
  - 1024–1279 keeps the sidebar collapsible;
  - 768–1023 makes the sidebar a drawer and the graph detail panel an overlay;
  - <768 stacks everything in one column, tables scroll horizontally inside their card (never the page), and graph
    detail opens as a sheet.

## 5. Components (catalogue in `FRONTEND_COMPONENT_CATALOG.md`)
- **Buttons** (`components/ui/button.tsx`): one `primary` per view, at most. `secondary` for supporting actions, `ghost` for
  toolbar and icon actions, `destructive` for irreversible actions behind a confirmation. Icon-only buttons must have
  an `aria-label`. A disabled button that's disabled for policy reasons uses a `title` explaining why.
- **StatusBadge** (new, `components/ui/status-badge.tsx`): the single mapping from an evidence or review state to tone, icon
  and plain-language label, for example `HITL → "Needs review"` and `SCANNER_UNAVAILABLE → "Held: scanner unavailable"`. The raw
  state stays available in `title` for precision.
- **PageHeader / Section / EmptyState / ErrorState / DeniedState / Loading** (new, `components/layout/page.tsx`): every page
  uses them, so loading, empty, error and denied states look and read the same everywhere.
- **ReasonDialog** (new, `components/ui/reason-dialog.tsx`): one accessible Radix dialog for every action that needs an
  audited reason (download original, reveal, review decision, reversal). It replaces `window.prompt` and three ad-hoc modals.
  It has a focus trap, Escape to cancel, a minimum-length check with a visible message, and the reason is never stored client-side.
- **Tables**: a semantic `<table>` with a sticky header, row hover, a whole-row click target plus an explicit
  link in the first cell (so keyboard users get a real link), and numeric columns right-aligned.
- **Drawer** (Radix dialog, side variant): contextual detail (an evidence record) without leaving the list.

## 6. Interaction rules
- Every async action shows its loading state on the control that started it, then a result message in an
  `aria-live` region next to it. Errors include the server's reason and, when present, the trace ID.
- No error is swallowed silently. `.catch(() => {})` is allowed only for an optional enrichment, and then the UI states
  the data is unavailable.
- Confirmation is required only for audited or irreversible actions (decisions, reveal, download original, anchor creation).
- URLs carry identifiers and tab state only. They never carry reasons, revealed values or other sensitive data.

## 7. Accessibility target (WCAG 2.2 AA, as a target, not a claim)
- Landmarks (`header`, `nav`, `main`), one H1 per page, and a skip link to `main`.
- Visible focus on every control (global `:focus-visible` outline). Dialogs trap and restore focus.
- Tabs use links (`aria-current="page"`), so every tab has its own URL and works with the keyboard and browser history.
- Form fields have `<label>`s. Errors are linked with `aria-describedby` and announced via `role="alert"`.
- `prefers-reduced-motion` turns motion tokens off (already in `tokens.css`).
