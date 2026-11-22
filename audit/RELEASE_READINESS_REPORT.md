# DRISTI-NET — Release Readiness Report

## 1. Release classification

- **Status: ENGINEERING PREVIEW** (re-confirmed 2026-11-03 after independent review; see DEF-033b…072) (re-assessed 2026-11-01 against the working tree on top of `e969324`, uncommitted)
- **Supersedes** the earlier version of this report, which read "APPROVED — STAGING CANDIDATE". That decision is
  withdrawn. Staging Candidate requires migrations that work, deployment readiness, a verified backup/restore and
  security testing to an agreed scope. On re-verification, the PostgreSQL migration chain was broken (two tables'
  worth of schema missing), the Compose stack cannot start (unresolvable MinIO digest), and no backup/restore,
  SAST, dependency or container scan had ever been run. The earlier report also cited `test_audit.py` as the
  evidence for Gate 6; that file does not exist.

## 2. Gate scorecard (evidence: `audit/TEST_RESULTS.md`)

| Gate | Result | Evidence / reason |
|---|---|---|
| Backend suite (SQLite) | PASS | 2026-11-03 (third pass): 175 passed, 6 skipped, 1 deselected |
| Backend suite (live PostgreSQL + Neo4j + S3 + ClamAV) | PASS | 2026-11-03 (third pass): 182 passed, 0 failed, 0 skipped |
| Migrations (fresh PostgreSQL, upgrade → model diff → downgrade) | PASS after fix | Two migrations were missing (DEF-021); `5bcde1234569` added |
| Web typecheck + build | PASS | `tsc -b --noEmit` 0 errors |
| Browser E2E | PASS | 2026-11-03: 6/6 ×2 on the full live stack (evidence in S3), incl. HITL anti-fabrication and download-integrity assertions; 14-route sweep 0 console / 0 HTTP errors |
| Browser sweep (12 case routes) | PASS | 0 console errors, 0 HTTP ≥400, valid PDF download |
| Golden-journey dry runs | PASS | 5/5 runs × 29/29 steps (testgate scanner) |
| Evidence gate (§19: edge opens exact source) | PASS after fix | Edge drawer lists per-claim locators; viewer opens at page 1 / line 11 (DEF-024) |
| Safety language (§16) | PASS after fix | "Court Ready", "Admissibility Verification", "Emergency Bypass", fabricated 100 % / 90 % confidence removed (DEF-011R, DEF-019, DEF-023) |
| Compose / deployment start | **FAIL** | MinIO image digest unresolvable (BLK-04); `postgres`, `neo4j`, `redis`, `kafka`, `besu`, `nginx` use mutable tags |
| Backup / restore | **PARTIAL (2026-11-01 s4)** | SQLite + local storage: PASS (`operations/RESTORE_TEST_REPORT.md`). PostgreSQL/MinIO: not run (BLK-04/05) |
| Security scanning (SAST / deps / containers / secrets) | **PARTIAL** | ruff + bandit (first runs, 2026-11-03), npm audit 0, pip-audit (paddlepaddle only), regex secret scan; no container scan, no DAST |
| TLS / network exposure | **FAIL (live)** | Host serves HTTP on :80; live uvicorn still binds 0.0.0.0:8000 and runs code vulnerable to DEF-028 (BLK-06). Repo unit now binds 127.0.0.1 |
| NER evaluation | **INSUFFICIENT** | 1 document / 3 entities; real-model probe shows recall gaps (DEF-018) |
| Independent review | **NOT DONE** | This assessment is a single-agent review |
| Organisational / government approval | **NOT APPLICABLE YET** | Separate gate; no approvals exist |

## 3. Release artifact

`releases/drishti-net-e969324-working-tree-snapshot-20261101T055602Z.tar.gz` predates every fix listed above and
is **superseded**.

**Session 4:** `releases/drishti-net-ebd5faa-clean-20261101T075442Z.tar.gz` (clean tree at `ebd5faa`, 2.13 MiB,
SHA-256 `45595bfc371063b1c419483d9c8b29997f451f1062d3a684b8c2f449dcd48d05`). Unpacked into an empty directory and
re-tested from there: no `.env`, `*.db`, `storage/`, `node_modules/`, `.git/` inside; `npm ci` + typecheck 0 + build OK +
`npm audit` 0; backend suite 91 passed / 5 skipped. Local file only — not published. No SBOM generated. A new archive should be built only after these changes are committed, then unpacked and re-tested.

## 4. Path to STAGING CANDIDATE

1. Resolve BLK-04 (choose and pin an obtainable S3-compatible image) and pin every Compose image by digest.
2. Bring the full Compose stack up on an isolated host and run `make test-stack`.
0. **Deploy the DEF-028 fix to the live demo (BLK-06).**
3. Repeat the backup/restore drill on the PostgreSQL + object-store path (SQLite path done in s4).
4. Run SAST, dependency, secret and container scans; triage findings.
5. Bind uvicorn to 127.0.0.1 behind nginx and verify TLS.
6. Have a second reviewer re-check the P0/P1 fixes in `audit/BUG_AND_DEFECT_REGISTER.md`.

**2026-11-03:** `releases/drishti-net-706934f-clean-20261103T145003Z.tar.gz`, SHA-256
`043c32b495aa157ad8c87db17301586964b55beb1e7f27fe2c68a2c628eba0c7` (clean tree at `706934f`). Unpacked into an empty
directory: 0 forbidden paths (`.env`, `*.db`, `storage/`, `node_modules/`, `.git/`); backend 124 passed / 6 skipped (the
extra skip is the SPA-route test, which needs `dist/`); `npm ci` + typecheck 0 + build OK + `npm audit` 0. Local file only.
Restore drill re-run on this code (fresh real-ClamAV ingest): PASS — 8/8 evidence, 33/33 audit HMACs, identical graphs,
33/33 HMAC failures under a different key.

**2026-11-03 (third pass):** `releases/drishti-net-8e8502c-clean-20261103T191830Z.tar.gz`, SHA-256
`146dbfb3512389040e3b98917d54e5704a200d874b694499520f6b5ad2f6a2ba` (clean tree at `8e8502c`). Unpacked: 0 forbidden paths;
backend 174 passed / 7 skipped (SPA route needs `dist/`; six PostgreSQL-only tests); `npm ci` + typecheck 0 + build OK +
`npm audit` 0. Restore drill on this code: PASS — 8/8 evidence, 52/52 audit events (all `hmac-sha256-json`), identical
graphs, 52/52 failures under a different key. Local file only, not published.

**2026-11-04 (fourth pass):** `releases/drishti-net-d295962-clean-20261103T234946Z.tar.gz`, SHA-256
`8f6f169c88ba7a4d87ce0102b3f63647835f48a441931f7ad02fde67b3caf186` (clean tree at `d295962`). Unpacked: 0 forbidden paths;
backend 180 passed / 7 skipped; `npm ci` + typecheck 0 + build OK + `npm audit` 0. Local file only.
