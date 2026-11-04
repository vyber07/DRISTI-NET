# Interaction register — apps/web/src

> **Statuses come from code reading only and are UNVERIFIED until browser-tested.** "WORKING-LIKELY" means the handler exists, calls a real endpoint or state change, and nothing in the code contradicts the label — not that it was clicked.

**Baseline:** git `HEAD` `817bfd0` (live demo build). Line numbers are HEAD line numbers; the working tree was being redesigned during this audit.
**Scope:** every rendered control in reachable files (unused files — foundation preview, placeholder view, TierFilter, bounding-box overlay — are excluded). Data-loading effects are listed too (type `effect`) because their error handling determines the feedback a user sees. Repeated controls (one per list item) are one row.
**Columns:** API = method + path as sent by the code (`{}` = path parameter). UI role gate = what the *frontend* checks; the server's own rule is given in brackets where it matters. Feedback = loading / success / error the user sees.

Status values: WORKING-LIKELY · NO_HANDLER (looks interactive, no handler) · PLACEHOLDER (handler exists but does nothing real / fake result) · DUPLICATE (same action reachable from another control on the same screen or nav) · BROKEN (reason) · DEAD CODE (rendered branch can never be reached) · UNVERIFIED.

## Summary

Total rows: **223**. A row stands for one control, or one group of identical repeated controls (e.g. per-card buttons, the 6 entity checkboxes).

| Status | Rows |
| --- | ---: |
| WORKING-LIKELY | 154 |
| DUPLICATE | 32 |
| BROKEN | 19 |
| NO_HANDLER | 8 |
| PLACEHOLDER | 8 |
| DEAD CODE | 2 |

### BROKEN (code-level reason)

- **(load cases)** — `features/command-center/command-center-page.tsx:25` — failure shown as "No cases assigned"; FE-022
- **(load cases)** — `features/cases/cases-directory-page.tsx:15` — failure = empty page, no empty-state either; FE-022
- **(load stats, contradictions, reviews, anchors)** — `features/cases/components/case-overview-view.tsx:24` — errors swallowed; `.catch(() => {})` ×4; auditor 403 on /stats (FE-022)
- **Upload** — `features/cases/evidence/case-evidence-view.tsx:95` — network error unhandled; double-submit possible; Bypasses real_client (FE-025)
- **aria-label "End Date"** — `features/cases/timeline/timeline-filter-bar.tsx:91` — end day excluded; FE-028
- **Map (title "Locate this event on the Investigation Map")** — `features/cases/timeline/timeline-event-row.tsx:108` — selection cleared by loadGraph; FE-029
- **Refresh** — `features/cases/reviews/case-reviews-view.tsx:66` — error never cleared; FE-049
- **Export CSV** — `features/cases/audit/audit-integrity-header.tsx:62` — no CSV escaping; FE-027
- **target id (title "Open … in context")** — `features/cases/audit/audit-event-card.tsx:201` — params ignored; /notes dead; FE-030
- **Hide Panel / Show Panel** — `features/cases/case-graph-page.tsx:109` — no effect while a node/edge is selected; FE-032
- **Organize / Organize Map / Pause** — `components/graph/GraphToolbar.tsx:150` — no layout on real ids; Pause restarts; FE-006, FE-017
- **Clear** — `components/graph/filters/EntityTypeFilter.tsx:43` — "Clear" selects Person only; FE-045
- **Clear** — `components/graph/filters/RelationshipTypeFilter.tsx:34` — "Clear" selects CALLED only; FE-045
- **Reveal identity** — `components/intelligence/pii-field.tsx:57` — revealed value never displayed afterwards; FE-003, FE-024
- **(load queue + stats)** — `features/hitl/hitl-workspace-page.tsx:51` — failure = "Queue Clear"; FE-002, FE-023
- **(load task)** — `features/hitl/hitl-workspace-page.tsx:56` — error not rendered; FE-002
- **Escalate to Supervisory Officer** — `features/hitl/hitl-decision-pane.tsx:136` — mislabelled: records DEFER; FE-004
- **Confirm & Sign Off** — `features/hitl/hitl-decision-dialog.tsx:93` — no error feedback; FE-005
- **(load)** — `features/audit/global-audit-page.tsx:37` — 403 for non-auditors; FE-021

### Controls that look like they act but call nothing (NO_HANDLER / PLACEHOLDER)

- `components/security/security-status-bar.tsx:79` — **aria-label "Notifications"** (NO_HANDLER): **none**
- `features/cases/case-graph-page.tsx:120` — **Share** (NO_HANDLER): **none**
- `features/cases/case-graph-page.tsx:125` — **Export (aria-label = "Supervisor clearance required…")** (PLACEHOLDER): disabled
- `components/graph/filters/GraphFilterPanel.tsx:85` — **Conflicting Clues Only** (PLACEHOLDER): **none** (htmlFor points at no input)
- `components/graph/drawers/EntityDrawer.tsx:155` — **rel-type badge + "Claims: n"** (NO_HANDLER): **none**
- `components/intelligence/reveal-identity-modal.tsx:245` — **Level 1: Observer** (PLACEHOLDER): setOfficerClearance
- `components/intelligence/reveal-identity-modal.tsx:245` — **Level 2: Investigator** (PLACEHOLDER): setOfficerClearance
- `components/intelligence/reveal-identity-modal.tsx:245` — **Level 3: Supervisor** (PLACEHOLDER): setOfficerClearance
- `components/intelligence/reveal-identity-modal.tsx:178` — **Revoke & Re-mask Field** (PLACEHOLDER): closeRevealModal only
- `features/audit/global-audit-page.tsx:125` — **(audit row)** (NO_HANDLER): **none**
- `features/profile/profile-page.tsx:199` — **aria-label "Toggle PII masking"** (PLACEHOLDER): setPiiMasked(!piiMasked)
- `features/profile/profile-page.tsx:224-253` — **Manage Profile** (NO_HANDLER): `() => {}`
- `features/profile/profile-page.tsx:224-253` — **Change Password** (NO_HANDLER): `() => {}`
- `features/profile/profile-page.tsx:224-253` — **Security & Sessions** (NO_HANDLER): `() => {}`
- `features/profile/profile-page.tsx:224-253` — **Role & Permissions** (NO_HANDLER): `() => {}`
- `features/settings/settings-page.tsx:72` — **Clear Local Cache** (PLACEHOLDER): setResetMessage(fake)

### Icon-only controls without an accessible name

- `layouts/AppShell/sidebar.tsx:15` — Dashboard (icon-only when collapsed)
- `layouts/AppShell/sidebar.tsx:15` — Case Directory
- `layouts/AppShell/sidebar.tsx:15` — Audit Trail
- `features/cases/components/case-detail-sidebar.tsx:44` — (no name) collapse panel
- `features/cases/evidence/case-evidence-view.tsx:68` — (no name) grid view
- `features/cases/evidence/case-evidence-view.tsx:75` — (no name) table view
- `features/cases/evidence/evidence-card.tsx:102` — (no name) copy SHA-256
- `components/evidence/ProvenanceViewer.tsx:44` — (no name) close X
- `features/cases/audit/audit-event-card.tsx:229` — (no name) copy trace id
- `features/cases/audit/audit-detail-drawer.tsx:114` — (no name) close X
- `features/cases/audit/audit-detail-drawer.tsx:226` — (no name) copy trace
- `components/graph/GraphToolbar.tsx:299` — (no name) ×
- `components/graph/drawers/EntityDrawer.tsx:52` — (no name) close X
- `components/graph/drawers/EdgeDrawer.tsx:33` — (no name) close X
- `features/hitl/hitl-workspace-page.tsx:143` — title "Refresh tasks"
- `features/hitl/hitl-queue-filters.tsx:36` — (no name) clear X
- `features/hitl/hitl-decision-dialog.tsx:43` — (no name) close X

Also: collapsed sidebar links (3) render only an icon — the Radix tooltip is not an accessible name.
Several icon buttons rely on `title` only (`hitl-workspace-page.tsx:143`, `audit-event-card.tsx:243`, `evidence-row.tsx:83`); `title` is not reliably announced.

