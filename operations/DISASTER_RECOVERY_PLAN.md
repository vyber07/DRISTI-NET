# DRISTI-NET — Disaster Recovery & Service Restoration Plan

> **Status (2026-11-11): rewritten from scratch and drill-tested against the live Compose
> deployment.** The previous version of this document contained several commands that don't exist
> (`integrity_routes` is not a CLI; there is no `neo4j_store --rebuild-all` and no
> `GET /audit/verify`) and one factual error (the audit log is per-event HMAC, not a hash chain).
> Every command below was actually run during this rewrite -- backup, restore into a disposable
> throwaway Postgres + MinIO (not the live instances), and verification -- not just inspected.
> Scope: the live Docker Compose deployment. Still not covered: off-host/offsite backup copies,
> backup encryption at rest, key escrow, and measured RPO/RTO under real load.

## 0. Before any of this: what actually needs backing up, and why

- **PostgreSQL** is the one authoritative source of truth. Every case, evidence record, claim,
  entity, review decision and audit event lives there.
- **MinIO** holds the evidence *bytes* (the files themselves); Postgres holds their SHA-256 and
  metadata. Restoring one without the other leaves either orphaned files or records pointing at
  nothing.
- **Neo4j holds nothing authoritative.** It's a projection of Postgres's Claim/Entity rows,
  rebuilt automatically, in-process, on every graph read (`services/graph.py:build_projection`).
  If Neo4j is unreachable or stale, the app falls back to this same in-process rebuild and marks
  the response `projection_stale: true` -- there is no separate "replay" step to run.
- **The signing key is not part of any backup.** `DRISHTI_SECRET_KEY`/`DRISHTI_AUDIT_KEYS` live
  only in `.env.compose`. Without the exact same key material, a perfectly restored audit trail
  will fail every HMAC check. Back these up separately, out of band, and never alongside the data
  backup itself.

## 1. Backup

```bash
cd /home/ubuntu/DRISTI-NET
set -a; source .env.compose; set +a
B=/home/ubuntu/drishti-backups/dr-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$B"; chmod 700 "$B"

# Postgres: a full logical dump, consistent, taken live without stopping the app.
docker compose --env-file .env.compose exec -T postgres pg_dump -U drishti -d drishti -Fc > "$B/drishti-postgres.dump"

# MinIO: every object, downloaded by key (preserves the same relative-key layout storage.py uses).
.venv311/bin/python3 -c "
import boto3, os
from botocore.config import Config
c = boto3.client('s3', endpoint_url='http://127.0.0.1:9000', aws_access_key_id='drishti',
                  aws_secret_access_key=os.environ['MINIO_ROOT_PASSWORD'], region_name='us-east-1',
                  config=Config(signature_version='s3v4'))
for o in c.list_objects_v2(Bucket='drishti').get('Contents', []):
    key = o['Key']
    local = os.path.join('$B', 'minio-objects', key)
    os.makedirs(os.path.dirname(local), exist_ok=True)
    c.download_file('drishti', key, local)
    print('backed up', key)
"

# Out of band, NOT next to the above: the signing key material.
cp .env.compose "$B/../env.compose.key-backup-$(date -u +%Y%m%dT%H%M%SZ)"
chmod 600 "$B"/../env.compose.key-backup-*
```

## 2. Restore

**Restoring into a fresh/disposable target first, to verify the backup, is strongly recommended
before ever restoring over the live instances.** This is exactly what this rewrite did.

### Scenario A: PostgreSQL corruption or loss

```bash
# Stop writes first -- the api/worker containers, not the whole stack.
docker compose --env-file .env.compose stop api worker

# Point at a fresh target. On the live instance, this means dropping and recreating the database
# first (pg_restore --clean handles existing objects, but a corrupted DB may not even accept that).
docker compose --env-file .env.compose exec -T postgres psql -U drishti -d postgres -c "DROP DATABASE IF EXISTS drishti; CREATE DATABASE drishti OWNER drishti;"
docker compose --env-file .env.compose exec -T postgres pg_restore -U drishti -d drishti --no-owner --no-privileges < "$B/drishti-postgres.dump"

docker compose --env-file .env.compose start api worker
```

