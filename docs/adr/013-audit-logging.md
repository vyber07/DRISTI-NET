# ADR-013: Audit logging: complete context, append-only storage, criticality-based failure handling

**Status:** Accepted (unit- and route-tested on SQLite and on a disposable PostgreSQL 16 container, 301 passed on
PostgreSQL and 299 on SQLite). Not yet deployed. Operational policy: `docs/AUDIT_LOG_POLICY.md`.

## Problem

The audit trail existed but was thin and could be written to with little control:

- Records had no IP address, user agent, username, session, office or correlation ID.
- The request identifier was taken from the client's `X-Trace-Id` header, so callers could write arbitrary values
  into the trail.
- Nothing in the database stopped an UPDATE or DELETE on `audit_events`. Signatures existed per row but nothing
  checked them, and the security documentation described a `GET /audit/verify` endpoint and a hash chain that did
  not exist.
- Several read paths were unaudited: case, evidence, candidate and review lists; searches; the anchor and proof views;
  and reads of the audit log itself. Logout did not exist.
- Failure handling was uniform, so a logging fault would either block everything or be ignored everywhere.

## Options considered

1. **Log to an external system only.** Rejected as the sole store: the database must still hold the accountability
   record, and no SIEM is in place yet.
2. **Hash-chain every row.** Rejected for now: concurrent writers would need serialisation on the chain head, which
   costs throughput and adds a failure mode. Per-row signatures plus off-host daily digests give deletion detection
   with less risk.
3. **Application-level immutability only.** Rejected: any code path or ad-hoc SQL session could bypass it.
4. **Database append-only triggers plus per-row signatures plus daily digests.** **Chosen.**
5. **Criticality-based failure handling.** **Chosen**, instead of one behaviour for every event: operations that change
   state or reveal case content fail closed; plain list views are best-effort.

## Decision

- **Context from the server.** `core/request_context.py` builds one context per request: a server-generated request
  ID, a validated correlation ID, the client IP from the trusted-proxy-aware `ratelimit.client_ip`, and a sanitised
  user agent. Authentication fills in the actor, session and office from the database row. Existing call sites gain
  these fields without change.
- **Schema (migration `5bcde1234572`).** New nullable columns on `audit_events` (actor username and role, office,
  resource office, session, IP, user agent, correlation ID, failure reason). `users.office_id`. A `user_sessions` table.
- **Sessions.** Each login creates a server-side session, referenced by the token's `sid` claim. Logout revokes it.
  `current_user` checks it on every request and audits rejected tokens for known accounts.
- **Append-only.** Triggers refuse UPDATE, DELETE and TRUNCATE on PostgreSQL, and UPDATE and DELETE on SQLite.
- **Signatures.** `hmac-sha256-json-v2` covers every field. Earlier algorithms still verify. `GET /audit/verify`
  recomputes a window. `GET /audit/digest` produces a daily SHA-256 over ordered signatures.
- **Redaction.** Secret-looking keys, JWT-shaped values and long strings are sanitised before storage. Search text is
  stored as a digest and a length.
- **Access.** Full audit reads, exports, verification and digests are restricted to AUDITOR and ADMIN, and each read is
  audited fail-closed. Assigned investigators see case audit trails without network and session fields.
- **Time.** Stored and signed in UTC. Responses add a local display time in `DRISHTI_AUDIT_DISPLAY_TZ`.
- **Coverage.** Added audit records for case and evidence lists, evidence summaries, candidate lists and views,
  review, contradiction and anchor reads, proofs, user lists, login-status reads, logout, token rejections, every
  audit read and export, and search.

## Reason

Database-enforced immutability is the strongest control available without a separate store. Per-row signatures let
verification find altered rows, and off-host digests let it find removed ones. Criticality-based handling makes a
logging fault stop only the operations where an unrecorded change would matter.

## Trade-offs and residual risks

- **Database owner.** A DBA can drop the triggers, alter rows and recompute signatures if they hold the signing key.
  The control that catches this is the off-host digest, which only works if it is stored and checked on a schedule.
- **Best-effort reads.** A logging fault can leave plain list views unrecorded. Searches and sensitive views are not
  affected.
- **Office assignment is administrative.** The system records the office the administrator assigned; it does not
  verify where a person physically works.
- **Sessions break existing tokens.** Tokens issued before this change have no session and are rejected after
  deployment: users sign in again once.
- **Performance.** Each request now reads its session, and each audited event looks up the case and actor. Both are
  primary-key lookups, but the cost has not been measured under load.
- **Not done:** SIEM forwarding, a hash chain, automatic retention enforcement, and background-job audit context.

## Security implications

The trail records who acted, from where, in which session, for which office, and with what outcome, and it resists
editing by application code and by the common database paths. Passwords, tokens and search text stay out of it.

## Migration

`5bcde1234572`: additive. The SQLite demo database gains the columns through the existing additive helper, the new
table through `create_all`, and the triggers through `init_db`. PostgreSQL requires `python3 -m apps.api.app.migrations
upgrade head`. Existing rows keep their v1 signatures, which still verify.

## Rollback

Revert the commits to restore the earlier behaviour. The migration's downgrade drops the new columns, the session table
and the append-only triggers, returning the schema to its earlier state (which had no triggers). It never deletes audit
rows. Store the digests for the affected period off-host before downgrading, and re-run `upgrade head` to restore the protection.

## Verification

- `test_audit_logging.py` (34 tests): required fields; spoofed `X-Forwarded-For`, `X-Real-IP`, `Forwarded` and
  `X-Trace-Id`; trusted-proxy chains; correlation and user-agent injection; office from the user record, not headers;
  logout and session revocation; password-change rejection; search fingerprints; investigator and anonymous denials;
  case-view redaction; export format; permission changes; invalid office codes; append-only enforcement; verification
  and digest detection after simulated trigger removal; signatures covering network fields; redaction rules;
  concurrent writes (60 events across 8 threads) and concurrent logins; fail-closed and best-effort behaviour.
- Full API suite on SQLite: 299 passed, 7 skipped. On PostgreSQL 16 (disposable container): 301 passed, 5 skipped.
- Migration test on PostgreSQL 16 (fresh database built from the chain): 2 passed.
- Trigger check on PostgreSQL 16: UPDATE, DELETE and TRUNCATE refused; the signed row still verifies.
- **Not verified:** the live Compose stack, which still runs the previous image; the migration on the live database;
  and performance under load.
