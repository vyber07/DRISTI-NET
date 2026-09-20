# FRONTEND API MAP

| Feature | Frontend Service | Method | Endpoint | Backend Route | Request Match | Response Match | Auth | Status |
| ------- | ---------------- | ------ | -------- | ------------- | ------------- | -------------- | ---- | ------ |
| Auth    | auth service     | POST   | `/api/auth/login` | `/auth/login` | VERIFIED | VERIFIED | public | REAL |
| Cases   | case service     | GET    | `/cases` | `/cases` | VERIFIED | VERIFIED | required | REAL |
| Cases   | case service     | GET    | `/cases/{caseId}` | `/cases/{case_id}` | VERIFIED | VERIFIED | required | REAL |
| Evidence| evidence service | GET    | `/cases/{caseId}/evidence` | `/cases/{case_id}/evidence` | VERIFIED | VERIFIED | required | REAL |
| Evidence| evidence service | GET    | `/evidence/{evidenceId}` | `/evidence/{evidence_id}` | VERIFIED | VERIFIED | required | REAL |
| HITL    | hitl service     | GET    | `/cases/{caseId}/candidates` | `/cases/{case_id}/candidates` | VERIFIED | VERIFIED | required | REAL |
| HITL    | hitl service     | POST   | `/candidates/{taskId}/decision` | `/candidates/{candidate_id}/decision` | VERIFIED | VERIFIED | required | REAL |
| Entity  | entity service   | GET    | `/entities/{entityId}` | `/entities/{entity_id}` | VERIFIED | VERIFIED | required | REAL |
| Reveal  | reveal service   | POST   | `/entities/{entityId}/reveal` | `/entities/{entity_id}/reveal` | VERIFIED | VERIFIED | required | REAL |
| Timeline| timeline service | GET    | `/cases/{caseId}/timeline` | `/cases/{case_id}/timeline` | VERIFIED | VERIFIED | required | REAL |
| Graph   | graph service    | GET    | `/cases/{caseId}/graph` | `/cases/{case_id}/graph` | VERIFIED | VERIFIED | required | REAL |
| Audit   | audit service    | GET    | `/cases/{caseId}/audit` | `/cases/{case_id}/audit` | VERIFIED | VERIFIED | required | REAL |
| Alerts  | alerts service   | N/A    | N/A | N/A | N/A | N/A | required | MOCK |
| Notes   | notes service    | N/A    | N/A | N/A | N/A | N/A | required | MOCK |
