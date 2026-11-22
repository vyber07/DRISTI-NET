# DRISTI-NET — Restore Test Report

**Date:** 2026-11-01 (session 4); re-run 2026-11-03 on `706934f`: PASS (8/8 evidence, 33/33 audit, identical graphs) · **Code:** branch `audit/session-4-security-fixes` on top of `135edeb`
**Scope actually tested:** the single-host deployment that the demo uses — SQLite database + local object storage.
**Update (2026-11-04):** BLK-04 ("Compose stack cannot start") is resolved — the full stack (Postgres, Neo4j,
MinIO, Redis, ClamAV) now starts and runs; see `frontend-audit/FRONTEND_CONTINUATION_STATE.md`'s "Production
migration" section. That was a one-time SQLite→Postgres/MinIO *migration* verified with
`scripts/verify_pg_minio_migration.py` (reuses this script's own `fingerprint()` unmodified, comparing source
against the freshly-migrated target), not a run of *this* backup→restore drill against Postgres/MinIO.
**Update (2026-11-11):** a backup→restore drill specifically against PostgreSQL + MinIO was run (not
this script, a separate one written for the Compose stack -- see `operations/DISASTER_RECOVERY_PLAN.md`'s
"Drill history" section): `pg_dump`/`pg_restore` and a MinIO object download/upload, both into disposable,
non-live instances, not the live ones. Row counts matched the live source exactly; all 99 audit events
verified with zero HMAC failures after restore; the one evidence object's SHA-256 matched both the backup
file and its database record. Neo4j needs no backup at all -- confirmed it's purely a rebuildable
projection of PostgreSQL rows, not a separate data store.
**Not tested:** `backup_restore_drill.py` itself (as opposed to the separate drill above) run
against Postgres/MinIO specifically (no isolated host, BLK-05), off-host copies, backup
encryption at rest, key escrow, RPO/RTO under load.

## Method
`scripts/backup_restore_drill.py` (repeatable; reads the source, never writes to it):
1. Online backup of the SQLite DB with the SQLite backup API **while the API server was running and serving**,
   plus a copy of the object tree (`quarantine/`, `accepted/`, …).
2. SHA-256 manifest of every backed-up file; manifest re-verified before restore.
3. Restore into a fresh directory.
4. Independent fingerprint of source and restore (separate processes): row count per table; SHA-256 of every
   evidence object against its recorded manifest value; HMAC verification of every audit event; graph projection
   rebuilt from the authoritative rows for every case (in-process builder, Neo4j not involved) and compared by
   `snapshot_hash` at a fixed reference time.

## Source data
An isolated instance (port 8001, temp storage, random secret) seeded with `python -m apps.api.app.seed --ingest`:
48 cases, 8 synthetic evidence files pushed through the **real** pipeline (host ClamAV 1.4 over TCP, real
IndicBERT NER model), reaching `HITL` / `GRAPH_PROJECTED`.

## Results
| Check | Result |
|---|---|
| Backup manifest re-verify | PASS (0 problems) |
| Row counts, 13 tables (audit_events 87, claims 364, entities 66, evidence 8, provenance 364, …) | identical |
| Evidence objects matching recorded SHA-256 after restore | 8 / 8 |
| Audit events whose HMAC verifies after restore | 87 / 87 |
| Graph rebuild from restored rows | CASE-0001 57 nodes / 119 edges, CASE-0002 3 / 3; snapshot hashes identical to source |
| Restored instance, browser E2E (`tests/e2e`, Playwright/Chromium, port 8002) | 6 / 6 passed |
| **Negative:** one byte changed in a backed-up `calls.csv` | manifest verify reports exactly that file |
| **Negative:** restore verified with a different `DRISHTI_SECRET_KEY` | 87 / 87 audit HMACs fail |

## What this shows / does not show
- A consistent online backup of this deployment can be restored and is byte-identical for evidence, verifiable
  for audit, and produces the same graph. The graph needs no separate backup (it is rebuilt from PostgreSQL/SQLite
  rows), consistent with `docs/context.md` §7.3.
- **The signing key is part of the recovery set.** The audit trail is only verifiable with the same
  `DRISHTI_SECRET_KEY` / `DRISHTI_AUDIT_KEYS`; these are not in the data backup and must be escrowed separately
  (and never stored next to the backup unencrypted).
- It says nothing about the PostgreSQL/MinIO path. `operations/BACKUP_POLICY.md` describes `pg_dump`, bucket
  versioning, `mc mirror` and a weekly automated test restore — **none of those exist or have been run**.

Reproduce: `python scripts/backup_restore_drill.py --db <db> --storage <storage root> --work <empty dir> --wrong-key-check`
(export the instance's `DRISHTI_SECRET_KEY` first). Exit 0 = PASS; `report.json` is written into `--work`.
