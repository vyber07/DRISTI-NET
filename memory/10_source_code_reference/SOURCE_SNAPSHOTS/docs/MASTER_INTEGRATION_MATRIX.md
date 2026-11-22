# DRISTI-NET Master Integration Matrix

This document represents the single authoritative contract matrix for the entire DRISTI-NET stack, freezing the architecture as per Phase 0 of the Integration Reconciliation & Production Hardening plan.

| Domain | UI | Store | API Service | HTTP | FastAPI | Schema | Auth | DB/Service | Test | Status |
| ------ | -- | ----- | ----------- | ---- | ------- | ------ | ---- | ---------- | ---- | ------ |
| Authentication | Login Form, User Profile | `authStore` | `authApi` | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` | `auth.py` | `Token`, `UserOut` | N/A | PostgreSQL (Users table) | TODO | 🔴 Demo fallback present |
| Users/Roles | Role display, Permissions | `authStore` | `authApi` | `GET /api/v1/auth/me` | `auth.py` | `UserOut`, `RoleEnum` | JWT | PostgreSQL | TODO | 🔴 Mismatch frontend vs backend roles |
| Cases Directory | Case List | `caseStore` | `casesApi` | `GET /api/v1/cases` | `cases.py` | `CaseOut`, `CaseListOut` | JWT (Case policy) | PostgreSQL | TODO | 🟠 Fabricated frontend fields |
| Case Detail | Case Overview | `caseStore` | `casesApi` | `GET /api/v1/cases/{case_id}`, `GET /api/v1/cases/{case_id}/stats` | `cases.py` | `CaseDetailOut`, `CaseStatsOut` | JWT (Case policy) | PostgreSQL | TODO | 🟠 Stats endpoint missing/faked |
| Evidence List | Evidence Table | `evidenceStore` | `evidenceApi` | `GET /api/v1/cases/{case_id}/evidence` | `evidence.py` | `EvidenceOut` | JWT (Case policy) | PostgreSQL | TODO | 🟠 Partial UI integration |
| Evidence Detail | Evidence View/Context | `evidenceStore` | `evidenceApi` | `GET /api/v1/evidence/{evidence_id}`, `GET /api/v1/evidence/{evidence_id}/context` | `evidence.py` | `EvidenceDetailOut`, `ContextOut` | JWT (Evidence policy) | PostgreSQL/MinIO | TODO | 🟠 Missing context/claims UI |
| Evidence Processing | Upload, Process, Download | `evidenceStore` | `evidenceApi` | `POST /api/v1/cases/{case_id}/evidence`, `POST /api/v1/evidence/{id}/process`, `GET /api/v1/evidence/{id}/download` | `evidence.py` | `EvidenceCreate`, `ProcessOut` | JWT | MinIO, Worker | TODO | 🟠 Full transition lifecycle missing |
| Processing Claims | Claim List | `claimStore` | `claimApi` | `GET /api/v1/evidence/{evidence_id}/claims` | `claims.py` | `ClaimOut` | JWT | PostgreSQL | TODO | 🔴 Missing |
| Provenance | Provenance Chain Viewer | `provenanceStore` | `provenanceApi` | `GET /api/v1/claims/{claim_id}` (derived) | `provenance.py` | `ProvenanceOut` | JWT | PostgreSQL | TODO | 🔴 Broken, fabricated in frontend |
| Graph Nodes | Sigma Graph View | `graphStore` | `graphApi` | `GET /api/v1/cases/{case_id}/graph` | `graph.py` | `GraphNodesOut` | JWT | Neo4j | TODO | 🔴 Fabricated metadata in UI |
| Graph Edges | Edge Details Panel | `graphStore` | `graphApi` | `GET /api/v1/cases/{case_id}/edge` | `graph.py` | `EdgeDetailOut` | JWT | Neo4j | TODO | 🔴 Fabricated edge info in UI |
| Timeline | Timeline View | `timelineStore` | `timelineApi` | `GET /api/v1/cases/{case_id}/timeline` | `timeline.py` | `TimelineEventOut` | JWT | PostgreSQL | TODO | 🟠 Partial, fabricated categories |
| HITL Candidates | Review Queue | `hitlStore` | `hitlApi` | `GET /api/v1/cases/{case_id}/candidates`, `GET /api/v1/candidates/{id}` | `hitl.py` | `CandidateOut` | JWT (Reviewer) | PostgreSQL | TODO | 🟠 Real core, fake stats/assignment |
| HITL Decisions | Review Action | `hitlStore` | `hitlApi` | `POST /api/v1/candidates/{id}/decision` | `hitl.py` | `DecisionIn` | JWT (Reviewer) | PostgreSQL | TODO | 🟠 Real core, fake stats/assignment |
| Audit | Audit Log View | `auditStore` | `auditApi` | `GET /api/v1/cases/{case_id}/audit`, `GET /api/v1/cases/{case_id}/audit/verify` | `audit.py` | `AuditEventOut` | JWT (Auditor) | PostgreSQL | TODO | 🔴 UI verification model incorrect |
| Integrity | Hash Verification | `integrityStore`| `integrityApi`| `GET /api/v1/evidence/{id}/verify` | `evidence.py` | `IntegrityOut` | JWT | PostgreSQL, Besu | TODO | 🟠 UI integration incomplete |
| Reports (Analyst) | Report Download | `reportStore` | `reportApi` | `POST /api/v1/cases/{case_id}/report` | `reports.py` | `ReportIn` | JWT | File/Worker | TODO | 🔴 False success UI, mismatched contract |
| Reports (Court) | Dossier PDF | `reportStore` | `reportApi` | `POST /api/v1/cases/{case_id}/report/court-pdf` | `reports.py` | `CourtPdfIn` | JWT | File/Worker | TODO | 🔴 Missing request body in UI |
| Health/Readiness| None | None | None | `GET /api/v1/health`, `GET /api/v1/ready` | `main.py` | `HealthOut` | N/A | Application | TODO | 🟡 Basic |

## Status Definitions

*   🟢 **Synchronized**: Frontend UI, stores, services, backend routing, models, and DB match exactly.
*   🟡 **Partial Backend**: Backend capability exists, UI incomplete or partially mapped.
*   🟠 **Partially Real**: Core functions exist, but some frontend capabilities are fabricated.
*   🔴 **Not Synchronized**: Major contradictions, missing endpoints, or fabricated frontend data.
