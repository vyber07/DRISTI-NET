# DRISTI-NET — Master Audit Index

**Authority:** `audit/`, `reports/`, `frontend-audit/`, `docs/audit/`  
**Consolidation Date:** 2026-11-19  

---

## 1. Catalog of Audits and Evaluations

| Audit Category | Location / Document | Primary Scope | Date |
|---|---|---|---|
| **Defect & Bug Registers** | `memory/07_audits_and_reports/CONSOLIDATED_AUDIT_FINDINGS.md` | Consolidated master register of all backend and frontend defects (DEF-001 through DEF-091, BUG-NEW-01 through BUG-NEW-18). | 2026-11-19 |
| **Frontend UI/UX Audit** | `frontend-audit/P21_UI_AUDIT.md` | Axe-core accessibility scans, typography floors, contrast ratios, and design token compliance. | 2026-11-13 |
| **Disaster Recovery Drill** | `operations/DISASTER_RECOVERY_PLAN.md` | PostgreSQL dump/restore and MinIO object store byte-for-byte verification drill. | 2026-11-11 |
| **Security Assessment** | `security/SECURITY_ASSESSMENT.md` | STRIDE threat model, credential management, and authorization review. | 2026-11-12 |
| **AI / NER Evaluation** | `reports/ner-evaluation.md`, `reports/ai-evaluation.md` | F1 score measurements on IndicBERT token extraction and PaddleOCR text layers. | 2026-11-04 |
| **Performance Benchmarks** | `reports/performance.md` | Ingestion throughput, graph query latency, and database query planning under load. | 2026-11-03 |
| **Master Cleanup & Architecture Audit** | `memory/07_audits_and_reports/master_cleanup_20261119/` | Codebase audit, duplicate code analysis, dead code candidates, dependency audit, backend/frontend structural proposals, deletion registers, and cryptographic SHA-256 manifests. | 2026-11-19 |