### Error-swallowing handlers
- `features/cases/components/case-overview-view.tsx:26-29` — `.catch(() => {})` on stats, contradictions, reviews, anchors (auditor `/stats` 403 becomes "—").
- `stores/hitlStore.ts:65` — `getHITLStats(...).catch(() => ({ data: get().stats }))` → zeros shown (FE-023).
- `stores/hitlStore.ts:176-178, 187-189` — `catch { console.error('Failed to refresh stats') }` (assign + stats; wrong message for assign).
- `stores/graphStore.ts:172-174` — `catch { // Keep selectedNodeId }` → node selected, no drawer, no message.
- `features/command-center/command-center-page.tsx:40`, `features/cases/cases-directory-page.tsx:21` — `.catch(console.error)` → empty dashboard/directory.
- `features/cases/timeline/timeline-event-row.tsx:37` — claim lookup failure silently opens the file at line 1.
- `components/intelligence/reveal-identity-modal.tsx:104-106` — `catch {}` (acceptable: store renders `submissionError`).
- `stores/auditStore.ts:70-75`, `stores/hitlStore.ts:103-108, 158-160` — catch replaces the server's `detail` with a generic string.
- `features/hitl/hitl-workspace-page.tsx` — store `error` is never rendered at all (FE-002, FE-005).

### Duplicates (same action, several controls)
- **Go to graph:** case nav "Investigation Map" (workspace `:135`, graph page `:165`), case header button, overview "Graph" module, dashboard "Graph", directory "Graph", HITL "Graph View", timeline "Map".
- **Go to case overview:** case nav, graph-page header "Case Overview", HITL "Case Overview", dashboard "Open Workspace", directory "Open Case Workspace".
- **Sign out:** top-bar "Lock" and profile "Sign Out".
- **Entity-type filter:** toolbar dropdown (2xl) and filter-panel checkboxes.
- **Reset filters:** two per page on evidence, timeline and audit (bar + empty state).
- **Copy/inspect/download evidence:** card and row variants with copied code.
- **Close audit drawer:** X, backdrop, "Close Inspection"; reveal success: "Revoke & Re-mask" and "Continue Investigation" both just close.

## Register


### Global shell (all authenticated routes)

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-001 | Global shell | `layouts/AppShell/sidebar.tsx:15` | NavLink | Dashboard (icon-only when collapsed) | navigate /command-center | — | none | active style | WORKING-LIKELY | Collapsed: no accessible name (tooltip only); DUPLICATE of dashboard links |
| INT-002 | Global shell | `layouts/AppShell/sidebar.tsx:15` | NavLink | Case Directory | navigate /cases | — | none | active style | WORKING-LIKELY | Collapsed: no accessible name |
| INT-003 | Global shell | `layouts/AppShell/sidebar.tsx:15` | NavLink | Audit Trail | navigate /audit | — | AUDITOR, ADMIN (sidebar.tsx:147) | active style | WORKING-LIKELY | Collapsed: no accessible name |
| INT-004 | Global shell | `layouts/AppShell/sidebar.tsx:60` | button | aria-label "View profile" (initials + name) | navigate /profile | — | none | none | WORKING-LIKELY | `[&.active]` styles never apply (not a NavLink) |
| INT-005 | Global shell | `layouts/AppShell/sidebar.tsx:179` | Button | Collapse Menu / aria-label Expand navigation | toggleSidebar | — | none | width change | WORKING-LIKELY | State not persisted |
| INT-006 | Global shell | `components/security/security-status-bar.tsx:79` | Button (icon) | aria-label "Notifications" | **none** | — | none | none | NO_HANDLER | Looks actionable; nothing happens |
| INT-007 | Global shell | `components/security/security-status-bar.tsx:83` | Button | Lock (aria-label "Lock workstation session") | logout(); navigate('/login') | — | none | full reload to /login | WORKING-LIKELY | Label says Lock, action is sign-out (FE-035) |
| INT-008 | Global shell | `app/providers/app-providers.tsx:10` | effect | (session restore) | restoreSession | GET /auth/me | none | "Authenticating..." full page | WORKING-LIKELY | Uses undefined class bg-bg-base |

### /login

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-009 | /login | `features/auth/login-page.tsx:63` | form | (login form) | handleSubmit → login() | POST /auth/login, GET /auth/me | none | spinner text; error box (401/429 mapped) | WORKING-LIKELY | Ignores state.from (FE-020) |
| INT-010 | /login | `features/auth/login-page.tsx:76` | input text | label "Officer / User ID" (not associated) | setUsername | — | none | — | WORKING-LIKELY | label lacks htmlFor (FE-040) |
| INT-011 | /login | `features/auth/login-page.tsx:96` | input password | label "Station Key" (not associated) | setPassword | — | none | — | WORKING-LIKELY | label lacks htmlFor |
| INT-012 | /login | `features/auth/login-page.tsx:109` | Button submit | Secure Login | form submit | (see form) | none | "Authenticating..." | WORKING-LIKELY | Demo credentials printed below (FE-010) |

### /command-center

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-013 | /command-center | `features/command-center/command-center-page.tsx:25` | effect | (load cases) | listCases | GET /cases | none | "—" while loading; failure → console only | BROKEN (failure shown as "No cases assigned") | FE-022 |
| INT-014 | /command-center | `features/command-center/command-center-page.tsx:137` | Link>Button | Open Workspace (per case, ≤6) | navigate /cases/:id | — | none | — | WORKING-LIKELY | a>button nesting (FE-039) |
| INT-015 | /command-center | `features/command-center/command-center-page.tsx:143` | Link>Button | Graph (per case) | navigate /cases/:id/graph | — | none | — | DUPLICATE | Same as case header / directory Graph |
| INT-016 | /command-center | `features/command-center/command-center-page.tsx:156` | Link>Button | View all N cases in directory | navigate /cases | — | shown only if >6 cases | — | DUPLICATE | Same as sidebar Case Directory |
| INT-017 | /command-center | `features/command-center/command-center-page.tsx:173` | Link>Button | Case Directory | navigate /cases | — | none | — | DUPLICATE | Same as sidebar |
| INT-018 | /command-center | `features/command-center/command-center-page.tsx:179` | Link>Button | Review Queue | navigate /cases/{cases[0]}/hitl | — | REVIEWER, INVESTIGATOR, ADMIN | — | WORKING-LIKELY | Opens the first case's queue arbitrarily |
| INT-019 | /command-center | `features/command-center/command-center-page.tsx:186` | Link>Button | Global Audit | navigate /audit | — | AUDITOR, ADMIN | — | DUPLICATE | Same as sidebar Audit Trail |
| INT-020 | /command-center | `features/command-center/command-center-page.tsx:192` | Link>Button | My Profile | navigate /profile | — | none | — | DUPLICATE | Same as sidebar profile button |

### /cases

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-021 | /cases | `features/cases/cases-directory-page.tsx:15` | effect | (load cases) | listCases | GET /cases | none | spinner; failure → console only | BROKEN (failure = empty page, no empty-state either) | FE-022 |
| INT-022 | /cases | `features/cases/cases-directory-page.tsx:61` | input text | placeholder only "Search cases by number…" | setSearchQuery (client filter) | — | none | list filters; 0 results shows nothing | WORKING-LIKELY | No label; no "no results" message |
| INT-023 | /cases | `features/cases/cases-directory-page.tsx:132` | Link>Button | Graph | navigate /cases/:id/graph | — | none | — | DUPLICATE |  |
| INT-024 | /cases | `features/cases/cases-directory-page.tsx:138` | Link>Button | Open Case Workspace | navigate /cases/:id | — | none | — | WORKING-LIKELY | a>button nesting |

