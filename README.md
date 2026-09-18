# DRISHTI-NET — working prototype

Evidence-linked relationship discovery for **authorized human review**. The system proposes candidate
relationships across approved cases and shows source, time, uncertainty, missing data, access history and
human decisions. **It does not decide who is a criminal.** Everything in this repository runs on synthetic data.

> The model proposes; the investigator decides. A shared identifier is a candidate relationship, not proof of identity.
> Temporal decay changes current relevance; it does not rewrite history.

## What the prototype demonstrates (the one story)

```
fictional case → synthetic upload → validated + quarantined → SHA-256 manifest → scan gate (fail-closed)
→ source-linked extraction → entity & relationship candidates → human accept / reject / defer / reverse
→ approved claims projected to a bounded graph → graph + timeline + evidence drawer
→ click an edge → exact source row / page / line → masking, audited reveal, server-side denial
→ human-reviewed report export (JSON / HTML)
```

Every step above has an automated test (`make test`, 19 tests) and a UI screen.

## Quick start (clean machine, ~3 minutes)

> On this development host run `source scripts/env.sh` first — it puts Node 24, a user-space ClamAV 1.4.3 and the headless-Chromium libraries on the path (all installed without root under `~/.cache/drishti/`). It is also sourced from `~/.bashrc`.

Requirements: Python 3.11+, Node 20.19+ (or 22+) for the web build. No Docker or Neo4j needed for the prototype; a single SQLite file is the default database. Real PostgreSQL is a supported, tested swap (see "Using PostgreSQL instead of SQLite" below) — not just a documented target.

```bash
git clone <repo> DRISHTI-NET && cd DRISHTI-NET
python3 -m pip install -r apps/api/requirements.txt
python3 data/synthetic/generate.py            # deterministic synthetic dataset
python3 -m apps.api.app.seed --ingest         # demo users + 2 cases, then pushes the files through the real pipeline
(cd apps/web && npm install && npm run build) # React UI → apps/web/dist (served by the API)
python3 -m uvicorn apps.api.app.main:app --port 8000
```

Open <http://localhost:8000>. Sign in as `investigator` / `investigator-demo` (all demo users: password = `<name>-demo`).

### Using PostgreSQL instead of SQLite

The app is DB-agnostic through `DRISHTI_DATABASE_URL`; schema is managed by real Alembic migrations
(`apps/api/migrations`), not `create_all`, whenever that URL is not `sqlite:...`.

```bash
docker compose up -d postgres                 # or point at any Postgres 13+ you already run
export DRISHTI_DATABASE_URL=postgresql+psycopg2://drishti:drishti@localhost:5432/drishti
python3 -m uvicorn apps.api.app.main:app --port 8000   # applies migrations automatically on startup
```

`make db-upgrade` applies migrations by hand; `make db-revision msg="..."` autogenerates a new one after
a model change — inspect the generated diff before committing it. This has been run end-to-end against a
real PostgreSQL 16 instance (seed → login → upload → scan → extract → resolve → graph, plus the full
`apps/api/app/tests` suite with `DRISHTI_DATABASE_URL` pointed at Postgres) as part of verifying this swap;
it is not merely a documented target.

### Using Neo4j instead of the in-process graph

`DRISHTI_NEO4J_URI` swaps the graph projection to real Neo4j; unset, an equivalent in-process build covers
the zero-install dev/test loop (same pattern as SQLite for Postgres).

```bash
docker compose up -d neo4j                    # or point at any Neo4j 5.x Community server you already run
export DRISHTI_NEO4J_URI=bolt://localhost:7687
export DRISHTI_NEO4J_PASSWORD=drishti-neo4j-demo
python3 -m uvicorn apps.api.app.main:app --port 8000   # applies graph/constraints.cypher automatically
```

`services/neo4j_store.py` writes the approved-claims projection into Neo4j via parameterized Cypher (`MERGE`,
never string-built) and serves bounded graph queries (hop/node limits) as real server-side Cypher traversals
— never exposed to the browser. This has been run end-to-end against a real Neo4j 5.26 instance (the full
`apps/api/app/tests` suite, plus a direct query of the resulting graph outside the test process) as part of
verifying this swap. That verification run caught and fixed a real bug: entities are a global registry in
Postgres (one entity can be referenced by claims from more than one case), so a node's case membership had
to be modeled as a set, not a field that the next case's sync could silently overwrite — see `TASK_BOARD.md`
Phase 3 for the detail. NetworkX remains only as a local analysis library for degree/betweenness/community
detection on an already-bounded result set; Neo4j Community has no built-in graph algorithms without the
separately licensed GDS plugin.

