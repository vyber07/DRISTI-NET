# DRISTI-NET — Security Architecture & Defense-in-Depth Specification

## 1. Security Architecture Principles

DRISTI-NET implements a defense-in-depth security model tailored to law enforcement digital intelligence requirements:

1. **Principle of Least Privilege**: Officers only access cases within their verified statutory jurisdiction where an explicit active assignment exists.
2. **Fail-Closed Perimeter**: Quarantine and anti-malware scanning strictly isolate unverified payloads. If a scanner is offline or encounters an error, the file remains locked in quarantine.
3. **Data Minimization & Default Masking**: PII (phone numbers, bank accounts, government IDs) is masked across all standard views and API endpoints.
4. **Non-Repudiation**: Every analytical interaction, manual reveal, review decision, and report download generates an HMAC-signed audit log linked in a tamper-evident cryptographic chain.
5. **Separation of Duties**: Operational roles strictly partition duties (e.g., Evidence Officers ingest and quarantine; Reviewers arbitrate merges; Auditors inspect chains).

---

## 2. Threat Mitigation Matrix

| Threat Vector | Attack Scenario | Architectural Defense |
|---------------|-----------------|------------------------|
| **Malicious File Upload** | Attacker uploads malware/exploit disguised as evidence (PDF/ZIP). | Quarantine isolation storage + multi-stage ClamAV TCP scan gate + file size/page limits + safe parsing in memory. |
| **Path Traversal / Archive Bombs** | Uploaded ZIP contains `../../etc/passwd` or recursive compression bombs. | `_check_archive()` defense-in-depth verifying member names, total uncompressed size, and decompression ratio. |
| **Unauthorized Case Access** | Investigator in District A attempts to inspect a case in District B. | Server-side `authorize_case()` dependency checking JWT claims against `case.jurisdiction` and `case_assignments` before querying database. |
| **PII Exfiltration** | Rogue analyst bulk-downloads customer telephone records. | Default schema masking (`*91 90000-***-****`). Unmasking requires single-entity POST `/reveal` with mandatory logged statutory justification. |
| **Audit Tampering** | Malicious administrator alters database logs to cover actions. | Chained HMAC-SHA256 signatures (`prev_hash` + `signature` using rotated key `k1-2026`). Verification endpoint `GET /audit/verify` detects any modified record. |
| **Brute Force Credential Attack** | Automated credential stuffing targeting officer accounts. | Redis-backed `login_throttle` limiting failed attempts per IP/account window (5 attempts per 15 minutes). |
| **Model Prompt Injection** | Adversarial text embedded in FIR attempting to hijack NER extraction. | Strictly scoped token classification pipeline (IndicBERT) returning structured span offsets without generative freeform text synthesis. |

---

## 3. Cryptographic Key Management & Rotation

- **JWT Signing Key**: Minimum 32-character secret (`DRISHTI_SECRET_KEY`) used for HMAC-SHA256 session token verification.
- **Audit Signing Key Registry**: JSON key map (`AUDIT_KEYS`) with key versioning (`k1-2026`, `k2-2027`). Allows rotating keys without invalidating historic audit trail verification.
- **Evidence Integrity**: SHA-256 digests computed immediately on stream arrival and verified before extraction.
