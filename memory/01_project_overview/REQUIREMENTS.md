# DRISTI-NET — Authoritative Requirements Specification

**Authority:** `REQUIREMENTS_MATRIX.md`, `docs/contracts.md`, `docs/context.md` §8-§11  
**Consolidation Date:** 2026-11-19  

---

## 1. Requirements Traceability Matrix

| Req ID | Requirement Category | Detailed Specification | Architecture & Source Location | Verification Test & Status |
|---|---|---|---|---|
| **REQ-01** | **Multi-Tenant Access Control & RBAC** | Strict role-based authorization across 6 personas (Investigator, Evidence Officer, Reviewer, Analyst, Auditor, Admin). Case-scoped authorization: unassigned users are denied server-side with 403 Forbidden and an audited denial event. | `apps/api/app/auth.py`, `models.CaseAssignment`, `routes/*.py` | `test_security.py` (**Demonstrated**) |
| **REQ-02** | **Quarantine Ingestion & Format Validation** | Ingest files into isolated quarantine storage. Validate MIME magic, file extensions, and file structure before processing. Reject unauthorized binaries or nested zip traversal. | `routes/evidence_routes.py`, `services/storage.py`, `services/extract.py` | `test_archive_uploads.py`, `test_upload_validation_rejects_bad_files` (**Demonstrated**) |
| **REQ-03** | **Fail-Closed Antivirus Scan Gate** | All evidence must pass ClamAV scanning before promotion to `CLEAN`. Scanner timeouts, connection failures, or malware detections immediately halt processing and leave files quarantined (`EXTRACTION_FAILED` / `INFECTED`). | `services/scanner.py`, `services/pipeline.py` | `test_scan_gate_fail_closed` (**Demonstrated**) |
| **REQ-04** | **Cryptographic SHA-256 Manifest** | Calculate SHA-256 hash immediately upon file receipt in streaming chunks. Persist immutable hash in database record. Any byte modification triggers `INTEGRITY_MISMATCH` and aborts evidence promotion. | `services/storage.py`, `models.Evidence.sha256` | `test_hash_manifest_and_tamper_detection` (**Demonstrated**) |
| **REQ-05** | **Fine-Grained Extraction Provenance** | Extract text, entities, and relationships with exact coordinate provenance: PDF page, line, char offset, OCR bounding box (`services/ocr_adapter.py`), CSV row/col, and JSON path. | `services/extract_document.py`, `services/nlp_adapter.py` | `test_extraction_failures.py`, `test_new_components.py` (**Demonstrated**) |
| **REQ-06** | **Human-in-the-Loop Entity Disambiguation** | Pairwise candidate matching using deterministic phone/PAN/account keys and fuzzy phonetic scoring (Jaro-Winkler). Auto-merging is strictly prohibited. Reviewers record accept/reject/defer decisions with required rationale. | `services/resolution.py`, `routes/review_routes.py`, `models.MatchCandidate` | `test_candidates_are_explainable_and_never_auto_merged` (**Demonstrated**) |
| **REQ-07** | **Bounded Analytical Graph Projection** | Project PostgreSQL POLE+ claims into Neo4j. Enforce server-side hop limits (k ≤ 3), max node caps (N ≤ 500), query timeouts, and graceful degradation to in-process NetworkX projection if Neo4j is offline (`projection_stale: true`). | `services/neo4j_store.py`, `services/graph.py`, `routes/graph_routes.py` | `test_graph_is_bounded_and_edges_trace_to_source`, `test_projection_is_rebuildable` (**Demonstrated**) |
| **REQ-08** | **Temporal Decay & Historical State** | Support temporal decay modeling using half-life decay equations on observed relationship timestamps. Graph and timeline views support point-in-time historical network reconstruction. | `services/graph.py`, `models.Claim.observed_time` | `test_graph_temporal_decay` (**Demonstrated**) |
| **REQ-09** | **Default PII Masking & Audited Reveal** | Identifiers (phone, PAN, Aadhaar hash, bank account) are masked by default across all UI views and API payloads. Revealing an unmasked identifier requires explicit user intent, recorded justification, and generates an immutable `UNMASK` audit log. | `services/masking.py`, `routes/graph_routes.py` | `test_masking_and_audited_reveal` (**Demonstrated**) |
| **REQ-10** | **Cryptographic Audit Log Chaining** | Append-only audit logging for every create, read, update, reveal, and export event. Records include user ID, role, client IP, action, timestamp (UTC), and HMAC-SHA256 signature linked to the prior event hash. | `services/audit.py`, `models.AuditEvent` | `test_audit_chain_and_tamper_detection` (**Demonstrated**) |
| **REQ-11** | **Merkle Tree & Besu Ledger Anchoring** | Compute RFC 6962 compliant Merkle trees over case evidence manifests and audit logs. Anchor Merkle roots onto private Hyperledger Besu EVM testnet smart contract, emitting cryptographic inclusion proofs. | `services/integrity.py`, `models.LedgerAnchor` | `test_new_components.py::TestMerkleTree` (**Demonstrated**) |
| **REQ-12** | **Court-Admissible Dossier Export** | Generate tamper-evident PDF dossiers including case metadata, evidence inventory, SHA-256 manifests, audit excerpts, Merkle roots, and legal disclaimers under BSA 2023 s.63(4)(c) / IEA s.65B. Strictly neutral language. | `services/court_pdf.py`, `routes/integrity_routes.py` | `test_new_components.py::TestCourtPdfRoute` (**Demonstrated**) |

---

## 2. API Contract & Architectural Guarantees

- **Authoritative Database:** PostgreSQL is the single source of truth. All graph projections in Neo4j are disposable and rebuildable on demand.
- **Fail-Closed Security:** In the event of scanner failure, rate-limiter failure, or authentication ambiguity, the system rejects the operation by default.
- **Timezone Invariance:** PostgreSQL database sessions, API timestamps, and audit records are pinned to UTC (`UTC-00:00`).
