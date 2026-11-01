# DRISTI-NET — Requirements Traceability Matrix

**Document ID:** DRISTI-REQ-001  
**Last Updated:** 2026-11-01  
**Authority:** `docs/context.md`, `docs/contracts.md`  

---

| Req ID | Requirement Description | Source Spec | Source Code Location | API Endpoint | DB Object | Frontend View | Verification Test | Status | Remaining Gap |
|---|---|---|---|---|---|---|---|---|---|
| **REQ-01** | Multi-tenant case isolation & RBAC authorization | Context §5, §15.6 | `apps/api/app/auth.py` | All `/api/v1/*` | `User`, `CaseAssignment` | ProtectedRoute, Sidebar | `test_security.py` | **Demonstrated** | None |
| **REQ-02** | File upload validation & quarantine storage | Context §8.1, §8.3 | `routes/evidence_routes.py`, `services/storage.py` | `POST /cases/{id}/evidence` | `Evidence` (QUARANTINED) | `CaseEvidenceView.tsx` | `test_archive_uploads.py` | **Demonstrated** | Fix escaped template in UI |
| **REQ-03** | Fail-closed malware scan gate | Context §8.1, §8.2 | `services/scanner.py`, `pipeline.py` | `POST /evidence/{id}/process` | `Evidence.status` (CLEAN/INFECTED) | `evidence-card.tsx` | `test_scan_gate_fail_closed` | **Demonstrated** | None |
| **REQ-04** | SHA-256 integrity manifest & tamper detection | Context §9.2, §17.1 | `services/storage.py`, `models.py` | `GET /evidence/{id}/verify` | `Evidence.sha256` | `audit-integrity-header.tsx` | `test_hash_manifest_and_tamper_detection` | **Demonstrated** | None |
| **REQ-05** | Multimodal OCR, Parser, and Candidate Extraction | Context §11.1, ADR-012 | `services/extract_document.py`, `ocr_adapter.py`, `nlp_adapter.py` | Internal pipeline | `ExtractionRecord`, `Claim` | `ProvenanceViewer.tsx` | `test_extraction_failures.py`, `test_new_components.py` | **Demonstrated** | Bbox integration in UI |
| **REQ-06** | Conservative Entity Resolution & HITL Queue | Context §11.2, ADR-008 | `services/resolution.py`, `routes/review_routes.py` | `GET /cases/{id}/candidates`, `POST /candidates/{id}/decision` | `MatchCandidate`, `Review` | `hitl-workspace-page.tsx` | `test_candidates_are_explainable_and_never_auto_merged` | **Demonstrated** | None |
| **REQ-07** | Bounded Neo4j POLE+ Graph Projection | Context §10.1-§10.4, ADR-002 | `services/neo4j_store.py`, `routes/graph_routes.py` | `GET /cases/{id}/graph` | Neo4j nodes (`:Entity`, `:Case`, `:Evidence`) & edges (`:REL`) | `GraphCanvas.tsx` (Sigma.js) | `test_graph_is_bounded_and_edges_trace_to_source` | **Demonstrated** | Fix date filter attribute |
| **REQ-08** | Temporal Graph Decay & Historical Playback | Context §11.4, ADR-009 | `services/graph.py`, `routes/graph_routes.py` | `GET /cases/{id}/timeline` | `Claim.observed_time` | `case-timeline.tsx`, `TemporalSlider.tsx` | `test_graph_temporal_decay` | **Demonstrated** | None |
| **REQ-09** | Default-On PII Masking & Audited Reveal Workflow | Context §9.7, ADR-008 | `services/masking.py`, `routes/graph_routes.py` | `POST /entities/{id}/reveal`, `POST /evidence/{id}/context/reveal` | `AuditEvent` (UNMASK) | `reveal-identity-modal.tsx` | `test_masking_and_audited_reveal` | **Demonstrated** | Fix reveal payload schema |
| **REQ-10** | Tamper-Evident Audit Logging | Context §9.7 | `services/audit.py` | `GET /cases/{id}/audit`, `GET /cases/{id}/audit/verify` | `AuditEvent` | `case-audit-view.tsx` | `test_audit_chain_and_tamper_detection` | **Demonstrated** | None |
| **REQ-11** | Cryptographic Merkle Root & Besu Ledger Anchoring | Context §7.3, ADR-014 | `services/integrity.py`, `routes/integrity_routes.py` | `POST /cases/{id}/integrity/anchor`, `GET /cases/{id}/integrity/anchors` | `LedgerAnchor` | `audit-integrity-header.tsx` | `test_new_components.py::TestMerkleTree` | **Demonstrated** | Fix validate script |
| **REQ-12** | Neutral Evidence Dossier PDF Export | Context §16, Status §11 | `services/court_pdf.py`, `routes/integrity_routes.py` | `POST /cases/{id}/report/court-pdf` | None (Generated PDF) | `reports-page.tsx` | `test_new_components.py::TestCourtPdfRoute` | **Demonstrated** | Binary blob parsing in web |
