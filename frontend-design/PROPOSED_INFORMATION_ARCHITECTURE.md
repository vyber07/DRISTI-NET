# Proposed information architecture

Status: **design, being implemented in this pass** (see `FRONTEND_IMPLEMENTATION_REPORT.md` for what was actually built and tested).
Inputs: the route list in `apps/web/src/app/router/router.tsx`, the case tab logic in
`features/cases/case-workspace-page.tsx`, the role checks in `apps/api/app/routes/*.py`, the "before" screenshots in
`frontend-audit/screenshots/before/`, and docs/context.md §5 (users) and §6 (workflow).

## 1. Current architecture (as found)

```
/login
/  → /command-center            "Dashboard"           (sidebar)
/cases                          "Case Directory"      (sidebar)
/cases/:id  /cases/:id/overview  ─┐
/cases/:id/evidence               │  CaseWorkspacePage: 3-pane shell, 9-item left rail,
/cases/:id/timeline               │  right "Case information" panel (repeats Overview),
/cases/:id/map                    │  fabricated footer ("PII Masking: Strict", "Secure Integration")
/cases/:id/analysis               │
/cases/:id/reviews                │
/cases/:id/audit                  │
/cases/:id/notes   → "Feature currently unavailable" placeholder
/cases/:id/graph                  CaseGraphPage: own header, own 5-item rail, drawer overlaps the global top bar
/cases/:id/hitl[/:taskId]         HITLWorkspacePage: leaves the case layout entirely
/cases/:id/report /reports        ReportsPage: leaves the case layout, no way back to the case
/audit                            Global audit (AUDITOR, ADMIN) (sidebar, role-filtered)
/profile, /settings               reachable only from the avatar / direct URL; Settings has no real function
*  → /command-center              silent redirect, the officer never learns the address was wrong
```

Problems this structure causes (evidence: screenshots and code):
1. **Four layouts for one case.** Graph, review and reports pages each drop or replace the case navigation, so
   an officer loses their place and must use the browser back button or "Home".
2. **Duplicate destinations.** The left rail, the "Investigation Modules" buttons, the header "Investigation Map" button,
   and the dashboard "Graph" buttons all lead to the same places.
3. **Unclear names.** "Investigation Map" is the relationship graph. "Location Map" is the map. "Graph Analysis" is
   pattern analysis. "Analyst Review" is the review queue. "Decisions" is the decision history.
4. **Hidden pages.** Review queue for a case is reachable only from the rail. "Settings" appears nowhere in navigation.
5. **No breadcrumb, no "where am I" for the case.** The header says "Home", even on case pages.

## 2. Proposed architecture

Global navigation (left sidebar, collapsible; drawer on small screens):

| Item | Route | Who sees it | Purpose |
|---|---|---|---|
| Home | `/command-center` (kept; `/home` redirects) | everyone | assigned cases, work waiting for me, quick links |
| Cases | `/cases` | everyone | searchable list of the cases this account may open |
| Audit log | `/audit` | AUDITOR, ADMIN | cross-case audit events |
| Account (bottom) | `/profile` | everyone | who I am, my role and what it allows, sign out |

Case workspace: **one layout** (`/cases/:caseId/*`) with a breadcrumb, the case title and key facts, and one row of tabs:

| Tab (new name) | Route | Old name / route | Shown to |
|---|---|---|---|
| Overview | `/cases/:id` (index) | Case Overview, `/overview` | all case members |
| Evidence | `/cases/:id/evidence` | Evidence & Records | all |
| Review queue (count badge) | `/cases/:id/review[/:candidateId]` | Analyst Review, `/hitl[/:taskId]` | all; deciding needs REVIEWER/INVESTIGATOR/ADMIN |
| Relationship graph | `/cases/:id/graph` | Investigation Map | all |
| Timeline | `/cases/:id/timeline` | Event Timeline | all |
| Locations | `/cases/:id/locations` | Location Map, `/map` | all |
| Patterns | `/cases/:id/analysis` | Graph Analysis | all |
| Decisions | `/cases/:id/decisions` | Decisions, `/reviews` | all |
| Reports | `/cases/:id/reports` | Export Reports, `/report` | all; generating needs INVESTIGATOR/REVIEWER/ANALYST/ADMIN |
| Audit log | `/cases/:id/audit` | Audit Trail | all case members (backend authorizes) |

