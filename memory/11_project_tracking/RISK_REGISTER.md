# DRISTI-NET — Project Risk & Blocker Register

**Authority:** `PROJECT_RISK_REGISTER.md`, `PROJECT_BLOCKERS.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Active Risk Register

| Risk ID | Category | Description | Likelihood | Impact | Mitigation Strategy | Status |
|---|---|---|---|---|---|---|
| **RSK-01** | Technical | Neo4j query timeout on dense high-degree graph clusters | Medium | Medium | Hard server-side 5000ms timeout + automatic degradation to in-process NetworkX projection with `projection_stale: true`. | **Mitigated** |
| **RSK-02** | Security | Malicious zip bomb or directory traversal attack via archive upload | High | Critical | Pre-decompression central directory check: max 100:1 ratio, 250 MB total, rejection of `..` or symlink members. | **Mitigated** |
| **RSK-03** | Legal / Ethical | Unwarranted investigative bias or false identity merge | High | Critical | Strict prohibition of automated merges. Mandatory Human-in-the-Loop review with written justification and audit logging. | **Mitigated** |
| **RSK-04** | Operational | Memory exhaustion during large digital evidence file download | Medium | High | Streaming downloads via `StreamingResponse` using 64 KB chunk iterators directly from MinIO/disk. | **Mitigated** |
| **RSK-05** | Integrity | Audit signature mismatch caused by host timezone shifts | High | Critical | Pin all database sessions to UTC (`SET TIME ZONE 'UTC'`) and enforce ISO 8601 UTC timestamps in audit serializers. | **Mitigated** |
| **RSK-06** | Deployment | Uncontrolled file duplication and stale documentation in repository root | High | Medium | Comprehensive Phase 1-3 memory consolidation, removal of verified duplicates, and updated `.gitignore`. | **In Progress** |

---

## 2. Active Blocker Tracking

- **Current Blocker Count:** **Zero technical blockers.**
- All backend unit/integration tests pass. The baseline backup is established. Central memory repository structure is populated.
