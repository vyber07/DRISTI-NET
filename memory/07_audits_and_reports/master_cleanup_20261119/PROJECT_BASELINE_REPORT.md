# DRISTI-NET — Master Project Baseline Report

**Audit Date:** 2026-11-19T13:57:00+05:30  
**Project Root:** `/home/ubuntu/DRISTI-NET`  
**Git Commit:** `2385d1cde3d9063369131dfd27d2f90dc664201d` (Branch: `main`)  
**Auditor / Specialist:** Senior Software Architect & Knowledge-Management Auditor  
**Status:** PHASE 1 COMPLETE — BASELINE PRESERVED & VERIFIED

---

## 1. Confirmed Project Root and Workspace Boundaries

- **Confirmed Root Path:** `/home/ubuntu/DRISTI-NET`
- **File System:** Mounted on `/dev/nvme0n1p1` with 38 GB available disk space.
- **Project Boundary:** Self-contained repository containing the DRISTI-NET multimodal investigation platform, including FastAPI backend (`apps/api/`), React/TypeScript frontend (`apps/web/`), operational scripts, evaluation suites, documentation, and local runtime storage.
- **Constitutional Guardrails:** Adheres to `docs/context.md` (Product Constitution, evidence states, strictness levels, and language boundaries: candidate relationships, possible bridges, review priorities; never criminal or guilt labels).

---

## 2. Baseline Backup Status and Verification

Before performing any destructive or reorganizational operations, a complete baseline backup was established and verified outside the active working tree:

| Backup Component | Destination Path | Size | SHA-256 / Verification Method | Status |
|---|---|---|---|---|
| **Full Working Tree Archive** | `/home/ubuntu/drishti-backups/baseline-cleanup-20261119T1352/DRISTI-NET-baseline-worktree.tar.gz` | 229 MB | `23f01096c7a6cda6b5f0df8bf9c162ce1c58515ff7c16b204ee348c82f8f2c7f` | **VERIFIED** (tar read test passed, 0 exit code) |
| **Existing Memory Directory** | `/home/ubuntu/drishti-backups/baseline-cleanup-20261119T1352/memory/` | 68 MB | Recursive copy (`cp -a`), 620 files preserved | **VERIFIED** |
| **Baseline Git State Document** | `BASELINE_GIT_STATE.md` | ~2.5 KB | Recorded branch, commit SHA, remote URL, worktrees, and status | **VERIFIED** |
| **Complete SHA-256 Manifest** | `BASELINE_SHA256_MANIFEST.txt` | 1.84 MB | 13,330 files hashed | **VERIFIED** |
| **Complete File Inventory** | `PROJECT_FILE_INVENTORY.csv` | 4.94 MB | 13,330 files classified across 15 standard schema fields | **VERIFIED** |

---

## 3. Git State and Repository Status

- **Current Branch:** `main` (commit `2385d1c`: `fix(db): ensure declarative models are registered on boot and add server default to token_version`)
- **Upstream:** `origin/main` (`https://github.com/vyber07/DRISTI-NET.git`) — fully up to date.
- **Tracked Working Tree:** Clean. Zero uncommitted changes to tracked files.
- **Untracked Directories:**
  - `DOCUMENTATION_EXPORT/` (1,525 files, 128 MB — created 2026-11-12)
- **Active Git Worktrees:**
  - `/home/ubuntu/DRISTI-NET` (commit `2385d1c`, branch `main`)
  - `/home/ubuntu/DRISTI-NET/.claude/worktrees/auth-login-ratelimit` (commit `4f11760`, branch `worktree-auth-login-ratelimit`)
  - `/home/ubuntu/DRISTI-NET/.claude/worktrees/features-docs-update` (commit `1600a11`, detached HEAD)
- **Symlinks:** Only two internal worktree convenience symlinks exist (`.claude/worktrees/*/apps/web/node_modules` -> `/home/ubuntu/DRISTI-NET/apps/web/node_modules`). No broken symlinks or symlinks within active source code.

---

## 4. File Inventory Summary

A comprehensive inventory of all 13,330 files was generated in `PROJECT_FILE_INVENTORY.csv` with SHA-256 signatures in `BASELINE_SHA256_MANIFEST.txt`.

### Breakdown by Directory and Classification

