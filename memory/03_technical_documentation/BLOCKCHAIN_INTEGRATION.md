# DRISTI-NET — Master Blockchain & Ledger Integration Documentation

**Authority:** `docs/adr/014-merkle-besu-anchor.md`, `apps/api/app/services/integrity.py`, `docs/context.md` §7  
**Consolidation Date:** 2026-11-19  

---

## 1. Architectural Role of Distributed Ledgers

In strict compliance with **ADR-014** and the DRISTI-NET Product Constitution (`docs/context.md` §7.3):
1. **Original Evidence Stays Off-Chain:** Binary evidence files and personally identifiable information (PII) are **never** stored on any blockchain or distributed ledger.
2. **Cryptographic Integrity References Only:** Ledgers are utilized solely to store immutable, timestamped Merkle roots derived from evidence inventories and audit log snapshots.
3. **No Automatic Truth:** A blockchain anchor proves that a specific cryptographic hash existed at or before a specific timestamp without modification. It does not prove that the underlying allegations in an evidence document are true, accurate, or legally admissible.

---

## 2. RFC 6962 Cryptographic Merkle Tree Engine

The integrity engine (`apps/api/app/services/integrity.py`) implements the standardized **RFC 6962** (Certificate Transparency) Merkle tree hashing scheme:
- **Leaf Hash Calculation:**
  $$\text{LeafHash}(D) = \text{SHA-256}(0x00 \mathbin{\Vert} D)$$
  Prevents second-preimage attacks by prefixing leaf data with a `0x00` byte.
- **Internal Node Hash Calculation:**
  $$\text{NodeHash}(L, R) = \text{SHA-256}(0x01 \mathbin{\Vert} L \mathbin{\Vert} R)$$
  Internal branch nodes are prefixed with a `0x01` byte.
- **Inclusion Proofs:** The service emits logarithmic $O(\log N)$ cryptographic audit paths, enabling any external court, auditor, or defense counsel to independently verify that an evidence record was included in a published anchor without requiring access to other confidential case files.

---

## 3. Hyperledger Besu Private EVM Integration

- **Network:** Private enterprise Ethereum testnet running Hyperledger Besu 24.1.
- **Client Protocol:** Web3 JSON-RPC over HTTP on TCP port 8545.
- **Smart Contract Interface:** Lightweight registry contract storing `anchorCase(bytes32 caseId, bytes32 merkleRoot)` and recording the transaction block number, miner timestamp, and transaction hash.
- **Opt-In / Decoupled Execution:** Ledger anchoring is asynchronous and opt-in. If the Besu node is offline, case workflows continue uninterrupted; the Merkle root is persisted authoritatively in PostgreSQL and queued for ledger broadcast upon network restoration.