### /cases/:id (workspace shell: overview/evidence/timeline/map/analysis/reviews/audit)

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-025 | /cases/:id | `features/cases/case-workspace-page.tsx:73` | effect | (load case) | getCaseDetails | GET /cases/{id} | none | "Loading Workspace..."; error one grey line | WORKING-LIKELY | Denied state weak (FE-059) |
| INT-026 | /cases/:id | `features/cases/components/case-header.tsx:22` | Button asChild Link | Home | navigate /command-center | — | none | — | WORKING-LIKELY | Back goes to dashboard, not directory |
| INT-027 | /cases/:id | `features/cases/components/case-header.tsx:53` | Button asChild Link | Investigation Map | navigate /cases/:id/graph | — | hidden on graph tab | — | DUPLICATE | Also nav tab + overview module button |
| INT-028 | /cases/:id | `features/cases/components/case-header.tsx:61` | Button asChild Link | Export Reports | navigate /cases/:id/reports | — | none | — | WORKING-LIKELY | Only entry to Reports; Reports drops case chrome |
| INT-029 | /cases/:id | `features/cases/case-workspace-page.tsx:151` | button (nav tab) | Case Overview | handleTabChange('overview') → navigate | — | none | active style | WORKING-LIKELY |  |
| INT-030 | /cases/:id | `features/cases/case-workspace-page.tsx:151` | button (nav tab) | Location Map | handleTabChange('map') → navigate | — | none | active style | WORKING-LIKELY | Name clashes with map view title "Investigation Map" |
| INT-031 | /cases/:id | `features/cases/case-workspace-page.tsx:151` | button (nav tab) | Evidence & Records | handleTabChange('evidence') → navigate | — | none | active style | WORKING-LIKELY |  |
| INT-032 | /cases/:id | `features/cases/case-workspace-page.tsx:151` | button (nav tab) | Event Timeline | handleTabChange('timeline') → navigate | — | none | active style | WORKING-LIKELY |  |
| INT-033 | /cases/:id | `features/cases/case-workspace-page.tsx:151` | button (nav tab) | Graph Analysis | handleTabChange('analysis') → navigate | — | none | active style | WORKING-LIKELY |  |
| INT-034 | /cases/:id | `features/cases/case-workspace-page.tsx:151` | button (nav tab) | Analyst Review | handleTabChange('hitl') → navigate | — | none | active style | WORKING-LIKELY | Leaves case layout (FE-042) |
| INT-035 | /cases/:id | `features/cases/case-workspace-page.tsx:151` | button (nav tab) | Decisions | handleTabChange('reviews') → navigate | — | none | active style | WORKING-LIKELY |  |
| INT-036 | /cases/:id | `features/cases/case-workspace-page.tsx:151` | button (nav tab) | Audit Trail | handleTabChange('audit') → navigate | — | none | active style | WORKING-LIKELY |  |
| INT-037 | /cases/:id | `features/cases/case-workspace-page.tsx:135` | Link (nav tab) | Investigation Map | navigate /cases/:id/graph | — | none | never shows active | WORKING-LIKELY | Graph page has a different 5-item nav |
| INT-038 | /cases/:id | `features/cases/case-workspace-page.tsx:44` | Button | Return to Overview (placeholder) | handleTabChange('overview') | — | only for unknown ?tab= | — | WORKING-LIKELY | DUPLICATE placeholder component |
| INT-039 | /cases/:id | `features/cases/components/case-detail-sidebar.tsx:44` | Button (icon) | (no name) collapse panel | onToggleCollapse | — | none | panel collapses | WORKING-LIKELY | Icon-only, no aria-label (FE-038) |
| INT-040 | /cases/:id | `features/cases/components/case-detail-sidebar.tsx:19` | button | aria-label "Expand case information panel" | onToggleCollapse | — | none | panel expands | WORKING-LIKELY | Three dots; weak affordance |

### /cases/:id (Overview)

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-041 | /cases/:id | `features/cases/components/case-overview-view.tsx:24` | effect | (load stats, contradictions, reviews, anchors) | 4 calls | GET /cases/{id}/stats, /contradictions, /reviews, /integrity/anchors | none | none on error | BROKEN (errors swallowed) | `.catch(() => {})` ×4; auditor 403 on /stats (FE-022) |
| INT-042 | /cases/:id | `features/cases/components/case-overview-view.tsx:101-117` | Link>Button | Evidence | navigate /cases/:id/evidence | — | none | — | DUPLICATE | Duplicates case nav tabs; a>button nesting |
| INT-043 | /cases/:id | `features/cases/components/case-overview-view.tsx:101-117` | Link>Button | Graph | navigate /cases/:id/graph | — | none | — | DUPLICATE | Duplicates case nav tabs; a>button nesting |
| INT-044 | /cases/:id | `features/cases/components/case-overview-view.tsx:101-117` | Link>Button | Map | navigate /cases/:id/map | — | none | — | DUPLICATE | Duplicates case nav tabs; a>button nesting |
| INT-045 | /cases/:id | `features/cases/components/case-overview-view.tsx:101-117` | Link>Button | Analysis | navigate /cases/:id/analysis | — | none | — | DUPLICATE | Duplicates case nav tabs; a>button nesting |
| INT-046 | /cases/:id | `features/cases/components/case-overview-view.tsx:176` | Button | Create Anchor | handleCreateAnchor | POST /cases/{id}/integrity/anchor, then GET …/anchors | none (server: INVESTIGATOR, REVIEWER, ANALYST, ADMIN) | spinner icon; message (errors shown in emerald) | WORKING-LIKELY | Error text styled as success; no role gate (FE-024) |

### /cases/:id/evidence

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-047 | /cases/:id/evidence | `features/cases/evidence/case-evidence-view.tsx:34` | effect | (load evidence) | loadEvidence | GET /cases/{id}/evidence | none | skeleton; error card | WORKING-LIKELY |  |
| INT-048 | /cases/:id/evidence | `features/cases/evidence/case-evidence-view.tsx:68` | button (icon) | (no name) grid view | setViewMode('grid') | — | none | style | WORKING-LIKELY | No aria-label / aria-pressed |
| INT-049 | /cases/:id/evidence | `features/cases/evidence/case-evidence-view.tsx:75` | button (icon) | (no name) table view | setViewMode('table') | — | none | style | WORKING-LIKELY | No aria-label / aria-pressed |
| INT-050 | /cases/:id/evidence | `features/cases/evidence/case-evidence-view.tsx:94` | input file | (native, unlabeled) | setSelectedFile | — | none (server: EVIDENCE_OFFICER, INVESTIGATOR, ADMIN) | — | WORKING-LIKELY | Raw browser control; not cleared after upload |
| INT-051 | /cases/:id/evidence | `features/cases/evidence/case-evidence-view.tsx:95` | Button | Upload | inline async fetch | POST /api/v1/cases/{id}/evidence (raw fetch, multipart) | none | status text after response; no busy state | BROKEN (network error unhandled; double-submit possible) | Bypasses real_client (FE-025) |
| INT-052 | /cases/:id/evidence | `features/cases/evidence/evidence-filter-bar.tsx:17` | input text | placeholder only "Search by filename or SHA-256..." | setSearchQuery | — | none | count text | WORKING-LIKELY | No label |
| INT-053 | /cases/:id/evidence | `features/cases/evidence/evidence-filter-bar.tsx:30` | Button | Reset | resetFilters | — | none | — | WORKING-LIKELY |  |
| INT-054 | /cases/:id/evidence | `features/cases/evidence/case-evidence-view.tsx:147` | Button | Reset Filters (empty state) | resetFilters | — | none | — | WORKING-LIKELY | Shown even when the case has no evidence at all |
| INT-055 | /cases/:id/evidence | `features/cases/evidence/evidence-card.tsx:102` | button (icon) | (no name) copy SHA-256 | clipboard.writeText | — | none | check icon 2 s (even if copy fails) | WORKING-LIKELY | No aria-label; promise unhandled |
| INT-056 | /cases/:id/evidence | `features/cases/evidence/evidence-card.tsx:109` | Button | Inspect Document | openProvenanceForRecord(id) | GET /evidence/{id}/context | none | loading/error overlay | WORKING-LIKELY | Opens at line 1 (no locator) |
| INT-057 | /cases/:id/evidence | `features/cases/evidence/evidence-card.tsx:113` | Button | Download (aria-label "Download original evidence file") | window.prompt reason → downloadEvidence | POST /evidence/{id}/download {reason} | INVESTIGATOR, REVIEWER, ADMIN (disabled otherwise) | error text (409/403 mapped); no busy state | WORKING-LIKELY | window.prompt (FE-050) |
| INT-058 | /cases/:id/evidence | `features/cases/evidence/evidence-row.tsx:83` | button (icon) | title "Copy SHA-256 hash" | clipboard.writeText | — | none | check icon | DUPLICATE | Same as card |
| INT-059 | /cases/:id/evidence | `features/cases/evidence/evidence-row.tsx:93` | Button | Inspect | openProvenanceForRecord(id) | GET /evidence/{id}/context | none | overlay | DUPLICATE | opacity-0 until hover (FE-039) |
| INT-060 | /cases/:id/evidence | `features/cases/evidence/evidence-row.tsx:96` | Button (icon) | aria-label "Download original evidence file" | prompt → downloadEvidence | POST /evidence/{id}/download | INVESTIGATOR, REVIEWER, ADMIN | error text | DUPLICATE | opacity-0 until hover |

