# DRISTI-NET handoff for Claude Code

## Completed

- Created `memory/` and added `/memory/` to the root `.gitignore`.
- Saved a snapshot of 585 Git-tracked files in `memory/source_snapshot/` and copies of 25 root Markdown files in `memory/reference_docs/`.
- Added project context, system design, architecture diagrams, capability/limit notes, and a prioritized scale-up discussion in the memory docs.
- Created `memory/COMPLETE_FILE_REFERENCE.md` with the workspace tree, maintained-project file catalog, memory-copy mappings, and path/type/size/location metadata for all other workspace files.

- 2026-11-12: Installed a `Stop` hook in `~/.claude/settings.json` (script `~/.claude/hooks/memory_update.py`) that updates this memory folder after each turn using Haiku, with Sonnet optional. Tested on a scratch copy and in one real session; activity log at `~/.claude/hooks/memory-update.log`.
- 2026-11-12: Feature testing of the isolated copy and backend unit suite completed. Details are in `TEST_AND_VERIFICATION_LOG.md`.

- 2026-11-12: Login rate limiting revised and pushed to `worktree-auth-login-ratelimit` (386ff52). Policy and test evidence are in `TEST_AND_VERIFICATION_LOG.md`. Not merged or deployed. Do not assume it is live.

- 2026-11-12: Audit logging implemented on the same branch (c74a1cd): request-scoped context, per-row signatures covering all fields, append-only triggers, `/audit/verify`, `/audit/digest`, `/audit/export`, session logout, and office assignment. Policy, API and security docs updated. Not merged or deployed; see `TEST_AND_VERIFICATION_LOG.md`.

- 2026-11-12: End-to-end audit check run on an isolated instance: 24 of 24 passed, and a missing session ID on token-rejection audit rows was fixed. Script is `scripts/audit_e2e_check.py`; it refuses known live hostnames. Not deployed; see `TEST_AND_VERIFICATION_LOG.md`.

- 2026-11-12: Feature-tracking docs (`DRISTI_NET_PENDING_FEATURES.md`, `DRISTI_NET_PARTIALLY_IMPLEMENTED_FEATURES.md`, `DRISTI_NET_VERIFIED_COMPLETED_FEATURES.md`) updated on branch `worktree-features-docs-update` (0725dc5). Not pushed and not applied to the main checkout. Apply with `git restore --source=worktree-features-docs-update --worktree -- <the three files>` in `/home/ubuntu/DRISTI-NET`. These files list open security gaps; pushing them is the owner's decision.
- 2026-11-12: Drafted a 3-page DRISTI-NET project report, classification Internal. Moved to `docs/DRISTI_NET_PROJECT_REPORT.md` (commit 1600a11, local branch `worktree-features-docs-update`, not pushed or merged); the claude.ai copy was deleted 2026-11-12. DPDP Rules commencement dates and BSA section 63 are marked To Be Verified because the gazette fetch was blocked. Organization, owner, budget and baseline metrics are Information Required. Page count not checked.

- 2026-11-12: Masking and reveal policy implemented on branch `worktree-auth-login-ratelimit` (82d40d2): `masking_policies` table and `GET`/`PUT /masking-policies` (migration `5bcde1234573`); one reveal check for entity label, attribute, evidence context and raw download routes; address and DOB masked at output; 422 input echo removed; ADMIN removed from reveal roles. Not merged or deployed; see `TEST_AND_VERIFICATION_LOG.md`.

- 2026-11-12: Masking authorisation model written up in `docs/MASKING_AUTHORIZATION.md` on branch `worktree-auth-login-ratelimit` (82d40d2). Not merged or deployed; test evidence is in `TEST_AND_VERIFICATION_LOG.md`.

- 2026-11-12: Permission override system (admin-controlled ALLOW/DENY with reason, expiry, approval and revocation, plus change history and audit) implemented on branch `worktree-auth-login-ratelimit` (b0a452c). Not merged or deployed. Test evidence is in `TEST_AND_VERIFICATION_LOG.md`.

