# DRISTI-NET — Continuation State & Handoff Record

**Updated:** 2026-11-03 (session 4, second pass complete)
**Release status:** ENGINEERING PREVIEW (`audit/RELEASE_READINESS_REPORT.md`)
**Position:** Step 3 (infrastructure/release validation) partially complete; Step 4 (Golden Synthetic Journey) demonstrated
on the full live stack (PostgreSQL + Neo4j + S3 + real ClamAV + real NER), in the browser, and after a SQLite restore.
**Branch:** `audit/session-4-security-fixes` (local, not pushed) on top of `main` @ `135edeb`.

## What this session established
- First independent review (three separate reviewer agents; every finding re-verified before fixing). Fixed with
  failing-first regression tests: DEF-028 … DEF-072 — full list with evidence in `audit/BUG_AND_DEFECT_REGISTER.md`.
  Most serious: path traversal (028), malware gate recording some infected files CLEAN (036), cross-case data exposure
  (031/033/033b), fabricated agency "CDR" evidence shown in the HITL review pane (058), Compose unable to start (052).
- 10 tests deleted in `61e3437` restored (051). Overclaiming docs corrected (security verdict withdrawn, government
  matrix, DR plan, status.md, 8 task-board phases).

## Verified at end of session (2026-11-03)
SQLite `make test` 125 passed / 5 skipped; live-store suite 131 passed / 0 failed / 0 skipped (×2); E2E 6/6 ×2 on the
live stack; browser sweep 14 routes, 0 errors; typecheck 0; build OK; `npm audit` 0. Details: `audit/TEST_RESULTS.md`.

## Environment state
- Live demo: `dristinet-api.service` → uvicorn `0.0.0.0:8000` behind nginx :80. **Not restarted — still runs code with
  DEF-028 (path traversal) and the other backend defects.** `apps/web/dist` was rebuilt from this branch, so the demo
  serves the new frontend against the old backend.
- Disposable verification containers `dristi-verify-{pg,neo4j,minio}` (127.0.0.1 only, random credentials, no volumes) —
  stopped at session end.

## Approval needed from the owner
1. **Deploy the backend fixes to the live demo (BLK-06):**
   `sudo cp infrastructure/dristinet-api.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart dristinet-api`
   Also disable the unversioned `dristinet-native.service` (also binds 0.0.0.0:8000). Check:
   `curl -s --path-as-is http://127.0.0.1:8000/%2e%2e/%2e%2e/%2e%2e/README.md | head -1` must print `<!doctype html>`.
2. If :8000 was ever internet-reachable, rotate `DRISHTI_SECRET_KEY` (keep the old key in `DRISHTI_AUDIT_KEYS` so
   existing audit HMACs still verify).
3. Merge `audit/session-4-security-fixes` into `main`; push or not.
4. Product decisions: raw-file download for EVIDENCE_OFFICER/AUDITOR (they may not reveal masked values but can download
   the raw file); per-case entity labels (a name from one case's evidence is visible on another case sharing the entity);
   six-tier model semantics (DEF-020; tier UI removed until decided).
5. Replacement images for MinIO and Kafka (BLK-04) and an isolated host for `docker compose` (BLK-05).

## Next exact actions
1. After approval 1: re-run the traversal probe and the browser suite against the demo **with an explicit copy of its DB**
   (`tests/e2e` now refuses to run without `DRISHTI_DATABASE_URL`).
2. BLK-04 → `docker compose up` on an isolated host → PostgreSQL + object-store restore drill (extend
   `scripts/backup_restore_drill.py`).
3. NER: pin model revision, `HF_HUB_OFFLINE=1`, build a ≥100-entity synthetic evaluation set (DEF-018).
4. Split runtime vs optional Python dependencies (S4-07); `paddlepaddle` advisories.