### Provenance viewer overlay (evidence, graph, timeline, review)

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-061 | Provenance viewer overlay | `components/evidence/ProvenanceViewer.tsx:21` | Button | Close (loading/error state) | closeModal | — | none | — | WORKING-LIKELY |  |
| INT-062 | Provenance viewer overlay | `components/evidence/ProvenanceViewer.tsx:44` | button (icon) | (no name) close X | closeModal | — | none | — | WORKING-LIKELY | No aria-label; no Escape; no focus trap (FE-041) |
| INT-063 | Provenance viewer overlay | `components/evidence/ProvenanceViewer.tsx:83` | input text | placeholder "Reason for revealing context…" | setReason | — | none | — | WORKING-LIKELY | No label; value persists across documents (FE-051) |
| INT-064 | Provenance viewer overlay | `components/evidence/ProvenanceViewer.tsx:90` | Button | Reveal Context | revealContext(reason) | POST /evidence/{id}/context/reveal {reason, locator, window:2} | none (server decides) | "Revealing..."; error text | WORKING-LIKELY | No client min length (server ≥5) |

### /cases/:id/timeline

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-065 | /cases/:id/timeline | `features/cases/timeline/case-timeline.tsx:37` | effect | (load timeline) | loadTimeline | GET /cases/{id}/timeline[?entity_id] | none | skeleton; error card with Retry | WORKING-LIKELY | Double fetch when scoping (setEntityScope + URL change) |
| INT-066 | /cases/:id/timeline | `features/cases/timeline/timeline-filter-bar.tsx:27` | input text | aria-label "Search timeline events" | setSearchQuery | — | none | count | WORKING-LIKELY |  |
| INT-067 | /cases/:id/timeline | `features/cases/timeline/timeline-filter-bar.tsx:36` | button | aria-label "Clear search" (×) | setSearchQuery('') | — | none | — | WORKING-LIKELY |  |
| INT-068 | /cases/:id/timeline | `features/cases/timeline/timeline-filter-bar.tsx:53` | button (icon) | aria-label "Clear entity scope" | setEntityScope(null) | GET /cases/{id}/timeline | none | reload | WORKING-LIKELY | Leaves ?entityId in URL (inconsistent with Show All Events) |
| INT-069 | /cases/:id/timeline | `features/cases/timeline/timeline-filter-bar.tsx:65` | Button | Reset Filters | resetFilters | — | none | — | DUPLICATE | Second reset in empty state |
| INT-070 | /cases/:id/timeline | `features/cases/timeline/timeline-filter-bar.tsx:80` | input date | aria-label "Start Date" | setDateRange | — | none | count | WORKING-LIKELY | Zone mismatch (FE-028) |
| INT-071 | /cases/:id/timeline | `features/cases/timeline/timeline-filter-bar.tsx:91` | input date | aria-label "End Date" | setDateRange | — | none | count | BROKEN (end day excluded) | FE-028 |
| INT-072 | /cases/:id/timeline | `features/cases/timeline/case-timeline.tsx:115` | Button | Show All Events | handleClearScope | GET /cases/{id}/timeline | none | reload | WORKING-LIKELY |  |
| INT-073 | /cases/:id/timeline | `features/cases/timeline/case-timeline.tsx:156` | Button | Retry | loadTimeline | GET /cases/{id}/timeline | none | reload | WORKING-LIKELY |  |
| INT-074 | /cases/:id/timeline | `features/cases/timeline/case-timeline.tsx:186` | Button | View Case-Wide Timeline | handleClearScope | GET /cases/{id}/timeline | none | — | DUPLICATE | Same as Show All Events |
| INT-075 | /cases/:id/timeline | `features/cases/timeline/case-timeline.tsx:195` | Button | Reset All Filters | resetFilters | — | none | — | DUPLICATE |  |
| INT-076 | /cases/:id/timeline | `features/cases/timeline/timeline-event-row.tsx:96` | Button | View Evidence | getClaimById → openProvenanceForRecord(ev, locator) | GET /claims/{id}, GET /evidence/{id}/context?page\|line\|row\|json_path | none | overlay | WORKING-LIKELY | Claim failure silently falls back to line 1 |
| INT-077 | /cases/:id/timeline | `features/cases/timeline/timeline-event-row.tsx:108` | Button | Map (title "Locate this event on the Investigation Map") | selectNode + navigate /graph | GET /entities/{id}?case_id (maybe wrong case) | none | — | BROKEN (selection cleared by loadGraph) | FE-029 |
| INT-078 | /cases/:id/timeline | `features/cases/timeline/timeline-event-row.tsx:130` | button | ENT-… id chip (title "Filter timeline to …") | onScopeEntity(entId) | GET /cases/{id}/timeline?entity_id | none | chip highlighted | WORKING-LIKELY | Shows raw id, not label (FE-036) |

### /cases/:id/map

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-079 | /cases/:id/map | `features/cases/map/investigation-map-view.tsx:41` | effect | (load locations) | getCaseLocations | GET /cases/{id}/locations | none | spinner; error card | WORKING-LIKELY |  |
| INT-080 | /cases/:id/map | `features/cases/map/investigation-map-view.tsx:64` | Button | Refresh | load | GET /cases/{id}/locations | none | spin icon | WORKING-LIKELY |  |
| INT-081 | /cases/:id/map | `features/cases/map/investigation-map-view.tsx:115` | svg g onClick | (location dot + label) | setSelected | — | none | detail card | WORKING-LIKELY | Mouse-only; hex colours |
| INT-082 | /cases/:id/map | `features/cases/map/investigation-map-view.tsx:146` | button | location label (list) | setSelected | — | none | highlight + card | WORKING-LIKELY | No aria-pressed |

### /cases/:id/analysis

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-083 | /cases/:id/analysis | `features/cases/analysis/case-analysis-page.tsx:27` | effect | (load analysis) | getCaseAnalysis | GET /cases/{id}/analysis | none | spinner; error card | WORKING-LIKELY |  |
| INT-084 | /cases/:id/analysis | `features/cases/analysis/case-analysis-page.tsx:37` | Button | Refresh | load | GET /cases/{id}/analysis | none | spin icon | WORKING-LIKELY | No t_from/t_to controls although the API supports them |

