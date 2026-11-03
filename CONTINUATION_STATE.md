# DRISTI-NET — Continuation State & Handoff Record

**Updated:** 2026-11-04 (session 4, fourth pass complete)
**Release status:** ENGINEERING PREVIEW (`audit/RELEASE_READINESS_REPORT.md`)
**Branch:** `audit/session-4-security-fixes` (local, not pushed) on top of `main` @ `135edeb`.

## Where things stand
- Defects found and fixed this session: DEF-028 … DEF-097, each with a regression test that fails on the old code
  (`audit/BUG_AND_DEFECT_REGISTER.md`). Third pass added: first Python static analysis, script fixes (performance numbers
  had been timing the duplicate short-cut; OpenAPI export touched the demo DB; evaluation crashed), and a pipeline reread
  that found integrity (Merkle, audit signature, PostgreSQL time zone), identity (cross-case person merge), HITL (reviewer
  decisions reverted) and provenance defects.
- Verified 2026-11-03: `make test` 175 passed / 6 skipped; live PostgreSQL + Neo4j + S3 + ClamAV 182 passed / 0 skipped;
  E2E 6/6; dry runs 5×29/29; evaluation all HIT, resolution 3/3.
- Independent review: two rounds of separate reviewer agents. The third round's agents stopped at the account limit; their
  probes were run and every lead reproduced before fixing. A human second reviewer has not reviewed anything.

## Environment state
- Live demo: `dristinet-api.service` → uvicorn `0.0.0.0:8000` behind nginx :80, **still running pre-fix backend code**
  (path traversal DEF-028 and every later backend fix not live). `apps/web/dist` was rebuilt from this branch.
- A copy of the live demo DB was upgraded successfully by the new code (column added, routes 200) — restart is expected
  to be safe; the real file was never written.
- Disposable verification containers and the :8001 isolated server are stopped at session end.

## Approval needed from the owner
1. **Restart the live demo on this branch's code** (closes DEF-028 and the rest):
   `sudo cp infrastructure/dristinet-api.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart dristinet-api`
   and disable `dristinet-native.service`. Check: `curl -s --path-as-is http://127.0.0.1:8000/%2e%2e/%2e%2e/%2e%2e/README.md | head -1` → `<!doctype html>`.
   Take a copy of `storage/drishti.db` first (`sqlite3 storage/drishti.db ".backup /path/backup.db"`).
2. Rotate `DRISHTI_SECRET_KEY` if :8000 was ever internet-reachable (keep the old key in `DRISHTI_AUDIT_KEYS`).
3. Merge `audit/session-4-security-fixes` into `main`; push or not.
4. Decisions: raw-file download for EVIDENCE_OFFICER/AUDITOR; labels of shared identifier entities across cases;
   six-tier model (UI removed until decided).
5. Replacement images for MinIO and Kafka (BLK-04); isolated host for `docker compose` (BLK-05).

## Fourth pass (2026-11-04)
DEF-098 job leases, DEF-099 candidate refresh, DEF-100 pinned/offline NER (real-model test). Verified: `make test` 181 passed /
6 skipped; live stack 188 passed / 0 skipped; E2E 6/6 ×2 on the live stack.

## Next exact actions
1. After approval 1: browser sweep of the live demo; confirm audit trail verifies (`scripts/backup_restore_drill.py` on a copy).
   Consider setting `DRISHTI_NER_OFFLINE=1` in the demo's `.env` (the pinned model is already in this host's cache).
2. NER: a ≥100-entity synthetic evaluation set; recall gaps observed (DEF-018).
3. Split runtime vs optional Python dependencies (S4-07).
