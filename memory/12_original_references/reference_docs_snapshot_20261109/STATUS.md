# DRISTI-NET Implementation Status

**CURRENT STATUS: ENGINEERING PREVIEW** (re-verified 2026-11-01; see `audit/RELEASE_READINESS_REPORT.md`)

This file previously read "PRODUCTION READY" with a "Date of Certification". Both statements were unsupported
and are withdrawn: the constitution (`docs/context.md` §2.2, §3) forbids claiming production readiness or
certification without evidence, and the evidence below does not support either. Per-requirement status lives in
`docs/status.md`; this file is only the summary.

## Verified on 2026-11-01 (commands and results in `audit/TEST_RESULTS.md`)
- Backend suite, SQLite: 87 passed, 5 skipped (live-store tests), 1 deselected.
- Backend suite against live PostgreSQL 16 + Neo4j 5 + S3-compatible store + real ClamAV, `REQUIRE_LIVE_TESTS=1`:
  93 passed, 0 failed, 0 skipped — the first time the live-store tests have ever run in this repository.
- Alembic: fresh-database upgrade now matches the models exactly and downgrades cleanly (two missing migrations
  were found and added: `ledger_anchors`, `match_candidates.assigned_to/assigned_at`).
- Web: `tsc -b --noEmit` 0 errors; production build OK.
- Browser (Playwright/Chromium): 5/5 E2E, including new assertions that every graph edge/node is drawn and that
  an edge opens its exact source line; 12 case routes swept with 0 console errors and 0 HTTP errors.
- Golden-journey dry runs: 5/5 runs, 29/29 steps each (testgate scanner, fresh store per run).

## Not verified / blocking a higher status
- `docker compose up` cannot currently start: the pinned MinIO image digest does not resolve (PROJECT_BLOCKERS BLK-04).
- No backup/restore test, no load/performance re-run, no SAST/dependency/container scan, no TLS verification.
- NER quality is unmeasured at any meaningful sample size (evaluation set = 1 document, 3 entities).
- No independent (second-party) review; no organisational, legal or government approval of any kind.

DRISTI-NET produces candidate relationships for human review. It does not determine guilt, identity or legal
admissibility, and an integrity reference (SHA-256, Merkle root) is not proof of authenticity or chain of custody.