- 2026-11-12: Upload limits and file validation implemented on branch `worktree-auth-login-ratelimit` (592d0ca): seven configurable size categories, streaming route `POST /cases/{id}/evidence/stream`, staging before promotion to the evidence store, resource guards, and an admin-visible metrics endpoint. Not merged or deployed; see `TEST_AND_VERIFICATION_LOG.md`.

- 2026-11-12: Live "Failed to fetch" investigation: fix committed as 3a1efae on `worktree-auth-login-ratelimit` and pushed. Covers connection release in the auth dependencies, pool sizing, busy 503 responses, request IDs, `GET /api/v1/diagnostics`, client retries and an offline banner. Not merged or deployed. Details are in `TEST_AND_VERIFICATION_LOG.md`.

- 2026-11-12: User request management module (case access, role change, temporary permission, data correction and support requests, with review, decisions, history and in-app notifications) implemented and pushed as 62a7ee5. Not merged or deployed; it needs its migration applied before going live. Test evidence is in TEST_AND_VERIFICATION_LOG.md.

- 2026-11-12: P1.2 manual user ID allocation done on `worktree-auth-login-ratelimit` (349f18f, pushed). Adds a separate `users.org_user_id` shown as 'User ID'; the `USR-` key stays as internal reference. Not merged or deployed; see DEPLOYMENT_STATE.md.

- 2026-11-12: P1.3 admin case assignment committed and pushed as 4af28f9. Adds add, remove and lead handover with reasons, history and notifications, plus an admin Case assignments page. Verified on the branch and an isolated instance (browser 21 of 21); not deployed. Apply migration 5bcde1234578 before any deploy. Known data issue: 46 of 48 seeded cases fail the primary-jurisdiction check.

- 2026-11-12: P1.4 graph loading and rendering completed and pushed as commit 714bdc6. Neo4j writes now happen only from the full graph view and only when case data changes (fingerprint). Date-filtered views are built in memory and never touch Neo4j. First view shows most-connected entities first, same order in SQLite and Neo4j paths. Layout is computed in screen pixels with overlaps removed. Empty state explains why and links to Evidence and Review queue.

- 2026-11-13: P1.5 graph full-screen mode committed and pushed as e34177a (branch only, not deployed). Frontend only: the graph page itself goes full screen, so zoom, selection, filters and time position carry over. Shortcut F and Esc; falls back to a full browser-window view where the Fullscreen API is unavailable. Dialogs and tooltips now portal into the full-screen element. P1 tasks are finished. Next session should check the deployed host before assuming this is live.

- 2026-11-13: P2.1 UI/UX redesign committed as `b3ead04` and pushed. Verified on the branch only, not deployed. Details in TEST_AND_VERIFICATION_LOG.md.

- 2026-11-13: P2.2 sidebar improvements done, committed and pushed as 489f286, not deployed. Nav items grouped into Workspace, Oversight and Administration, shown by role. Collapse state persists across reloads. Phone and tablet menu is a proper dialog with focus handling and Esc. Changed: constants/navigation.ts, layouts/AppShell/sidebar.tsx, stores/uiStore.ts, components/security/security-status-bar.tsx. Docs: docs/frontend/NAVIGATION.md. Server-side access checks unchanged.


















## Verification and limits

- Verified the 608 maintained-project paths and 118,964 other workspace paths against the inventories; the workspace tree matched.
- Verified all 25 root Markdown copies and SHA-256 hashes for the 585-file source snapshot. The snapshot `.gitignore` matches the pre-`/memory/` version.
- Secret values, dependency contents, databases, and evidence contents were not read or copied. Dependency/runtime paths are listed as metadata only.
- No application tests, builds, service startup, integration tests, or full technical audit were performed. The catalog's path/purpose descriptions and symbol/heading indexes are not proof that each feature works.

