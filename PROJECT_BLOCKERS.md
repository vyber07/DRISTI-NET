# DRISTI-NET — Project Blockers Register

**Document ID:** DRISTI-BLK-001  
**Last Updated:** 2026-11-01  

---

| Blocker ID | Description | Impact | Blocking Workstream | Proposed Resolution | Status |
|---|---|---|---|---|---|
| **BLK-01** | Syntax error in `apps/web/src/services/api/integrityApi.ts` (missing closing `}`). | Build failure on `make build-web`. | Web build, Playwright E2E. | Fix syntax by adding closing brace on line 22. | RESOLVED (verified 2026-11-01: `tsc -b` 0 errors) |
| **BLK-02** | Query Cancellation in Neo4j. | Synchronous backend call cannot be safely aborted mid-flight without async worker queue. | Architecture Target (docs/adr/004). | Acknowledged architecture target. Server query timeout is already enforced; cancellation deferred. | DOCUMENTED / WAIVED |
| **BLK-03** | Live ClamAV Daemon Signature Refresh. | Freshclam signature updates fail in restricted offline sandbox environments. | Malware Scanning Live Gate. | Fallback to local ClamAV engine or testgate mode in isolated CI while enforcing real scan in Docker. | CONTROLLED |
| **BLK-04** | Pinned MinIO image `quay.io/minio/minio@sha256:14cea4…` does not resolve; `quay.io/minio/minio:latest` and `minio/minio:latest` also fail from this host (consistent with MinIO ending community image distribution). | `docker compose up` / `make test-stack` cannot start. | Step 3 live infrastructure, deployment, backup/restore. | Owner decision: pick an obtainable S3-compatible image (e.g. a digest-pinned build of MinIO from source, `bitnamilegacy/minio`, or SeaweedFS), pin by digest, re-run `make test-stack`. | **OPEN — needs owner decision** |
| **BLK-05** | No authorised, isolated host for a full Compose stack + backup/restore drill (this host runs the public demo on :80/:8000 with 2 vCPU / 7 GB RAM). | Restore test, failure injection, performance re-run. | Staging gate. | Provision a disposable environment, or approve a maintenance window on this host. | **OPEN** |
| **BLK-06** | Live demo runs code vulnerable to DEF-028 (path traversal → `.env`, DB readable) on `0.0.0.0:8000`. Fix is on branch `audit/session-4-security-fixes`. | Possible disclosure of the JWT/audit signing key and all demo data if :8000 is internet-reachable. | Security gate. | Owner: install the updated unit + restart (`CONTINUATION_STATE.md` approval 1); rotate the secret if :8000 was reachable. | **OPEN — needs owner approval (2026-11-01)** |
