# FRONTEND API MAP

| Feature | Frontend Service | Function | Method | Frontend Endpoint | Actual FastAPI Route | Request Schema | Response Schema | Auth | RBAC | Storage/Service | Status |
| ------- | ---------------- | -------- | ------ | ----------------- | -------------------- | -------------- | --------------- | ---- | ---- | --------------- | ------ |
| Auth    | authApi.ts       | login    | POST   | `/api/v1/auth/login` | `/auth/login`        | OAuth2PasswordRequestForm | Token | public | N/A | Auth Service | REAL |
| Cases   | casesApi.ts      | getCaseDetails | GET | `/api/v1/cases/{caseId}` | `/cases/{case_id}` | None | CaseDetail | required | required | Database | REAL |
| Cases   | casesApi.ts      | listCases | GET | `/api/v1/cases` | `/cases` | None | list[CaseSummary] | required | required | Database | REAL |
| Cases   | casesApi.ts      | getCaseStats | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Evidence| evidenceApi.ts   | listEvidence | GET | `/api/v1/cases/{caseId}/evidence` | `/cases/{case_id}/evidence` | None | list[EvidenceItem] | required | required | Database | REAL |
| Evidence| evidenceApi.ts   | getEvidenceById | GET | `/api/v1/evidence/{evidenceId}` | `/evidence/{evidence_id}` | None | EvidenceItem | required | required | Database | REAL |
| Evidence| evidenceApi.ts   | getEvidenceByProvenanceId | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| HITL    | hitlApi.ts       | listHITLTasks | GET | `/api/v1/cases/{caseId}/candidates` | `/cases/{case_id}/candidates` | None | list[HITLTask] | required | required | Database | REAL |
| HITL    | hitlApi.ts       | getHITLTask | GET | `/api/v1/candidates/{taskId}` | `/candidates/{candidate_id}` | None | HITLTask | required | required | Database | REAL |
| HITL    | hitlApi.ts       | submitTaskDecision | POST | `/api/v1/candidates/{taskId}/decision` | `/candidates/{candidate_id}/decision` | DecisionRequest | void | required | required | Database | REAL |
| HITL    | hitlApi.ts       | assignTask | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| HITL    | hitlApi.ts       | getHITLStats | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Entity  | entityApi.ts     | getEntityDetails | GET | `/api/v1/entities/{entityId}` | `/entities/{entity_id}` | None | Entity | required | required | Graph/DB | REAL |
| Entity  | entityApi.ts     | listEntities | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Reveal  | revealApi.ts     | requestPiiReveal | POST | `/api/v1/entities/{entityId}/reveal` | `/entities/{entity_id}/reveal` | RevealRequestPayload | RevealResult | required | required | Database | REAL |
| Reveal  | revealApi.ts     | revokePiiReveal | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Reveal  | revealApi.ts     | getRevealStatus | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Timeline| timelineApi.ts   | getTimelineEvents | GET | `/api/v1/cases/{caseId}/timeline` | `/cases/{case_id}/timeline` | None | list[TimelineEvent] | required | required | Database | REAL |
| Timeline| timelineApi.ts   | getTimelineEventById | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Graph   | graphApi.ts      | getCaseGraph | GET | `/api/v1/cases/{caseId}/graph` | `/cases/{case_id}/graph` | None | GraphData | required | required | Graph DB | REAL |
| Graph   | graphApi.ts      | expandNeighbors | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Audit   | auditApi.ts      | listAuditLogs | GET | `/api/v1/cases/{caseId}/audit` | `/cases/{case_id}/audit` | None | list[AuditLogEvent] | required | required | Database | REAL |
| Audit   | auditApi.ts      | recordAuditEvent | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Notes   | notesApi.ts      | *all* | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Alerts  | alertsApi.ts     | *all* | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Provenance| provenanceApi.ts | *all* | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Relation| relationshipApi.ts| *all* | N/A | N/A | N/A | N/A | N/A | required | N/A | N/A | MISSING |
| Evidence | None             | None     | POST   | N/A | `/cases/{case_id}/evidence` | UploadForm | EvidenceItem | required | required | MinIO + DB | UNUSED (Backend only) |
| Evidence | None             | None     | POST   | N/A | `/evidence/{evidence_id}/process` | None | ProcessResult | required | required | Worker | UNUSED (Backend only) |
| Evidence | None             | None     | GET    | N/A | `/evidence/{evidence_id}/verify` | None | VerifyResult | required | required | DB | UNUSED (Backend only) |
| Evidence | None             | None     | GET    | N/A | `/evidence/{evidence_id}/context` | None | ContextResult | required | required | Graph | UNUSED (Backend only) |
| Evidence | None             | None     | POST   | N/A | `/evidence/{evidence_id}/context/reveal` | RevealReq | RevealRes | required | required | Graph | UNUSED (Backend only) |
| Evidence | None             | None     | GET    | N/A | `/evidence/{evidence_id}/download` | None | FileStream | required | required | MinIO | UNUSED (Backend only) |
| Evidence | None             | None     | GET    | N/A | `/evidence/{evidence_id}/claims` | None | list[Claim] | required | required | DB | UNUSED (Backend only) |
| Cases    | None             | None     | POST   | N/A | `/cases` | CaseCreate | CaseDetail | required | required | DB | UNUSED (Backend only) |
| Cases    | None             | None     | POST   | N/A | `/cases/{case_id}/assign` | AssignReq | CaseDetail | required | required | DB | UNUSED (Backend only) |
| Auth     | None             | None     | GET    | N/A | `/auth/me` | None | User | required | required | Auth | UNUSED (Backend only) |
| Auth     | None             | None     | GET    | N/A | `/users` | None | list[User] | required | required | Auth | UNUSED (Backend only) |
| Review   | None             | None     | POST   | N/A | `/claims/{claim_id}/decision` | DecisionReq | void | required | required | DB | UNUSED (Backend only) |
| Review   | None             | None     | GET    | N/A | `/cases/{case_id}/reviews` | None | list[Review] | required | required | DB | UNUSED (Backend only) |
| Review   | None             | None     | GET    | N/A | `/cases/{case_id}/contradictions` | None | list[Contradiction] | required | required | DB | UNUSED (Backend only) |
| Graph    | None             | None     | GET    | N/A | `/cases/{case_id}/locations` | None | list[Location] | required | required | Graph | UNUSED (Backend only) |
| Graph    | None             | None     | GET    | N/A | `/cases/{case_id}/analysis` | None | AnalysisRes | required | required | Graph | UNUSED (Backend only) |
| Graph    | None             | None     | GET    | N/A | `/cases/{case_id}/edge` | None | EdgeDetail | required | required | Graph | UNUSED (Backend only) |
| Graph    | None             | None     | GET    | N/A | `/claims/{claim_id}` | None | ClaimDetail | required | required | DB | UNUSED (Backend only) |
| Integrity| None             | None     | POST   | N/A | `/cases/{case_id}/integrity/anchor` | None | Anchor | required | required | Ledger | UNUSED (Backend only) |
| Integrity| None             | None     | GET    | N/A | `/cases/{case_id}/integrity/anchors` | None | list[Anchor] | required | required | Ledger | UNUSED (Backend only) |
| Integrity| None             | None     | GET    | N/A | `/cases/{case_id}/integrity/anchors/{id}/proof/{hash}` | None | Proof | required | required | Ledger | UNUSED (Backend only) |
| Integrity| None             | None     | POST   | N/A | `/cases/{case_id}/report/court-pdf` | None | FileStream | required | required | MinIO | UNUSED (Backend only) |
| Report   | None             | None     | POST   | N/A | `/cases/{case_id}/report` | ReportReq | ReportRes | required | required | DB | UNUSED (Backend only) |
| Demo     | None             | None     | POST   | N/A | `/demo/tamper/{evidence_id}` | None | void | public | N/A | DB | UNUSED (Backend only) |
