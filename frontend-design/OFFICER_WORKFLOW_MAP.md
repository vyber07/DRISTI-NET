# Officer workflow map

The roles are the ones the backend implements (`apps/api/app/seed.py`, `require_roles` in `routes/*.py`). The demo users are
fictional: investigator, officer (EVIDENCE_OFFICER), reviewer, analyst, auditor, admin, outsider (other district), and
unassigned (not on CASE-0001). The constitution's user table (docs/context.md §5) matches these roles. There is no separate
"supervisor" role, and the old "Escalate to Supervisory Officer" button actually recorded `DEFER` (see FE defect register).

Click counts are from the signed-in Home page, measured by the scripted runs in `FRONTEND_USABILITY_COMPARISON.md`.

## Investigator (INVESTIGATOR)
1. Sign in → Home lists assigned cases with evidence and pending-review counts.
2. Open a case → Overview: purpose, authority reference, people (names), evidence by status, open reviews, contradictions.
3. Evidence tab → find a file (search or status filter) → open its detail drawer: status, scan result, processing jobs,
   SHA-256, Verify integrity, extracted claims → "Open source" at the exact line.
4. Relationship graph → click an edge → the claims behind it → open the exact source line.
5. Timeline → filter by date or text → "Source" on an event opens the cited evidence line.
6. Review queue → decide (approve, reject or defer, with a reason) or reverse an earlier decision.
7. Reports → HTML/JSON report or the integrity-reference PDF, each audit-logged.

## Evidence officer (EVIDENCE_OFFICER)
Upload on the Evidence tab → the result states the real outcome (accepted, held by the scan gate, rejected), with
the server's reason → watch the status column → reprocess an item held by a scanner failure. May view, but not
download originals, decide reviews or export reports. Those controls say so instead of failing.

## Reviewer (REVIEWER)
Home shows "Waiting for review" per case → Review queue → candidate detail: both records side by side, supporting
signals, counter-evidence, conflicts, missing fields, and the cited source → decision with a reason → confirmation → the
queue updates. Decided items can be reversed with a reason, and the reversal is recorded as a new review.

## Analyst (ANALYST)
Graph, Timeline, Locations, Patterns (bridge candidates, communities, degree), Reports, and integrity anchors. Decision
controls are read-only with an explanation.

## Auditor (AUDITOR)
Sidebar "Audit log" (all cases) → filter by action, actor and outcome → event detail with HMAC verification status. Inside a case:
Overview and the Audit log tab. Review statistics are not called for this role (the old UI fired a 403 on every case open).

## Administrator (ADMIN)
Everything above, plus the global audit log. User administration has no backend beyond `GET /users`. Not built here.

## Shared failure paths (docs/context.md §6.1)
- Not assigned to a case, or a different jurisdiction → a denied page with the server's reason and a link back to Cases.
- Evidence still quarantined or infected → the source viewer and download explain that the scan gate blocks them (409).
- Session expired → redirected to sign-in, returning to the same page afterwards.
