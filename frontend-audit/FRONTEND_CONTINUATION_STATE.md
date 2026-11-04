# Frontend redesign: continuation state

**Updated:** 2026-11-04 · **Phase:** complete through testing and documentation (phases 1–14). **Not deployed to the live demo.**

## Where things are
- **Code:** commit `e3abc24` on local `main` (not pushed). Documentation is in the following commit.
- **Design:** `frontend-design/`. **Audit and test evidence:** `frontend-audit/`. **Evaluation scripts:** `tests/ui-evaluation/`.
- **Live demo:** unchanged. It still serves the previous build from `apps/web/dist`.

## How to test without touching the live demo
```bash
source scripts/env.sh
# isolated data
export DRISHTI_DATABASE_URL=sqlite:////tmp/x/storage/drishti.db DRISHTI_STORAGE_ROOT=/tmp/x/storage
export DRISHTI_SECRET_KEY=$(python3 -c 'import secrets;print(secrets.token_hex(32))')
export DRISHTI_SCANNER_MODE=clamav DRISHTI_CLAMAV_HOST=127.0.0.1 DRISHTI_NEO4J_URI= DRISHTI_NER_OFFLINE=1
python -m apps.api.app.seed --ingest
# build into a separate directory; never `make build-web` (it overwrites the live demo's dist)
(cd apps/web && npx vite build --outDir /tmp/x/dist)
DRISHTI_WEB_DIST=/tmp/x/dist python -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8002
DRISHTI_UI=http://127.0.0.1:8002 python -m pytest tests/e2e -q
```

## Owner decisions pending
1. **Deploy the redesign to the live demo?** Steps:
   - back up `apps/web/dist`;
   - run `make build-web`;
   - reload the browser (static files are read per request, so no API restart is needed for the frontend);
   - the API code changed too (`people` field), so restart `dristinet-api`;
   - then run `make e2e` with the demo's disposable database settings.
2. **Demo credentials on the login page (FE-010):** keep them for the demo, or remove them.

## Next engineering steps (in order)
1. A decision control for contradictory claims on the Overview's contradiction list (no UI can make the first decision today).
2. Remove the client-side demo-name masking (FE-044), and gate the `window.__graph*` test hooks behind a build flag (FE-056), adjusting the E2E.
3. Case creation and assignment UI: `POST /cases` and `/assign` already exist.
4. Turn on TypeScript `strict` file by file (FE-018).
5. Graph: an accessible tabular view of the selected neighbourhood; the remaining filter defects (FE-045 – FE-048).
6. Server-side search and paging if datasets grow beyond a few thousand rows.
7. Moderated usability sessions with officers (method in `FRONTEND_USABILITY_COMPARISON.md`).

## Test deployment (running since 2026-11-04 — stop when the owner says so)
- **URL:** `http://<server public address>:8181/` (nginx site `dristinet-frontend-test` → app on 127.0.0.1:8100). Port 8181 may
  need to be allowed in the cloud firewall / security group.
- **App:** transient systemd unit `dristinet-frontend-test` (code from this repo at `b005108`).
- **Data:** a *copy* of the live demo's database and evidence files in `/home/ubuntu/drishti-test/frontend/`; changes made
  while testing never reach the live demo. It uses a separate token key: test-site logins are refused by the live site (verified, 401).
- **Live demo:** unchanged (port 80, previous build).
- **Backup taken first:** `/home/ubuntu/drishti-backups/pre-frontend-test-20261104T070721Z` (live web build, database online backup with integrity ok, evidence files, nginx site, env).

**Stop and remove** (restores the server to how it was before the test):
```bash
sudo systemctl stop dristinet-frontend-test
sudo rm /etc/nginx/sites-enabled/dristinet-frontend-test /etc/nginx/sites-available/dristinet-frontend-test
sudo nginx -t && sudo systemctl reload nginx
# optional: rm -r /home/ubuntu/drishti-test/frontend   (the test data copy)
```
