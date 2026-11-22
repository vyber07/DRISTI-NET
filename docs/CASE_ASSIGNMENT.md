# Case assignment management

Status: **IMPLEMENTED — NOT DEPLOYED** (branch `worktree-auth-login-ratelimit`, 2026-11-12). Decision record: ADR-020.
Code: `apps/api/app/services/case_assignments.py`, `routes/case_routes.py`, migration `5bcde1234578`,
`apps/web/src/features/admin/case-assignments-page.tsx`. Tests: `apps/api/app/tests/test_case_assignments.py`.

## 1. Model

Access to a case is decided on **every request** by `auth.authorize_case`. The rules have not changed:
- ADMIN and AUDITOR see every case by role;
- anyone else must be the case's **primary investigator** (`cases.owner_id`) or have a row in `case_assignments`;
- jurisdiction must match, and a permission override on `caseAccess` may still deny (or, for a non-member, allow)
  access.

This module controls those two facts:

| Assignment | Stored as | Who | Notes |
| --- | --- | --- | --- |
| Primary investigator | `cases.owner_id` plus that person's own `case_assignments` row | Exactly one per case; must have the INVESTIGATOR role when set through a handover | Created as the person who opened the case. Cannot be removed, only handed over |
| Supporting member | `case_assignments` row | Investigators, evidence officers, reviewers, analysts | `purpose` describes the work (investigation, review, analysis, evidence handling) |

ADMIN and AUDITOR are **not assignable** (400 `ROLE_NOT_ASSIGNABLE`): they already see every case, so an assignment
would grant nothing and would only mislead.

Because authorization reads these rows on every request, a change takes effect on the person's **next request**. No
session or token keeps stale access. Removal is verified on `/cases/{id}`, `/cases/{id}/evidence`,
`/cases/{id}/graph`, the case list and `/auth/me`. Graph, masking and request checks read the same rows.

## 2. Operations and rules

| Operation | Who | Rules |
| --- | --- | --- |
| Assign (`POST /cases/{id}/assign`) | ADMIN, or the case's primary investigator (as before) | Reason 5–500 characters (422 `REASON_REQUIRED`). The person must be active (400 `USER_INACTIVE`), in an assignable role (400 `ROLE_NOT_ASSIGNABLE`) and in the case's jurisdiction (400 `JURISDICTION_MISMATCH`). Already on the case: 409 `ALREADY_ASSIGNED` |
| Remove (`POST /cases/{id}/assignments/{user}/remove`) | ADMIN only (`manageCaseAssignments`, not overridable) | Reason required. The primary investigator cannot be removed (409 `PRIMARY_CANNOT_BE_REMOVED`). Not on the case: 409 `NOT_ASSIGNED`. The response says whether an active ALLOW override still lets the person in (`access_remains_via_override`) |
| Hand over (`POST /cases/{id}/primary`) | ADMIN only | Reason required. `expected_primary_id` must match the current primary (409 `PRIMARY_CHANGED`). The new primary must be an active INVESTIGATOR in the case's jurisdiction. `previous: KEEP` leaves the old primary on the case as a supporting member; `REMOVE` takes them off it |
| Team and history (`GET /cases/{id}/assignments`) | ADMIN, AUDITOR (`viewCaseAssignments`) | Members with effective access, issues, and history (newest first). Audited |
| All cases (`GET /case-assignments`) | ADMIN, AUDITOR | Search (`q`, LIKE wildcards escaped), `jurisdiction`, `user_id`, `attention`, `unstaffed`, `limit` ≤ 200, `offset`; `X-Total-Count` |

Every change, in the same transaction:
- updates the row;
- writes a `case_assignment_events` row (append-only: ASSIGNED, REMOVED, PRIMARY_SET, PRIMARY_RELEASED, with actor,
  role, time, reason and detail);
- writes a signed audit event (`CASE_ASSIGN`, `CASE_UNASSIGN`, `CASE_PRIMARY_CHANGE`);
- sends an in-app notification to the person concerned. The notification names only the case reference, never case
  content.

Approved `CASE_ACCESS` user requests are applied through the same `assign` function, so they get the same checks,
history (`via: UR-…`), audit and notification.

### Concurrency

- Each change locks the case row (`SELECT … FOR UPDATE` on PostgreSQL).
- The decisive steps are single atomic statements, so they also hold on SQLite, where that lock does nothing:
  - the handover is `UPDATE cases SET owner_id = :new WHERE owner_id = :expected`, so only one of several concurrent
    handovers succeeds;
  - a removal is a single `DELETE` that refuses to delete whoever is the primary investigator at that moment;
  - duplicate assignments are stopped by the `(case_id, user_id)` unique constraint (409 `ALREADY_ASSIGNED`).
- Tested with 6 concurrent assignments, 4 concurrent handovers and 4 concurrent removals: in each, exactly one
  succeeds. Repeated 5 times on SQLite and 3 times on PostgreSQL.

### Indicators ("needs attention")