### /cases/:id/reviews

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-085 | /cases/:id/reviews | `features/cases/reviews/case-reviews-view.tsx:25` | effect | (load reviews) | getCaseReviews | GET /cases/{id}/reviews | none | spinner; error card | WORKING-LIKELY |  |
| INT-086 | /cases/:id/reviews | `features/cases/reviews/case-reviews-view.tsx:66` | Button | Refresh | load | GET /cases/{id}/reviews | none | spin icon | BROKEN (error never cleared) | FE-049 |
| INT-087 | /cases/:id/reviews | `features/cases/reviews/case-reviews-view.tsx:126` | Button (per CLAIM review) | APPROVE | window.prompt reason → makeClaimDecision | POST /claims/{id}/decision {decision, reason} | none (server: REVIEWER, INVESTIGATOR, ADMIN) | inline status text | WORKING-LIKELY | No role gate; prompt; shared state per claim id |
| INT-088 | /cases/:id/reviews | `features/cases/reviews/case-reviews-view.tsx:126` | Button (per CLAIM review) | REJECT | window.prompt reason → makeClaimDecision | POST /claims/{id}/decision {decision, reason} | none (server: REVIEWER, INVESTIGATOR, ADMIN) | inline status text | WORKING-LIKELY | No role gate; prompt; shared state per claim id |
| INT-089 | /cases/:id/reviews | `features/cases/reviews/case-reviews-view.tsx:126` | Button (per CLAIM review) | CONTRADICTORY | window.prompt reason → makeClaimDecision | POST /claims/{id}/decision {decision, reason} | none (server: REVIEWER, INVESTIGATOR, ADMIN) | inline status text | WORKING-LIKELY | No role gate; prompt; shared state per claim id |
| INT-090 | /cases/:id/reviews | `features/cases/reviews/case-reviews-view.tsx:126` | Button (per CLAIM review) | REVERSE | window.prompt reason → makeClaimDecision | POST /claims/{id}/decision {decision, reason} | none (server: REVIEWER, INVESTIGATOR, ADMIN) | inline status text | WORKING-LIKELY | No role gate; prompt; shared state per claim id |

### /cases/:id/audit

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-091 | /cases/:id/audit | `features/cases/audit/case-audit-view.tsx:29` | effect | (load logs) | loadLogs | GET /cases/{id}/audit | none | skeleton; generic error + Retry | WORKING-LIKELY | 403 detail discarded |
| INT-092 | /cases/:id/audit | `features/cases/audit/audit-integrity-header.tsx:62` | Button | Export CSV | handleExportDossier (client blob) | — | none | download; none | BROKEN (no CSV escaping) | FE-027 |
| INT-093 | /cases/:id/audit | `features/cases/audit/audit-filter-bar.tsx:38` | input text | placeholder "Search audit trail..." | setSearchQuery | — | none | list | WORKING-LIKELY | No label |
| INT-094 | /cases/:id/audit | `features/cases/audit/audit-filter-bar.tsx:48` | button | Clear Filters (n) | resetFilters | — | shown when filters active | — | WORKING-LIKELY | Doesn't reset sort |
| INT-095 | /cases/:id/audit | `features/cases/audit/audit-filter-bar.tsx:65` | select | "All Actions" (icon-labelled) | setActionFilter | — | none | list | WORKING-LIKELY | No label |
| INT-096 | /cases/:id/audit | `features/cases/audit/audit-filter-bar.tsx:79` | select | "All Domains" | setTargetTypeFilter | — | none | list | WORKING-LIKELY | No label |
| INT-097 | /cases/:id/audit | `features/cases/audit/audit-filter-bar.tsx:93` | select | "All Actors" (raw USR ids) | setActorFilter | — | none | list | WORKING-LIKELY | No label; ids not names |
| INT-098 | /cases/:id/audit | `features/cases/audit/audit-filter-bar.tsx:107` | select | Newest First / Oldest First (Genesis) | setSortOrder | — | none | list | WORKING-LIKELY | "Genesis" wording (FE-014) |
| INT-099 | /cases/:id/audit | `features/cases/audit/case-audit-view.tsx:101` | Button | Retry | loadLogs | GET /cases/{id}/audit | none | reload | WORKING-LIKELY |  |
| INT-100 | /cases/:id/audit | `features/cases/audit/case-audit-view.tsx:123` | Button | Reset All Filters | resetFilters | — | none | — | DUPLICATE |  |
| INT-101 | /cases/:id/audit | `features/cases/audit/audit-event-card.tsx:153` | div onClick | (whole card) | onInspect → openDrawer | — | none | drawer | WORKING-LIKELY | Not keyboard reachable (FE-039) |
| INT-102 | /cases/:id/audit | `features/cases/audit/audit-event-card.tsx:201` | Link | target id (title "Open … in context") | navigate graph?entityId / evidence?evidenceId / notes | — | none | — | BROKEN (params ignored; /notes dead) | FE-030 |
| INT-103 | /cases/:id/audit | `features/cases/audit/audit-event-card.tsx:229` | button (icon) | (no name) copy trace id | clipboard.writeText | — | none | check icon | WORKING-LIKELY | No aria-label |
| INT-104 | /cases/:id/audit | `features/cases/audit/audit-event-card.tsx:243` | Button (icon) | title "Inspect full audit record" | none (relies on card click bubbling) | — | none | drawer | WORKING-LIKELY | No own handler/aria-label |
| INT-105 | /cases/:id/audit | `features/cases/audit/audit-detail-drawer.tsx:97` | div onClick | (backdrop) | closeDrawer | — | none | — | WORKING-LIKELY | No Escape key |
| INT-106 | /cases/:id/audit | `features/cases/audit/audit-detail-drawer.tsx:114` | Button (icon) | (no name) close X | closeDrawer | — | none | — | WORKING-LIKELY | No aria-label (FE-038) |
| INT-107 | /cases/:id/audit | `features/cases/audit/audit-detail-drawer.tsx:226` | button (icon) | (no name) copy trace | handleCopy | — | none | check icon | WORKING-LIKELY | No aria-label; no type=button |
| INT-108 | /cases/:id/audit | `features/cases/audit/audit-detail-drawer.tsx:240` | Button | Close Inspection | closeDrawer | — | none | — | DUPLICATE | Same as X and backdrop |