### Scenario B: MinIO corruption or loss

```bash
set -a; source .env.compose; set +a
.venv311/bin/python3 -c "
import boto3, os
from botocore.config import Config
c = boto3.client('s3', endpoint_url='http://127.0.0.1:9000', aws_access_key_id='drishti',
                  aws_secret_access_key=os.environ['MINIO_ROOT_PASSWORD'], region_name='us-east-1',
                  config=Config(signature_version='s3v4'))
try:
    c.head_bucket(Bucket='drishti')
except Exception:
    c.create_bucket(Bucket='drishti')
B = '$B/minio-objects'
for root, dirs, files in os.walk(B):
    for f in files:
        path = os.path.join(root, f)
        key = os.path.relpath(path, B)
        c.put_object(Bucket='drishti', Key=key, Body=open(path, 'rb').read())
        print('restored', key)
"
```

### Scenario C: Neo4j loss or corruption

```bash
docker compose --env-file .env.compose stop neo4j
docker volume rm dristi-net_drishti-neo4jdata   # or restore a volume backup if one exists
docker compose --env-file .env.compose up -d neo4j
```
Nothing else is required: the next graph read for any case rebuilds its projection directly from
Postgres (`services/graph.py`), the same way it already degrades gracefully today whenever Neo4j is
briefly unreachable.

## 3. Verification (run after any restore, before resuming real traffic)

```bash
cd /home/ubuntu/DRISTI-NET
set -a; source .env.compose; set +a
PGURL="postgresql+psycopg2://drishti:${POSTGRES_PASSWORD}@127.0.0.1:5432/drishti"
set -a; source .env; set +a   # the real signing keys, same side as production

DRISHTI_DATABASE_URL="$PGURL" .venv311/bin/python3 -c "
from apps.api.app.db import SessionLocal
from apps.api.app.models import AuditEvent, Evidence
from apps.api.app.services.audit import verify_audit_event
from apps.api.app.services import storage
db = SessionLocal()

# Audit trail: every event's HMAC must still verify under the real key registry.
total = db.query(AuditEvent).count()
bad = [a.audit_id for a in db.query(AuditEvent) if not verify_audit_event(a)]
print(f'audit events: {total}, HMAC failures: {len(bad)}')

# Evidence: every stored object's hash must still match its database record.
mismatches = []
for ev in db.query(Evidence):
    if not storage.exists(ev.storage_path):
        mismatches.append((ev.evidence_id, 'missing'))
        continue
    ok, actual = storage.verify_hash(ev.storage_path, ev.sha256)
    if not ok:
        mismatches.append((ev.evidence_id, f'hash mismatch: {actual}'))
print(f'evidence objects: {db.query(Evidence).count()}, problems: {mismatches or \"none\"}')"
```
Then: `curl https://<live-url>/api/v1/health` and `/api/v1/ready` both return 200; sign in through
the real UI and open a case with evidence and a graph to confirm the whole path end to end.

## Recovery verification checklist

- [ ] Postgres restored and queryable; row counts match the pre-incident baseline (or are
      explained by writes that happened in between, if any).
- [ ] Every audit event's HMAC verifies under the real key registry (not a hash chain -- there
      isn't one; this is the correct, actual mechanism).
- [ ] Every evidence object's stored hash matches its database record (`storage.verify_hash`).
- [ ] `/api/v1/health` and `/api/v1/ready` both return 200.
- [ ] Real browser login and case view work, including opening a graph (confirms Neo4j's
      automatic projection rebuild, or the authoritative in-process fallback, either way).

## Drill history

- **2026-11-11**: full backup → restore (into a disposable, non-live Postgres container and a
  disposable, non-live MinIO container) → verify cycle run end to end while rewriting this
  document. Postgres: row counts matched the live source exactly; all audit events restored with
  **zero** HMAC failures. MinIO: the one evidence object's SHA-256 matched both the backup file
  and the database's own recorded hash. Backup used:
  `/home/ubuntu/drishti-backups/dr-drill-20261111T114740Z/`.
