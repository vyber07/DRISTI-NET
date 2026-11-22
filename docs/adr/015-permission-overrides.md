# ADR-015: Administrator-controlled permission overrides

**Status:** Accepted. Tested on SQLite (400 passed) and disposable PostgreSQL 16 (402 passed), with an isolated
browser check (16 checks). Not deployed. Model: `docs/AUTHORIZATION_OVERRIDES.md`.

## Problem

Access was decided only by role lists, case assignment and the masking policy. There was no sanctioned way to grant one
person a temporary permission (cover during leave, a specialist on one case) or to withdraw one (suspected misuse)
without changing their role or assignments, which is coarse and leaves no reasoned, time-limited record.

## Options considered

1. Change roles or assignments for exceptions. Rejected: too coarse, no expiry, no reason, no approval.
2. A general policy language (ABAC rules engine). Rejected for now: more expressive than needed, harder to audit and test.
3. **Scoped ALLOW/DENY overrides on named actions, evaluated in the existing three gates.** Chosen.

## Decision

- Name every role gate's action; evaluate overrides in `require_roles`, `authorize_case` (`caseAccess`) and
  `authorize_reveal` (`reveal`, `downloadOriginal`), so every route is covered without per-route code.
- Precedence: mandatory restriction, then DENY, then baseline allow, then ALLOW, then deny.
- Mandatory restrictions: oversight and administration actions are not overridable; authentication, jurisdiction,
  evidence integrity and quarantine stay in force; ADMIN can never gain reveal.
- Governance: ADMIN only; ALLOW needs a different ADMIN's approval; nobody acts on an override that applies to them;
  expiry required (at most 90 days); history append-only; every change and every use audited.
- Frontend: the server's effective permissions drive `can()`; an admin page reviews overrides by status.

## Trade-offs

- **Per-request cost:** a few indexed queries, cached per request.
- **One-admin deployments:** a deployment with one administrator cannot approve an ALLOW.
- **Not least privilege for ADMIN:** overrides don't make ADMIN least-privilege (SEC-03 remains); they only allow targeted DENYs.
- **No status rewrite on expiry:** expiry is evaluated at read time, so expired rows are never rewritten.

## Migration and rollback

`5bcde1234574` creates two empty tables, so there is no behaviour change until an administrator creates an override.
Rollback: revoke all overrides (access returns to baseline at once), or revert the commit and downgrade one revision.
