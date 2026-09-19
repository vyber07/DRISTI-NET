# ADR-014: Merkle root + Hyperledger Besu integrity anchoring

## Problem

ADR-010 documented Merkle tree / transparency log as a future option when "a measured need"
justified the infrastructure.  The PS 26189 evaluation now explicitly requires demonstrated
Merkle anchoring as part of the blockchain-and-cybersecurity theme.

## Decision

Add `services/integrity.py` implementing:
1. **Merkle tree** (SHA-256, RFC 6962 / Bitcoin convention): deterministic root, inclusion proofs.
2. **LedgerAnchor** PostgreSQL table: stores Merkle root + optional ledger tx reference.
3. **Besu adapter** (import-guarded): submits Merkle root as tx.data to an EVM-compatible node.

ADR-010's per-file SHA-256 manifest is **unchanged** — it remains the primary tamper-detection
mechanism.  Merkle anchoring adds a batch-level integrity reference that can cover an entire
case's evidence set in one transaction.

## What is on-chain

**Only the Merkle root** (a 32-byte SHA-256 hash).  No evidence bytes, no PII, no structured
data enter the ledger.  Evidence remains fully off-chain in PostgreSQL and MinIO.

## What it proves (and does not prove)

The Merkle root proves that a specific ordered set of evidence SHA-256 hashes was known at
the time the anchor transaction was submitted and that no hash in that set was later altered.
It does **not** prove chain of custody, legal admissibility, or that the underlying files were
collected lawfully.  Language everywhere: *"integrity reference"*, never *"chain-of-custody
certificate"* (docs/context.md §16, ADR-010).

## Besu evaluation setup

- Hyperledger Besu 25.7.0 in `--network=dev` mode (auto-mining, well-known dev key).
- Production: permissioned network, HSM-backed key, TLS-secured RPC.
- The dev signing key in `DRISHTI_BESU_SIGNING_KEY` must NEVER be used outside the
  evaluation stack.  It is a well-known key in every Besu dev-mode instance.

## API

```
POST /cases/{case_id}/integrity/anchor          → create anchor
GET  /cases/{case_id}/integrity/anchors          → list anchors
GET  /cases/{case_id}/integrity/anchors/{id}/proof/{sha256}  → inclusion proof
```

## Trade-offs

- One Merkle root per API call covers an entire case's evidence set — cost-effective vs one
  transaction per file.
- web3 is NOT added to `requirements.txt` (import-guarded, install separately for Besu path).
- Besu can be absent (no `DRISHTI_BESU_ENDPOINT` set) — anchor is stored as `LOCAL_ONLY`.
- Inclusion proof is verifiable offline with `MerkleProof.verify()`.

## Verification

`test_new_components.py::TestMerkleTree` — 10 tests covering: empty list, single leaf,
two leaves, odd-length duplication, determinism, order-sensitivity, inclusion proof for all
indices, tampered-leaf failure, out-of-range IndexError, hash correctness.

`test_new_components.py::TestIntegrityRoutes` — covers anchor creation, list, proof round-trip,
role denial (auditor), 404 for unknown SHA.
