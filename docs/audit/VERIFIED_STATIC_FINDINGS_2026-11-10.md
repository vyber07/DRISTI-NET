# Verified Static Findings — 2026-11-10

These findings were independently checked against the cited current source during the recovery pass. They are static findings, not runtime reproductions. The migration scripts were not executed. Severity follows the requested P0–P3 scheme and is limited to the evidenced impact.

## AUD-001 — Migration tools cleared broad target data

- **Severity:** P0
- **Status:** **Remediated in current source; provider/database integration remains unverified.** Neither migration was executed against an external target.
- **Original evidence:** At baseline, [migrate_evidence_to_minio.py](/home/ubuntu/DRISTI-NET/scripts/migrate_evidence_to_minio.py) deleted every listed bucket key, and [migrate_sqlite_to_postgres.py](/home/ubuntu/DRISTI-NET/scripts/migrate_sqlite_to_postgres.py) deleted every modeled target row before copying.
- **Current control:** S3 migration no longer lists/deletes the whole bucket. It checks each destination key, skips identical bytes, refuses conflicting bytes before the first put, leaves unrelated objects untouched, and uses `IfNoneMatch="*"` conditional creates. PostgreSQL migration no longer deletes target rows; it refuses nonempty modeled tables and locks PostgreSQL tables during its emptiness check/import with a 5-second lock timeout.
- **Original impact:** A mistaken bucket or database target could remove unrelated or authoritative records. Transaction rollback only protected the relational copy while its transaction remained available; the object-store deletion was not transactional with uploads.
- **Residual risk:** The source controls are tested locally, but provider compatibility and PostgreSQL locking are unverified. Run only on a disposable target until that integration test is complete.
- **Root cause:** The original scripts encoded wipe-and-replace semantics without an enforced disposable-target boundary.
- **Remediation performed:** Replaced destructive replacement with conflict-safe S3 import and empty-target-only relational import. Added synthetic/mock tests for identical/conflicting S3 keys and empty/nonempty relational targets.
- **Verification:** `apps/api/app/tests/test_migration_safety.py`: 4 passed. Full `make test`: 214 passed, 6 skipped, 1 deselected. PostgreSQL table-lock behavior and S3-compatible `IfNoneMatch` behavior were not tested against live services; require a disposable integration rehearsal before operational use.

## AUD-002 — Upload body is fully buffered before the application size check

- **Severity:** P1
- **Status:** Open; static finding verified, concurrency impact not measured.
- **Evidence:** [evidence_routes.py](/home/ubuntu/DRISTI-NET/apps/api/app/routes/evidence_routes.py:38) authorizes the upload, then reads the complete UploadFile into `data` at line 45 before `validate_upload()` runs at line 46. The configured MAX_UPLOAD_MB is an application validation cap in config.py; it does not prevent the initial body read.
- **Impact:** Oversized or concurrent requests can consume memory and temporary multipart storage before rejection. Actual host impact depends on proxy/ASGI limits and concurrency and was not measured.
- **Root cause:** The route uses whole-file buffering for hashing, validation, and storage.
- **Remediation:** Enforce a request-body cap at the reverse proxy/ASGI boundary and stream into bounded quarantine while hashing; reject as soon as the configured cap is exceeded. Add single-upload and concurrent oversized-input tests.
- **Reproduction:** Source inspection only; no load test run.
- **Regression test:** Existing upload validation tests cover rejection behavior, but do not prove bounded memory under concurrent oversized uploads.

## AUD-003 — Audit API returns event detail without a visible signature-verification result

- **Severity:** P2
- **Status:** Open; read-path behavior verified, disclosure policy and signature verification expectations need confirmation.
- **Evidence:** [audit_routes.py](/home/ubuntu/DRISTI-NET/apps/api/app/routes/audit_routes.py:11) copies AuditEvent.detail directly into each response at lines 11–13. Neither list route calls a verification function or includes a signature verification field.
- **Impact:** Sensitive free-form values stored in details may be returned to authorized auditors; a tampered event is not visibly distinguished by this route. The actual detail contents and deployment threat model were not inspected.
- **Root cause:** Serialization exposes the stored JSON payload without route-level redaction or integrity status.
- **Remediation:** Define an allowlisted/redacted detail schema and expose verification status based on the existing audit verification service. Add success and tampered-event API tests.
- **Reproduction:** Static route inspection only; no event tampering or live audit query performed.
- **Regression test:** Existing signature tests cover verification helpers, not this response route.

## AUD-004 — Audit list limits have no positive lower bound

- **Severity:** P2
- **Status:** **Remediated in current source; SQLite route behavior verified. PostgreSQL behavior not separately exercised.**
- **Evidence:** both route parameters now use `Query(200, ge=1, le=1000)` in [audit_routes.py](/home/ubuntu/DRISTI-NET/apps/api/app/routes/audit_routes.py). Requests with 0, -1, and 1001 return HTTP 422; valid boundary requests succeed.
- **Impact:** Negative values are delegated to database-specific LIMIT behavior, which can produce inconsistent errors or unexpectedly broad result sets. No negative-limit request was sent in this pass.
- **Root cause:** Route parameter is an unvalidated integer with only an upper clamp.
- **Remediation performed:** Added FastAPI query bounds and regression coverage for both audit routes.
- **Regression test:** `apps/api/app/tests/test_audit_and_review_stats.py` covers invalid bounds and valid in-range requests. Full backend suite passed.

## AUD-005 — Review metric labeled as identity merges counts all candidates

- **Severity:** P2
- **Status:** **Remediated in current source; API count verified against persisted APPROVE states. Frontend interpretation not reviewed.**
- **Evidence:** [review_routes.py](/home/ubuntu/DRISTI-NET/apps/api/app/routes/review_routes.py) now counts candidates whose state is `APPROVE` for `identityMergesCount`; the endpoint test compares this response with persisted state counts.
- **Impact:** A dashboard consumer may interpret unresolved/rejected/deferred candidates as accepted identity merges.
- **Root cause:** Response field is populated from total candidates rather than accepted match decisions.
- **Remediation performed:** Count only approved candidates, preserving the existing response contract.
- **Reproduction:** `apps/api/app/tests/test_audit_and_review_stats.py` verifies the metric against database state after synthetic fixture ingestion.
- **Regression test:** Focused tests and full backend suite passed. Separate UI rendering/interpretation review remains open.

## Explicitly not concluded

- Whether names, dates of birth, and addresses in case-authorized reviewer/report views require additional masking is a policy question; this pass does not label it a confirmed disclosure defect.
- Restricted cross-case counts are surfaced explicitly by the entity card; the acceptable disclosure of such aggregate counts requires a documented policy decision.
- report_routes.py masks relationship labels and selected text fields, while candidate endpoint behavior and access rules still require a full route-by-route review.
