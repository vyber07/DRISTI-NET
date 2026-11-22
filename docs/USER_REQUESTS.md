# User request management

**Status (2026-11-12):** on branch `worktree-auth-login-ratelimit`. Tested on SQLite and on disposable PostgreSQL 16;
browser walkthrough 9 of 9. **Not deployed.** Needs migration `5bcde1234576` on the live database. Decision record:
`docs/adr/018-user-requests.md`.

Code:
- service: `apps/api/app/services/user_requests.py`
- routes: `routes/user_request_routes.py`, `routes/notification_routes.py`
- web: `apps/web/src/features/requests/`, `components/layout/notifications-bell.tsx`
- tests: `apps/api/app/tests/test_user_requests.py` (33), `scripts/reliability/verify_user_requests_ui.py` (browser)

## 1. What existed before (inspected 2026-11-12)

There was no general request workflow. The nearest pieces:
- **Case assignment:** `POST /cases/{id}/assign` (owner or ADMIN) and role changes (`PATCH /users/{id}`, ADMIN) had no
  way for the affected officer to ask for them.
- **Permission overrides** (ADR-015) have a PENDING → ACTIVE approval by a second administrator, with append-only
  history. This module copies that pattern.
- **Review decisions** on match candidates are evidence decisions, not user requests.
- **No notifications:** a notification bell had been removed from the top bar because it had no backend.

## 2. Requirements and where they are met

| ID | Requirement | Implementation | Verified by |
|---|---|---|---|
| UR-1 | Create, save as draft, edit a draft, submit | `POST /user-requests` (`submit` true/false), `PATCH` (DRAFT only), `/submit` | `test_full_lifecycle…`, browser step 1 |
| UR-2 | View, filter, search, page, track status | `GET /user-requests` (scope, status list, category, priority, requester, claimed-by-me, date range, `q`, sort, limit ≤ 100, offset, `X-Total-Count`); `/summary`; detail with history | `test_paging_search_and_filters` |
| UR-3 | Categories with required fields | 5 categories, server-defined fields (§3), `GET /user-requests/categories` drives the form | `test_categories…`, `test_category_fields_are_validated` |
| UR-4 | Pending, under review, approved, rejected, completed states | §4 state machine, plus DRAFT and CANCELLED | `test_invalid_transitions` |
| UR-5 | Administrator review and decision controls | claim, release, approve, reject, complete (ADMIN); detail page buttons from `allowed_actions`; review checks | `test_unauthorized_decisions…`, browser step 3 |
| UR-6 | Reviewer identity, reason, timestamps, history | `reviewer_id`, `decision_reason`, `decided_at`, `completed_by/at`, `completion_note`; `user_request_events` (append-only); signed audit events | `test_full_lifecycle…`, `test_request_history_is_append_only` |
| UR-7 | No unauthorized viewing or changes | requester / ADMIN / AUDITOR visibility (404 otherwise); requester-only and reviewer-only actions; no self-review; claimer decides | `test_user_isolation`, `test_unauthorized_decisions…`, `test_administrator_cannot_review_own_request`, `test_requester_only_actions` |
| UR-8 | Notifications | `notifications` table, bell with unread count, list, mark read | `test_notifications…`, browser steps 3–4 |
| UR-9 | Validation and error handling | per-field 422 with location; stable codes (§6); one error envelope with request ID | `test_common_fields…`, `test_category_fields…` |
| UR-10 | Integration with roles and permissions | actions `createUserRequest` (overridable), `viewAllUserRequests`, `reviewUserRequests` (mandatory); `/auth/me/permissions`; fulfilment reuses case assignment and role rules | `test_a_deny_override…`, `test_effective_permissions…` |
| UR-11 | Duplicates prevented | one open request per requester and duplicate key; unique partial index for races; at most 10 open requests | `test_duplicate_requests…`, `test_concurrent_duplicate_creates…`, `test_open_request_limit`, `test_editing_a_draft_into_a_duplicate…` |
| UR-12 | Concurrent updates safe | `version` on every change; conditional UPDATE; 409 `VERSION_CONFLICT` | `test_stale_version…`, `test_concurrent_claims…`, `test_cancel_racing_a_decision…`, browser step 6 |

## 3. Categories and fields

All requests have: `title` (5–120 characters), `justification` (20–2000 characters), and `priority` (`LOW`, `NORMAL`,
`HIGH` or `URGENT`). The category's own fields go in `details`; unknown fields are refused.