| user           | role             | use it to show                                        |
| -------------- | ---------------- | ----------------------------------------------------- |
| `investigator` | INVESTIGATOR     | cases, graph, evidence drawer, reveal, report         |
| `officer`      | EVIDENCE_OFFICER | upload, quarantine, hash, scan gate, retry            |
| `reviewer`     | REVIEWER         | accept / reject / defer / reverse                     |
| `analyst`      | ANALYST          | analysis, timeline                                    |
| `auditor`      | AUDITOR          | global audit trail                                    |
| `admin`        | ADMIN            | tamper demo (hash mismatch), assignments              |
| `unassigned`   | INVESTIGATOR     | **denied** on CASE-0001 (not assigned)                |
| `outsider`     | INVESTIGATOR     | **denied** on CASE-0001 (jurisdiction mismatch)       |

Dev loop: `make api` (auto-reload) + `make web` (Vite on :5173 proxies `/api` to :8000).

### Hosted demo (Antideploy)

A demo-mode instance is deployed at <https://dristi-net.antideploy.com> (SQLite + in-process graph +
`testgate` scanner — no Postgres/Neo4j/ClamAV in that container). **Note the hyphen** — the provisioned
subdomain is `dristi-net`, not `dristinet`; this doc previously listed the wrong (unhyphenated) host,
which silently 404s with "Nothing deployed here" rather than erroring loudly, and cost real time to
notice — see `TASK_BOARD.md` Phase 22. `.antideploy.json` holds only the application id (no secret; safe
to commit). Also unlike this doc's older claim, the platform **reuses the same database across
redeploys** (confirmed live 2026-09-13: a schema change without a matching migration path broke a
redeploy against the already-seeded database) — plan schema changes accordingly, the same discipline
`apps/api/migrations` already uses for the real Postgres path. To redeploy:

```bash
APP_ID=$(python3 -c 'import json; print(json.load(open(".antideploy.json"))["applicationId"])')
TOKEN=$(python3 -c 'import json, os; print(json.load(open(os.path.expanduser("~/.antideploy/config.json")))["token"])')
tar czf - --exclude=.git --exclude=node_modules --exclude=.venv --exclude=__pycache__ \
  --exclude=storage --exclude=.env --exclude=.claude --exclude=releases . \
  | curl -sS -X POST "https://antideploy.com/api/v1/deploy?applicationId=$APP_ID" \
    -H "authorization: Bearer $TOKEN" -F "archive=@-"
# then poll the returned `watch` URL until status is succeeded or failed
```

Send the whole repository: Antideploy's build is multi-stage (a Node stage builds `apps/web`, then the
Python stage runs the API), so stripping `apps/web`'s source breaks its generated Dockerfile. The account
token lives in `~/.antideploy/config.json` (mode 0600) — never in the repo.

**Auto-deploy on push**: `.github/workflows/deploy-antideploy.yml` redeploys automatically on every push
to `main` (and can be triggered by hand from the Actions tab). It needs a repository secret named
`ANTIDEPLOY_TOKEN` — a **project-scoped deploy key** (prefix `ad_`) for this one application, not the
account token above (a project key's scope is exactly this application, so a leaked CI secret costs at
most this app, never the whole account). Get one from the dashboard at
<https://antideploy.com/app/2f53ae0d-a3b9-430e-a1b9-a80e69f9b519>, then add it under
**Settings → Secrets and variables → Actions → New repository secret**. Until that secret is set the
workflow fails loudly with instructions rather than silently skipping the deploy.

## Repository layout

```
apps/api/app/           FastAPI backend (routes/, services/, models.py, auth.py, seed.py, tests/)
apps/web/               React + TypeScript UI (Vite)
data/synthetic/         generate.py + generated fixtures + truth-labels.json
docs/                   workflow, architecture, API contract, data dictionary, security, demo script, limitations
storage/                local object store (quarantine/, accepted/) + SQLite DB   [gitignored]
tests/                  integration / security / e2e placeholders for the team
reports/                evaluation & release checklists
```

