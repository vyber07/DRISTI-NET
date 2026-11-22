# Workspace Baseline — 2026-11-10

Captured: 2026-11-10 05:36 UTC. Read-only baseline; no repository state was changed by the inspection.

## Repository identity

| Item | Recorded value |
|---|---|
| Root | `/home/ubuntu/DRISTI-NET` |
| Branch | `main` |
| HEAD | `0863cb93fad583866226fb91974a266487de694c` |
| HEAD subject/date | `chore: reorganize project structure and update gitignore`, 2026-11-09 08:37:06 +05:30 |
| Tracked paths | 9,713 (`git ls-files \| wc -l`) |
| Files found by bounded workspace scan | 9,713 (excluding `.git`, `node_modules`, and `.venv*`; command counted regular files) |

## Pre-existing working-tree state

The following changes predate this recovery work and are preserved:

- Modified `.gitignore` adds `/memory/`.
- Twelve untracked root documents: `DRISTI_NET_ARCHITECTURE_GAP_ANALYSIS.md`, `DRISTI_NET_BUG_AND_ERROR_REGISTER.md`, `DRISTI_NET_INTEGRATION_VERIFICATION.md`, `DRISTI_NET_MASTER_IMPLEMENTATION_CHECKLIST.md`, `DRISTI_NET_PARTIALLY_IMPLEMENTED_FEATURES.md`, `DRISTI_NET_PENDING_FEATURES.md`, `DRISTI_NET_PRIORITIZED_IMPLEMENTATION_ROADMAP.md`, `DRISTI_NET_PRODUCTION_READINESS_REPORT.md`, `DRISTI_NET_REPOSITORY_MAP.md`, `DRISTI_NET_SECURITY_AUDIT.md`, `DRISTI_NET_TEST_EXECUTION_REPORT.md`, and `DRISTI_NET_VERIFIED_COMPLETED_FEATURES.md`.
- Existing ignored data/configuration includes `.env`, `.env.compose`, `apps/web/.env`, and `storage/`. Their contents were not inspected.
- Existing ignored project artifacts include `memory/`, `releases/`, virtual environments, frontend dependencies/build output, and local continuation/management documents.

No reset, clean, checkout, destructive Docker command, or source edit was performed. This report does not establish who created the pre-existing changes.

## Recovery artifact spot checks

| Artifact | Observation | Verification limit |
|---|---|---|
| `memory/source_snapshot/` | 585 regular files | Count matches the historical claim; full path/hash reconciliation remains open. |
| `memory/reference_docs/` | 25 regular files | Count matches the historical claim. At a follow-up check, 23/25 same-named root Markdown copies were byte-identical; the two differences are `CONTINUATION_STATE.md` and `PROJECT_PROGRESS.md`, which were updated during this pass. Initial byte equality before those updates was not captured. |
| `memory/COMPLETE_FILE_REFERENCE.md` | 46,640,498 bytes; 257,743 lines | Historical size and line count match the recorded values; path counts, embedded tree, hash, classification, and coverage are not yet reconciled. |
| `.gitignore` memory rule | `/memory/` at line 25; `git check-ignore -v` matched both `memory` and `memory/PROJECT_CONTEXT.md` | Correctly ignores the intended root memory directory; no broader ignore effect was tested. |
| 32-phase roadmap | `PROJECT_TASK_BOARD.md` and `PROJECT_PROGRESS.md` state original unavailable and prior matrix reconstructed (DEC-003) | Reconstructed names are not treated as original. |

## Scope and limits

This is a timestamped starting-state record, not a complete repository audit, file hash manifest, or release assessment. The repository already contains a separate baseline architecture document at `docs/architecture/BASELINE_ARCHITECTURE.md`; it is not substituted for this workspace-state record. Later work must retain the pre-existing dirty state above and append verification results rather than rewriting historical claims.