| Directory / Category | File Count | Approximate Size | Description and Role |
|---|---:|---:|---|
| **Frontend Dependencies (`apps/web/node_modules/`)** | 8,304 | ~200 MB | Installed npm dependencies (reproducible via `package-lock.json`) |
| **Development Worktrees (`.claude/`)** | 1,795 | 59 MB | Git worktree directories for auth and docs updates |
| **Documentation Export (`DOCUMENTATION_EXPORT/`)** | 1,525 | 128 MB | Untracked snapshot of documentation, reports, and code exported on 2026-11-12 |
| **Existing Memory Directory (`memory/`)** | 620 | 68 MB | Central memory repository, including historical `source_snapshot` (585 files) and `reference_docs` (25 files) |
| **Active Application Code (`apps/`)** | 573 | ~27 MB | Core backend (`apps/api/`) and React frontend (`apps/web/src/`) |
| **Frontend Audits (`frontend-audit/`)** | 170 | 15 MB | Accessibility, UI audits, and before/after verification screenshots |
| **Official Documentation (`docs/`)** | 77 | 632 KB | Architecture blueprints (`docs/context.md`, `docs/status.md`), ADRs, API specs |
| **Local Storage / Evidence (`storage/`)** | 51 | 1.5 MB | Local SQLite database (`drishti.db`), accepted, quarantine, and staging dirs |
| **Synthetic Data & Fixtures (`data/`)** | 46 | 516 KB | Fictional test cases, calls, transactions, FIRs, EICAR test file, generator |
| **Utility & Reliability Scripts (`scripts/`)** | 38 | 352 KB | Verification scripts, environment helpers, database tools |
| **Root Workspace Files (`.`)** | 37 | ~355 MB | Root configs, Makefile, Dockerfile, 2 zip files (351 MB), and 25 loose MD files |
| **Audit Logs & Test Results (`audit/`)** | 31 | 2.2 MB | Bug/defect registers, audit logs, test run evidence |
| **Reports (`reports/`)** | 21 | 2.0 MB | Dry run reports, AI/NER evaluations, performance benchmarks, UI screenshots |
| **E2E & UI Tests (`tests/`)** | 9 | 160 KB | Playwright UI tests, evaluation suites |
| **Root Archives & Releases (`releases/`, `*.zip`)** | 7 | ~368 MB | `DRISTI-NET-full-project.zip`, `DRISTI-NET-documentation.zip`, release tarballs |
| **Design System & Specs (`frontend-design/`)** | 5 | 40 KB | Frontend component catalog, design tokens, workflow maps |
| **Test Runner Cache (`.pytest_cache/`)** | 5 | 88 KB | Pytest node tracking and failure cache |
| **Infrastructure (`infrastructure/`)** | 4 | 32 KB | Nginx config, systemd service unit files |
| **Background Workers (`workers/`)** | 3 | 32 KB | Kafka consumer & async evidence processing worker |
| **Operations (`operations/`)** | 3 | 24 KB | Backup policies, restore test drill reports, disaster recovery plans |
| **Security Architecture (`security/`)** | 2 | 8 KB | Security assessment & policy documentation |
| **Graph Analytical Module (`graph/`)** | 2 | 8 KB | Graph schema documentation and constraints |
| **Government / Regulatory (`government/`)** | 1 | 4 KB | Regulatory references and compliance framing |
| **Policy (`policy/`)** | 1 | 4 KB | Authorization and policy governance |
| **Shared Schemas (`packages/`)** | 1 | 72 KB | OpenAPI JSON schema package |
| **Editor Config (`.vscode/`)** | 1 | 4 KB | Workspace settings |
| **TOTAL** | **13,330** | **~933 MB** | Complete, unbroken repository inventory |

---

## 5. Existing Memory Directory Status

The current `memory/` directory (created ~2026-11-13) contains:
- `memory/MEMORY_INDEX.md`: Catalog scope and description.
- `memory/PROJECT_CONTEXT.md`: High-level system overview.
- `memory/SYSTEM_DESIGN.md`: Architecture diagrams, data flow, component boundaries.
- `memory/FILE_CATALOG.md`: Catalog of 608 maintained source files (as of 2026-11-09).
- `memory/COMPLETE_FILE_REFERENCE.md`: Structural guide to repository paths.
- `memory/source_snapshot/`: 585 files representing a frozen snapshot of the Git working tree from early November.
- `memory/reference_docs/`: 25 Markdown files copied from the repository root (e.g., `DRISTI_NET_BUG_AND_ERROR_REGISTER.md`, `DRISTI_NET_MASTER_IMPLEMENTATION_CHECKLIST.md`, `STATUS.md`).

**Evaluation:**
The existing memory directory already contains substantial historical structure, but suffers from two limitations:
1. Significant file duplication: The 25 markdown files exist in triplicate (in the repository root, in `memory/reference_docs/`, and in `DOCUMENTATION_EXPORT/files/`).
2. The memory directory does not yet reflect the multi-section authoritative master structure mandated by the master prompt (`01_project_overview/`, `02_architecture/`, `03_technical_documentation/`, `04_security_and_governance/`, `05_deployment_and_operations/`, etc.).

---

## 6. Access Limitations and Safety Guardrails

- **Environment:** Linux (Ubuntu 24.04 LTS), Node 24 (via nvm), Python 3.11.
- **Permissions:** Full read/write within `/home/ubuntu/DRISTI-NET` and `/home/ubuntu/drishti-backups/`.
- **Active Execution Control:** Strictly adhering to the non-destructive mandate: no source code refactoring, no deletions, and no migrations have been executed.
- **Rule 8 Compliance:** All helper logic for baseline generation was strictly executed and deleted immediately.

---

## 7. Blockers and Approval Gates

There are **zero technical blockers** preventing Phase 2 and Phase 3.

Before proceeding with Phase 2 (Documentation Audit & Content Analysis) and Phase 3 (Memory Master Restructuring), the following approval gates are noted:
1. **Approval Gate 1 (Baseline Approval):** Acknowledge Phase 1 completion and baseline preservation.
2. **Approval Gate 2 (Next Phase Authorization):** Authorization to proceed to Phase 2 (Deep Content Reading and Classification of all documentation) and drafting the consolidated master documents for `memory/`.
