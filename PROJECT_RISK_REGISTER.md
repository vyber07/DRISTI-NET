# DRISTI-NET — Master Project Risk Register

**Document ID:** DRISTI-RISK-001  
**Last Updated:** 2026-11-01  
**Review Cycle:** Continuous  

---

| Risk ID | Category | Description | Probability | Impact | Severity | Mitigation Strategy | Status |
|---|---|---|---|---|---|---|---|
| **RSK-01** | Release Blocker | Syntax error in `integrityApi.ts` blocks `make build-web` production asset compilation. | High | Critical | **P0** | Add missing closing brace, enforce `tsc -b --noEmit` in CI/build pipeline. | OPEN (Immediate Fix) |
| **RSK-02** | Security / Auth | Development secret key fallback (`"change-me-demo-only"`) is 19 bytes, failing RFC 7518 32-byte SHA256 min key length. | Medium | High | **P1** | Set minimum 32-byte default key for local test suites and enforce strictly in production validator. | OPEN |
| **RSK-03** | Data Loss | `Makefile` contains destructive `docker compose down -v` in `test-stack`. | Medium | Critical | **P1** | Remove `-v` flag to prevent wiping persistent Postgres, MinIO, and Neo4j volume stores. | OPEN |
| **RSK-04** | API Contract Mismatch | Reveal modal sends `justification` & `caseId: "unknown"` instead of backend `case_id` & `reason`. | High | High | **P1** | Update frontend `revealStore` & `revealApi` to pass `case_id` and `reason`, handling backend response. | OPEN |
| **RSK-05** | API Contract Mismatch | Entity card API `GET /entities/{id}` called without `?case_id=`, resulting in 422 HTTP failure. | High | High | **P1** | Add required `case_id` query parameter to frontend `entityApi.ts` callers. | OPEN |
| **RSK-06** | UX / Functionality | Evidence list does not automatically load on component mount in `case-evidence-view.tsx`. | High | Medium | **P1** | Add `useEffect` on mount invoking `loadEvidence(caseId)`. | OPEN |
| **RSK-07** | Regulatory / Legal | Non-neutral terms ("Court-Ready", "Certified") in UI copy violate responsible AI constitution §2.2. | Medium | High | **P1** | Replace with neutral terms: "Integrity Reference Dossier (BSA s.63(4)(c) Aligned)". | OPEN |
| **RSK-08** | Inappropriate Claims | Presets in `reveal-identity-modal.tsx` claim live NAFIS biometric and phone KYC integrations. | Medium | High | **P1** | Replace presets with neutral case-investigative justification templates. | OPEN |
| **RSK-09** | Deployment / SRE | Systemd unit `dristinet.service` references non-existent `/home/ubuntu/project/DRISTINET`. | High | Medium | **P1** | Correct path to `/home/ubuntu/DRISTI-NET`. | OPEN |
| **RSK-10** | Operational / DoS | Redis container missing in `docker-compose.yml`, leaving login rate-limiting unconfigured. | Medium | Medium | **P2** | Add `redis:7-alpine` container and configure `DRISHTI_REDIS_URL`. | OPEN |
