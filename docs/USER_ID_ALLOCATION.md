# Organisational user ID allocation

Status: **IMPLEMENTED — NOT DEPLOYED** (branch `worktree-auth-login-ratelimit`, 2026-11-12). Decision record: ADR-019.
Code: `apps/api/app/services/org_user_ids.py`, `routes/auth_routes.py` (bottom), migration `5bcde1234577`,
`apps/web/src/features/admin/user-management-page.tsx`. Tests: `apps/api/app/tests/test_org_user_ids.py`.

## 1. Two identifiers, on purpose

| | `users.user_id` | `users.org_user_id` |
| --- | --- | --- |
| What | Internal primary key, `USR-<12 hex>` | The organisation's identifier for the person (service or employee number) |
| Who sets it | Generated at creation | An administrator, at creation or later |
| Changes? | Never | Yes, through the controlled workflow below |
| Referenced by | Every foreign key, audit row, session, override, request, case assignment and URL | Nothing; display, search and lookup only |
| Shown as | "Internal reference" on the profile page | "User ID" everywhere a person is identified |

Before this change the only identifier was `user_id`. The profile page labelled that random key "User ID", and
there was no way to record an organisational number. Making `user_id` editable would have meant rewriting every
foreign key and every signed audit row, so it stays immutable. The organisational ID is a separate column.

## 2. Rules

| Rule | Enforced by |
| --- | --- |
| Format: trimmed and upper-cased; 3–32 characters; must match `DRISHTI_ORG_USER_ID_PATTERN` (default `^[A-Z0-9](?:-?[A-Z0-9]){2,31}$`: letters, digits, single inner hyphens) | `org_user_ids.normalize` (422 `ORG_USER_ID_INVALID`) |
| The `USR-` prefix is refused, so an organisational ID can never be mistaken for an internal key | `normalize` (422 `ORG_USER_ID_RESERVED`) |
| Case-insensitive uniqueness: `dl-0042` and `DL-0042` are the same ID | Stored upper-cased; unique `users.org_user_id` |
| One holder at a time; at most one ACTIVE allocation per user | `uq_users_org_user_id`; partial unique index `uix_org_user_ids_active_user` |
| **Never reused.** A replaced or retired ID is RETIRED for good, for every account including its former holder | Partial unique index `uix_org_user_ids_taken (org_user_id) WHERE status IN ('ACTIVE','RETIRED')` |
| The allocation history cannot be rewritten or deleted | Trigger `org_user_ids_guard` (PostgreSQL: UPDATE, DELETE, TRUNCATE; SQLite: UPDATE, DELETE). The only permitted UPDATE ends an ACTIVE row (→ RETIRED or VOIDED) with `ended_by`, `ended_at` and `end_reason` set and every allocation column unchanged |
| Only ADMIN allocates, changes or retires (`manageUsers`, not overridable) | `require_roles("ADMIN", action="manageUsers")`; others get 403, audited `ACCESS_DENIED` |
| No administrator changes their own ID | 403 `SELF_CHANGE_FORBIDDEN`. Another administrator must do it |
| Every change has a reason (5–500 characters) | 422 `REASON_REQUIRED` |
| Compare-and-set: the caller states the ID they expect the user to hold now (`current_org_user_id`, `null` = none). Required field | Conditional `UPDATE users … WHERE org_user_id = :expected` (409 `ORG_USER_ID_STALE`) |
| Not changeable through `PATCH /users/{id}` | `UserUpdateIn` refuses unknown fields (422) |
| Every change is audited in the same transaction (fail-closed) | `USER_ID_ASSIGN`, `USER_ID_CHANGE`, `USER_ID_CORRECT`, `USER_ID_RETIRE`, and `USER_CREATE` carries `org_user_id` |

### Missing, duplicate, invalid and conflicting IDs

| Situation | Behaviour |
| --- | --- |
| No ID given at creation | The account is created with `org_user_id = null`. The UI shows "Not allocated"; allocate later |
| Existing users after migration | `null`; nothing is invented. Demo accounts get fictional `DDA-…`/`DDB-…` IDs only when the seed creates them |
| Invalid or reserved format | 422. At creation the whole account creation is rolled back |
| ID held by another account | 409 `ORG_USER_ID_IN_USE` |
| ID held before (retired) | 409 `ORG_USER_ID_RETIRED`, even for its former holder |
| Same ID as the current one | 409 `ORG_USER_ID_UNCHANGED` (never a fake success) |
| Someone changed the user's ID since the caller loaded it | 409 `ORG_USER_ID_STALE` |
| Two administrators allocate at the same instant | One succeeds; the other gets 409 `ORG_USER_ID_STALE` or `ORG_USER_ID_CONFLICT` (unique index at flush) |
| `users.org_user_id` and the registry disagree (only possible through direct SQL on `users`) | 409 `ORG_USER_ID_REGISTRY_MISMATCH`; nothing is changed |

### Corrections (an ID assigned in error)

A typo would otherwise burn an ID that belongs to someone else, because retired IDs are never reused. A
**correction** (`correction: true`) replaces the current ID and marks the old one **VOIDED** instead of RETIRED.
A voided ID may be allocated again, typically to its rightful holder. Corrections are allowed only:
- when the account has a current ID;
- within `DRISHTI_ORG_USER_ID_CORRECTION_HOURS` (default 24) of that ID's allocation (422 `CORRECTION_WINDOW_PASSED`);
- when the setting is above 0 (`0` turns corrections off: 422 `CORRECTION_DISABLED`).

The voided allocation stays in the registry with its times, so `GET /org-user-ids/{id}` still shows who held it,
and when.

