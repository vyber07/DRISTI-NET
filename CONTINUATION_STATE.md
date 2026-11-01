# DRISTI-NET — Continuation State (2026-11-01, session 4, second pass — stopped at usage limit)

Release status: **ENGINEERING PREVIEW** (unchanged). Branch `audit/session-4-security-fixes` (local, not pushed).

## Done this pass (each fix has a test that fails on the old code)
- Independent review by 3 separate reviewers (backend security, frontend contract, infra/claims); findings verified before fixing.
- Backend: malware gate recorded infected files with "OK" in the signature name as CLEAN (DEF-036/037); cross-case attributes
  still leaking via graph + /locations (DEF-033b); block_key phones (038); court-PDF masking (039) + markup injection (041);
  Merkle allowlist (040); missing object 500 -> INTEGRITY_MISMATCH (042); Neo4j outage 500 -> stale fallback (043);
  storage outage 503 + S3 timeouts (044); dup-upload audit (045); reveal window cap (046); corrupt PDF 500 (047);
  case list jurisdiction (048); role denials audited (049); review reasons masked (050); secret >= 32 chars (057).
- 10 deleted workflow tests restored (DEF-051, `test_workflow_restored.py`).
- Infra: migrations service missing secret (052), Kafka env name (053), `.dockerignore` (054), destructive test fixtures guarded (055/056).
- Frontend: fabricated "Rajasthan SOG" CDR sheet in HITL removed, real source shown (058); matcher signals + decisions shown (059/060);
  stale data after 403/logout (061); mock core-connections toggle (062); dead filters (063); fake reveal metadata (064);
  claim decision "ALLOWED"->422 + canned reason (065); fake map lines (066); HITL stats 403 hid queue (067); misleading legal copy (068-070).
- Docs: withdrew SECURITY_ASSESSMENT verdict; corrected GOV matrix, DR plan, status.md, 8 overclaimed task-board phases.

## Verified at stop
SQLite `make test` 124 passed/5 skipped; typecheck 0; build OK; E2E 6/6 x2 on live PG+Neo4j+S3+ClamAV; 14-route browser sweep 0 errors.
Live-store pytest: **129 passed, 1 FAILED** — `test_workflow_restored.py::test_graph_is_bounded_and_edges_trace_to_source`
(`assert ([])`) after the DEF-071 change in `services/graph.py::bounded_subgraph` (centered traversal now in-process on every backend).
Uncommitted-before-this-commit DEF-071 is included; investigate that test first (it passes on SQLite).

## Not done
DEF-041 escape of remaining PDF fields is complete; still open: download policy for officers/auditors (product decision),
global Entity.label cross-case name exposure (design), Compose images (MinIO/Kafka) unresolvable, defect-register entries for
DEF-036..071 not yet written into `audit/BUG_AND_DEFECT_REGISTER.md` (this file is the record), release archive not rebuilt,
live demo still runs vulnerable code (BLK-06, needs owner restart).

## Next exact action
`source <live env>; pytest apps/api/app/tests/test_workflow_restored.py -k bounded` against live Neo4j; then add DEF-036..071 to the
register, rebuild `scripts/make_release_archive.py`, re-run the restore drill.
