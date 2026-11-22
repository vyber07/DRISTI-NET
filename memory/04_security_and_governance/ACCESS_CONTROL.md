# DRISTI-NET — Master Access Control & Authorization Specification

**Authority:** `docs/AUTHORIZATION_OVERRIDES.md`, `docs/adr/015-permission-overrides.md`, `apps/api/app/auth.py`, `docs/CASE_ASSIGNMENT.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Role-Based Access Control (RBAC) Matrix

DRISTI-NET enforces six core roles across the investigation hierarchy:

| Role Name | Scope & Authority | Allowed Actions | Restricted Actions |
|---|---|---|---|
| **INVESTIGATOR** | Assigned cases only | Search case entities, explore POLE+ graphs, view timelines, request PII unmasking, view accepted evidence, generate dossiers. | Cannot upload/delete raw evidence, alter audit logs, or arbitrate reviewer queues. |
| **EVIDENCE_OFFICER** | Assigned cases | Upload evidence, monitor quarantine & virus scans, inspect SHA-256 manifests, generate Merkle anchors. | Cannot view unmasked suspect PII or perform analytical cross-case link discovery. |
| **REVIEWER / SUPERVISOR**| Assigned cases | Arbitrate match candidates (Accept, Reject, Defer), author written review rationales, assign case members, grant temporary permission overrides. | Cannot delete audit trails or modify raw evidence files. |
| **ANALYST** | Cross-case read (assigned) | Filter temporal networks, inspect bridge candidates and betweenness centrality, evaluate community stability, detect cross-case patterns. | Cannot alter evidence states or arbitrate identity merges. |
| **AUDITOR** | System-wide read-only | Inspect global append-only audit trail, verify HMAC signature chains, audit unmasking events and access denials, export compliance summaries. | Cannot modify cases, entities, claims, or system configuration. |
| **ADMIN** | System management | Manage user accounts, role definitions, jurisdiction configurations, emergency permission overrides, and container health. | Cannot silently delete audit records or bypass quarantine scanning gates. |

---

## 2. Object-Level Case Authorization Scoping

- A user's role is necessary but **not sufficient** to access case data.
- The user must possess an explicit active record in `case_assignments` for the target `case_id`.
- Unassigned requests are rejected server-side with HTTP 403 Forbidden:
  ```json
  {
    "detail": "User is not assigned to this investigation case",
    "error_code": "FORBIDDEN_CASE_ACCESS"
  }
  ```
- Denied attempts generate an immutable security audit event: `CASE_ACCESS_DENIED`.

---

## 3. Temporary Elevation & Permission Overrides (`permission_overrides`)

For urgent cross-jurisdictional cooperation or emergency supervisor reviews:
1. An investigator submits a time-bound override request specifying the target case, reason, and requested duration (maximum 72 hours).
2. A Reviewer or Administrator must approve the request with an audited digital signature.
3. While active, the backend middleware grants elevated read access.
4. Upon expiration, access reverts automatically without requiring manual revocation.
