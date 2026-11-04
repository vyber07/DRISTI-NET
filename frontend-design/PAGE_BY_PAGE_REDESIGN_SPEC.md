# Page-by-page redesign specification

Each existing page gets an explicit decision. The functionality is preserved unless the "Removed" line says otherwise, with a reason.
Statuses: **Redesign** (rebuilt on the shared layout), **Restyle** (same component, new header/states/copy), **Merge**, **Remove**.

| # | Page (old route) | Decision | Main changes |
|---|---|---|---|
| P1 | Login `/login` | Restyle | unchanged flow; labelled fields, error announced; returns to the page that was requested |
| P2 | Dashboard `/command-center` | Redesign → "Home" | assigned cases table with pending reviews; "Waiting for review" list linking straight to each queue; role-aware shortcuts. Removed: "SYSTEM ONLINE" (not derived from anything) |
| P3 | Case directory `/cases` | Redesign | sortable table (case, title, jurisdiction, evidence, pending reviews, opened) with search over the complete list the server returned (stated as such); row opens the case |
| P4 | Case overview `/cases/:id` | Redesign | facts (purpose, authority, jurisdiction, classification, opened); people **by name** (additive API field `people`); evidence by status; review counts; contradictions with entity, attribute and both values; recent decisions with reviewer names; integrity anchors. Removed: right "Case information" panel (duplicate), "Investigation Modules" buttons (duplicate of tabs), fabricated footer |
| P5 | Evidence `/cases/:id/evidence` | Redesign | table by default (cards removed: 2 per row hid most of the list); status filter + search; upload panel for permitted roles with a real file picker and the true outcome; **detail drawer**: summary, scan, jobs, integrity (copy SHA-256, Verify integrity → `GET /evidence/{id}/verify`), extracted claims (`GET /evidence/{id}/claims`) each opening its exact source line, Reprocess for held items. Download original uses the reason dialog |
| P6 | Source viewer (modal) | Restyle | accessible dialog (labelled, Escape closes, focus trapped); integrity line reads "SHA-256 matches the recorded value" / "does not match"; reveal uses a labelled reason field and is disabled with explanation for roles that may not reveal |
| P7 | Review queue `/hitl` | Redesign → `/review` | inside the case layout. Queue table: candidate pair, confidence, state, created. Detail: two records, signals, counter-evidence, conflicts, missing fields, cited source. Decision: Approve (same person) / Reject (different people) / **Defer (needs more information)** — the old "Escalate to Supervisory Officer" recorded `DEFER` while promising an escalation that does not exist. **Reverse decision** added (backend `REVERSE` existed; the UI said decisions were reversible but offered no way). Removed: "STAGE 4 VALIDATION", "CONFIDENTIAL // LEA SENSITIVE", "Pipeline Phase 4", hard-coded "HIGH" priority, "statutory" wording |
| P8 | Relationship graph `/graph` | Restyle within case layout | drawer anchored inside the graph area (it overlapped the global top bar); real counts; legend from the existing `GraphLegend`. Removed: emoji colour legend (duplicated), "Share" (no handler), "Export" (permanently disabled with an invented reason) |
| P9 | Timeline `/timeline` | Restyle | copy: "candidate events extracted from evidence"; hard-coded "verified … Jaipur, Mumbai, and Dubai" removed; entities shown by **label** (API already returns them) |
| P10 | Location map `/map` | Restyle → `/locations` | shared header and states; wording unchanged otherwise |
| P11 | Graph analysis `/analysis` | Restyle → "Patterns" | shared header; explanatory line that degree and bridge scores are review priorities, not findings |
| P12 | Decisions `/reviews` | Restyle → `/decisions` | table with reviewer **name**, decision, reason, time, superseded link |
| P13 | Case audit `/audit` (case) | Restyle | shared header; existing filter bar and cards kept (functionality verified by E2E) |
| P14 | Reports `/reports` | Redesign within case layout | two clear choices (case report HTML/JSON; integrity-reference PDF) with what each contains, who may generate, and that each export is audit-logged; disabled with explanation for roles the backend rejects |
| P15 | Global audit `/audit` | Restyle | shared header and states |
| P16 | Profile `/profile` | Restyle → "Account" | merged with Settings: identity, role, jurisdiction, assigned cases, what the role allows, sign out |
| P17 | Settings `/settings` | Remove → redirect `/profile` | its only control showed a fake "refreshed to factory defaults" message |
| P18 | Placeholder / notes | Remove → redirect | no backend for notes |
| P19 | Not found `*` | New | explicit page instead of a silent redirect to the dashboard |
| P20 | Case denied | New state | shows the server's reason (assignment, jurisdiction or purpose) and a link to Cases |
| P21 | Mobile (<768px) case pages | Redesign | content stacks; only the graph keeps a note that it works best on wider screens |

## Shared states (every data view)
| State | Treatment |
|---|---|
| Loading | skeleton rows or a short "Loading …" line in the content area; the header stays put |
| Empty | what is empty, why it may be empty, and the next action (e.g. "No evidence yet — upload a file") |
| Error | the server message and trace ID, plus a Retry button |
| Denied (403) | `DeniedState` with the server's reason; no partial data from a previous case |
| Masked | masked values stay masked; a reveal needs a role and a reason, and is audited |
