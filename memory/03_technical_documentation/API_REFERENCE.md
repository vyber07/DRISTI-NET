# DRISTI-NET — Master API Reference Specification

**Authority:** `docs/API_ARCHITECTURE.md`, `docs/FRONTEND_API_MAP.md`, `packages/schemas/openapi.json`  
**Consolidation Date:** 2026-11-19  
**Base Path:** `/api/v1`  

---

## 1. Authentication & Account Endpoints

| Method | Endpoint | Description | Auth Required | Request Payload | Response Schema |
|---|---|---|---|---|---|
| `POST` | `/auth/login` | Authenticate user credentials and issue JWT bearer token | Public | `LoginRequest` (username, password) | `TokenResponse` (access_token, token_type, user) |
| `POST` | `/auth/logout` | Revoke active server-side session and record audit event | Bearer JWT | None | 200 OK (`{"message": "Logged out"}`) |
| `GET` | `/auth/me` | Fetch active user profile, role, and jurisdiction | Bearer JWT | None | `UserOut` |
| `PATCH` | `/auth/me` | Update personal display name | Bearer JWT | `UpdateProfileRequest` (display_name) | `UserOut` |
| `POST` | `/auth/me/password` | Self-service password change with rate-limiting and other-session revocation | Bearer JWT | `PasswordChangeRequest` (old_password, new_password) | 200 OK |
| `GET` | `/auth/me/sessions` | List all active sessions for current user | Bearer JWT | None | List[`SessionOut`] |
| `DELETE` | `/auth/me/sessions/{id}` | Revoke a specific active session | Bearer JWT | None | 200 OK |
| `GET` | `/auth/me/activity` | Retrieve recent personal security audit log entries | Bearer JWT | Query (`limit`, `offset`) | List[`AuditEventOut`] |

---

## 2. Case Management Endpoints

| Method | Endpoint | Description | Auth Required | Permitted Roles | Response Schema |
|---|---|---|---|---|---|
| `GET` | `/cases` | List cases assigned to the requesting user with search & pagination | Bearer JWT | All assigned roles | `PaginatedCases` |
| `POST` | `/cases` | Create a new authorized investigation case | Bearer JWT | Admin, Investigator | `CaseOut` |
| `GET` | `/cases/{id}` | Fetch full details for a specific case | Bearer JWT | Assigned members, Admin, Auditor | `CaseOut` |
| `GET` | `/cases/{id}/members` | List investigators and reviewers assigned to case | Bearer JWT | Assigned members, Admin | List[`CaseMemberOut`] |
| `POST` | `/cases/{id}/members` | Assign an investigator or reviewer to a case | Bearer JWT | Admin, Case Owner | `CaseMemberOut` |
| `DELETE` | `/cases/{id}/members/{user_id}` | Remove a member assignment from a case | Bearer JWT | Admin, Case Owner | 200 OK |

---

## 3. Evidence Ingestion & Processing Endpoints

| Method | Endpoint | Description | Auth Required | Permitted Roles | Response Schema |
|---|---|---|---|---|---|
| `POST` | `/cases/{id}/evidence` | Upload digital evidence file into quarantine | Bearer JWT | Evidence Officer, Admin | `EvidenceOut` |
| `GET` | `/cases/{id}/evidence` | List all evidence items associated with case | Bearer JWT | Assigned members, Admin | List[`EvidenceOut`] |
| `GET` | `/evidence/{id}` | Fetch evidence status, SHA-256 manifest, and scan result | Bearer JWT | Assigned members | `EvidenceOut` |
| `GET` | `/evidence/{id}/download` | Stream download original evidence file with checksum header | Bearer JWT | Assigned members | Streaming binary with `X-Evidence-SHA256` |
| `POST` | `/evidence/{id}/process` | Trigger ClamAV scan and multimodal extraction pipeline | Bearer JWT | Evidence Officer, Admin | `JobOut` (idempotent job reference) |

---

## 4. Entity Resolution & HITL Review Endpoints

| Method | Endpoint | Description | Auth Required | Permitted Roles | Response Schema |
|---|---|---|---|---|---|
| `GET` | `/cases/{id}/candidates` | List pending entity match candidate pairs for review | Bearer JWT | Reviewer, Investigator, Admin | List[`MatchCandidateOut`] |
| `POST` | `/candidates/{id}/decision` | Record arbitration decision (`ACCEPT`, `REJECT`, `DEFER`) with justification | Bearer JWT | Reviewer, Admin | `ReviewDecisionOut` |

---

## 5. Knowledge Graph & Analytics Endpoints

| Method | Endpoint | Description | Auth Required | Permitted Roles | Response Schema |
|---|---|---|---|---|---|
| `GET` | `/cases/{id}/graph` | Query bounded k-hop POLE+ graph with temporal and node limits | Bearer JWT | Investigator, Analyst, Admin | `GraphResponse` (nodes, edges, metrics, projection_stale) |
| `GET` | `/cases/{id}/timeline` | Retrieve chronological claim event timeline | Bearer JWT | Investigator, Analyst | List[`TimelineEventOut`] |
| `GET` | `/cases/{id}/locations` | Fetch geocoded point coordinates for case entities | Bearer JWT | Investigator, Analyst | List[`LocationEntityOut`] |
| `POST` | `/entities/{id}/reveal` | Request audited reveal of masked identifier | Bearer JWT | Investigator, Admin | `UnmaskResponse` (unmasked_value, audit_id) |

---

## 6. Cryptographic Integrity & Dossier Export Endpoints

| Method | Endpoint | Description | Auth Required | Permitted Roles | Response Schema |
|---|---|---|---|---|---|
| `POST` | `/cases/{id}/integrity/anchor` | Generate RFC 6962 Merkle root and anchor to Besu ledger | Bearer JWT | Evidence Officer, Admin | `LedgerAnchorOut` |
| `GET` | `/cases/{id}/integrity/anchors`| Retrieve historical Merkle roots and blockchain inclusion proofs | Bearer JWT | Assigned members, Auditor | List[`LedgerAnchorOut`] |
| `POST` | `/cases/{id}/report/court-pdf` | Generate neutral BSA s.63(4)(c) evidence dossier PDF | Bearer JWT | Investigator, Auditor, Admin | Streaming PDF (`application/pdf`) |

---

## 7. Audit & Accountability Endpoints

| Method | Endpoint | Description | Auth Required | Permitted Roles | Response Schema |
|---|---|---|---|---|---|
| `GET` | `/cases/{id}/audit` | Retrieve case-scoped append-only audit trail | Bearer JWT | Auditor, Admin, Case Owner | List[`AuditEventOut`] |
| `GET` | `/cases/{id}/audit/verify`| Cryptographically verify HMAC-SHA256 signature chain | Bearer JWT | Auditor, Admin | `AuditVerificationResult` (valid, discrepancies) |
| `GET` | `/audit/events` | Query global cross-case audit log with semantic filtering | Bearer JWT | Auditor, Admin | `PaginatedAuditEvents` |
