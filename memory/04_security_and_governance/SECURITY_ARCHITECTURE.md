# DRISTI-NET — Master Security Architecture & Threat Model

**Authority:** `docs/SECURITY_ARCHITECTURE.md`, `security/SECURITY_ASSESSMENT.md`, `security/THREAT_MODEL.md`, `docs/security.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Security Philosophy & Principles

DRISTI-NET operates under a **Zero-Trust, Fail-Closed Security Model** tailored for digital forensics and criminal investigation intelligence:
1. **Default-Deny Access:** Unauthenticated requests, requests from users not explicitly assigned to a case, and unapproved cross-jurisdiction access attempts are denied server-side with HTTP 403 Forbidden and logged as security anomalies.
2. **Fail-Closed Processing:** If any security checkpoint (antivirus scanner, rate-limiter, JWT signature validator, file integrity checker) experiences a timeout or service interruption, the pipeline halts immediately in a secure state.
3. **No Secrets in Source:** All production credentials, cryptographic keys, and database passwords are injected via runtime environment variables and excluded from Git.

---

## 2. Threat Modeling & Attack Surface Mitigation (STRIDE Analysis)

| Threat Category | Potential Attack Vector | DRISTI-NET Mitigation Mechanism |
|---|---|---|
| **Spoofing** | Forged JWT bearer tokens or session replay | Cryptographically signed JWTs (PBKDF2/HMAC), server-side `token_version` check on every authenticated request, active session revocation table, and sliding token expiration. |
| **Tampering** | Modification of evidence bytes, claims, or audit logs | Immediate SHA-256 calculation upon upload, immutable object storage buckets, append-only PostgreSQL tables, and cryptographic HMAC-SHA256 audit chaining. |
| **Repudiation** | An officer denies viewing sensitive PII or altering a match decision | Mandatory unmasking audit logs, mandatory written justification for all HITL arbitration decisions, and client IP/user-agent capture in every audit record. |
| **Information Disclosure** | Unauthorized exposure of phone numbers, PAN, or financial accounts | Default-on PII masking across all API endpoints and frontend views. Unmasking requires deliberate user action, justification, and generates an `UNMASK` audit log. |
| **Denial of Service** | Archive zip bombs, path traversal, or massive high-degree graph queries | Pre-extraction archive inspection (100:1 ratio limit), path traversal rejection, server-enforced Cypher query timeouts (5000ms), and 500-node query caps. |
| **Elevation of Privilege**| Unauthorized cross-case or administrative action | Server-side role enforcement (RBAC) in FastAPI dependencies, multi-investigator case assignment scoping, and time-bounded permission overrides requiring supervisor approval. |

---

## 3. Cryptographic Key Management & Rotation

- **JWT Secret Key:** Enforces a minimum entropy floor (rejects keys under 32 characters in production).
- **HMAC Audit Key Rotation:** Supported via versioned key identifiers (`AUDIT_HMAC_KEYS={"v1": "...", "v2": "..."}`). New audit records sign with the active key, while historical records verify against their recorded key version.
- **Password Storage:** Salted PBKDF2 with SHA-256 and 100,000+ iterations.