Removed or merged:
- Right "Case information" panel: merged into Overview (it repeated the same fields on every tab).
- "Investigation Modules" button row and the header "Investigation Map" button: replaced by the tab row.
- `/cases/:id/notes`: no backend exists (docs/FRONTEND_API_MAP.md "Notes: no backend support"); redirects to Overview.
- `/settings`: its only button faked a success message; the account facts it showed move to `/profile`; `/settings` redirects there.
- Notification bell: had no handler and no backend; removed.
- Graph "Share" (no handler) and "Export" (permanently disabled with an invented "supervisor clearance" reason): removed;
  exporting is on the Reports tab.

## 3. Redirects (bookmarks and existing links keep working)

| Old | New |
|---|---|
| `/` | `/command-center` |
| `/home` | `/command-center` |
| `/cases/:id/overview` | `/cases/:id` |
| `/cases/:id/hitl` | `/cases/:id/review` |
| `/cases/:id/hitl/:taskId` | `/cases/:id/review/:taskId` |
| `/cases/:id/map` | `/cases/:id/locations` |
| `/cases/:id/reviews` | `/cases/:id/decisions` |
| `/cases/:id/report` | `/cases/:id/reports` |
| `/cases/:id/notes` | `/cases/:id` |
| `/settings` | `/profile` |
| anything else | "Page not found" page with links to Home and Cases (no silent redirect) |

## 4. Role access (UI shows; backend decides)

The UI hides or disables an action only as a convenience. Every action is still authorized server-side.
A disabled control always says why (for example "Your role (Analyst) cannot record review decisions").

| Capability | Backend rule (route) | UI |
|---|---|---|
| Open a case | assignment + jurisdiction (`authorize_case`); ADMIN/AUDITOR all | denied page with the server's reason |
| Upload evidence / reprocess | EVIDENCE_OFFICER, INVESTIGATOR, ADMIN | upload panel shown only to these roles |
| Download original (unmasked) | INVESTIGATOR, REVIEWER, ADMIN + reason (DEF-101) | reason dialog; disabled with explanation otherwise |
| Reveal masked context / entity | INVESTIGATOR, REVIEWER, ADMIN + reason | reason field; disabled with explanation otherwise |
| Record / reverse a review decision | REVIEWER, INVESTIGATOR, ADMIN | decision panel; read-only notice for others |
| Review statistics | REVIEWER, INVESTIGATOR, ADMIN | counts fall back to the case's pending count for other roles (no failing call) |
| Integrity anchor create | INVESTIGATOR, REVIEWER, ANALYST, ADMIN; list adds AUDITOR | button shown to creators only |
| Reports and integrity dossier PDF | INVESTIGATOR, REVIEWER, ANALYST, ADMIN | buttons disabled with explanation otherwise |
| Global audit log | AUDITOR, ADMIN | sidebar item shown to these roles only |
| Create case | INVESTIGATOR, ADMIN | not in this pass (see Known limitations) |

## 5. Rationale

- Officers think in **cases**. Everything about a case is one click away from anywhere in that case, and the case
  is always named at the top.
- **Tabs, not a narrow side rail.** Ten short labels fit in one row at 1280px and give the content about 150px more width.
  They scroll horizontally on tablets and phones instead of being hidden.
- **Names say what the page shows**: "Relationship graph", not "Investigation Map".
- **Counts lead to work.** The review-queue count is on the tab and on Home, so pending work is visible without opening the queue.
