# DRISTI-NET — Project Decision Register

**Authority:** `PROJECT_DECISION_LOG.md`  
**Consolidation Date:** 2026-11-19  

---

| Decision ID | Date | Subject | Decision Taken | Rationale | Impact |
|---|---|---|---|---|---|
| **DEC-001** | 2026-08-10 | Primary Database | Adopt PostgreSQL 16 as sole relational system of record | High ACID compliance, rich indexing, and strict provenance support | Neo4j is disposable/rebuildable |
| **DEC-002** | 2026-08-28 | PII Privacy | Default-on masking for phone, PAN, Aadhaar hash, accounts | Compliance with DPDP Act 2023 and protection of sensitive suspect/witness data | Unmasking requires audited rationale |
| **DEC-003** | 2026-09-05 | Audit Security | Cryptographic HMAC-SHA256 signature chaining on all audit entries | Non-repudiation and immediate tamper detection for legal scrutiny | Tampered events break verification chain |
| **DEC-004** | 2026-09-22 | Blockchain Anchoring | Use private Hyperledger Besu EVM testnet with RFC 6962 Merkle trees | External integrity proof without exposing confidential evidence on-chain | Privacy preserved; zero off-chain leakage |
| **DEC-005** | 2026-10-04 | File Validation | Libmagic byte sniffing and pre-extraction zip inspection | Prevention of zip bombs and path traversal attacks | Fail-closed security before disk extraction |
| **DEC-006** | 2026-11-13 | UI Accessibility | Minimum 12px text floor and Radix accessible modal drawers | Full WCAG 2.1 AA compliance across mobile and desktop devices | Zero axe-core violations |
| **DEC-007** | 2026-11-19 | Account Control | Self-service password rotation, display name edit, and session revocation | Zero-trust session management and defense against credential theft | `token_version` check on all API calls |
| **DEC-008** | 2026-11-19 | Memory Reorganization | Consolidate 25 loose root markdown registers into structured `memory/` master repository | Eliminate massive file duplication and establish single authoritative knowledge base | Clean root directory, updated `.gitignore` |
