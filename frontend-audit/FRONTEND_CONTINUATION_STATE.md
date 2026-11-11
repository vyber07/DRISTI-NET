# Frontend redesign: continuation state

**Updated:** 2026-11-04. **Current reality, stated once:** the redesign has been live on the public
site since 2026-11-04 15:09 UTC. The one-off test deployment used to try it before merging was
stopped on 2026-11-04 once its purpose was served. The live site itself was later migrated, same
day, from the single-host SQLite/local-storage deployment to the full Docker Compose stack
(PostgreSQL + Neo4j + MinIO + Redis + ClamAV) — see "Production migration" below. The sections
after that are kept as a dated history of how each step happened; none of them describe the site's
current state except the last one.

## Where things are
- **Code:** the redesign merged as commit `e3abc24` and onward; the live site currently runs HEAD
  of `main` (`e5e6a51` at the time of the production migration below).
- **Design:** `frontend-design/`. **Audit and test evidence:** `frontend-audit/`. **Evaluation scripts:** `tests/ui-evaluation/`.

## How to test without touching the live site
```bash
source scripts/env.sh
# isolated data
export DRISHTI_DATABASE_URL=sqlite:////tmp/x/storage/drishti.db DRISHTI_STORAGE_ROOT=/tmp/x/storage
export DRISHTI_SECRET_KEY=$(python3 -c 'import secrets;print(secrets.token_hex(32))')
export DRISHTI_SCANNER_MODE=clamav DRISHTI_CLAMAV_HOST=127.0.0.1 DRISHTI_NEO4J_URI= DRISHTI_NER_OFFLINE=1
python -m apps.api.app.seed --ingest
# build into a separate directory; never `make build-web` (it overwrites the live site's dist)
(cd apps/web && npx vite build --outDir /tmp/x/dist)
DRISHTI_WEB_DIST=/tmp/x/dist python -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8002
DRISHTI_UI=http://127.0.0.1:8002 python -m pytest tests/e2e -q
```

## Owner decisions pending
- **Demo credentials on the login page (FE-010):** keep them for the demo, or remove them.

## Next engineering steps (in order)
1. A decision control for contradictory claims on the Overview's contradiction list (no UI can make the first decision today).
2. Remove the client-side demo-name masking (FE-044), and gate the `window.__graph*` test hooks behind a build flag (FE-056), adjusting the E2E.
3. Case creation and assignment UI: `POST /cases` and `/assign` already exist.
4. Turn on TypeScript `strict` file by file (FE-018).
5. Graph: an accessible tabular view of the selected neighbourhood; the remaining filter defects (FE-045 – FE-048).
6. Server-side search and paging if datasets grow beyond a few thousand rows.
7. Moderated usability sessions with officers (method in `FRONTEND_USABILITY_COMPARISON.md`).

## History: test deployment (2026-11-04, stopped 2026-11-04)
Stood up to try the redesign against a disposable data copy before merging it to the live site.
**Redeployed 2026-11-04 with code `3a89fd4`** (server-side search, case creation and assignment, graph list view, all audit
defects closed, cross-browser fixes). Backup taken first, of both the live demo and the test site's own data: `/home/ubuntu/drishti-backups/pre-frontend-redeploy-20261104T132154Z`. The test
site kept its data copy (10 audit events from testing preserved). The build has no E2E hooks; the test service was restarted.

- **URL (public, while running):** `http://test.65.0.102.181.nip.io/` — nginx site `dristinet-frontend-test` on **port 80**, selected by host
  name (nip.io maps that name to 65.0.102.181), → app on 127.0.0.1:8100. The plain IP `http://65.0.102.181/` still went to the
  live site (its `default_server`). Port 8181 was abandoned: from outside only 22/80/443 are reachable (the server's ufw also
  blocks 8181; 5051/8000/8080 are blocked outside the server even though ufw allows them). The site also listened on
  172.31.41.122:8000 (reachable inside the AWS network only). **No firewall rule was added or changed.**
  Verified 2026-11-04 through the public URL in Chromium, Firefox and WebKit.
