# DRISTI-NET — Continuation State & Handoff Record

**Updated:** 2026-11-01 (session 4)
**Release status:** ENGINEERING PREVIEW (unchanged — see `audit/RELEASE_READINESS_REPORT.md`)
**Position:** Step 3 (infrastructure/release validation) partially complete → Step 4 (Golden Synthetic Journey)
demonstrated on SQLite + real ClamAV + real NER, in the browser, and after a backup/restore.
**Branch:** `audit/session-4-security-fixes` (local only, not pushed), branched from `main` @ `135edeb`.

## What session 4 established
- **P0 DEF-028 path traversal** in the SPA fallback (any file on the host readable, incl. `.env` signing key and the
  DB). Reproduced on the live demo's port 8000. Fixed + tested; **live process still runs the vulnerable code**.
- Object-level authorization gaps DEF-031/033 (cross-case task claim, stats, entity attributes) fixed + tested;
  DEF-032 (HITL claim always 500) fixed.
- Evidence page never loaded and Download never worked (DEF-029/030) — fixed, new E2E asserts the downloaded
  bytes hash to the recorded SHA-256.
- Dependency scans run for the first time: npm 0 advisories (unused `pdfjs-dist` removed), pip only paddlepaddle.
- First backup/restore drill (SQLite path) PASS; negative journeys with real ClamAV all as required.
- Full evidence: `audit/BUG_AND_DEFECT_REGISTER.md` (session 4 section), `audit/TEST_RESULTS.md`,
  `operations/RESTORE_TEST_REPORT.md`.

## Verified at end of session 4
`make test` 91 passed / 5 skipped; real-ClamAV test 1 passed; typecheck 0; `make build-web` OK; E2E 6/6 twice on an
isolated server; restore drill PASS; restored instance E2E 6/6.

## Environment state
- Live demo: `dristinet-api.service` (systemd) → uvicorn `0.0.0.0:8000`, nginx :80. **Not restarted.** It serves
  `apps/web/dist`, which this session rebuilt from the branch (frontend fixes are therefore already live; backend
  fixes are not).
- Isolated verification server on 127.0.0.1:8001 (temp dir under the job directory) — disposable.

## Approval needed from the owner (in priority order)
1. **Deploy the DEF-028 fix to the live demo** (restart picks up the code; the unit change also closes :8000):
   `sudo cp infrastructure/dristinet-api.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart dristinet-api`
   then `curl -s --path-as-is http://127.0.0.1:8000/%2e%2e/%2e%2e/%2e%2e/README.md | head -1` must print `<!doctype html>`.
2. If port 8000 was reachable from the internet (check the EC2 security group), treat `.env` as disclosed: rotate
   `DRISHTI_SECRET_KEY` (invalidates sessions; old audit HMACs need the old key kept in `DRISHTI_AUDIT_KEYS`).
3. Merge `audit/session-4-security-fixes` into `main` (and whether to push).
4. Carried over: BLK-04 (MinIO image choice), BLK-05 (isolated host), DEF-020 (tier semantics).

## Next exact actions
1. After approval 1: re-run the traversal probe and `make e2e` against the live demo **with**
   `DRISHTI_DATABASE_URL` pointed at a copy — note `tests/e2e`'s fixture writes to whatever DB that variable names.
2. Set `DRISHTI_REDIS_URL` on the live demo (login throttling is currently off there).
3. TASK S4-07: split `requirements.txt` into core vs optional (ML/OCR/ledger/Kafka/test) — needs a decision on what the
   API image must include.
4. BLK-04 → `make test-stack`, then extend `scripts/backup_restore_drill.py` to `pg_dump`/`pg_restore` + object store.
5. NER: pin model `revision=`, `HF_HUB_OFFLINE=1` (DEF-018); the real model downloaded from huggingface.co during
   this session's ingest (synthetic text only).