- 2026-11-12: Live public site is untested behind login; the admin password was not available to the session. Do not assume any authenticated flow works on the live site.
- 2026-11-12: Arbitrary CSV layouts are not extracted, and blockchain anchoring was not exercised on the live stack.

- 2026-11-12: Login rate limiting is not verified on the live Compose stack. Open items: nginx `X-Forwarded-For` pass-through; browser display of 429 messages; per-process counters during a Redis outage with multiple workers.
- 2026-11-12: Untracked root docs (`PROJECT_PROGRESS.md`, `DRISTI_NET_*.md`) exist only in the shared checkout and were not edited. `DRISTI_NET_SECURITY_AUDIT.md` still shows SEC-01 as open.

- 2026-11-12: Audit logging is verified only on the isolated SQLite and disposable PostgreSQL test runs. Do not assume the audit trail or its triggers are active on the live database.

- 2026-11-12: `make test` touches the host Redis at 127.0.0.1:6379 (briefly throttles, then clears the `officer` login counter). Set `DRISHTI_TEST_REDIS_URL` to avoid this.
- 2026-11-12: Another session has uncommitted edits in the main checkout. Treat them as unverified; see the test log.

- 2026-11-12: Masking changes are not verified in a browser or on the live stack. Reviewers see only birth year and `[masked address]`, with no attribute-reveal button yet. Do not assume the ADMIN reveal restriction or the address/DOB masking is live.

- 2026-11-12: Upload limits are verified only by isolated SQLite and PostgreSQL test runs, not in a browser or on the live stack. The old 25 MB form route still exists alongside the streaming route. Image, audio, video and forensic files are stored and hashed but never parsed.

- 2026-11-12: Live users will keep seeing failures until the branch is deployed and the owner applies the canonical-origin nginx snippet. One API process reaches capacity at about 100 active users; more API processes are in the backlog.

- 2026-11-12: The project report file was checked against the source document's markdown export (14 headings, 73 table lines, 4 source links). Its size differs by 11 bytes because the author byline was replaced with the date. Page count not checked. The file is not yet in the main checkout.

- 2026-11-12: P1.4 is verified on the branch only, not deployed. Verification used an isolated server, a throwaway database and a disposable Neo4j. The live site was not checked after the change. Access checks, masking and size limits were unchanged.










## Read before doing project work

Follow repository `AGENTS.md`: read `docs/context.md` first, then `docs/status.md`. Treat those as project guidance/status, and confirm implementation claims from current source and tests. The detailed inventory is `memory/COMPLETE_FILE_REFERENCE.md`; the design summary is `memory/SYSTEM_DESIGN.md`.

## Current workspace note

`memory/` is Git-ignored. The existing `.gitignore` change is intentional. Do not add secret values or real evidence to memory or Git.

- 2026-11-12: On this host `google-chrome` (in ~/.local/bin) is a wrapper around Obscura, which blocks loopback addresses, so local browser checks against the isolated server fail. Use the Playwright Chromium binary in the Playwright cache instead. Avoid `pkill -f` with broad patterns: it can match and kill your own shell.


## Deferred backlog (2026-11-12, not started)

- Review page: add a reveal button for date of birth and address, then check in a browser.
- Branch `worktree-auth-login-ratelimit` (head 592d0ca): open a pull request and review it; apply both migrations to the live database; plan a one-time forced re-login; assign offices to live users; test on an isolated port first.
- Add branch notes to `DRISTI-NET/memory/DEPLOYMENT_STATE.md` (blocked earlier).
- SEC-03: ADMIN still passes every other role check. Owner decision needed.
- Masking decisions: whether to mask person names; whether policy changes need two administrators.
- Audit retention: owner to confirm the proposed 7-year period.
- The owner will say when incoming changes are finished; check each item against the code at that point.

- 2026-11-12: Frontend logout gap found during the permission-override work. Added to the backlog; not started.

