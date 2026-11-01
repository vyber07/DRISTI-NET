# DRISTI-NET — Module Status Inventory

**Document ID:** DRISTI-MOD-001  
**Last Updated:** 2026-11-01  

---

| Module Path | Primary Language | Function / Scope | Implementation State | Test Coverage | Defects / Blockers |
|---|---|---|---|---|---|
| `apps/api/app/main.py` | Python | FastAPI app creation, lifecycle, middleware, error handlers | **WORKING** | Tested via unit/integration | None |
| `apps/api/app/auth.py` | Python | JWT authentication, PBKDF2 hashing, case authorization gates | **WORKING** | 100% covered in `test_security.py` | None |
| `apps/api/app/config.py` | Python | Environment parsing, bounds validation, secret enforcement | **WORKING** | Tested in config checks | Short default test key warning |
| `apps/api/app/models.py` | Python | SQLAlchemy ORM tables (POLE+ entities, claims, evidence, reviews) | **WORKING** | Verified via Alembic | None |
| `apps/api/app/services/storage.py` | Python | S3/MinIO & local storage, quarantine, hash calculation | **WORKING** | `test_storage_s3.py` | Missing `s3` public alias |
| `apps/api/app/services/scanner.py` | Python | ClamAV fail-closed scanning, timeout handling | **WORKING** | `test_scan_gate_fail_closed` | None |
| `apps/api/app/services/extract_document.py` | Python | Multi-format parser (PDF, CSV, JSON, TXT, ZIP) | **WORKING** | `test_archive_uploads.py` | None |
| `apps/api/app/services/ocr_adapter.py` | Python | PaddleOCR & PyPDF text layer extraction | **WORKING** | `test_new_components.py` | None |
| `apps/api/app/services/nlp_adapter.py` | Python | AI4Bharat IndicBERTv2 NER model inference | **WORKING** | `test_new_components.py` | None |
| `apps/api/app/services/resolution.py` | Python | Deterministic candidate matching & explainable signals | **WORKING** | `test_candidates_are_explainable` | None |
| `apps/api/app/services/graph.py` | Python | Bounded traversal, temporal decay calculation | **WORKING** | `test_graph_analysis.py` | None |
| `apps/api/app/services/neo4j_store.py` | Python | Neo4j Cypher projection and query execution | **WORKING** | `test_neo4j_live.py` | None |
| `apps/api/app/services/integrity.py` | Python | Merkle trees, inclusion proofs, Besu EVM client | **WORKING** | `test_new_components.py` | None |
| `apps/api/app/services/court_pdf.py` | Python | ReportLab PDF generator for evidence dossiers | **WORKING** | `test_new_components.py` | Language neutralization |
| `apps/web/src/services/api/integrityApi.ts` | TypeScript | Client for ledger anchors and dossier PDF | **BROKEN** | Broken (syntax error TS1005) | Missing closing brace |
| `apps/web/src/services/api/real_client.ts` | TypeScript | Fetch wrapper, bearer token injector, response parser | **NEEDS FIX** | Builds | Binary PDF treated as string |
| `apps/web/src/services/api/entityApi.ts` | TypeScript | Entity card data fetcher | **NEEDS FIX** | Builds | Missing required `case_id` query |
| `apps/web/src/stores/revealStore.ts` | TypeScript | Sensitive identifier unmasking state | **NEEDS FIX** | Builds | Contract schema mismatch |
| `apps/web/src/components/graph/engine/GraphEngine.ts` | TypeScript | Sigma.js graph layout and filter engine | **NEEDS FIX** | Builds | Edge timestamp filter check |
| `workers/worker.py` | Python | Kafka consumer background worker | **WORKING** | Tested via Kafka bus test | Startup dependency in compose |
