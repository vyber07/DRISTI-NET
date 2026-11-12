# ADR-019: Organisational user IDs are separate from the internal key, allocated by administrators, never reused

**Status:** Accepted. Tested:
- SQLite: full suite and 29 module tests;
- disposable PostgreSQL 16: 158 feature and migration tests, plus manual trigger probes;
- browser walkthrough: 12 of 12.

Not deployed. Details: `docs/USER_ID_ALLOCATION.md`.

## Problem

Administrators need to give each account the identifier the organisation already uses for that person (a service
or employee number). The system had only `users.user_id`, a generated `USR-<hex>` primary key. Seven foreign keys
reference it directly, and many more tables and signed audit rows hold it as a string. The profile page labelled
this key "User ID".

## Options considered

- **Let administrators edit `user_id`.** Rejected. Every foreign key and stored reference would need rewriting in one
  transaction, and signed audit rows cannot be rewritten without breaking their signatures. A reused key would
  silently attach old audit history to a new person.
- **Use `username` as the organisational ID.** Rejected. It is a login credential with its own format, and the two
  change for different reasons.
- **A separate `org_user_id` column plus an append-only allocation registry.** Chosen.

## Decision

- `users.user_id` stays the immutable internal key. `users.org_user_id` (nullable, unique) holds the current
  organisational ID and is what the UI calls "User ID".
- `org_user_ids` records every allocation: holder, allocator, time and reason, and when, by whom and why it ended.
  A partial unique index over ACTIVE and RETIRED rows means a retired ID can never be allocated again. A trigger
  permits only one change to a row: ending an ACTIVE allocation. So "never reused" holds even against direct SQL.
- **Correction exception:** an ID assigned in error may be VOIDED (freed) instead of retired, but only within a
  configurable window after allocation (default 24 hours). Without it a typo would permanently consume someone
  else's number. The window keeps it from becoming a general reuse path.
- **Concurrency:** every change names the ID the caller expects the user to hold (`current_org_user_id`, required).
  A conditional UPDATE and the unique indexes make concurrent changes fail with 409 rather than overwrite each other.
- **Authority:** only ADMIN (`manageUsers`, not overridable), never for their own account, always with a reason.
  History and lookup are oversight (`viewUserIdHistory`: ADMIN, AUDITOR; not overridable). Every change is audited
  in the same transaction.
- **Format:** normalised to upper case and validated against `DRISHTI_ORG_USER_ID_PATTERN`. The `USR-` prefix is
  reserved for internal keys.
- **Missing IDs:** an account without one is "not allocated"; nothing is generated automatically. Existing users are
  migrated as unallocated.

## Consequences

- Nothing that references `user_id` changes. The migration is additive.
- Audit rows still identify actors by `user_id` and username. Mapping to an organisational ID at a point in time goes
  through the registry.
- A single-administrator installation cannot give its own administrator an ID through the API. That is the cost of
  refusing self-changes.
- Downgrading the migration destroys the allocation history; export it first.
