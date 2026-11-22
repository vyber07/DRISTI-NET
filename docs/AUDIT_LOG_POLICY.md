# DRISTI-NET Audit Log Policy

Status: implemented on branch `worktree-auth-login-ratelimit` (not yet deployed). The retention period and archive
location are proposed values that must be confirmed by the owning organisation before go-live (section 6).

## 1. What is audited, and where it lives

Audit events are rows in `audit_events` (PostgreSQL in production, SQLite for local and test runs). They are the
accountability record. Application logs (`DRISHTI_LOG_FORMAT`) are operational output: they are not the audit trail, and
the audit trail does not depend on them.

Every event is written in the same database transaction as the operation it records, so a sensitive change and its
record commit or roll back together.

Covered events, by category:

| Category | Actions (examples) | Outcomes recorded |
|---|---|---|
| Authentication | `LOGIN`, `LOGOUT`, `ACCOUNT_LOCKED`, `LOGIN_STATUS_VIEW`, `USER_UNLOCK`, `AUTH_TOKEN_REJECTED` | OK, DENIED (with reason) |
| Case access | `CASE_VIEW`, `CASE_LIST`, `CASE_ASSIGN`, `CASE_CREATE`, `ACCESS_DENIED` | OK, DENIED |
| Evidence | `EVIDENCE_UPLOAD`, `EVIDENCE_LIST`, `EVIDENCE_SUMMARY`, `EVIDENCE_VIEW`, `EVIDENCE_DOWNLOAD`, `EVIDENCE_PROCESS` | OK, DENIED, ERROR |
| Review and masking | `CANDIDATE_LIST`, `CANDIDATE_VIEW`, `REVIEW_DECISION`, `UNMASK` | OK, DENIED |
| Exports and reports | `EXPORT`, `COURT_PDF_EXPORT`, `AUDIT_EXPORT` | OK, DENIED |
| Searches | `CASE_LIST` / `EVIDENCE_LIST` / `CANDIDATE_LIST` with a search term | OK (search fingerprint only) |
| Administration | `USER_CREATE`, `USER_UPDATE` (role, office, jurisdiction, before and after), `USER_DEACTIVATE`, `USER_PASSWORD_RESET` | OK |
| Audit access | `AUDIT_LOG_VIEW`, `AUDIT_VIEW`, `AUDIT_VERIFY`, `AUDIT_DIGEST`, `AUDIT_EXPORT` | OK |

Denied sensitive operations are recorded, not only successful ones. A role denial is `ACCESS_DENIED`; a case denial
is `ACCESS_DENIED` with the reason, the case and the attempted action.

## 2. Criticality and failure handling

Each operation is classed. The class decides what happens if its audit record cannot be written.

| Class | Operations | If the audit write fails |
|---|---|---|
| **Fail-closed** | Login and logout, account and role changes, unlock and password reset, unmasking, evidence download, exports, decisions, uploads, searches, sensitive case views, every read of the audit log | The operation is refused (HTTP 500), and any change in progress is rolled back. Nothing happens without a record. |
| **Best-effort** | Plain list and summary views with no search term (case list, evidence summary, candidate summary, stats, contradictions, anchor list) | The view is still served. The failure is logged as an error with the action and exception type only. |

The best-effort class exists so that a logging fault cannot make investigators unable to see their cases. Its cost is
that a read may go unrecorded during a logging fault. That cost is accepted only for reads that reveal no more than the
case list already does. Searches and sensitive views stay fail-closed.

## 3. Access

- **Read the full audit log, export it, verify it, and take digests:** AUDITOR and ADMIN only. Every such read is
  itself audited (fail-closed). Any other role is refused and the refusal is audited.
- **Case audit trail (`GET /cases/{id}/audit`):** assigned investigators see the case's events **without** IP
  address, user agent, session identifier or correlation ID. AUDITOR and ADMIN see the full record.
- **Change:** no role may change or delete an audit row through the application. The database refuses UPDATE, DELETE
  and TRUNCATE (section 5).
- **Export files contain network and session data.** Treat them as restricted. Each export is audited with its window
  and row count.

## 4. Record fields and where each value comes from