### /cases/:id/graph

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-109 | /cases/:id/graph | `features/cases/case-graph-page.tsx:53` | effect | (load graph) | loadGraph | GET /cases/{id}/graph | none | "Loading Investigation Map..."; red banner on error | WORKING-LIKELY |  |
| INT-110 | /cases/:id/graph | `features/cases/case-graph-page.tsx:72` | Button asChild Link | Home | navigate /command-center | — | none | — | WORKING-LIKELY | Leaves the case |
| INT-111 | /cases/:id/graph | `features/cases/case-graph-page.tsx:102` | Button asChild Link | Case Overview | navigate /cases/:id | — | none | — | DUPLICATE | Also in left nav |
| INT-112 | /cases/:id/graph | `features/cases/case-graph-page.tsx:109` | Button | Hide Panel / Show Panel | setIsDrawerCollapsed | — | none | panel toggles | BROKEN (no effect while a node/edge is selected) | FE-032 |
| INT-113 | /cases/:id/graph | `features/cases/case-graph-page.tsx:120` | Button | Share | **none** | — | none | none | NO_HANDLER | FE-031 |
| INT-114 | /cases/:id/graph | `features/cases/case-graph-page.tsx:125` | Button (restricted) | Export (aria-label = "Supervisor clearance required…") | disabled | — | always disabled for every role | title text | PLACEHOLDER | Export exists on Reports (FE-031) |
| INT-115 | /cases/:id/graph | `features/cases/case-graph-page.tsx:165` | Link (case nav) | Case Overview | navigate /cases/:id | — | none | Investigation Map marked active | DUPLICATE | 5-item nav vs 9 in workspace (FE-042) |
| INT-116 | /cases/:id/graph | `features/cases/case-graph-page.tsx:165` | Link (case nav) | Investigation Map | navigate /cases/:id/graph | — | none | Investigation Map marked active | DUPLICATE | 5-item nav vs 9 in workspace (FE-042) |
| INT-117 | /cases/:id/graph | `features/cases/case-graph-page.tsx:165` | Link (case nav) | Evidence & Records | navigate /cases/:id/evidence | — | none | Investigation Map marked active | DUPLICATE | 5-item nav vs 9 in workspace (FE-042) |
| INT-118 | /cases/:id/graph | `features/cases/case-graph-page.tsx:165` | Link (case nav) | Event Timeline | navigate /cases/:id/timeline | — | none | Investigation Map marked active | DUPLICATE | 5-item nav vs 9 in workspace (FE-042) |
| INT-119 | /cases/:id/graph | `features/cases/case-graph-page.tsx:165` | Link (case nav) | Audit Trail | navigate /cases/:id/audit | — | none | Investigation Map marked active | DUPLICATE | 5-item nav vs 9 in workspace (FE-042) |
| INT-120 | /cases/:id/graph | `components/graph/engine/GraphEngine.ts:266` | canvas clickNode | (node) | selectNode | GET /entities/{id}?case_id | none | entity drawer; failure silent | WORKING-LIKELY | Error swallowed (graphStore.ts:172) |
| INT-121 | /cases/:id/graph | `components/graph/engine/GraphEngine.ts:273` | canvas clickEdge | (edge) | selectEdge | GET /cases/{id}/edge?source&target&rel_type | none | edge drawer; "Loading provenance…"; error text | WORKING-LIKELY |  |
| INT-122 | /cases/:id/graph | `components/graph/engine/GraphEngine.ts:280` | canvas clickStage | (background) | clearSelection | — | none | empty drawer | WORKING-LIKELY | Not keyboard reachable; graph has no keyboard alternative |
| INT-123 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:103` | Button (icon) | aria-label "Zoom in" | engine.zoomIn | — | none | camera | WORKING-LIKELY |  |
| INT-124 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:118` | Button (icon) | aria-label "Zoom out" | engine.zoomOut | — | none | camera | WORKING-LIKELY |  |
| INT-125 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:133` | Button (icon) | aria-label "Fit to Screen" | engine.resetCamera | — | none | camera | WORKING-LIKELY |  |
| INT-126 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:150` | Button | Organize / Organize Map / Pause | handleToggleLayout → organizeMap | — | none | camera refit; active state invisible | BROKEN (no layout on real ids; Pause restarts) | FE-006, FE-017 |
| INT-127 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:181` | Button | Filter / Filter Clues (aria-label "Toggle Filter Panel") | toggleFilterPanel | — | none | panel; active state invisible | WORKING-LIKELY | bg-teal-primary removes background (FE-017) |
| INT-128 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:222` | Button | Clue Types (n) (aria-label "Filter entities by type") | toggle dropdown | — | visible only ≥2xl (1536 px) | dropdown | DUPLICATE | Of EntityTypeFilter; no outside-click close |
| INT-129 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:260` | button ×6 | person / organization / location / event / financial / cyber (ON/OFF) | toggleEntityType | — | none | ON/OFF text | DUPLICATE | No aria-pressed; last type cannot be removed (silent) |
| INT-130 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:289` | input text | placeholder "Search clues..." | setSearchTerm | — | none | canvas dims/hides; autocomplete | WORKING-LIKELY | No label; width 56–96 px |
| INT-131 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:299` | button | (no name) × | setSearchTerm('') | — | none | — | WORKING-LIKELY | No aria-label |
| INT-132 | /cases/:id/graph | `components/graph/GraphToolbar.tsx:312` | button (per result) | masked node label + type | selectNode(id) on mousedown | GET /entities/{id} | none | drawer | WORKING-LIKELY | Keyboard can't reach results (blur closes) |
| INT-133 | /cases/:id/graph | `components/graph/filters/GraphFilterPanel.tsx:58` | Button (icon) | aria-label "Reset all filters" | resetFilters | — | none | — | WORKING-LIKELY |  |
| INT-134 | /cases/:id/graph | `components/graph/filters/GraphFilterPanel.tsx:68` | Button (icon) | aria-label "Close filter panel" | setFilterPanelOpen(false) | — | none | — | WORKING-LIKELY |  |
| INT-135 | /cases/:id/graph | `components/graph/filters/GraphFilterPanel.tsx:85` | label (cursor-pointer) | Conflicting Clues Only | **none** (htmlFor points at no input) | — | none | none | PLACEHOLDER | FE-034 |
| INT-136 | /cases/:id/graph | `components/graph/filters/EntityTypeFilter.tsx:35` | button | All | selectAllEntityTypes | — | none | checkboxes | WORKING-LIKELY | text-teal-primary undefined |
| INT-137 | /cases/:id/graph | `components/graph/filters/EntityTypeFilter.tsx:43` | button | Clear | clearEntityTypes → {PERSON} | — | none | checkboxes | BROKEN ("Clear" selects Person only) | FE-045 |
| INT-138 | /cases/:id/graph | `components/graph/filters/EntityTypeFilter.tsx:65` | Checkbox ×6 | aria-label "Filter by PERSON" … | toggleEntityType | — | none | canvas | WORKING-LIKELY | Unmapped kinds (VEHICLE …) have no checkbox and are always shown |
| INT-139 | /cases/:id/graph | `components/graph/filters/RelationshipTypeFilter.tsx:26` | button | All | selectAllRelationshipTypes | — | none | — | WORKING-LIKELY |  |
| INT-140 | /cases/:id/graph | `components/graph/filters/RelationshipTypeFilter.tsx:34` | button | Clear | clearRelationshipTypes → {CALLED} | — | none | — | BROKEN ("Clear" selects CALLED only) | FE-045 |
| INT-141 | /cases/:id/graph | `components/graph/filters/RelationshipTypeFilter.tsx:56` | Checkbox ×7 | aria-label "Filter by CALLED" … | toggleRelationshipType | — | none | canvas | WORKING-LIKELY | Filter-count badge misses 1 unchecked type |
| INT-142 | /cases/:id/graph | `components/graph/filters/ConfidenceRangeFilter.tsx:36` | input range | aria-label "Minimum algorithmic confidence threshold" | setMinConfidence | — | none | value text; edges passing | WORKING-LIKELY | "Nodes passing" fake (FE-046) |
| INT-143 | /cases/:id/graph | `components/graph/filters/ConfidenceRangeFilter.tsx:59` | button (preset) | All | setMinConfidence | — | none | selected style | WORKING-LIKELY | No aria-pressed |
| INT-144 | /cases/:id/graph | `components/graph/filters/ConfidenceRangeFilter.tsx:59` | button (preset) | ≥ 50% | setMinConfidence | — | none | selected style | WORKING-LIKELY | No aria-pressed |
| INT-145 | /cases/:id/graph | `components/graph/filters/ConfidenceRangeFilter.tsx:59` | button (preset) | ≥ 75% | setMinConfidence | — | none | selected style | WORKING-LIKELY | No aria-pressed |
| INT-146 | /cases/:id/graph | `components/graph/filters/ConfidenceRangeFilter.tsx:59` | button (preset) | ≥ 90% | setMinConfidence | — | none | selected style | WORKING-LIKELY | No aria-pressed |
| INT-147 | /cases/:id/graph | `components/graph/filters/DateRangeFilter.tsx:89` | input date | label "From" (associated) | setDateRange | — | none | edges-in-range count | WORKING-LIKELY | UTC vs browser-local parse of edge times |
| INT-148 | /cases/:id/graph | `components/graph/filters/DateRangeFilter.tsx:111` | input date | label "To" | setDateRange | — | none | count | WORKING-LIKELY | Same zone issue |
| INT-149 | /cases/:id/graph | `components/graph/filters/DateRangeFilter.tsx:129-150` | button (preset) | Full | handleFullExtent | — | none | only Full shows selected style | WORKING-LIKELY |  |
| INT-150 | /cases/:id/graph | `components/graph/filters/DateRangeFilter.tsx:129-150` | button (preset) | 1st Half | handleFirstHalf | — | none | only Full shows selected style | WORKING-LIKELY |  |
| INT-151 | /cases/:id/graph | `components/graph/filters/DateRangeFilter.tsx:129-150` | button (preset) | 2nd Half | handleSecondHalf | — | none | only Full shows selected style | WORKING-LIKELY |  |
| INT-152 | /cases/:id/graph | `components/graph/GraphLegend.tsx:11` | button | Map Legend (title "Expand Workstation Legend") | setCollapsed(false) | — | none | legend | WORKING-LIKELY | Legend content wrong (FE-007, FE-008) |
| INT-153 | /cases/:id/graph | `components/graph/GraphLegend.tsx:41` | button | aria-label "Collapse legend" | setCollapsed(true) | — | none | — | WORKING-LIKELY |  |
| INT-154 | /cases/:id/graph | `components/graph/TemporalSlider.tsx:66` | Button (icon) | aria-label "Reset to start" | setCurrentTimestamp(min) | — | none | edges hide | WORKING-LIKELY |  |
| INT-155 | /cases/:id/graph | `components/graph/TemporalSlider.tsx:81` | Button (icon) | aria-label "Step backward" | stepTemporal(-1) | — | none | — | WORKING-LIKELY |  |
| INT-156 | /cases/:id/graph | `components/graph/TemporalSlider.tsx:96` | Button | Play / Pause | togglePlay (150 ms interval) | — | none | label toggles | WORKING-LIKELY | Loops forever; no reduced-motion handling |
| INT-157 | /cases/:id/graph | `components/graph/TemporalSlider.tsx:122` | Button (icon) | aria-label "Step forward" | stepTemporal(1) | — | none | — | WORKING-LIKELY |  |
| INT-158 | /cases/:id/graph | `components/graph/TemporalSlider.tsx:143` | input range | aria-label "Temporal scrubber" | setCurrentTimestamp | — | none | timestamp readout | WORKING-LIKELY | step=0 when one timestamp (FE-058) |
| INT-159 | /cases/:id/graph | `components/graph/drawers/EntityDrawer.tsx:52` | button (icon) | (no name) close X | clearSelection | — | none | — | WORKING-LIKELY | No aria-label |
| INT-160 | /cases/:id/graph | `components/graph/drawers/EntityDrawer.tsx:63` | TabsTrigger | Profile | Radix tab | — | none | tab | WORKING-LIKELY |  |
| INT-161 | /cases/:id/graph | `components/graph/drawers/EntityDrawer.tsx:64` | TabsTrigger | Links (n) | Radix tab | — | none | tab | WORKING-LIKELY |  |
| INT-162 | /cases/:id/graph | `components/graph/drawers/EntityDrawer.tsx:77` | button | Show Attributes ▾ / Hide Attributes | setShowAdvanced | — | none | section | WORKING-LIKELY | No aria-expanded; duplicate chevrons |
| INT-163 | /cases/:id/graph | `components/intelligence/pii-field.tsx:57` | Button | Reveal identity | openRevealModal | (modal) POST /entities/{id}/reveal | none (canRequestReveal hard-coded true, EntityDrawer.tsx:136) | modal | BROKEN (revealed value never displayed afterwards) | FE-003, FE-024 |
| INT-164 | /cases/:id/graph | `components/intelligence/pii-field.tsx:67` | Button (restricted) | Reveal identity (restricted) | disabled | — | unreachable (canRequestReveal always true) | title | DEAD CODE |  |
| INT-165 | /cases/:id/graph | `components/intelligence/pii-field.tsx:78` | Button | Re-mask | onRevokeReveal | — | never passed by EntityDrawer | — | DEAD CODE | Unreachable (FE-003) |
| INT-166 | /cases/:id/graph | `components/graph/drawers/EntityDrawer.tsx:155` | button (per link) | rel-type badge + "Claims: n" | **none** | — | none | hover only | NO_HANDLER | FE-033 |
| INT-167 | /cases/:id/graph | `components/graph/drawers/EdgeDrawer.tsx:33` | button (icon) | (no name) close X | clearSelection | — | none | — | WORKING-LIKELY | No aria-label |
| INT-168 | /cases/:id/graph | `components/graph/drawers/EdgeDrawer.tsx:124` | Button (per claim) | Open source at {page/line/row/json_path} | openProvenanceForRecord(ev, locator) | GET /evidence/{id}/context?… | none | overlay | WORKING-LIKELY |  |

### Reveal identity modal (opened from graph entity drawer)

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-169 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:50` | Dialog onOpenChange | (Escape / overlay / X from DialogContent) | closeRevealModal | — | none | — | WORKING-LIKELY | Radix: focus trap OK |
| INT-170 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:245` | button (clearance tile) | Level 1: Observer | setOfficerClearance | — (not sent) | none | selected style; L1 shows warning | PLACEHOLDER | FE-011 |
| INT-171 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:245` | button (clearance tile) | Level 2: Investigator | setOfficerClearance | — (not sent) | none | selected style; L1 shows warning | PLACEHOLDER | FE-011 |
| INT-172 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:245` | button (clearance tile) | Level 3: Supervisor | setOfficerClearance | — (not sent) | none | selected style; L1 shows warning | PLACEHOLDER | FE-011 |
| INT-173 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:304` | button (preset) | + Case Evidence Corroboration | setJustification(preset) | — | none | textarea filled | WORKING-LIKELY | Canned reason text (cf. DEF-069 removal on HITL) |
| INT-174 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:304` | button (preset) | + Supervisor-Approved Subscriber Verification | setJustification(preset) | — | none | textarea filled | WORKING-LIKELY | Canned reason text (cf. DEF-069 removal on HITL) |
| INT-175 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:304` | button (preset) | + Financial Transaction Reconciliation | setJustification(preset) | — | none | textarea filled | WORKING-LIKELY | Canned reason text (cf. DEF-069 removal on HITL) |
| INT-176 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:304` | button (preset) | + Contradiction Resolution | setJustification(preset) | — | none | textarea filled | WORKING-LIKELY | Canned reason text (cf. DEF-069 removal on HITL) |
| INT-177 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:315` | textarea | label "Mandatory Legal Justification / Nexus (BNSS §91)" (associated) | setJustification | — | none | validation text | WORKING-LIKELY | Legal wording; no maxLength (server 500) |
| INT-178 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:328` | input checkbox | I confirm that this identity unmasking requisition… | setCertifiedAcknowledgment | — | none | validation | WORKING-LIKELY |  |
| INT-179 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:341` | Button | Cancel | closeRevealModal | — | none | — | WORKING-LIKELY |  |
| INT-180 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:350` | Button submit | Submit Requisition & Unmask | submitRevealRequest | POST /entities/{id}/reveal {case_id, reason} | none (server decides) | "Attesting Requisition..."; red denial box | WORKING-LIKELY | case_id taken from graphStore |
| INT-181 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:178` | Button | Revoke & Re-mask Field | closeRevealModal only | — | none | modal closes | PLACEHOLDER | Revokes nothing (FE-011) |
| INT-182 | Reveal identity modal | `components/intelligence/reveal-identity-modal.tsx:187` | Button | Continue Investigation | closeRevealModal | — | none | — | DUPLICATE | Same action as Revoke |

