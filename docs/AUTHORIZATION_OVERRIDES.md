# Authorization architecture and permission overrides

Status: implemented on branch `worktree-auth-login-ratelimit`, not deployed. Decision record: ADR-015.

## 1. Existing model (inspected 2026-11-12)

| Layer | Where | Decides |
|---|---|---|
| Authentication | `auth.current_user` | Valid signed token, active account, live server-side session, current password version |
| Role (RBAC) | `auth.require_roles(*roles, action=...)` on 27 routes | Whether the role may perform the action. ADMIN passes every role list (audit finding SEC-03). |
| Case (ABAC) | `auth.authorize_case` on 31 call sites | Assignment or ownership, plus jurisdiction. ADMIN and AUDITOR see all cases without assignment. |
| Reveal | `masking_policy.authorize_reveal` | Masking-policy role, case assignment, and the value belonging to the case (docs/MASKING_AUTHORIZATION.md) |
| Handler checks | inside routes | Evidence integrity, quarantine, duplicates, reasons, input validation |
| Frontend | `apps/web/src/lib/permissions.ts` `can()` | Which controls to show (presentation only) |

Each role gate now names its action (`services/overrides.ACTIONS`). A test fails if a route names an action that is not in the registry.

## 2. Overrides

An override is an explicit, time-boxed `ALLOW` or `DENY` of one **action** for a **subject** (one user, or everyone
with a role), optionally narrowed to one **case** and/or one **resource** (`EVIDENCE`, `CANDIDATE`, `CLAIM`, `ENTITY`).

Overridable actions: `upload`, `decide`, `createAnchor`, `listAnchors`, `report`, `createCase`, `viewUsers`,
`caseAccess`, `reveal`, `downloadOriginal`.

### Precedence (deterministic, highest first)

1. **Mandatory restriction**: not overridable at all (section 3).
2. **Matching active DENY override**: deny.
3. **Baseline allow** (role, assignment or masking policy): allow.
4. **Matching active ALLOW override**: allow.
5. Otherwise: deny.

Deny wins whatever the scope of either override. A broad DENY beats a narrow ALLOW. The outcome never depends on
creation order.

### Matching

An override matches a request when all of these hold:

- its status is ACTIVE and `starts_at <= now < expires_at`;
- the action is the same;
- the subject is the user, or the user's role;
- every scope it sets equals the request's scope.

An unset scope matches anything. A set scope never matches a request whose scope is unknown (fail-safe). The request's
case is taken from the path; for routes addressed by a resource ID, it is read from the database (evidence, candidate
and claim rows), never from the request body or headers.

## 3. Mandatory restrictions overrides cannot bypass

- **Actions that cannot be overridden at all** (neither ALLOW nor DENY): `globalAudit` (oversight), `manageUsers`,
  `viewMaskingPolicy`, `manageMaskingPolicy`, `viewOverrides`, `manageOverrides`, `demoTamper`. Rows naming these are
  refused by the API and ignored by evaluation even if written into the table directly.
- **Authentication**: token, active account, session and password version are checked before any override.
- **Jurisdiction**: an ALLOW `caseAccess` grants entry without an assignment, but the user must still be in the case's jurisdiction.
- **Evidence integrity and quarantine**: these checks live inside handlers, after role and case gates, and no override reaches them.
- **Masking separation of duties**: an ALLOW never gives ADMIN `reveal` or `downloadOriginal`. The API refuses it, and
  evaluation ignores it.
- **Input validation, reasons and required fields** are unaffected.

## 4. Governance (who may do what)

| Operation | Who | Rules |
|---|---|---|
| View list, details, history | ADMIN, AUDITOR | Audited (`OVERRIDE_VIEW`) |
| Create | ADMIN | Reason 10–1000 characters. Expiry required, after the start, at most 90 days. Start not in the past. ALLOW starts PENDING; DENY is ACTIVE at once. |
| Approve | ADMIN | Only PENDING. Not the creator. Not when the override applies to the approver or their role. Not after expiry. |
| Reject | ADMIN | Only PENDING. |
| Revoke | ADMIN | PENDING or ACTIVE. Not when the override applies to the revoker or their role, so a restricted admin cannot lift their own DENY. |