- **App:** transient systemd unit `dristinet-frontend-test` (code from this repo at `b005108`).
- **Data:** a *copy* of the live site's database and evidence files in `/home/ubuntu/drishti-test/frontend/`; changes made
  while testing never reached the live site. It used a separate token key: test-site logins were refused by the live site (verified, 401).
- **Backup taken first:** `/home/ubuntu/drishti-backups/pre-frontend-test-20261104T070721Z` (live web build, database online backup with integrity ok, evidence files, nginx site, env).

**Stopped 2026-11-04** (restored the server to how it was before the test):
```bash
sudo systemctl stop dristinet-frontend-test
sudo rm /etc/nginx/sites-enabled/dristinet-frontend-test /etc/nginx/sites-available/dristinet-frontend-test   # also freed port 80 host name and 172.31.41.122:8000
sudo nginx -t && sudo systemctl reload nginx
rm -rf /home/ubuntu/drishti-test/frontend   # the test data copy
```

## History: live deployment of the redesign (2026-11-04 15:09 UTC)
- **Live site `http://65.0.102.181/` started running the redesign** (visual refresh, charts, server-side search, case creation and
  assignment, graph list view, all audit fixes). Built with `make build-web` (no E2E hooks); `dristinet-api` restarted.
- **Backup taken first:** `/home/ubuntu/drishti-backups/pre-live-merge-20261104T150746Z` — previous web build, online DB backup (integrity ok; 48 cases, 8 evidence, 137 audit
  events), evidence files, `.env`, nginx site, systemd unit. The live server had been running code `c4b23e8` since 00:54 UTC.
- **Verified on the public address:** Chromium, Firefox, WebKit and Obscura — sign-in, 11 pages, quick navigation keeps the
  session, edge → claim → exact source line; no test hooks; no failed requests.
- **No data migration** was needed (no model changes); existing sessions stay valid (same signing key).

Rollback for this step (restoring the previous frontend/backend code, on the *bare-metal SQLite*
deployment that was running at the time) is now superseded by the rollback described below, since
the deployment itself has since changed.

## Production migration: SQLite/local-storage → Docker Compose stack (2026-11-04)
The live site moved from the single-host deployment (SQLite + local filesystem evidence storage,
`dristinet-api.service`) to the full stack `docker-compose.yml` documents: PostgreSQL, Neo4j,
MinIO, Redis, ClamAV, with the bundled `nginx` service left unused (behind a `bundled-nginx`
profile) since the existing system nginx already serves the public site.

- **Pre-flight backup:** `/home/ubuntu/drishti-backups/pre-compose-migration-20261104T184904Z`
  (online SQLite backup, integrity-checked `ok`; evidence files; `.env`; nginx site; systemd unit;
  repo HEAD; a baseline `backup_restore_drill.py` report).
- **Baseline finding, pre-existing and unrelated to this migration:** 33 of 197 audit events already
  failed HMAC verification under the current key registry before anything was touched — all signed
  with the legacy `hmac-sha256` payload format under key `k1-2026`, all dated 2026-11-01 (the
  original seed-data burst). The `k1-2026` secret now in `.env` evidently differs from whatever
  value was live when that seed data was first signed. This was not introduced by the migration and
  was not "fixed" by it — resigning old audit rows to force a match would defeat the point of an
  immutable audit trail. The migration scripts (`scripts/verify_pg_minio_migration.py`) check that
  copying introduces **no new** failures, not that the pre-existing 33 disappear.