### /cases/:id/hitl and /hitl/:taskId

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-183 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-workspace-page.tsx:51` | effect | (load queue + stats) | loadTasks | GET /cases/{id}/candidates, GET /cases/{id}/stats | none | spinner; **error not rendered** | BROKEN (failure = "Queue Clear") | FE-002, FE-023 |
| INT-184 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-workspace-page.tsx:56` | effect | (load task) | loadTaskById | GET /candidates/{id} | none | none on error | BROKEN (error not rendered) | FE-002 |
| INT-185 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-workspace-page.tsx:117` | Button | Back to Queue | navigate /cases/:id/hitl | — | none | — | WORKING-LIKELY |  |
| INT-186 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-workspace-page.tsx:128` | Link>Button | Graph View | navigate /cases/:id/graph | — | none | — | DUPLICATE | a>button |
| INT-187 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-workspace-page.tsx:134` | Link>Button | Case Overview | navigate /cases/:id | — | none | — | DUPLICATE | Only way back into the case layout |
| INT-188 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-workspace-page.tsx:143` | Button (icon) | title "Refresh tasks" | loadTasks() | GET /cases/{id}/candidates, /stats | none | spin | WORKING-LIKELY | No aria-label |
| INT-189 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-queue-filters.tsx:28` | input text | placeholder "Search by Task ID, entity name, phone…" | onFilterChange → setFilter → loadTasks | GET /cases/{id}/candidates per keystroke | none | list flashes | WORKING-LIKELY | No label; no debounce (FE-052) |
| INT-190 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-queue-filters.tsx:36` | button (icon) | (no name) clear X | onFilterChange({searchQuery:''}) | GET …/candidates | none | — | WORKING-LIKELY | No aria-label/type |
| INT-191 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-queue-filters.tsx:51` | Button | Reset | resetFilter | GET …/candidates | none | — | WORKING-LIKELY |  |
| INT-192 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-queue-filters.tsx:70` | select | Status: (text, not label) All/Pending/Approved/Rejected/Escalated | onFilterChange({status}) | GET …/candidates | none | list | WORKING-LIKELY | "Escalated" = DEFER (FE-004) |
| INT-193 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-workspace-page.tsx:227` | Button | Reset Filters (empty state) | resetFilter | GET …/candidates | none | — | DUPLICATE |  |
| INT-194 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-task-card.tsx:17` | button (card) | task title + status + confidence | navigate /cases/:id/hitl/:taskId | — | none | two-pane view | WORKING-LIKELY |  |
| INT-195 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-decision-pane.tsx:118` | Button (choice) | Approve Merge | setSelectedAction | — | none (server: REVIEWER, INVESTIGATOR, ADMIN) | variant change | WORKING-LIKELY | No aria-pressed; no role gate (FE-024) |
| INT-196 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-decision-pane.tsx:127` | Button (choice) | Reject (Distinct) | setSelectedAction | — | none | variant change | WORKING-LIKELY |  |
| INT-197 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-decision-pane.tsx:136` | Button (choice) | Escalate to Supervisory Officer | setSelectedAction('ESCALATE') | (sends DEFER) | none | variant change | BROKEN (mislabelled: records DEFER) | FE-004 |
| INT-198 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-decision-pane.tsx:155` | textarea | label "Reason for this decision…" (not associated) | setJustification | — | none | char count; error ≥15 | WORKING-LIKELY | Label not linked; placeholder asks for "statutory justification" |
| INT-199 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-decision-pane.tsx:179` | Button | Record decision | handleSubmit → open dialog | — | none | dialog | WORKING-LIKELY |  |
| INT-200 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-decision-dialog.tsx:43` | button (icon) | (no name) close X | onClose | — | none | — | WORKING-LIKELY | No aria-label; custom modal without focus trap (FE-041) |
| INT-201 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-decision-dialog.tsx:84` | Button | Cancel | onClose | — | none | — | WORKING-LIKELY |  |
| INT-202 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-decision-dialog.tsx:93` | Button | Confirm & Sign Off | onConfirm → submitDecision | POST /candidates/{id}/decision {decision, reason} | none | "Signing & Recording..."; success closes; **failure silent** | BROKEN (no error feedback) | FE-005 |
| INT-203 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-evidence-pane.tsx:50` | effect | (load supporting evidence) | loadOne ×≤6 | GET /evidence/{id}, GET /evidence/{id}/context?line=1&window=10 | none | spinner; one failure fails all | WORKING-LIKELY | Promise.all: one 403 blanks the pane |
| INT-204 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-evidence-pane.tsx:94` | button role=tab | filename (per evidence) | setActive(i) | — | none | aria-selected | WORKING-LIKELY | No arrow-key handling / tabpanel |
| INT-205 | /cases/:id/hitl and /hitl/:taskId | `features/hitl/hitl-evidence-pane.tsx:108` | Button | Open source | openProvenanceForRecord(id) | GET /evidence/{id}/context | none | overlay | WORKING-LIKELY | Opens at line 1 |

