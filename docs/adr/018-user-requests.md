# ADR-018: User request management with versioned transitions and append-only history

**Status:** Accepted. Tested:
- SQLite 486 passed;
- disposable PostgreSQL 16 488 passed, with the module's 33 tests repeated three times;
- migration upgrade, downgrade and upgrade on PostgreSQL;
- browser walkthrough 9 of 9.

Not deployed. Details: `docs/USER_REQUESTS.md`.

## Problem

Officers had no way to ask for what only an administrator can grant: access to a case, a different role, a temporary
permission, a data correction, or help. Requests happened outside the system, so there was no record of who asked,
who decided, why, or when. Nor was there any way to tell the officer the outcome.

## Options considered

- **Reuse permission overrides as the request.** Rejected: overrides are an administrator's instrument. They need a
  second administrator, and requests cover more than permissions.
- **A generic ticket table with free-form status.** Rejected: allowed transitions, required reasons and fulfilment are
  exactly the parts that must be enforced.
- **A typed request with a server-side state machine, category registry, version check and append-only history.**
  Chosen.

## Decision

- **Categories:** five, each with fields defined on the server (`services/user_requests.CATEGORIES`). The UI builds its
  form from them. Two categories apply automatically on completion:
  - case access, through the same rules as `POST /cases/{id}/assign`;
  - role change, never to ADMIN, and it bumps `token_version`.

  The other three are completed by hand, with a recorded note.
- **States:** DRAFT, PENDING, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED, CANCELLED. The transition table is in
  `TRANSITIONS`.
  - Approval (the decision) is separate from completion (the change being applied).
  - An approve or reject must come from the administrator who claimed the request.
  - Any administrator may release a claim, with a reason.
- **Authorization:**
  - Visibility: the requester, plus ADMIN and AUDITOR. Everyone else gets 404.
  - Only ADMIN reviews, and never their own request.
  - New actions: `createUserRequest` (overridable, so an administrator can DENY a user who abuses it);
    `viewAllUserRequests` and `reviewUserRequests` (mandatory).
- **Concurrency:** a `version` on every change, applied by a conditional UPDATE. Side effects run after the update, in
  the same transaction.
- **Duplicates:** a duplicate key per category, checked before insert and enforced by a unique partial index over
  open requests. At most 10 open requests per user.
- **History:** `user_request_events` (append-only, with triggers), plus signed audit events for every change and every
  refused attempt.
- **Notifications:** a new `notifications` table and a bell in the top bar, which replaces the removed placeholder.
  Notifications carry a reference and a status, never case data.
- **Errors:** stable codes through the ADR-017 error envelope (`RequestError` carries its own `code`).

## Reason

Every requirement maps to a server-side check with a test (`docs/USER_REQUESTS.md` §2). The UI never decides: it shows
the server's `allowed_actions` and explains the server's errors.

## Trade-offs

- **Temporary permissions are not applied automatically.** The override system's two-administrator rule is kept, at
  the cost of a manual step.
- **Notifications are polled** (every 60 s) rather than pushed; there is no e-mail.
- **Request IDs are sequential integers.** They can be enumerated, but every lookup is authorized and returns 404 for
  a request the caller may not see.

## Security implications

- No existence oracle for cases or requests.
- No self-review.
- ADMIN cannot be requested.
- A role change ends the user's sessions.
- Every refused action is audited.
- The history cannot be edited.
- Notifications are private to their recipient.

## Migration

`5bcde1234576` creates three empty tables, the partial index and the PostgreSQL triggers. Tested upgrade, downgrade
and upgrade on PostgreSQL 16.

## Rollback

Downgrade `5bcde1234576`; this drops the three tables and their data. Then revert the commit.
