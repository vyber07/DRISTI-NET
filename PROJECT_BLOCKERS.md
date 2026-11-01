# DRISTI-NET — Project Blockers Register

**Document ID:** DRISTI-BLK-001  
**Last Updated:** 2026-11-01  

---

| Blocker ID | Description | Impact | Blocking Workstream | Proposed Resolution | Status |
|---|---|---|---|---|---|
| **BLK-01** | Syntax error in `apps/web/src/services/api/integrityApi.ts` (missing closing `}`). | Build failure on `make build-web`. | Web build, Playwright E2E. | Fix syntax by adding closing brace on line 22. | **RESOLVING NOW** |
| **BLK-02** | Query Cancellation in Neo4j. | Synchronous backend call cannot be safely aborted mid-flight without async worker queue. | Architecture Target (docs/adr/004). | Acknowledged architecture target. Server query timeout is already enforced; cancellation deferred. | DOCUMENTED / WAIVED |
| **BLK-03** | Live ClamAV Daemon Signature Refresh. | Freshclam signature updates fail in restricted offline sandbox environments. | Malware Scanning Live Gate. | Fallback to local ClamAV engine or testgate mode in isolated CI while enforcing real scan in Docker. | CONTROLLED |
