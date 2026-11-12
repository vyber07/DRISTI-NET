# ADR-020: Case assignment through one service: primary investigator handover, reasons, append-only history

**Status:** Accepted. Tested:
- SQLite: full suite 527 passed;
- disposable PostgreSQL 16: 182 passed, plus a migration check on data from before the change;
- browser walkthrough: 21 of 21.

Not deployed. Details: `docs/CASE_ASSIGNMENT.md`.

## Problem

A case's team could only grow. `POST /cases/{id}/assign` added people (primary investigator or ADMIN) and that was all:
- no removal, so access could only be withdrawn by an override or by deactivating the account;
- no handover of the primary investigator;
- no reason, and no history beyond the audit row;
- no cross-case view for administrators.

ADMIN and AUDITOR accounts could be "assigned", which granted nothing. Request fulfilment inserted assignment rows
directly, bypassing the endpoint's checks.

## Options considered

- **A separate assignment-role table** (PRIMARY/SUPPORTING rows, with `owner_id` derived from it). Rejected for now.
  `cases.owner_id` is already the primary investigator everywhere authorization looks: `authorize_case`, the case
  list, masking and request checks. Moving it would touch every access path.
- **Keep `owner_id` as the primary investigator, keep `case_assignments` as membership, and put every change behind
  one service with history.** Chosen.

## Decision

- `services/case_assignments.py` is the only writer of `case_assignments` and `cases.owner_id` after creation. That
  covers the assign route, request fulfilment, removal and handover.
- Primary investigator = `owner_id`, who always has a membership row (the migration backfills missing ones). It cannot
  be removed, only handed over. A handover is ADMIN-only, compare-and-set on the expected primary, and
  investigator-only. The previous primary either stays as a supporting member or is removed.
- Assign: ADMIN or the primary investigator. Remove and hand over: ADMIN. Both new actions are non-overridable
  (`manageCaseAssignments`; viewing is `viewCaseAssignments` for ADMIN and AUDITOR).
- Every change needs a reason and writes an append-only `case_assignment_events` row, a signed audit event and an
  in-app notification, in one transaction.
- Eligibility: active, an assignable role (not ADMIN or AUDITOR), and the case's jurisdiction. Jurisdiction stays the
  organisational boundary; cases have no office.
- Concurrency: a row lock, plus atomic conditional statements for handover and removal, so the guarantees also hold on
  SQLite.
- Effective-access indicators reuse `authorize_case`'s rules, so administrators see who actually cannot open a case
  and why.

## Consequences

- `POST /cases/{id}/assign` now requires `reason`, refuses ADMIN and AUDITOR targets, and returns 409 for an existing
  member (it used to return 200). Bundled clients and tests are updated.
- Access changes take effect on the person's next request; nothing has to be invalidated.
- The indicators exposed a seed-data problem that already existed: most demo cases are only openable by
  ADMIN and AUDITOR.
