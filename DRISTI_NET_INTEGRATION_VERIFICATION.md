# DRISTI-NET Integration Verification

No live external service was successfully verified during this audit. Code/configuration presence is not treated as a successful connection.

| System | Code/config evidence | Actual connection / end-to-end result | Status |
|---|---|---|---|
| SQLite | `apps/api/app/db.py`, test fixture | Full backend suite passed against isolated SQLite and temporary storage: 210 passed, 6 skipped, 1 deselected. | IMPLEMENTED — PARTIAL |
| PostgreSQL | Compose, SQLAlchemy, Alembic migrations | Compose status blocked by missing effective required env; no live connection attempted. | UNVERIFIABLE |
| Local object storage | `services/storage.py` | Test suite temp storage configured; no completed result proving end-to-end. | IMPLEMENTED — PARTIAL |
| S3/MinIO | `services/storage.py`, Compose, `test_storage_s3.py` | No endpoint connection verified. Restore drill report covers SQLite/local only. | UNVERIFIABLE |
| Neo4j | `services/neo4j_store.py`, Compose, `test_neo4j_live.py` | Not connected in this audit. Existing docs describe optional projection/fallback. | UNVERIFIABLE |
| Redis | `services/ratelimit.py`, Compose | Not connected; code is optional and fails open/degrades when unavailable. | IMPLEMENTED — PARTIAL |
| Kafka | `services/kafka_bus.py`, `workers/worker.py`, `requirements-kafka.txt` | No live producer-consumer run. Documentation conflicts about adoption; opt-in path needs reconciliation. | UNVERIFIABLE |
| ClamAV | `services/scanner.py`, `test_clamav_live.py` | Audit tests used `testgate`, not ClamAV. Prior docs claim a live daemon on an earlier host/date only. | UNVERIFIABLE |
| Besu/EVM | optional adapter in `services/integrity.py`, `scripts/validate_besu.py` | No RPC/contract connection or anchor transaction verified. | UNVERIFIABLE |
| OCR / IndicBERT | `services/ocr_adapter.py`, `services/nlp_adapter.py`; optional requirements | Runtime model availability/inference not freshly tested; global backend fixture mocks NLP. | IMPLEMENTED — PARTIAL |
| Nginx/systemd/Docker | Compose, Dockerfile, `infrastructure/` | `docker compose ps` failed at env interpolation; no current health/TLS/restart check. | UNVERIFIABLE |
| Email, government, telecom, banking, biometric connectors | Not found; product boundary prohibits unapproved connections | No connectors verified; intentional boundary in `docs/context.md`. | OPTIONAL / OUT OF SCOPE |

Local tests did verify limited protocol/library behavior, not real integrations: ClamAV mock-protocol tests passed 9/9 outside the sandbox; Merkle/graph unit tests passed 42 with the API anchor route deselected; Redis disabled/unreachable unit behavior passed 2/2 with real Redis tests deselected. No Redis, ClamAV daemon, Neo4j, Kafka, S3, PostgreSQL or Besu service was connected during this audit.

Next: use a disposable staging stack with synthetic data and explicit health checks; test service outage behavior and full evidence flow before classifying integrations as operational.

## 2026-11-10 recovery addendum

The broad target-deletion behavior in both migration scripts was removed in source after static verification. Four success/failure tests use fake S3 and temporary SQLite; the full backend suite now passes 214 tests (6 skipped, 1 deselected). This does not change the integration statuses above: no S3-compatible endpoint or PostgreSQL target was connected, and neither migration was run. Rehearse the conditional S3 write and PostgreSQL lock behavior on a disposable stack before operational use.

## Deployment and recovery coupling findings

- Compose requires healthy PostgreSQL, Neo4j, Redis, MinIO, ClamAV, Kafka and Besu before API/worker startup (API also waits for successful migrations). This is stricter than several app-level optional/degraded paths and means a Kafka/Besu outage can block the core API stack.
- Compose sets `DRISHTI_BESU_ENDPOINT` but not `DRISHTI_BESU_SIGNING_KEY`; the integrity route submits only when both exist. The default Compose wiring therefore does not prove on-chain writes; anchors can remain local-only.
- `infrastructure/nginx/nginx.conf` listens on port 80 only and has no TLS listener/certificate config. This describes the bundled config; the current host proxy/TLS remains UNVERIFIABLE.
- `docker-compose.override.yml` and systemd units use host-specific paths/port bindings; native API and Compose systemd units both exist. They are not a portable migration recipe on their own.
- `Dockerfile` builds the UI with Node 22 and the Python container defaults to root; repository environment notes specify Node 24. No clean Docker build or non-root container runtime check was performed.
- The native API unit comment says DB migrations run on startup, but `db.init_db()` only creates/additively upgrades SQLite; PostgreSQL migrations are explicit (`apps/api/app.migrations` and Compose migration service).

### Migration and recovery safety

- `scripts/migrate_evidence_to_minio.py` enumerates and deletes **every object in the selected bucket** before uploading local `accepted/`, `quarantine/` and `derived/` files. It has no dry-run or deletion confirmation/prefix restriction. Do not run against a non-disposable bucket absent verified backup and endpoint/bucket preflight.
- `scripts/migrate_sqlite_to_postgres.py` deletes every target table row before copying the source in a transaction. `--dry-run` prints counts only; there is no guard requiring a disposable/empty target. Do not run against live/non-disposable target absent verified backup and explicit target confirmation.
- `operations/RESTORE_TEST_REPORT.md` is historical (2026-11-01/03) and covers SQLite + local storage. It explicitly excludes PostgreSQL + MinIO/S3 restore, off-host copy, backup encryption/key escrow and tested RPO/RTO.
- `operations/BACKUP_POLICY.md` labels PostgreSQL/MinIO schedules, versioning, mirror and weekly restore as target-only/not implemented.
- `operations/DISASTER_RECOVERY_PLAN.md` labels itself target/not tested but includes nonexistent commands (`integrity_routes` CLI, `/api/v1/audit/verify`, Neo4j `--rebuild-all`) and destructive graph-storage deletion guidance. Its text also conflates per-event HMAC with a chain. Do not use it until replaced by reviewed, tested steps.