| Category | Fields | Duplicate key (per requester) | On completion |
|---|---|---|---|
| `CASE_ACCESS`: access to a case | `case_id`* (normalised to upper case), `purpose`* (investigation, review, analysis, oversight) | the case | **Automatic:** assignment created. The case must exist, and the requester must be active and in the case's jurisdiction. Otherwise 409 `FULFILMENT_FAILED` and the request stays APPROVED. |
| `ROLE_CHANGE`: change of role | `requested_role`* (any role except ADMIN, and not the current role) | one at a time | **Automatic:** role changed, `token_version` bumped (the user signs in again). |
| `TEMPORARY_PERMISSION` | `action`* (an overridable action), `case_id`, `duration_days`* (1–90) | action + case | **Manual:** the administrator creates the permission override (which needs a second administrator) and records its ID. |
| `DATA_CORRECTION` | `case_id`* (a case the requester can open), `item_reference` | normalised title | **Manual:** note required. |
| `SUPPORT` | none | normalised title | **Manual:** note required. |

\* required.

**Privacy of case existence:** a case-access request for a case the requester cannot see is accepted without saying
whether the case exists. Only the reviewer's "Review checks" show that. A data correction for a case that does not
exist and one for a case the user may not open get the same 422.

## 4. States and transitions

| Action | From | To | Who | Reason |
|---|---|---|---|---|
| edit | DRAFT | DRAFT | requester | n/a |
| submit | DRAFT | PENDING | requester | n/a |
| cancel ("withdraw") | DRAFT, PENDING, UNDER_REVIEW | CANCELLED | requester | optional |
| claim ("start review") | PENDING | UNDER_REVIEW | ADMIN, not the requester | n/a |
| release | UNDER_REVIEW | PENDING | any ADMIN, not the requester | required |
| approve | UNDER_REVIEW | APPROVED | the claiming ADMIN | required (10–2000) |
| reject | UNDER_REVIEW | REJECTED | the claiming ADMIN | required (10–2000) |
| complete | APPROVED | COMPLETED | ADMIN, not the requester | automatic categories: none; manual categories: required |

REJECTED, COMPLETED and CANCELLED are final. Any other action returns 409 `INVALID_TRANSITION`.

**Release by another administrator:** any administrator may release a claim, with a reason, so a request never stays
stuck with an absent reviewer.

**Decision versus application:** approval is the decision; completion is the change being applied. A request that
cannot be applied stays APPROVED, and the failure is audited (`outcome=ERROR`).

## 5. Who may do what

| | Requester (any role) | Other non-admin users | AUDITOR | ADMIN |
|---|---|---|---|---|
| Raise a request | yes (`createUserRequest`; can be withdrawn per user by a DENY override) | n/a | yes | yes |
| See own requests | yes | n/a | yes | yes |
| See others' requests | n/a | no: **404**, the same as a request that does not exist | yes, read-only, audited `USER_REQUEST_VIEW` / `USER_REQUEST_LIST` | yes, audited |
| Claim, decide, complete | never on their own request (`SELF_REVIEW`) | no | no | yes |

Refused actions are audited as `USER_REQUEST_<ACTION>` with `outcome=DENIED`.

`viewAllUserRequests` and `reviewUserRequests` are mandatory: no override can grant them or take them away
(`overrides.NON_OVERRIDABLE`).

## 6. API

| Method | Path | Notes |
|---|---|---|
| GET | `/user-requests/categories` | categories with fields, priorities, statuses, limits |
| GET | `/user-requests` | `scope=mine` (default) or `all`; `status` (comma list), `category`, `priority`, `q` (title, justification, case or `UR-000123`), `requester`, `assigned_to_me`, `created_from`/`created_to` (YYYY-MM-DD), `sort` (`created`, `updated`, `priority`, `status`, `reference`; `-` for descending; default `-updated`), `limit` (1–100, default 25), `offset`. Total in `X-Total-Count`. |
| GET | `/user-requests/summary` | counts by status, open count, and the number claimed by the caller |
| POST | `/user-requests` | 201; body `{category, title, justification, priority, details, submit}` |
| GET | `/user-requests/{id}` | with `history`; reviewers also get `review_context` |
| PATCH | `/user-requests/{id}` | `{version, title?, justification?, priority?, details?}`; drafts only |
| POST | `/user-requests/{id}/{submit,cancel,claim,release,approve,reject,complete}` | `{version, reason?}` |
| GET | `/notifications` | own only; `unread_only`, `limit`, `offset`; `X-Total-Count`, `X-Unread-Count` |
| GET | `/notifications/unread-count` | `{unread}` |
| POST | `/notifications/{id}/read`, `/notifications/read-all` | another user's notification returns 404 |

