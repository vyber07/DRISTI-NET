# DRISTI-NET Frontend API Map

This file maps the required alignment between frontend features, API service files, and actual backend implementations as dictated by the MASTER_INTEGRATION_MATRIX.

| Feature Domain | Frontend Service | Action | Real FastAPI Route (Target) | Status | Action Required |
| --- | --- | --- | --- | --- | --- |
| **Authentication** | `authApi.ts` | login | `POST /api/v1/auth/login` | 🔴 Local fallback remains | Remove demo fallback, use JWT strictly |
| **Authentication** | `authApi.ts` | me | `GET /api/v1/auth/me` | 🔴 Not used by UI | Integrate, source roles from here |
| **Cases** | `casesApi.ts` | listCases | `GET /api/v1/cases` | 🟠 Fabricated fields | Remove dummy status/priority/counts |
| **Cases** | `casesApi.ts` | getCaseDetails | `GET /api/v1/cases/{case_id}` | 🟠 Fabricated fields | Same as above |
| **Cases** | `casesApi.ts` | getCaseStats | `GET /api/v1/cases/{case_id}/stats` | 🔴 Missing | Build in backend or remove from UI |
| **Evidence** | `evidenceApi.ts` | listEvidence | `GET /api/v1/cases/{case_id}/evidence` | 🟠 Partial UI | Add filter support in UI |
| **Evidence** | `evidenceApi.ts` | getEvidenceById| `GET /api/v1/evidence/{evidence_id}`| 🟠 Partial UI | Add context/claims viewer |
| **Evidence** | `evidenceApi.ts` | processEvidence| `POST /api/v1/evidence/{id}/process`| 🔴 Unused in UI | Connect processing workflow |
| **Evidence** | `evidenceApi.ts` | download | `GET /api/v1/evidence/{id}/download`| 🔴 Unused in UI | Connect download action |
| **Evidence** | `evidenceApi.ts` | verifyIntegrity| `GET /api/v1/evidence/{id}/verify` | 🔴 Unused in UI | Connect to Integrity UI |
| **Claims** | `claimApi.ts` | listClaims | `GET /api/v1/evidence/{id}/claims` | 🔴 Unused in UI | Create Claims viewer |
| **Provenance** | `provenanceApi.ts` | getProvenance | (Derived from Claims/Evidence) | 🔴 Faked in Store | Remove `mock-prov-1`, map to real chain |
| **Graph** | `graphApi.ts` | getCaseGraph | `GET /api/v1/cases/{case_id}/graph` | 🔴 Fabricated metadata | Stop calculating dummy confidence/tiers |
| **Graph** | `graphApi.ts` | getEdgeDetail | `GET /api/v1/cases/{case_id}/edge` | 🔴 Fabricated details | Use real backend endpoint for edge clicks |
| **Timeline** | `timelineApi.ts`| getTimelineEvents| `GET /api/v1/cases/{case_id}/timeline` | 🟠 Fabricated categories | Map exactly to backend `TimelineEventOut` |
| **HITL** | `hitlApi.ts` | listCandidates | `GET /api/v1/cases/{case_id}/candidates` | 🟠 Real | Valid |
| **HITL** | `hitlApi.ts` | getCandidate | `GET /api/v1/candidates/{id}` | 🟠 Real | Valid |
| **HITL** | `hitlApi.ts` | submitDecision | `POST /api/v1/candidates/{id}/decision` | 🟠 Real | Valid |
| **HITL** | `hitlApi.ts` | getHITLStats | `GET /api/v1/cases/{case_id}/reviews` (closest) | 🔴 Faked locally | Implement real stats or remove UI |
| **HITL** | `hitlApi.ts` | assignTask | `POST /api/v1/cases/{case_id}/assign` | 🔴 Faked locally | Implement real assignment or remove |
| **Audit** | `auditApi.ts` | listAuditLogs | `GET /api/v1/cases/{case_id}/audit` | 🔴 Incorrect UI model | Use HMAC signature model, not SHA chain |
| **Integrity** | `integrityApi.ts` | getAnchors | `GET /api/v1/cases/{case_id}/integrity/anchors`| 🔴 Unused in UI | Connect Ledger anchors |
| **Reports** | `reportApi.ts` | generateReport | `POST /api/v1/cases/{case_id}/report` | 🔴 False success | Send `ReportIn`, handle download response |
| **Reports** | `reportApi.ts` | getCourtPdf | `POST /api/v1/cases/{case_id}/report/court-pdf` | 🔴 Missing body | Fix payload (`CourtPdfIn`) and download |

## Discarded / Deprecated Features
*   **Notes:** No backend support. UI to be removed.
*   **Alerts:** No backend support. UI to be removed.
*   **Demo Tamper API:** Local mock to be removed.
*   **Demo Auth Fallback:** To be completely disabled.