- **Cutover window:** 2026-11-04 19:07:42–19:08:10 UTC (~28 seconds of downtime: `dristinet-api`
  stopped to freeze writes, data copied against the frozen SQLite file, independently re-verified,
  then nginx's one `proxy_pass` line flipped from the bare-metal API to the new stack).
- **Verified after cutover:** `/api/v1/health` reports `"database": "postgresql+psycopg2"`,
  `"storage": "s3"`, `"graph_store": "neo4j"`; `/ready` returns 200. Logged in as each of
  `investigator`/`officer`/`auditor` over the public address: case list, evidence list, and
  CASE-0001's graph (56 nodes / 117 edges, matching the independent verification's snapshot hash)
  all work. A real file upload went through the full pipeline on the new stack — queued via Kafka,
  scanned by the Compose `clamav` container (`CLEAN`), promoted to `accepted` in MinIO — and all 4
  of its audit events (`EVIDENCE_UPLOAD`, `EVIDENCE_QUEUED_KAFKA`, `SCAN_RESULT`,
  `EXTRACTION_FAILED` — the last because the test file's `record_type` didn't match a real schema,
  not a migration bug) verify under the carried-over HMAC keys.
- **Audit keys:** `DRISHTI_AUDIT_KEYS`/`DRISHTI_CURRENT_AUDIT_KEY_ID` were carried over into
  `.env.compose` unchanged from the bare-metal `.env` (wired through `docker-compose.yml`'s `api`
  and `worker` services) so every pre-existing, correctly-signed audit event stays verifiable.

**Rollback** (restores the bare-metal SQLite deployment; the old unit was left installed and
stopped, never removed, specifically so this stays possible). Note: since the TLS addition below,
the `proxy_pass` to flip back lives in the port-443 DRISTI-NET block, not port 80 (which is now a
redirect-only stub) -- edit `/etc/nginx/sites-available/dristinet`'s `location /` under
`server_name 65.0.102.181.nip.io;` to point at `127.0.0.1:8000` instead of `127.0.0.1:8001`, then:
```bash
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl start dristinet-api
# Any writes made against the Compose stack between cutover and rollback are not auto-reconciled
# back to SQLite -- check storage/drishti.db's state against the Compose database before assuming
# nothing was lost.
```

## TLS added (2026-11-11)

The live site previously ran entirely over plain HTTP (flagged in the independent security audit,
`DRISTI_NET_SECURITY_AUDIT.md` SEC-19, as the no-TLS-path part of that finding -- the other half,
running the container as non-root, was fixed earlier the same day). No real domain points at this
host, only the bare IP, and Let's Encrypt cannot issue a certificate for a bare IP. Used the free
nip.io wildcard DNS service instead: `65.0.102.181.nip.io` resolves to this host (already used
earlier for the test-site deployment) and **is** a real, publicly resolvable hostname, so Let's
Encrypt issued a genuine, browser-trusted certificate for it.

- **Live URL is now `https://65.0.102.181.nip.io/`** (real, trusted cert -- no browser warning;
  verified with `curl`'s own certificate validation, no `-k` needed). `http://65.0.102.181/`
  still works but now 301-redirects to the HTTPS URL rather than serving the app directly.
- Certificate obtained with `certbot certonly --nginx` (authentication only, not auto-config, to
  avoid certbot rewriting the hand-tuned nginx site file) and installed into a new port-443 server
  block matched by SNI on `65.0.102.181.nip.io`. Code-server's existing port-443 block (a
  different, unrelated service on this host, self-signed cert) is untouched and still the
  `default_server` for 443 -- confirmed serving correctly for any other hostname/no-SNI request.
- Added `Strict-Transport-Security: max-age=63072000; includeSubDomains`.
- Auto-renewal: certbot's own systemd timer (`certbot.timer`), confirmed scheduled; certificate
  expires 2027-02-09 and renews automatically well before then.
- **Backup taken first:** `/home/ubuntu/drishti-backups/pre-tls-20261111T062204Z/nginx-dristinet-before-tls.conf`.
- Verified live: HTTPS health/ready/login/frontend all correct; HTTP redirects correctly; code-server unaffected.

**Rollback** (removes TLS, restores plain-HTTP-only):
```bash
sudo cp /home/ubuntu/drishti-backups/pre-tls-20261111T062204Z/nginx-dristinet-before-tls.conf /etc/nginx/sites-available/dristinet
sudo nginx -t && sudo systemctl reload nginx
# certificate files under /etc/letsencrypt/live/65.0.102.181.nip.io/ are left in place, unused
```