Every response for a request includes `version` and `allowed_actions`, the actions the caller may take now. The web
app shows exactly those buttons, but the server still checks every action.

**Error codes** (body `{detail, code, request_id}`):

| Code | Status | Meaning |
|---|---|---|
| `INVALID_REQUEST` | 422 | `detail` lists `{loc, msg}` per field |
| `NOT_FOUND` | 404 | no such request, or not visible to the caller |
| `FORBIDDEN`, `NOT_REQUESTER`, `SELF_REVIEW`, `NOT_CLAIMER` | 403 | the caller may not take this action |
| `INVALID_TRANSITION` | 409 | the action is not allowed from the current status |
| `VERSION_CONFLICT` | 409 | someone else changed the request since the caller loaded it |
| `DUPLICATE_REQUEST` | 409 | an open request with the same duplicate key exists; `detail` gives its reference |
| `TOO_MANY_OPEN` | 409 | the requester already has 10 open requests |
| `ALREADY_GRANTED` | 409 | the requester already has access to that case |
| `FULFILMENT_FAILED` | 409 | the approved change cannot be applied; the request stays APPROVED |

## 7. Data model (migration `5bcde1234576`)

- **`user_requests`:**
  - `request_id` (integer PK; reference `UR-000123`), `category`, `title`, `justification`, `details` (JSON),
    `priority`, `status`, `dedupe_key`, `requester_id` (FK users), `case_id`;
  - review and completion: `reviewer_id`, `decision_reason`, `decided_at`, `completed_by`, `completed_at`,
    `completion_note`;
  - times and concurrency: `created_at`, `submitted_at`, `updated_at`, `version`;
  - indexes on `category`, `status`, `requester_id`, `case_id` and `reviewer_id`, plus the unique partial index
    `uix_user_requests_open_dedupe (requester_id, dedupe_key) WHERE status IN (DRAFT, PENDING, UNDER_REVIEW, APPROVED)`.
- **`user_request_events`** (append-only; triggers refuse UPDATE and DELETE, and on PostgreSQL also TRUNCATE):
  `event_id`, `request_id`, `event` (`CREATED`, `EDITED`, `SUBMITTED`, `CANCELLED`, `CLAIMED`, `RELEASED`,
  `APPROVED`, `REJECTED`, `COMPLETED`), `from_status`, `to_status`, `actor_id`, `actor_role`, `at`, `reason`,
  `detail` (JSON, for example what completion applied).
- **`notifications`:** `notification_id`, `user_id`, `kind`, `title`, `body`, `link`, `request_id`, `created_at`,
  `read_at`. A notification holds a reference and a status, never case data.

**Who is notified:**
- on submit: all active administrators except the requester;
- on claim, release, approve, reject and complete: the requester. Approve and reject include the reason.
- when a request under review is withdrawn: the claiming administrator.

The bell polls `unread-count` every 60 s and on focus or navigation. There is no e-mail or push delivery.

## 8. Concurrency

Every change sends the `version` it was based on, and the server runs:
`UPDATE user_requests SET … , version = version + 1 WHERE request_id = ? AND version = ? AND status = ?`.

- If no row matches, nothing changes, and the caller gets 409 `VERSION_CONFLICT`. The web app then reloads the
  request and explains what happened.
- Side effects (assignment, role change, events, audit, notifications) happen after this update, in the same
  transaction, so a losing request applies nothing.
- Duplicate creates race on the unique partial index; the loser gets 409 `DUPLICATE_REQUEST`.

**Tested** on SQLite and PostgreSQL 16:
- 8 identical creates at once give 1 × 201 and 7 × 409;
- 2 administrators claiming at once give 1 × 200 and 1 × 409;
- withdraw racing approve: exactly one succeeds.

## 9. Known limits

- **Notifications are in-app only**, with no e-mail. They are kept indefinitely (no retention job yet).
- **Temporary permissions are fulfilled by hand:** the request does not create the override. This is deliberate,
  because overrides need a second administrator (ADR-015).
- **No attachments** on requests.
- **No SLA timers or escalation** for requests that wait too long.
- **Not deployed:** requires migration `5bcde1234576` on the live database.
