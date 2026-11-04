# Frontend: known limitations (updated 2026-11-04, after commit `fa3e0bc`)

## Resolved since the first version of this list
| Was listed as | Now |
|---|---|
| 13 open audit defects | All resolved: 50 fixed, 4 removed, 5 partly fixed, 1 not a defect, 0 open (`FRONTEND_DEFECT_REGISTER.md`) |
| No screen to create cases or assign people | **New case** dialog on Cases (investigator/admin); **Add person** on the Overview (case owner/admin). The backend also now rejects blank case fields and dates new cases today instead of 2025-01-01. E2E-tested |
| Search ran in the browser over the full list | Cases, Evidence and the Review queue search, filter and page **on the server** (`?q=&status=/state=&limit=&offset=`, `X-Total-Count`); summaries give the filter counts. Backend-tested, including that a candidate search cannot probe masked phone/account numbers |
| The graph could not be used by keyboard or screen reader | The **List view** on the graph tab shows entities and relationships as accessible tables, using the same detail panel and sources. E2E-tested keyboard-only, from the list to the exact source line |
| Only Chromium tested; no manual accessibility audit | E2E **15/15 on Chromium, Firefox and WebKit**. Keyboard audit (tab order, visible focus, traps, skip link, landmarks, names, 320 px reflow, dialog focus): **0 issues** on 13 pages and 2 dialogs. axe: 0 violations |

## Still true
- **No screen-reader session with a person.** The accessibility tree, names and keyboard paths are checked automatically, but nobody has used the app with NVDA, JAWS or VoiceOver. This is not a WCAG conformance claim.
- **The keyboard audit checks the first 120 Tab stops per page.** Long pages (timeline, audit log, graph list) have more. The later stops reuse the same row components, but they were not individually checked.
- **The graph canvas itself is mouse/touch only.** The List view is the accessible equivalent. In browsers without WebGL, the List view is shown automatically.
- **No server-side sort on Cases.** Columns sort only when the results fit on one page; across pages, results come in case-number order.
- **People outside the case** (for example an auditor or admin in the audit log) still show as user IDs. Only case members are resolved to names.
- **No first decision on a contradictory claim.** The Decisions tab revises claims that already have a review; the Overview lists contradictions but has no decide button.
- **No unassign.** The backend has no endpoint to remove someone from a case.
- **The usability comparison is scripted.** No officers took part.
- **Five audit items are only partly fixed:** silent catches in optional enrichments, the audit card's clickable `<div>`, the custom audit drawer, decision reason minimum 10 in the UI vs 3 on the server, and some unused legacy code and packages (see the defect register).
- **About 80 explicit `any` types and 49 lint warnings remain** (117 at the start). They are code-quality debt, not failures.

## Deployment
- The **live site (port 80) runs the redesign**, deployed 2026-11-04 15:09 UTC.
- The one-off test deployment used to try the redesign before merging it is **stopped**; it never
  ran on port 8181 (that port was abandoned early — only 22/80/443 are reachable from outside this
  host — in favor of nip.io host-name routing on the already-open port 80).
- The live site itself was later migrated, same day, from SQLite/local storage to the full Docker
  Compose stack (PostgreSQL, Neo4j, MinIO, Redis, ClamAV); see
  `frontend-audit/FRONTEND_CONTINUATION_STATE.md`'s "Production migration" section for the
  verified details.
