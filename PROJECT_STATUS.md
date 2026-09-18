# DRISHTI-NET — project status

_Updated 2026-09-13 · branch `main` · 62 backend tests (60 passing + 2 live-only skipped on the zero-install default) + 5 browser e2e tests (last re-run before this session's edge-governance-fields/pagination/map-view changes — no browser connection available this session to re-run; see §4 note)._

Status words follow `docs/context.md` §3: **Demonstrated** (code + passing test), **In progress**, **MVP target**, **Architecture target**, **Roadmap**.

## 1. Seven-day prototype plan — day by day

| Day | Goal | Status | Evidence |
|---|---|---|---|
| 1 | Story, scope, IDs, states, API list, synthetic-data plan, prohibited-use statement | Demonstrated | `README.md`, `docs/workflow.md`, `docs/contracts.md`, `LICENSE_OR_PROJECT_NOTICE.md`, `models.py` vocab |
| 2 | Synthetic dataset + working environment on every machine | Demonstrated | `data/synthetic/generate.py` (all 10 planted scenarios), `seed.py --ingest`, fresh-clone verification in README |
| 3 | Upload, manifest, scan gate, extraction with source locators | Demonstrated | `evidence_routes.py`, `scanner.py` (real ClamAV on dev host), `extract.py`; `test_status_flow_and_source_linked_extraction` |
| 4 | Candidates + human review (accept/reject/defer/reverse), audit | Demonstrated | `resolution.py`, `review_routes.py`; `test_review_decisions`, `test_contradiction_is_flagged_not_hidden` |
| 5 | Graph, timeline, evidence drawer, bridge/degree analysis | Demonstrated | `graph.py`, `GraphView.tsx`, `EvidenceDrawer.tsx`, `TimelinePanel.tsx`; `test_graph_is_bounded_and_edges_trace_to_source` |
| 6 | Authorization, masking, audit, tamper, secrets, report export | Demonstrated | `auth.py`, `masking.py`, `report_routes.py`; whole of `test_security.py`, `test_report_export` |
| 7 | Stabilise, clean-start test, screenshots, demo script, limitations | Demonstrated (dry runs: 3 automated; 5 human rehearsals still to do) | `tests/e2e/test_ui_demo.py`, `reports/screenshots/`, `docs/demo-script.md`, `docs/limitations.md` |

## 2. Component status

| Area | Component | Status | Notes |
|---|---|---|---|
| Data | Synthetic golden dataset + truth labels | Demonstrated | deterministic, versioned by generator seed |
| Ingestion | Validation (ext, size, magic bytes, structure, safe names) | Demonstrated | `validate_upload` |
| Ingestion | Quarantine → hash → scan → accepted | Demonstrated | fail-closed on SCAN_FAILED / TIMEOUT / UNAVAILABLE / INFECTED |
| Ingestion | Real antivirus | Demonstrated on dev host (ClamAV 1.4.3, user-space) | `testgate` substitute elsewhere |
| Ingestion | Parser CPU/memory caps | Demonstrated | see Extraction row below (TASK_BOARD.md Phase 9) |
| Ingestion | Archive (.zip) controls — nesting, path traversal, symlinks, member/total size, decompression ratio | Demonstrated | `services/extract.py::_check_archive`; checked from central-directory metadata only, before any member is decompressed; members extracted through the same per-type handlers as a standalone upload — `apps/api/app/tests/test_archive_uploads.py` |
| Ingestion | Sandboxed parser worker | Architecture target | parsing still runs in the API process; `workers/README.md` describes the split |
| Ingestion | Evidence-level classification/jurisdiction/purpose/access_class | Demonstrated | mirrored from the case at upload (immutable snapshot, not a live join); real Alembic migration with a live-data backfill — see `TASK_BOARD.md` Phase 11 |
| Integrity | SHA-256 manifest, verify, `INTEGRITY_MISMATCH` state, tamper demo | Demonstrated | |
| Extraction | CSV / JSON structured parsers | Demonstrated | row/column and json_path locators |
| Extraction | PDF / TXT narrow regex NER on FIR fixture | Demonstrated | page/line/char_offset locators; `bbox`, language, OCR are MVP target |
| Extraction | Missingness + confidence recorded | Demonstrated | |
| Extraction | Corrupt-file fixture proving `EXTRACTION_FAILED` + retry | Demonstrated | `data/synthetic/corrupt/{calls_corrupt.csv,fir_001_truncated.pdf}`; `test_extraction_failures.py` — both pass upload validation, fail at parse time with a real exception surfaced in the job error, and the evidence is retried via the existing `/evidence/{id}/process` endpoint (deterministic re-failure, attempts counter advances, error stays visible — not silently cleared) |
| Extraction | Parser CPU/memory/time caps | Demonstrated | `config.CSV_MAX_ROWS`/`JSON_MAX_RECORDS`/`PDF_MAX_PAGES`, enforced in `validate_upload`; a signal-based CPU timeout was evaluated and rejected (wrong-thread risk inline in the request handler) in favour of this input-size bound — see `TASK_BOARD.md` Phase 9 |
| Resolution | Blocking, transparent signals, counter-evidence, conflicts, missingness | Demonstrated | confidence never 0/1 |
| Resolution | Human accept / reject / defer / stale / reverse; no auto-merge | Demonstrated | |
| Resolution | Reviewer-agreement / false-merge metrics | MVP target | templates in `reports/` |
| Graph | Rebuildable graph projection, approved-merge contraction, bounded k-hop, supernode cap | Demonstrated | in-process build with no external service by default; SQLite-equivalent zero-install path |
| Graph | Historical vs current relevance, decay, time window | Demonstrated | |
| Graph | Degree, betweenness bridge candidates, communities, burst + fan-in rules | Demonstrated | neutral labels enforced by test; computed via NetworkX as a local analysis library over an already-bounded result set (Neo4j Community has no built-in graph algorithms without the GDS plugin) |
| Graph | Community stability output, query timeout, edge-level `snapshot_id` | Demonstrated | seeded bootstrap-perturbation stability score per community (`graph.py::_community_stability`, own unit tests proving it discriminates real robustness, not a constant); `config.NEO4J_QUERY_TIMEOUT_S` enforced server-side, live-verified against a real Neo4j (`test_neo4j_live.py`); every graph edge carries `snapshot_id` = its bounded view's content hash — see `TASK_BOARD.md` Phase 10 |
| Graph | Neo4j projection + bounded server-side Cypher traversal | Demonstrated | `services/neo4j_store.py`; verified against a real live Neo4j 5.26 instance (parameterized writes + bounded reads), including a real cross-case entity-ownership bug found and fixed during that verification — see `TASK_BOARD.md` Phase 3. Opt-in via `DRISHTI_NEO4J_URI`; `docker-compose.yml`'s `neo4j` service is live-verified via real Docker on this host (Phase 7), not just wired |
| Graph | Edge-level `jurisdiction`/`access_class`/`authority_reference` | Demonstrated | mirrored from the claim's own evidence (Phase 11's governance snapshot); most-recently-observed value wins across the claims collapsed into one summary edge, `governance_mixed` flags real disagreement rather than picking silently — `TASK_BOARD.md` Phase 13 |
| Graph | Query pagination (`offset`/`next_offset`) | Demonstrated | uncentered node listing only (a centered hop-bounded traversal has no stable order to page); both the real-Neo4j and in-process backends — `TASK_BOARD.md` Phase 14 |
| Graph | Query cancellation | **Architecture target** — not attempted | safe mid-flight cancellation of a synchronous DB call needs the async job/worker model ADR-004 deliberately didn't adopt; blocker recorded in `task.md`'s appended note rather than faked with an unverified cross-thread session-close hack |
| Graph | Map / H3 spatial overlap | Roadmap | lat/lon captured |
| Security | Server-side case + jurisdiction + role authorization, audited denial | Demonstrated | |
| Security | Default masking, audited reveal with reason | Demonstrated | |
| Security | Secret scan, no graph-store endpoint, trace ids | Demonstrated | |
| Security | OIDC / OPA / TLS reverse proxy | Architecture target | |
| UI | Login, cases, evidence, review queue, graph, timeline, analysis, audit, report | Demonstrated | React 19 + TS strict; Playwright-tested |
| UI | Map view over location entities | Demonstrated | `GET /cases/{id}/locations` (bounded, authorized, audited) + `MapView.tsx`; a locally-rendered linear projection, not a tile-server map (avoids sending case coordinates to a third-party service) — `TASK_BOARD.md` Phase 16 |
| UI | Keyboard/accessibility pass | Demonstrated (targeted, not a full audit) | fixed 4 real mouse-only clickable elements (`EvidencePanel`, `ReviewQueue` table rows, `TimelinePanel` items, `Login`'s demo-user shortcuts — found via grep, not assumed) via a shared `clickableRow` helper / real `<button>`s; added a skip-to-main-content link and `:focus-visible` styling; added `<label>`s (visually hidden where no visible label fits the layout) to every previously placeholder-only form control across `Login`, `Cases`, `EvidencePanel`, `ReviewQueue`, `EvidenceDrawer`, `ReportPanel`, `AuditPanel`, `TimelinePanel`; fixed 3 measured WCAG AA color-contrast failures (`.pill.hist` text 2.67:1→4.73:1, the historical-timeline-row opacity fade that pushed text as low as 2.25:1→replaced with a non-text background tint, and the `GraphView` legend's swatch-as-text-color pattern that made several entries as low as 1.84:1→decoupled into a colored swatch dot + normal-contrast label text). Map markers are real `<button>` elements, not raw SVG click handlers. Sigma.js graph-canvas node selection remains mouse-only by nature of canvas rendering — the existing `centre` text input is the keyboard-accessible path into the same functionality, not a new gap. Full accessibility audit (end-to-end screen-reader flows, every remaining contrast pair) remains **MVP target** — this pass fixed concrete measured failures, not an exhaustive sweep. |
| Report | JSON + HTML human-reviewed report with snapshot + audit id | Demonstrated | |
| Ops | Fresh-clone install, Makefile, env script | Demonstrated | zero-install path (SQLite/in-process) and full Docker Compose stack (Postgres+Neo4j+MinIO+Redis) both verified on this host — `TASK_BOARD.md` Phase 7 |
| Ops | PostgreSQL | Demonstrated | real Alembic migrations (`apps/api/migrations`), `docker-compose.yml` `postgres` service; full `apps/api/app/tests` suite + a live seed→upload→graph run verified against a real Postgres 16 instance, 5 consecutive runs for stability |
| Ops | MinIO | Demonstrated | real running MinIO container, 14 objects independently confirmed via a separate boto3 client outside the test process — `TASK_BOARD.md` Phase 2 |
| Ops | Redis | Demonstrated | login-throttle counters against a real Redis, live 401×5→429, fail-open with an audited degradation event on outage — `TASK_BOARD.md` Phase 4 |
| Ops | Kafka | Not adopted (by design) | no measured throughput/availability need justifies it yet — `docs/adr/004-async-queue.md`, directive §64 |
| Ops | Failure-injection (each backend stopped mid-session) | Demonstrated | 2 real reliability bugs found and fixed (56.6s Neo4j hang, boot crash on Neo4j-unreachable); Postgres/MinIO/Redis degrade and recover correctly as-is — `TASK_BOARD.md` Phase 8 |
| Ops | Container image vulnerability scan | Demonstrated | `trivy` scan of all 4 images; `postgres:16-alpine` evaluated for its smaller CVE footprint and rejected after live testing (musl/glibc collation-version incompatibility) — `TASK_BOARD.md` Phase 6 |
| Ops | Architecture Decision Records | Demonstrated | 11 ADRs in `docs/adr/` covering every real technology decision, including deliberate non-adoptions |
| Docs | README, context (constitution), status, workflow, architecture, contracts, data dictionary, security, responsible-AI, demo script, limitations | Demonstrated | |
| Evaluation | Extraction / ER / graph metric reports vs truth labels | Demonstrated | `scripts/evaluate.py` runs the real pipeline against the golden dataset and fills `reports/*-evaluation.md`; 5/5 extraction, 3/3 entity-resolution, 4/4 graph checks HIT — `TASK_BOARD.md` Phase 15 |

