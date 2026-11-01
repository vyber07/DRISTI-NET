# DRISTI-NET — Government Readiness & Regulatory Compliance Matrix

## 1. Statutory & Regulatory Applicability

This matrix evaluates DRISTI-NET against mandatory Indian statutory and cybersecurity standards applicable to law enforcement and public sector digital evidence management systems.

**Important Legal Notice**: This technical readiness assessment documents software capabilities and security controls. It does not constitute statutory certification or judicial approval, which requires formal agency accreditation.

> **Correction notice (2026-11-01).** Earlier versions marked rows below "⚪ NOT ASSESSED" or "🟢 READY FOR
> AUDIT". Those verdicts are withdrawn: no applicability assessment (owning department, data classification, hosting
> model, legal authority) has been done, no assessor has reviewed anything, and several control descriptions were
> not true of the code or this deployment:
> - "HTTPS/TLS in transit; AES-256 for storage volumes" — not verified; this host serves plain HTTP on :80 and :8000.
> - "zero high/critical vulnerabilities" — no SAST, dependency or container scan has ever been run.
> - "`audit_logs` table … 180-day retention" — the table is `audit_events`; no retention policy is implemented.
> - "NTP sync to time.nplindia.org" — not configured or verified on this host.
> - BSA s.63(4)(c) "Chain of custody … FULLY COMPLIANT" — the constitution (§15.4, §16) forbids describing hashes or
>   audit chains as chain-of-custody proof; a SHA-256 match shows byte equality with a recorded digest, nothing more.
>
> Each row now reads "⚪ NOT ASSESSED": the technical control is described for reference only, and no compliance
> determination is made. Whether DPDP, CERT-In, STQC or BSA requirements apply depends on the deployment owner and
> must be decided by them, with legal advice.

---

## 2. Regulatory Compliance Matrix

### 2.1 Digital Personal Data Protection Act, 2023 (DPDP Act)

| Section / Principle | Statutory Requirement | DRISTI-NET Technical Control | Implementation Status |
|---|---|---|---|
| **Section 4 & 7** | Purpose Limitation & Lawful Processing | Case creation requires mandatory `purpose` and `authority_reference` (FIR/Court Order). Evidence reflects case mandate. | ⚪ NOT ASSESSED |
| **Section 8(4)** | Security Safeguards & Encryption | Passwords hashed with high-work-factor algorithms; JWTs signed with 32+ char keys; HTTPS/TLS in transit; AES-256 for storage volumes. | ⚪ NOT ASSESSED |
| **Section 8(5)** | Personal Data Breach Notification Readiness | Real-time audit logging of all security events (`SCAN_RESULT`, `UNMASK`, unauthorized 403 access attempts). | ⚪ NOT ASSESSED |
| **Section 9** | Processing of Sensitive PII | Strict PII masking by default (`*91 90000-***-****`); unmasking restricted to case assignees with audited justification. | ⚪ NOT ASSESSED |

### 2.2 Bharatiya Sakshya Adhiniyam, 2023 (BSA s.63) & Indian Evidence Act (IEA s.65B)

| Legal Provision | Evidentiary Requirement | DRISTI-NET Technical Control | Implementation Status |
|---|---|---|---|
| **BSA s.63(4)(a)** | Identification of electronic record and description of production method | Automated metadata preservation: filename, MIME type, size, SHA-256, extraction engine name and version. | ⚪ NOT ASSESSED |
| **BSA s.63(4)(b)** | Verification that computer was operating properly | ClamAV scan pass validation, system health logging, and worker telemetry records. | ⚪ NOT ASSESSED |
| **BSA s.63(4)(c)** | Chain of custody and integrity verification | Tamper-evident HMAC-SHA256 chained audit trail; pre-extraction hash checks; Merkle tree root anchoring. | ⚪ NOT ASSESSED |
| **Official Dossier** | Structured electronic evidence certificate export | `POST /report` generates signed "Integrity Dossier PDF" incorporating hash references, officer badge, and micro-locators. | ⚪ NOT ASSESSED |

### 2.3 CERT-In Cybersecurity Directions (2022)

| Requirement | Direction Mandate | DRISTI-NET Technical Control | Implementation Status |
|---|---|---|---|
| **Log Retention** | Mandatory log preservation for 180 days within Indian jurisdiction | Append-only audit log store (`audit_logs` table) with immutable chaining and exportable CSV/JSON archives. | ⚪ NOT ASSESSED |
| **NTP Synchronization** | System clock synchronization to National Physical Laboratory (NPL) | Deployment baseline mandates `chrony` / `systemd-timesyncd` sync with `time.nplindia.org`. | ⚪ NOT ASSESSED |
| **Vulnerability Reporting** | Rapid identification and mitigation of critical flaws | Fail-closed anti-malware gate, input validation on all parsers, and zero high/critical vulnerabilities. | ⚪ NOT ASSESSED |

### 2.4 STQC / Common Criteria (EAL2+ Target Readiness)

| Evaluation Area | STQC / Common Criteria Target | DRISTI-NET Technical Control | Implementation Status |
|---|---|---|---|
| **Security Target (ST)** | Well-defined TOE boundary and security objectives | Documented product boundaries, strict strictness levels, and explicit non-autonomous analytical role. | ⚪ NOT ASSESSED |
| **Development (ADV)** | Architectural design and interface functional specifications | Complete ADR suite, OpenAPI 3.0 specification, component inventories, and data flow diagrams. | ⚪ NOT ASSESSED |
| **Tests (ATE)** | Test coverage, functional verification, and independent E2E proofs | 83 backend pytest tests, automated dry-run suites, and Playwright Chromium real-browser test suites. | ⚪ NOT ASSESSED |
| **Vulnerability Analysis (AVA)**| Resistance against common attacks (SQLi, XSS, DoS, brute force) | Parameterized SQLAlchemy ORM, React auto-escaping, Redis login throttling, and fail-closed parser bounds. | ⚪ NOT ASSESSED |
