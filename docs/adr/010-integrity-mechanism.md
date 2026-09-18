# ADR-010: Evidence integrity mechanism

## Problem

Uploaded evidence must be detectably tamper-evident — if the stored bytes ever diverge from what was
originally accepted, that divergence must be caught, not silently trusted on every subsequent read.

## Options considered

- **No integrity check** — rejected outright; directly contradicts the product's evidence-chain premise.
- **Append-only hash chain / Merkle tree / transparency log** (directive §49 raises these as options to
  evaluate) — a real, heavier mechanism that would let you prove not just "this file matches its original
  hash" but "this whole history of records hasn't been reordered or had entries removed." Not implemented.
- **Per-file SHA-256 manifest, verified on demand** — what was implemented: a SHA-256 hash recorded at
  upload/acceptance time, checked again via `GET /evidence/{id}/verify`, with a dedicated
  `INTEGRITY_MISMATCH` evidence state that blocks acceptance/re-extraction if the check fails.

## Decision

SHA-256 manifest hashing, verified on demand, not a hash chain or transparency log.

## Reason

A hash chain / Merkle tree is a meaningfully larger piece of infrastructure (key management, rotation, a
place to anchor the root, its own failure modes) that this prototype has no demonstrated need for yet — a
per-file hash already satisfies the concrete, tested requirement ("altered evidence produces a hash
mismatch," `docs/security.md` row 6). Building the heavier mechanism speculatively would again be the
"technology without justification" pattern the directive's §64 warns against.

## Trade-offs

A per-file hash proves *this file's bytes* haven't changed since it was accepted. It does **not** prove
anything about the order, completeness, or non-deletion of the broader evidence *record* over time the way
a hash chain or transparency log would — an insider with database access could still delete an evidence
row outright (leaving no mismatch to detect, because there's nothing left to check). This is a real,
acknowledged limitation, not glossed over: `docs/limitations.md` and this ADR both name it explicitly.

## Security implications

`SHA-256 hash reference` is explicitly documented (per the directive's own required language) as an
**integrity reference, not a chain-of-custody certificate** — this project never claims the hash
constitutes legal proof of anything, only that it can detect byte-level tampering of a file that is still
present in storage.

## Performance implications

One SHA-256 computation per file at upload/verify time; negligible for the file sizes this prototype
handles (`DRISHTI_MAX_UPLOAD_MB` = 25).

## Migration

Adding a hash chain later would layer on top of the existing per-file hashes (each manifest entry could
become a leaf in a chain/tree) without needing to change how individual file integrity is checked today.

## Rollback

N/A — no simpler prior mechanism existed to roll back to.

## Verification

`test_hash_manifest_and_tamper_detection` — covers the real tamper-then-detect path: a file is accepted,
its stored bytes are then mutated directly (the admin "demo tamper" route), and a subsequent verify call
correctly reports `INTEGRITY_MISMATCH` rather than silently returning stale-but-plausible data.