### /cases/:id/reports (and /report)

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-206 | /cases/:id/reports | `features/reports/reports-page.tsx:102` | button ×2 | HTML / JSON (format) | setFormat | — | none | selected style | WORKING-LIKELY | No aria-pressed; label not associated |
| INT-207 | /cases/:id/reports | `features/reports/reports-page.tsx:119` | textarea | label "Analyst Comments (optional)" (not associated) | setAnalystComments | — | none | — | WORKING-LIKELY |  |
| INT-208 | /cases/:id/reports | `features/reports/reports-page.tsx:129` | Button | Download HTML / Download JSON | generateCaseReport → blob | POST /cases/{id}/report {analyst_comments, format} | none (server: INVESTIGATOR, REVIEWER, ANALYST, ADMIN) | "Generating…"; success/unauthorized/error boxes | WORKING-LIKELY | No role gate |
| INT-209 | /cases/:id/reports | `features/reports/reports-page.tsx:133` | Button | Integrity Dossier PDF | raw fetch → blob | POST /api/v1/cases/{id}/report/court-pdf (raw fetch) | none | shared status boxes | WORKING-LIKELY | Bypasses client (FE-026); no case nav/back link |

### /audit

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-210 | /audit | `features/audit/global-audit-page.tsx:37` | effect | (load) | listGlobalAuditLogs(500) | GET /audit?limit=500 | runs for every role (guard after hooks) | spinner; error | BROKEN (403 for non-auditors) | FE-021 |
| INT-211 | /audit | `features/audit/global-audit-page.tsx:77` | Button | Refresh | load | GET /audit?limit=500 | AUDITOR, ADMIN (page guard) | spin | WORKING-LIKELY |  |
| INT-212 | /audit | `features/audit/global-audit-page.tsx:87` | input text | placeholder "Search by action, actor, target, case…" | setSearch | — | none | count | WORKING-LIKELY | No label |
| INT-213 | /audit | `features/audit/global-audit-page.tsx:94` | select | All Actions | setActionFilter | — | none | count | WORKING-LIKELY | No label |
| INT-214 | /audit | `features/audit/global-audit-page.tsx:103` | Button | Clear | reset search+filter | — | none | — | WORKING-LIKELY |  |
| INT-215 | /audit | `features/audit/global-audit-page.tsx:125` | row (div) | (audit row) | **none** | — | none | hover style only | NO_HANDLER | Hover affordance but no detail view (case audit has a drawer) |

### /profile

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-216 | /profile | `features/profile/profile-page.tsx:199` | button role=switch | aria-label "Toggle PII masking" | setPiiMasked(!piiMasked) | — | none | switch + top bar says "PII REVEALED" | PLACEHOLDER | Changes nothing but a label (FE-009) |
| INT-217 | /profile | `features/profile/profile-page.tsx:224-253` | button (ActionCard) | Manage Profile | `() => {}` | — | none | hover + chevron | NO_HANDLER | FE-013 |
| INT-218 | /profile | `features/profile/profile-page.tsx:224-253` | button (ActionCard) | Change Password | `() => {}` | — | none | hover + chevron | NO_HANDLER | FE-013 |
| INT-219 | /profile | `features/profile/profile-page.tsx:224-253` | button (ActionCard) | Security & Sessions | `() => {}` | — | none | hover + chevron | NO_HANDLER | FE-013 |
| INT-220 | /profile | `features/profile/profile-page.tsx:224-253` | button (ActionCard) | Role & Permissions | `() => {}` | — | none | hover + chevron | NO_HANDLER | FE-013 |
| INT-221 | /profile | `features/profile/profile-page.tsx:234` | button (ActionCard) | Workstation Settings | navigate /settings | — | none | — | WORKING-LIKELY | Leads to placeholder page |
| INT-222 | /profile | `features/profile/profile-page.tsx:263` | button (ActionCard) | Sign Out | logout(); navigate('/login') | — | none | reload | DUPLICATE | Same as top-bar Lock |

### /settings

| ID | Page/route | file:line | Type | Visible label / aria-label | Handler | API (method + path) | UI role gate | Feedback | Static status | UX issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INT-223 | /settings | `features/settings/settings-page.tsx:72` | Button | Clear Local Cache | setResetMessage(fake) | — | none | fake success text 3 s | PLACEHOLDER | FE-012 |