| Field | Source | Notes |
|---|---|---|
| `request_id` (`trace_id`) | Server, generated per request (`REQ-…`) | A client `X-Trace-Id` is ignored, so callers cannot write values into the trail. Returned to the client as `X-Request-Id`. |
| `correlation_id` | Client `X-Correlation-Id`, if it matches `[A-Za-z0-9._:-]{8,64}` | A join hint only. Never used for access decisions. |
| `actor_id`, `actor_username`, `actor_role` | Authenticated user row in the database | Never from request headers. |
| `office_id` (actor's office) | `users.office_id`, assigned by an administrator | Not derived from IP geolocation or request headers. Demo users are assigned fictional codes. |
| `resource_office` | The case's `jurisdiction` in the database, for case-scoped events | Identifies the office responsible for the resource. |
| `session_id` | Server-side session row (`user_sessions`), created at login | Revoked by logout. |
| `ip_address` | `services/ratelimit.client_ip`: the socket peer, unless the peer is a trusted proxy (`DRISHTI_TRUSTED_PROXIES`), in which case the right-most untrusted `X-Forwarded-For` hop | Spoofed leftmost hops are ignored. |
| `user_agent` | Request header, with control characters removed and truncated to 256 characters | Prevents log injection. |
| `occurred_at_utc` | Server clock, stored in UTC | Exports and API responses include `…Z` UTC times. |
| `occurred_at_local` | Display only, computed from UTC in `DRISHTI_AUDIT_DISPLAY_TZ` (default `Asia/Kolkata`) | Set per deployment. Storage is always UTC. |
| `action`, `resource_type`, `resource_id`, `case_id` | The handler | |
| `outcome`, `failure_reason` | The handler. `failure_reason` is a short, non-secret cause | e.g. `bad credentials`, `session revoked`, `role not permitted`. |
| `detail` | The handler, passed through a redaction filter (section 7) | |
| `signature` | HMAC-SHA256 (algorithm `hmac-sha256-json-v2`) over every field above | Key id in the signature; keys come from `DRISHTI_AUDIT_KEYS`. |

## 5. Integrity

1. **Append-only at the database.** PostgreSQL triggers (migration `5bcde1234572`) refuse UPDATE, DELETE and TRUNCATE on
   `audit_events`. SQLite gets equivalent triggers from `db.py`. Verified on a disposable PostgreSQL 16 container, not the
   live stack: UPDATE, DELETE and TRUNCATE were each refused, and a signed row still verified afterwards.
2. **Per-row signature.** Each row's HMAC covers every stored field, so editing any field invalidates it. Rows written
   before this change still verify under their original algorithm.
3. **Verification.** `GET /api/v1/audit/verify?start=&end=` recomputes every signature in a window and returns the
   count of valid, unsigned and invalid rows, with the IDs of invalid rows.
4. **Daily digest.** `GET /api/v1/audit/digest?day=YYYY-MM-DD` returns a SHA-256 over that UTC day's ordered
   signatures and the row count. Store the digest outside the database each day. A later recomputation that differs
   shows that rows were removed or altered.

**Known residual risk.** A database owner can drop the triggers, alter a row, and recompute nothing: the row's
signature would then fail verification, and removal would change the day's digest. Both are detectable only if the
digests are stored off-host and the verification is run on a schedule. Without the off-host digests, a complete rewrite
by the database owner (including signatures under a stolen key) is not detectable. Signing keys must be stored outside
the database and rotated under `DRISHTI_AUDIT_KEYS` / `DRISHTI_CURRENT_AUDIT_KEY_ID`.

## 6. Retention, archival and export

- **Retention period (proposed): 7 years** (`DRISHTI_AUDIT_RETENTION_YEARS=7`). Set by the owning organisation's legal
  and records policy. Not confirmed; do not treat this as legal advice.
- **The application never deletes audit rows.** No endpoint or job removes them. Removal after the retention period
  is a separate, approved procedure run by the database owner, and it must be recorded outside the database.
- **Archival (procedure):**
  1. Each day, store the digest from `/audit/digest` in write-once storage separate from the database.
  2. Each month, export the month's window with `/audit/export?format=csv` (or `json`), compute its SHA-256, and store
     the file with that hash in write-once storage. The export is itself an audited event.
  3. Run `/audit/verify` on the month's window before archiving. Archive only if `invalid` is 0. Record the result.
  4. Test a restore of one archived month at least once a year.
- **Legal hold:** a hold stops any removal for the held window. It is recorded outside the database.
- **Access to archives:** the same roles as the live log (AUDITOR and ADMIN). Archive access is itself logged by the
  organisation's own controls.

## 7. Secrets and sensitive content

- **Never logged:** passwords (plain or hashed), session tokens, JWT-shaped strings, and the contents of uploaded or
  parsed evidence. `core/request_context.sanitize_detail` replaces any value under a secret-looking key (`password`,
  `token`, `secret`, `authorization`, `api_key`, `credential`, `cookie`, `private`, `session_key`) with `[REDACTED]`,
  replaces JWT-shaped strings, and truncates strings over 512 characters.
- **Search terms** are recorded as a 16-hex-character SHA-256 digest and a length. The text itself is not stored,
  because a search in an investigation can name people.
- **Evidence hashes** (SHA-256 of evidence bytes) are kept: they are integrity facts, not secrets.
- **Passwords** are checked only by `verify_password` and never written to any audit detail, counter or log. A test
  asserts that a submitted password does not appear in any stored row.

## 8. Time

All timestamps are stored and signed in UTC. API responses give `occurred_at_utc` (ending in `Z`) and
`occurred_at_local` (in `DRISHTI_AUDIT_DISPLAY_TZ`). Export `start` and `end` parameters accept ISO-8601 with an offset,
which is converted to UTC.

## 9. Limits of this design

- Office assignments are maintained by administrators. The system does not verify that a person really works in the
  office they are assigned to: that is an administrative control.
- IP addresses reflect the trusted-proxy configuration. If the proxy is misconfigured, addresses are wrong: verify
  `DRISHTI_TRUSTED_PROXIES` against the deployed network.
- No forwarding to an external SIEM yet. The digest and archive steps are manual until one is added.
- The audit writer runs in the request's transaction. A future background-job audit path must pass its own identifiers
  and is not covered by the request context.
- Tokens issued before this change have no session identifier and are rejected after deployment. Users must sign in
  again once.