## 3. API

| Method | Path | Who | Body / result |
| --- | --- | --- | --- |
| `POST` | `/users` | ADMIN | Optional `org_user_id`. 422/409 as above roll the creation back |
| `PUT` | `/users/{user_id}/org-user-id` | ADMIN, not for themselves | `{org_user_id, current_org_user_id, reason, correction?}` → `{user_id, org_user_id, previous_org_user_id, previous_status, user}` |
| `POST` | `/users/{user_id}/org-user-id/retire` | ADMIN, not for themselves | `{current_org_user_id, reason}`; the account has no ID afterwards |
| `GET` | `/users/{user_id}/org-user-id/history` | ADMIN, AUDITOR (`viewUserIdHistory`, mandatory) | Every allocation, newest first, with allocator, ender, times and reasons. Audited (`USER_ID_HISTORY_VIEW`) |
| `GET` | `/org-user-ids/{org_user_id}` | ADMIN, AUDITOR | Who holds or held this ID, and when. Audited (`USER_ID_LOOKUP`) |

`org_user_id` is also returned by `/auth/login`, `/auth/me`, `/users`, the `people` of `/cases/{id}`, and the
requester/reviewer of user requests.

## 4. Data

- `users.org_user_id` VARCHAR NULL, unique (`uq_users_org_user_id`). It mirrors the ACTIVE registry row, and both
  are written in one transaction.
- `org_user_ids` (registry): `assignment_id` (PK), `org_user_id`, `user_id` (FK `users`), `status`
  (`ACTIVE`/`RETIRED`/`VOIDED`), `assigned_by`, `assigned_at`, `assign_reason`, `ended_by`, `ended_at`, `end_reason`.
  `assigned_by` is a `user_id`, or `SEED` for demo seeding. Times are UTC.

Audit rows keep identifying actors by internal `user_id` and `actor_username`; they do not snapshot the
organisational ID (the signed row format is unchanged). To resolve "which organisational ID did this actor hold at
time T", use the registry's `assigned_at`/`ended_at`.

## 5. UI

- **Users** page: a "User ID" column ("Not allocated" when empty) and an optional "User ID" field in Create user.
- A per-row **User ID** dialog to allocate, change, correct (checkbox) or retire (confirmation) an ID, with the
  allocation history. For the administrator's own row the form is withheld and the dialog explains why.
- Profile page: "User ID" (organisational) and "Internal reference" (`USR-…`), shown separately.
- Case people and request detail show the organisational ID next to the name when there is one.

## 6. Deployment and rollback

- **Deploy:** run migration `5bcde1234577` (after `5bcde1234572`–`5bcde1234576` from the same branch):
  `python3 -m apps.api.app.migrations`. Existing rows are untouched; every user starts unallocated. SQLite demos
  upgrade on start: the column and a unique index are added, and the triggers are installed.
- **Config (optional):** `DRISHTI_ORG_USER_ID_PATTERN` (the organisation's format, applied to the upper-cased
  value) and `DRISHTI_ORG_USER_ID_CORRECTION_HOURS` (default 24; 0 disables corrections). The pattern is compiled at
  start-up, so an invalid pattern stops the API from starting instead of failing later.
- **Rollback:** `alembic downgrade 5bcde1234576` drops the registry and the column, **destroying the allocation
  history**. Export it first (`COPY org_user_ids TO …`). Reverting the code alone is safe: older code ignores
  the extra column and table.

## 7. Verification (2026-11-12)

- `test_org_user_ids.py`: 29 tests covering:
  - allocation at creation and later; normalisation; 12 invalid inputs, including rollback of the creation;
  - case-insensitive duplicates; no reuse of changed or retired IDs (also for the former holder);
  - correction (voiding and reallocation) and its three limits; stale compare-and-set and the required field;
  - 8 concurrent assignments to one user and 6 concurrent assignments of one ID (exactly one wins);
  - non-admin, auditor and self-change refusals; PATCH bypass refused;
  - history and lookup access; four direct-SQL tampering attempts refused;
  - internal key, case assignment and login unchanged after a change; seeded demo IDs; denied attempts audited.
- Full SQLite suite: 510 passed, 12 skipped (one existing test updated: case `people` now include `org_user_id`).
- Disposable PostgreSQL 16: the feature, user, case, request, override and audit tests plus the Alembic test
  (fresh-database upgrade, model comparison, downgrade): 158 passed. The migration's triggers were also probed by hand
  with direct SQL: a duplicate, a second ACTIVE row, a rewrite, ending without who/when/why, RETIRED→VOIDED, reuse,
  DELETE and TRUNCATE were all refused. A valid ACTIVE→RETIRED was accepted.
- SQLite in-place upgrade on a copy of the old demo database: the column and unique index were added, 8 of 8 users
  were unallocated, and a duplicate was refused.
- Browser (real Chromium against an isolated server on a throwaway store): 12 of 12 checks passed
  (`scripts/reliability/verify_org_user_ids_ui.mjs`).

## 8. Known limitations

- Not deployed; not checked against the live Compose stack.
- `scripts/migrate_sqlite_to_postgres.py` copies only the original tables, as it already did before this change. It
  does not copy `org_user_ids` or the other newer tables.
- No bulk import of IDs (for example, from a personnel file); allocation is one account at a time.
- With a single administrator, that administrator cannot be given an ID through the API (self-change is refused).
  A second administrator is needed. Demo seeding allocates one at creation.
- The default format is generic. The organisation's real numbering rule should be set through
  `DRISHTI_ORG_USER_ID_PATTERN` once known.
