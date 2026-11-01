# DRISTI-NET — Release Readiness Report

## 1. Release classification

- **Status: ENGINEERING PREVIEW** (re-assessed 2026-11-01 against the working tree on top of `e969324`, uncommitted)
- **Supersedes** the earlier version of this report, which read "APPROVED — STAGING CANDIDATE". That decision is
  withdrawn. Staging Candidate requires migrations that work, deployment readiness, a verified backup/restore and
  security testing to an agreed scope. On re-verification, the PostgreSQL migration chain was broken (two tables'
  worth of schema missing), the Compose stack cannot start (unresolvable MinIO digest), and no backup/restore,
  SAST, dependency or container scan had ever been run. The earlier report also cited `test_audit.py` as the
  evidence for Gate 6; that file does not exist.

## 2. Gate scorecard (evidence: `audit/TEST_RESULTS.md`)

| Gate | Result | Evidence / reason |
|---|---|---|
| Backend suite (SQLite) | PASS | 87 passed, 5 skipped, 1 deselected |
| Backend suite (live PostgreSQL + Neo4j + S3 + ClamAV) | PASS | 93 passed, 0 failed, 0 skipped, `REQUIRE_LIVE_TESTS=1` |
| Migrations (fresh PostgreSQL, upgrade → model diff → downgrade) | PASS after fix | Two migrations were missing (DEF-021); `5bcde1234569` added |
| Web typecheck + build | PASS | `tsc -b --noEmit` 0 errors |
| Browser E2E | PASS | 5/5, with strengthened graph and provenance assertions (DEF-022, DEF-024) |
| Browser sweep (12 case routes) | PASS | 0 console errors, 0 HTTP ≥400, valid PDF download |
| Golden-journey dry runs | PASS | 5/5 runs × 29/29 steps (testgate scanner) |
| Evidence gate (§19: edge opens exact source) | PASS after fix | Edge drawer lists per-claim locators; viewer opens at page 1 / line 11 (DEF-024) |
| Safety language (§16) | PASS after fix | "Court Ready", "Admissibility Verification", "Emergency Bypass", fabricated 100 % / 90 % confidence removed (DEF-011R, DEF-019, DEF-023) |
| Compose / deployment start | **FAIL** | MinIO image digest unresolvable (BLK-04); `postgres`, `neo4j`, `redis`, `kafka`, `besu`, `nginx` use mutable tags |
| Backup / restore | **NOT RUN** | No restore has ever been executed |
| Security scanning (SAST / deps / containers / secrets) | **NOT RUN** | — |
| TLS / network exposure | **NOT VERIFIED** | Host serves HTTP on :80; uvicorn binds 0.0.0.0:8000, bypassing nginx headers |
| NER evaluation | **INSUFFICIENT** | 1 document / 3 entities; real-model probe shows recall gaps (DEF-018) |
| Independent review | **NOT DONE** | This assessment is a single-agent review |
| Organisational / government approval | **NOT APPLICABLE YET** | Separate gate; no approvals exist |

## 3. Release artifact

`releases/drishti-net-e969324-working-tree-snapshot-20261101T055602Z.tar.gz` predates every fix listed above and
is **superseded**. A new archive should be built only after these changes are committed, then unpacked and re-tested.

## 4. Path to STAGING CANDIDATE

1. Resolve BLK-04 (choose and pin an obtainable S3-compatible image) and pin every Compose image by digest.
2. Bring the full Compose stack up on an isolated host and run `make test-stack`.
3. Execute and document a backup → restore → integrity-verify → graph-rebuild → golden-journey cycle.
4. Run SAST, dependency, secret and container scans; triage findings.
5. Bind uvicorn to 127.0.0.1 behind nginx and verify TLS.
6. Have a second reviewer re-check the P0/P1 fixes in `audit/BUG_AND_DEFECT_REGISTER.md`.
