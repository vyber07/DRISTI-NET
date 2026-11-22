# DRISTI-NET Baseline Git State

**Timestamp:** 2026-11-19T13:54:00+05:30  
**Project Root:** `/home/ubuntu/DRISTI-NET`  
**Git Revision:** `2385d1cde3d9063369131dfd27d2f90dc664201d`  
**Branch:** `main`  
**Upstream:** `origin/main` (up to date)  
**Remote URL:** `https://github.com/vyber07/DRISTI-NET.git`  

---

## 1. Git Status Summary

```
On branch main
Your branch is up to date with 'origin/main'.

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	DOCUMENTATION_EXPORT/

nothing added to commit but untracked files present (use "git add" to track)
```

- **Tracked Modifications:** None. The working tree is clean with respect to tracked files.
- **Untracked Directories/Files:**
  - `DOCUMENTATION_EXPORT/` (Directory created on 2026-11-12 containing complete exported documentation and artifacts)

---

## 2. Ignored Files and Directories (from `.gitignore`)

The following files and paths are present in the workspace but ignored by Git:
- `.env` (development environment secrets - excluded from version control)
- `.env.compose` (Docker Compose environment configuration)
- `apps/web/.env` (web frontend environment configuration)
- `AGENTS.md` (repository constitution and coding rules for agents)
- `CLAUDE.md` (Claude assistant guidance)
- `CONTINUATION_STATE.md` (local session state tracker)
- `PROJECT_TASK_BOARD.md` (local project task board)
- `PROJECT_PROGRESS.md` (local project progress record)
- `STATUS.md` (local implementation status)
- `PROJECT_DECISION_LOG.md` (local project decision register)
- `PROJECT_BLOCKERS.md` (local blocker tracking)
- `PROJECT_RISK_REGISTER.md` (local risk register)
- `MODULE_STATUS.md` (module tracking matrix)
- `REQUIREMENTS_MATRIX.md` (requirements trace matrix)
- `DRISTI-NET-documentation.zip` (73 MB documentation archive from 2026-11-12)
- `DRISTI-NET-full-project.zip` (278 MB complete project archive from 2026-11-12)
- `memory/` (Central project memory directory and historical source snapshots)
- `releases/` (Historical release tarballs)
- `storage/` (Local SQLite database `drishti.db` and evidence storage directories `accepted/`, `quarantine/`, `staging/`)
- `.claude/` (Claude workspace and worktrees)
- `.vscode/` (VS Code local settings)
- `.pytest_cache/` (Pytest execution cache)
- `apps/web/node_modules/` (Frontend npm dependencies)
- `apps/web/dist/` (Frontend build output)
- `**/__pycache__/` (Python compiled bytecode)

---

## 3. Branches and Remotes

### Branches
- `* main` (checked out at commit `2385d1c`)
- `+ worktree-auth-login-ratelimit` (checked out in `.claude/worktrees/auth-login-ratelimit` at commit `4f11760`)
- `  worktree-features-docs-update` (historical worktree at commit `1600a11`)
- `remotes/origin/HEAD -> origin/main`
- `remotes/origin/main`
- `remotes/origin/worktree-auth-login-ratelimit`

### Git Worktrees
```
/home/ubuntu/DRISTI-NET                                        2385d1c [main]
/home/ubuntu/DRISTI-NET/.claude/worktrees/auth-login-ratelimit 4f11760 [worktree-auth-login-ratelimit]
/home/ubuntu/DRISTI-NET/.claude/worktrees/features-docs-update 1600a11 (detached HEAD)
```

---

## 4. Recent Git History (Last 5 Commits)

```
2385d1c fix(db): ensure declarative models are registered on boot and add server default to token_version
4f11760 Add self-service account management: profile display name, password change, sessions, activity log (P2.3)
28a6f5c fix(security): stream evidence download and revoke server session on logout
489f286 Improve sidebar navigation: sections, remembered collapse, accessible drawer (P2.2)
b3ead04 UI/UX audit and consistency pass against the design system (P2.1)
```

---

## 5. Symlinks

- `./.claude/worktrees/features-docs-update/apps/web/node_modules` -> `/home/ubuntu/DRISTI-NET/apps/web/node_modules`
- `./.claude/worktrees/auth-login-ratelimit/apps/web/node_modules` -> `/home/ubuntu/DRISTI-NET/apps/web/node_modules`
- No symlinks exist within the main active application source code or documentation tree.
