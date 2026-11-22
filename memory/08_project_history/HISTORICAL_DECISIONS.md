# DRISTI-NET — Master Historical Decision Log

**Authority:** `PROJECT_DECISION_LOG.md`, `docs/ARCHITECTURE_DECISIONS.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Key Architectural Decisions

1. **PostgreSQL as Authoritative Source of Truth:** Neo4j is strictly an analytical projection. All graph data must remain 100% rebuildable from relational claims.
2. **Never Automatically Merge Person Entities:** Automatic merging on shared identifiers (phones, IP, vehicles) leads to catastrophic false arrests and legal liability. Human arbitration is mandatory.
3. **Fail-Closed Malware Scanner Gate:** If the antivirus scanner fails or times out, processing halts; unverified files never reach extraction.
4. **Append-Only HMAC-SHA256 Audit Trail:** Audit records are cryptographically chained and pinned to UTC timestamps.
5. **Neutral Factual Language:** Outputs strictly avoid terms like *criminal*, *kingpin*, *guilt*, or *threat score*, using neutral phrases (*candidate relationship*, *possible bridge*, *review priority*).
6. **No Raw Evidence on Blockchain:** Only Merkle roots and integrity references are anchored to distributed ledgers; evidence bytes and PII remain off-chain.
7. **Streaming Large Files:** Large file downloads stream via `StreamingResponse` with `storage.iter_bytes()`, preventing heap memory exhaustion.