`workers/`, `graph/`, `infrastructure/`, `policy/` from the target layout are intentionally *not* populated: the
prototype runs the pipeline in-process (`services/pipeline.py`) and uses local files for evidence bytes.
SQLite is the default database; PostgreSQL is a tested swap via `DRISHTI_DATABASE_URL` (see above). The graph
projection (`services/graph.py`) is likewise in-process by default and a tested swap to real Neo4j via
`DRISHTI_NEO4J_URI` (see "Using Neo4j instead of the in-process graph" below). MinIO is wired in
`docker-compose.yml` but unverified on this Docker-less dev host — see `TASK_BOARD.md`.

## Architecture (prototype)

```
React + TS  ──HTTP──▶  FastAPI /api/v1  ──▶  SQLAlchemy (SQLite → PostgreSQL)
                          │                  cases, users, evidence manifest, jobs, claims, provenance,
                          │                  match candidates, reviews, audit, snapshots
                          ├──▶ local object store  (quarantine/ → accepted/)      → MinIO/S3
                          ├──▶ scan gate            (ClamAV | testgate | unavailable; fail-closed)
                          ├──▶ extraction           (CSV / JSON / PDF / TXT, locators preserved)
                          ├──▶ entity resolution    (explainable candidates; never auto-merge)
                          └──▶ graph projection     (rebuildable from claims + reviews; real Neo4j via
                                                      DRISHTI_NEO4J_URI, in-process equivalent otherwise)
```

The browser never talks to the graph store or the object store — only to the bounded, authorized API.

## Safety boundary (what it is not)

No live CCTNS/ICJS, telecom, bank or surveillance connectivity. No biometrics. No automatic person-level
merging. No guilt / threat / risk scores. No autonomous alerts or interventions. Not production-certified;
a SHA-256 hash is an integrity reference, not a chain-of-custody certificate. See `docs/limitations.md`.

## Tests

```bash
make test      # pytest: security gate (authz, scan gate, hash, masking, audit) + full workflow  (19 tests)
make e2e       # Playwright walkthrough of the demo script against a running server on :8000    (5 tests)
               #   one-time: pip install playwright && playwright install chromium
               #   (on hosts without root, Chromium's shared libs can come from conda-forge; set LD_LIBRARY_PATH)
```

### Fresh-install verification (2026-09-11)

Run from a clean clone of this repository on Linux, Python 3.11.6, Node 24.17:

| step | command | result |
|---|---|---|
| deps | `python3 -m venv .venv && .venv/bin/pip install -r apps/api/requirements.txt` | ok |
| data | `python3 data/synthetic/generate.py` | 14 people, 85 calls, 31 txns, 3 vehicles |
| seed + ingest | `python3 -m apps.api.app.seed --ingest` | 8 files → HITL / GRAPH_PROJECTED |
| backend | `pytest apps/api/app/tests` | 19 passed |
| web | `cd apps/web && npm install && npm run build` | 36 packages, build ok |
| server | `uvicorn apps.api.app.main:app` → `/api/v1/health`, `/ready` | ok |
| e2e | `pytest tests/e2e` (Playwright) | 5 passed |

## Docs

- `PROJECT_STATUS.md` — **what is done, in progress, and planned**, day by day and by component

- `docs/context.md` — **the project constitution** (agent-ready blueprint); `AGENTS.md` tells agents how to use it
- `docs/status.md` — every blueprint requirement classified Demonstrated / MVP target / Roadmap
- `docs/responsible-ai.md` — commitments and where each is enforced

- `docs/workflow.md` — the eleven steps with the status machine
- `docs/architecture.md` — zero-install default vs. real backend for each component, and why
- `docs/adr/` — Architecture Decision Records: the real technology choices made and why, with what was live-verified
- `docs/contracts.md` — endpoints, IDs, states
- `docs/data-dictionary.md` — synthetic dataset and planted scenarios
- `docs/security.md` — controls and how each is demonstrated
- `docs/demo-script.md` — the 13-step demo, click by click
- `docs/limitations.md` — what is demonstrated vs roadmap
