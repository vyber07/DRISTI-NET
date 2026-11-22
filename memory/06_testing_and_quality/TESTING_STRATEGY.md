# DRISTI-NET — Master Testing Strategy & Quality Framework

**Authority:** `docs/context.md` §17, `docs/status.md` §17, `DRISTI_NET_TEST_EXECUTION_REPORT.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Multi-Tiered Testing Philosophy

DRISTI-NET enforces a strict testing pyramid to ensure absolute evidentiary reliability:
1. **Pure Unit Tests:** Fast, isolated tests without external services. Mocks are used strictly for external networks (Besu, live ClamAV, remote object stores).
2. **Integration Tests:** Exercise real FastAPI endpoints against local SQLite / PostgreSQL and filesystem / MinIO storage.
3. **Security Gate Tests:** Adversarial tests attempting path traversal, zip bombs, unauthorized case access, unmasked PII leakage, and audit signature tampering.
4. **End-to-End (E2E) Browser Tests:** Playwright tests verifying all 6 officer roles, full screen graph interaction, HITL decision arbitration, and responsive sidebar navigation.
5. **Accessibility Scans:** Automated axe-core audits enforcing WCAG 2.1 AA compliance across all 42 primary route views.

---

## 2. Test Execution Commands

```bash
# Backend Test Suite (Fast Unit & Integration)
pytest apps/api/app/tests -v

# Isolated Security & Tamper Gate Tests
pytest apps/api/app/tests/test_security.py -v
pytest apps/api/app/tests/test_archive_uploads.py -v
pytest apps/api/app/tests/test_evidence_streaming.py -v

# Frontend Typecheck & Build Verification
cd apps/web && npm run typecheck && npm run build

# Playwright E2E Verification
python3 -m pytest tests/e2e -v
```