`GET /case-assignments` and the team view compute, from the same rules as `authorize_case`, whether each person can
actually open the case:
- per person: `OK`, `DEACTIVATED`, `JURISDICTION_MISMATCH`, `DENIED_BY_OVERRIDE` or `UNKNOWN_USER`;
- per case:
  - `NO_PRIMARY`;
  - `PRIMARY_<status>`, when the primary investigator cannot open the case;
  - `PRIMARY_NOT_INVESTIGATOR`, for example a case an ADMIN created;
  - `MEMBER_ACCESS_BLOCKED`;
  - `NO_SUPPORTING_MEMBERS`. This one is shown but does not count as "needs attention".

## 3. Offices and jurisdiction

Cases have no office field. The organisational boundary enforced for case access is **jurisdiction**, as before:
assignment refuses a person from another jurisdiction, and `authorize_case` refuses access if a person's jurisdiction
later changes. The indicator then shows `JURISDICTION_MISMATCH`. The user's verified office (`users.office_id`) is
recorded in every audit event. A per-office rule would need an office on the case, which does not exist yet; that is
listed under limitations.

## 4. UI

- **Case assignments** page (`/admin/case-assignments`; ADMIN and AUDITOR in the sidebar):
  - every case with its primary investigator, team size and issue badges;
  - search, "Needs attention" and "No supporting members" filters, and paging;
  - **Team** opens the team dialog: members with Primary/Supporting labels, access badges and who assigned them,
    when and why;
  - the dialog also has the change controls (reason, add, remove with confirmation, and hand over with a "keep
    previous" choice and confirmation) and the history;
  - auditors see the dialog without change controls;
  - `?case=CASE-…` opens a case directly.
- Case overview: "Manage team" link for ADMIN and AUDITOR. The **Add person** dialog now requires a reason and lists
  only eligible people. The primary investigator is labelled.

## 5. Deployment and rollback

- **Deploy:** run migration `5bcde1234578` after `5bcde1234572`–`5bcde1234577` from this branch.
  - It adds three nullable columns to `case_assignments` and the `case_assignment_events` table with its triggers.
  - It inserts the missing `case_assignments` row for any primary investigator who had none. Access does not change:
    owners already had access through `owner_id`.
  - Rows from before the migration show "Before history was kept".
  - SQLite demos upgrade on start.
- **API change for clients:** `POST /cases/{id}/assign` now requires `reason`, refuses ADMIN and AUDITOR targets, and
  returns 409 instead of 200 for someone already on the case. The bundled UI and tests are updated. Any external
  script that calls it must add `reason`.
- **Rollback:** reverting the code is safe, because older code ignores the new columns and table.
  `alembic downgrade 5bcde1234577` drops the history (export `case_assignment_events` first) but leaves the backfilled
  owner rows, which only restate existing access.

## 6. Verification (2026-11-12)

- `test_case_assignments.py`: 17 tests covering:
  - the history written at case creation;
  - assignment with reason, history, audit and notification; the primary investigator may still add people;
  - validation (reason, duplicate, ADMIN/AUDITOR targets, no person named), cross-jurisdiction and deactivated
    targets;
  - unassigned users refused on the case, evidence and graph endpoints;
  - removal with immediate loss of access on the case, evidence, graph, case list and `/auth/me` with the same token;
  - the primary investigator cannot be removed;
  - handover with KEEP and REMOVE (exact event sequence), and the handover rules (stale, wrong role, already
    primary, other jurisdiction, no reason, bad `previous`, unknown user);
  - a primary investigator, supporting member, non-member and auditor cannot remove or hand over (direct API
    bypass);
  - oversight views and indicators; wildcard-safe search; the three concurrency cases; append-only history.
- Existing tests that called `/assign` without a reason were updated. Full SQLite suite: 527 passed, 12 skipped.
- Disposable PostgreSQL 16: Alembic upgrade, model comparison and downgrade, plus the assignment, case, request,
  user-ID, cross-case, security, override and case-people tests: 182 passed. The one skip ("web build absent")
  is unrelated.
- Migration check on PostgreSQL with data from before the change: the missing owner row was backfilled and existing
  rows were unchanged. UPDATE, DELETE and TRUNCATE on the history were refused. Downgrade then upgrade was clean.
- Browser (real Chromium, isolated server, throwaway store): 21 of 21 checks passed
  (`scripts/reliability/verify_case_assignments_ui.mjs`).
- **Not run:** the Playwright e2e suite (`tests/e2e`; Python Playwright is not installed here).
  `test_create_case_and_assign_a_person` was updated to fill in the reason.

## 7. Known limitations and findings

- Not deployed; not checked against the live Compose stack.
- **Seed data finding:** 46 of the 48 seeded cases are in jurisdictions other than "Demo District A". Their primary
  investigator and members are all District A demo accounts, so only ADMIN and AUDITOR can open them. The new
  indicators flag them as `PRIMARY_JURISDICTION_MISMATCH` and `MEMBER_ACCESS_BLOCKED`. This was already the case
  before this change; it is now visible. Fixing it is a seed-data decision and was not changed here.
- No office-level restriction (cases have no office); jurisdiction is the boundary.
- Primary and supporting are the only assignment levels. There are no time-limited assignments; temporary access
  is handled by permission overrides.
- `GET /case-assignments` computes indicators for every matching case per request. That is fine for hundreds of
  cases, but it will need a cached or SQL-side computation at much larger scale.
- An ADMIN who creates a case is recorded as its primary investigator, as before, and the case is flagged
  `PRIMARY_NOT_INVESTIGATOR` until it is handed over.
