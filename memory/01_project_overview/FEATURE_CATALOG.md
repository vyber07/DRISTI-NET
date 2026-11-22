# DRISTI-NET — Master Feature Catalog and Implementation Status

**Authority:** `docs/status.md`, `DRISTI_NET_VERIFIED_COMPLETED_FEATURES.md`, `DRISTI_NET_PARTIALLY_IMPLEMENTED_FEATURES.md`, `DRISTI_NET_PENDING_FEATURES.md`, `CHANGELOG.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Verified Complete Features (Demonstrated)

Features verified in source code and backed by passing automated unit, integration, or E2E tests:

| Feature ID | Feature Name | Source Implementation | Test Evidence | Capabilities & Guarantees |
|---|---|---|---|---|
| **VC-01** | Multi-Role Authentication & Session Control | `apps/api/app/auth.py`, `routes/auth_routes.py`, `routes/account_routes.py` | `test_security.py`, `test_account_self_service.py` | PBKDF2 password hashing, JWT bearer tokens, role enforcement, self-service password update, profile display name editing, session list/revocation, logout audit logging. |
| **VC-02** | Case Management & Membership Assignment | `routes/case_routes.py`, `models.Case`, `models.CaseAssignment` | `test_case_create_assign.py`, `test_listing_search.py` | Case creation, multi-investigator assignment, case classification/jurisdiction tags, authority reference metadata, wildcard-escaped case search. |
| **VC-03** | Multi-Stage Quarantine & Upload Pipeline | `routes/evidence_routes.py`, `services/storage.py`, `services/extract.py` | `test_archive_uploads.py`, `test_security.py` | MIME type magic validation, path traversal defense, zip bomb/ratio rejection, streaming upload directly into quarantine bucket/folder. |
| **VC-04** | Fail-Closed ClamAV Malware Scanning | `services/scanner.py`, `services/pipeline.py` | `test_scan_gate_fail_closed`, `test_scanner_parsing.py` | Fail-closed scan evaluation. EICAR test string caught and quarantined. Scanner timeout or daemon disconnection leaves evidence in quarantine. |
| **VC-05** | Streaming SHA-256 Manifest & Tamper Detection | `services/storage.py`, `models.Evidence` | `test_hash_manifest_and_tamper_detection`, `test_evidence_streaming.py` | Real-time SHA-256 calculation. Any byte alteration triggers `INTEGRITY_MISMATCH` and halts promotion. Streaming evidence download with `X-Evidence-SHA256` header. |
| **VC-06** | Multimodal Document Extraction & Provenance | `services/extract_document.py`, `services/ocr_adapter.py`, `services/nlp_adapter.py` | `test_extraction_failures.py`, `test_new_components.py` | Text parsing for PDF, CSV, JSON, TXT. Bounding box coordinates via PaddleOCR (fallback to pypdf text layer). IndicBERTv2 NER model adapter for Indian entity extraction. Corrupt file handling with retry capability. |
| **VC-07** | Conservative HITL Entity Resolution | `services/resolution.py`, `routes/review_routes.py`, `models.MatchCandidate` | `test_candidates_are_explainable_and_never_auto_merged` | Deterministic key matching + Jaro-Winkler phonetic matching. Pairwise candidates displayed with positive/negative signals. Accept/Reject/Defer reviewer workflow. Zero automated merges. |
| **VC-08** | Bounded Neo4j Graph Projection & Fallback | `services/neo4j_store.py`, `services/graph.py`, `routes/graph_routes.py` | `test_graph_is_bounded_and_edges_trace_to_source`, `test_projection_is_rebuildable` | PostgreSQL-to-Neo4j POLE+ projection. Server-enforced query timeouts. Node capping (N ≤ 500) and hop limitation. In-process fallback with `projection_stale: true` when Neo4j is unavailable. |
| **VC-09** | Temporal Graph Decay & Historical Playback | `services/graph.py`, `models.Claim` | `test_graph_temporal_decay`, `test_workflow.py` | Half-life temporal decay equation on edge timestamps. Point-in-time network state querying. Contradictory evidence flagging (`flags.contradicts`). |
| **VC-10** | Default-On PII Masking & Audited Reveal | `services/masking.py`, `routes/graph_routes.py` | `test_masking_and_audited_reveal` | Phone, PAN, Aadhaar, account masking by default. Audited unmasking dialog with mandatory reason entry and audit logging. |
| **VC-11** | Cryptographic HMAC Audit Trail | `services/audit.py`, `models.AuditEvent` | `test_audit_chain_and_tamper_detection` | Tamper-evident append-only audit trail. HMAC-SHA256 hash chaining. Session timezone pinned to UTC. Key rotation support. |
| **VC-12** | RFC 6962 Merkle Tree & Besu Blockchain Anchoring | `services/integrity.py`, `routes/integrity_routes.py`, `models.LedgerAnchor` | `test_new_components.py::TestMerkleTree` | RFC 6962 Merkle leaf hashing. Merkle root anchoring to Hyperledger Besu EVM private testnet. Inclusion proof generation. |
| **VC-13** | Neutral BSA s.63(4)(c) Evidence Dossier PDF | `services/court_pdf.py`, `routes/integrity_routes.py` | `test_new_components.py::TestCourtPdfRoute` | Automated PDF dossier export containing technical hash manifests, audit excerpts, Merkle references, and legal disclaimers. Neutral language only. |
| **VC-14** | Accessible Responsive Web Application Shell | `apps/web/src/layouts/AppShell/`, `apps/web/src/features/` | Playwright test suite, axe-core scans | WCAG 2.1 AA compliant navigation. Collapsible sidebar, focus trapping on mobile drawers, dark theme design tokens, zero axe violations. |
| **VC-15** | Disaster Recovery Backup & Restore Drills | `scripts/backup_restore_drill.py`, `operations/DISASTER_RECOVERY_PLAN.md` | DR drill execution reports | SQLite/PostgreSQL dump and restore tested. MinIO object store backup verified with zero HMAC failures and exact SHA-256 preservation. |

---

## 2. Partially Implemented Features (MVP Target)

Features implemented in backend or frontend but requiring operational hardening or full integration verification:

| Feature ID | Feature Name | Current Status | Remaining Work | Target Gate |
|---|---|---|---|---|
| **PA-01** | Asynchronous Kafka Ingestion Bus | Implemented (`workers/worker.py`, `services/kafka_bus.py`). Direct in-process fallback remains active. | Full load stress testing under heavy concurrent multi-file uploads. | MVP Production Gate |
| **PA-02** | PaddleOCR Bounding Box UI Overlay | Adapter populates bounding box coordinates (`services/ocr_adapter.py`). | Visual bounding box highlighting overlay in frontend PDF viewer. | Frontend P2 Gate |
| **PA-03** | Indian IndicBERT Language Model Fine-Tuning | Adapter running AI4Bharat IndicBERTv2 NER model (`services/nlp_adapter.py`). Test suite uses lightweight fake for fast test runs. | Large-scale multi-lingual evaluation dataset benchmarking (Hindi, Tamil, Bengali). | ML Research Gate |
| **PA-04** | Coarse Spatial Point Map View | Local linear lat/lon map projection implemented (`MapView.tsx`, `GET /cases/{id}/locations`). | Tile-layer server caching or offline vector map tile integration for secure air-gapped deployments. | Operations Gate |

---

## 3. Planned Architecture Targets & Roadmap

Features intentionally scoped for future architectural iterations:

| Feature ID | Planned Capability | Architectural Specification | Target Phase |
|---|---|---|---|
| **RD-01** | Extended POLE+ Node Types | Additional specialized nodes: `Alias`, `Device`, `SIM`, `H3Cell`, `Communication`, `FinancialEvent`. | Roadmap v2.0 |
| **RD-02** | H3 Coarse Spatial Overlap Analytics | Hexagonal hierarchical spatial indexing (Uber H3) for aggregate location correlation without raw GPS tracking. | Roadmap v2.0 |
| **RD-03** | Mid-Flight Asynchronous Graph Query Cancellation | Cooperative cancellation tokens across long-running Neo4j Cypher analytical queries. | Roadmap v2.0 |
| **RD-04** | Air-Gapped Kubernetes Helm Deployment | Production-grade Helm charts with automated volume replication and high-availability PostgreSQL/Neo4j clustering. | Enterprise Operations |
| **RD-05** | Distributed Identity Attestation | Decentralized W3C Verifiable Credentials for cross-jurisdictional evidence exchange. | Regulatory Roadmap |