## 3. Release gates (`docs/context.md` §19)

| Gate | State |
|---|---|
| Data — synthetic, versioned, traceable | 🟢 |
| Evidence — every important edge opens exact source context | 🟢 |
| Identity — human decision, rationale, counter-evidence, reversal | 🟢 |
| Security — server-side denial, masking, audit, tamper, secret scan | 🟢 |
| Safety — neutral language + prohibited-use statement | 🟢 |
| Evaluation — conditions and limitations documented; metrics measured | 🟢 `reports/*-evaluation.md` filled with real measured metrics (`scripts/evaluate.py`); `reports/performance.md` filled with real measured timings + documented conditions (`scripts/perf_test.py`) |
| Integration — five clean dry runs upload → report | 🟡 5/5 automated API-level dry runs passing (`reports/dry-runs.md`); a literal human rehearsal of the live UI is still pending (no browser connection available this session) |
| Release — README, setup, tests, demo script, backups, hashes | 🟡 release archive + SHA-256 now recorded (`reports/release-checklist.md`) — but as a working-tree snapshot at uncommitted state, not yet an official tagged release; re-run `scripts/make_release_archive.py` after this session's changes are committed and reviewed |

## 4. In progress / next up (one owner each)

1. ~~**Role 4** — corrupt-CSV/truncated-PDF fixtures + parser resource caps~~ — done, see §2.
2. ~~**Role 6** — fill `reports/extraction-evaluation.md`, `entity-resolution-evaluation.md`, `graph-evaluation.md` from `truth-labels.json`; record five dry runs; release archive + SHA-256; performance testing under documented conditions~~ — all done, see §2 (`scripts/{evaluate,dry_run,perf_test,make_release_archive}.py`, `reports/{*-evaluation,dry-runs,performance,release-checklist}.md`). **Remaining for Role 6**: `make e2e` and the UI-visual checklist items need a session with a real browser connection; the release archive needs rebuilding after this session's changes are committed.
3. ~~**Role 5** — community stability score; query timeout; edge-level `snapshot_id`~~ — done, see §2.
4. ~~**Role 1** — evidence-level `classification / jurisdiction / purpose / access_class` mirrored from the case at upload~~ — done, see §2.
5. ~~**Role 3** — verify `Dockerfile` / `docker-compose.yml` on a host with Docker~~ — done: full stack live-verified, 2 real reliability bugs found and fixed via failure-injection, container images scanned — `TASK_BOARD.md` Phases 6–8.
6. ~~**Role 2** — map view over location entities; keyboard/accessibility pass~~ — done, see §2 (targeted pass, not a full audit — see the row above for scope).
7. ~~**Role 4** — archive upload limits (size/nesting/ratio/decompression-bomb ratio)~~ — done, see §2.
8. ~~**Role 5** — `jurisdiction`/`authority_reference`/`access_class` on graph edges~~ — done, see §2.
9. ~~**Role 5** — graph query pagination~~ — done, see §2. Cancellation specifically is an architecture-blocked item (see `task.md`'s appended note) — not attempted, not silently dropped.
10. ~~**Role 6** — five recorded dry runs; release archive + SHA-256; performance testing under documented conditions~~ — done, see §2.
11. **Role 2** — full accessibility audit (contrast, end-to-end screen-reader flows) — the targeted pass in #6 fixed known concrete gaps, not a comprehensive audit.
12. **Role 6** — `make e2e` and the UI-visual portions of `reports/release-checklist.md`, both blocked this session on no browser-extension connection; rebuild the release archive after committing this session's changes.

## 5. Commit history

| Commit | What |
|---|---|
| `Initial commit` | repository created |
| `DRISHTI-NET working prototype…` | full vertical slice: backend, UI, dataset, tests, docs |
| `Adopt agent master blueprint…` | constitution, status audit, `INTEGRITY_MISMATCH` state |
| `Secret-scan test: skip .venv…` | fresh-install bug fix + verification table |
| `Host toolchain: real ClamAV…` | ClamAV in the scan gate, env script, setup targets |
| `Add PROJECT_STATUS.md…` | day-by-day, component, release-gate and in-progress view |
| `change in files and fix data issue…` | tech-stack migration groundwork |
| `Real Redis rate-limiting, Sigma.js graph renderer…` | Phase 4 (Redis throttle) + Phase 5 (Sigma.js/Graphology graph rewrite) + Phase 6 (full-stack security scan) |
| `Failure-injection testing against the real stack…` | Phase 8: 2 real reliability bugs found and fixed (Neo4j 56s hang, boot crash) |
| `Add Architecture Decision Records…` | 11 ADRs; refreshed `docs/architecture.md` to match real (not aspirational) state |
| `Corrupt-CSV/truncated-PDF fixtures…` | Phase 9: real `EXTRACTION_FAILED` + retry fixtures |
| `Parser CSV/JSON/PDF resource caps…` | Phase 9: `CSV_MAX_ROWS`/`JSON_MAX_RECORDS`/`PDF_MAX_PAGES` |
| `Community stability score, Neo4j query timeout…` | Phase 10: bootstrap-perturbation stability, real server-enforced Neo4j timeout, edge `snapshot_id` |
| `Evidence-level classification/jurisdiction/purpose/access_class` | Phase 11: governance fields mirrored from case at upload, with a live-data-backfilled Alembic migration |
| `Archive (.zip) upload controls` | Phase 12: `.zip` accepted as an upload type with path-traversal, nested-archive, symlink, member/total-size and decompression-ratio limits enforced from central-directory metadata; members extracted through the existing per-type handlers |
| `Edge-level jurisdiction/access_class/authority_reference` | Phase 13: `Case.authority_reference` added (real Alembic migration with backfill), mirrored onto `Evidence` and thence onto every graph edge; `governance_mixed` flag on disagreement |
| `Graph query pagination` | Phase 14: `offset`/`next_offset` on the uncentered node listing, both backends; query cancellation recorded as an architecture-blocked item rather than faked |
| `Evaluation reports filled from truth-labels.json` | Phase 15: `scripts/evaluate.py` runs the real pipeline on a throwaway store and computes real hit/miss metrics — no manual eyeballing, no invented numbers |
| `Map view + targeted accessibility pass` | Phase 16: `GET /cases/{id}/locations` + `MapView.tsx` (no tile-server dependency); 3 real mouse-only rows fixed via a shared `clickableRow` helper; skip link |
| `Release readiness: 5 dry runs, release archive+hash, performance testing` | Phase 17: `scripts/{dry_run,perf_test,make_release_archive}.py`; real measured numbers, real archive hash, honest scope notes on what still needs a browser connection |
| `Accessibility contrast/label pass; case-creation regression fix` | Phase 18: 3 measured WCAG AA contrast failures fixed; every placeholder-only form control given a real accessible name; found+fixed a real Phase-13 regression (case creation had no `authority_reference` field, zero prior test coverage) |
| `Supernode-capping test coverage` | Phase 19: found via re-reading `docs/context.md` §17.2 directly — golden dataset plants no supernode, zero test coverage existed; closed with an isolated test case |
