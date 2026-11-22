# DRISTI-NET — Master Audit & Provenance Specification

**Authority:** `docs/AUDIT_LOG_POLICY.md`, `docs/adr/013-audit-logging.md`, `apps/api/app/services/audit.py`  
**Consolidation Date:** 2026-11-19  

---

## 1. Immutable Audit Chaining Architecture

DRISTI-NET implements a tamper-evident, append-only cryptographic audit ledger:

```
[Genesis Block / Event 0]
       │
       ▼  (Hash 0)
[Event 1] ──► HMAC-SHA256(Payload 1 || Hash 0, SecretKey) = Signature 1
       │
       ▼  (Hash 1 = Signature 1)
[Event 2] ──► HMAC-SHA256(Payload 2 || Hash 1, SecretKey) = Signature 2
       │
       ▼  (Hash 2 = Signature 2)
[Event 3] ──► HMAC-SHA256(Payload 3 || Hash 2, SecretKey) = Signature 3
```

- **Unambiguous Serialization:** Audit payloads are serialized to deterministic canonical JSON (sorted keys, no extraneous whitespace, UTF-8 encoded) before signature computation.
- **Timezone Invariance:** Audit timestamps are enforced in ISO 8601 UTC format.
- **Tamper Detection:** An auditor or administrator can invoke `GET /api/v1/cases/{id}/audit/verify` at any time. The service recomputes the entire cryptographic chain from the genesis record to the latest event. Any modified, inserted, or deleted event breaks the chain immediately, pinpointing the exact corrupted record index.

---

## 2. Mandatory Audited Events

The audit engine captures:
1. `USER_LOGIN` / `USER_LOGOUT` / `LOGIN_FAILED` / `PASSWORD_CHANGED`
2. `EVIDENCE_UPLOADED` / `EVIDENCE_SCANNED` / `EVIDENCE_PROMOTED` / `EVIDENCE_DOWNLOADED`
3. `EXTRACTION_COMPLETED` / `EXTRACTION_FAILED`
4. `CANDIDATE_ACCEPTED` / `CANDIDATE_REJECTED` / `CANDIDATE_DEFERRED` (includes user written rationale)
5. `PII_UNMASKED` (captures officer ID, target identifier, and statutory justification)
6. `GRAPH_QUERIED` / `TIMELINE_ACCESSED`
7. `REPORT_GENERATED` / `DOSSIER_DOWNLOADED`
8. `PERMISSION_OVERRIDE_GRANTED` / `CASE_ASSIGNMENT_MODIFIED`
9. `SECURITY_DENIAL` / `ACCESS_FORBIDDEN` / `INTEGRITY_MISMATCH`