Nobody may create an override that applies to themselves or their own role. ALLOW cannot target an ADMIN user or the
ADMIN role. Status and approver cannot be set at creation: the API ignores those fields. There is no endpoint that
edits or deletes an override.

## 5. Audit and history

- Each change writes a row to `permission_override_events` (append-only, with a snapshot) and a signed audit event:
  `OVERRIDE_CREATED`, `OVERRIDE_APPROVED`, `OVERRIDE_REJECTED`, `OVERRIDE_REVOKED`. Each audit detail carries the effect,
  action, subject (affected user or role), scope, reason, start, expiry, creator, approver and revoker.
- A refused attempt is audited as DENIED, for example `OVERRIDE_APPROVE` by the creator, or `ACCESS_DENIED` for a
  non-admin creation.
- Each access granted by an ALLOW is audited as `OVERRIDE_APPLIED`. Each access refused by a DENY is audited as
  `ACCESS_DENIED` with `reason: denied by permission override` and the `override_id`.

## 6. Frontend presentation

- `GET /auth/me/permissions?case_id=` returns the server's decision for each capability the UI presents, with its
  source (`role`, `override_allow`, `override_deny`, `mandatory`).
- The app loads the global map at sign-in and session restore, and the map for a case when the case opens
  (`stores/permissionsStore.ts`, `features/cases/case-context.tsx`). `can()` uses the case map, then the global map,
  then the static role table. It only decides what is shown; the server authorizes every request.
- **Admin interface:** `/admin/overrides` (`features/admin/permission-overrides-page.tsx`). It filters by status (all,
  active, pending, scheduled, expired, revoked, rejected), shows effect, action, subject, scope, time window, creator,
  approver and revoker, and opens the full history. ADMIN can create, approve, reject and revoke; AUDITOR can only review.
  Approve and Revoke are disabled where the server would refuse (own override, override that applies to you).

## 7. Verification

- `test_permission_overrides.py` (47 tests). Areas covered:
  - governance: who may create, approve, reject and revoke, plus self-approval and self-revocation;
  - mandatory actions, input rules, and a resource that must belong to its case;
  - precedence: DENY beats role, DENY beats ALLOW;
  - scope: case scope doesn't leak to other cases, and resource routes resolve their case;
  - jurisdiction stays mandatory, and a DENY applies to an ADMIN;
  - time: scheduled, expired, revoked and rejected overrides;
  - masking: ALLOW reveal for a non-admin, DENY reveal for a permitted role, and directly inserted rows that try to
    grant ADMIN reveal or a mandatory action;
  - direct bypass: no edit or delete endpoint, client override hints ignored, status not settable at creation;
  - history append-only, effective permissions per case, and registry coverage of every route gate.
- Full API suite: SQLite 400 passed; disposable PostgreSQL 16 402 passed (including the migration-chain test).
  Migration `5bcde1234574` builds, downgrades and re-upgrades on PostgreSQL.
- Browser check against an isolated instance (built frontend, throwaway SQLite): 16 checks. Areas covered:
  - navigation by role: admin and auditor see the page link, the analyst doesn't, and an investigator opening the URL
    directly gets the denied state;
  - the list, with Approve disabled for the creator;
  - creating a DENY through the dialog, which doesn't offer yourself as a subject;
  - the history dialog, and a second administrator approving;
  - the analyst's "New case" button appearing only once an ALLOW `createCase` is active;
  - the auditor seeing no management buttons;
  - the API agreeing with what the UI showed, and no console errors.

  One navigation check failed first because of a timing race in the test script, and passed after waiting for the
  sidebar to render.

## 8. Known limits

- ADMIN still passes every role gate as a baseline (SEC-03). Overrides can now DENY specific actions for a specific
  admin, but least privilege for ADMIN remains a policy decision.
- Approval needs a second administrator. A deployment with one ADMIN can create DENY overrides only.
- The override evaluation adds a few queries per request, cached per request; not load-tested.
- Expiry is enforced at evaluation time. Expired rows stay ACTIVE in the table and are shown as EXPIRED; no job
  rewrites them.
- The frontend shows case-scoped results only inside the case views. Components outside a case use the global map.
