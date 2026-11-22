# DRISTI-NET live deployment state

Updated: 2026-11-13. This file tracks the actual running production deployment -- none of the
other memory docs cover this; they're static inventory/design snapshots. This one goes stale fast;
re-verify against the live host before trusting it, the same way the other docs ask you to verify
against source.

## Where it's running

- **Live URL: `https://65.0.102.181.nip.io/`** (real Let's Encrypt cert, not self-signed -- the
  host has no real domain, so this uses the free nip.io wildcard-DNS trick: that hostname resolves
  to the host's own IP, and because it's a real resolvable hostname, Let's Encrypt will certify
  it). `http://65.0.102.181/` 301-redirects there. Cert expires 2027-02-09, auto-renews via
  certbot's systemd timer.
- Runs as the full Docker Compose stack (`docker-compose.yml`): api, worker, postgres, neo4j,
  minio, redis, clamav, kafka, besu. All checked via `cd /home/ubuntu/DRISTI-NET && docker compose
  --env-file .env.compose ps`.
- Fronted by the HOST's own system nginx (`/etc/nginx/sites-available/dristinet`), NOT the
  bundled Compose `nginx` service (that one's gated behind a `bundled-nginx` profile and not
  running -- the system nginx already owns ports 80/443 on this host, alongside an unrelated
  code-server instance on port 443 via SNI routing, untouched).
- The original bare-metal SQLite deployment (`dristinet-api.service`) is stopped but still
  installed, specifically kept as a rollback target. Do not re-enable without a clear need --
  the Compose stack is the one actually serving traffic.
- `.env` (bare-metal secrets, kept for historical/rollback reference) and `.env.compose` (the live
  stack's actual secrets -- Postgres/Neo4j/MinIO passwords, plus `DRISHTI_SECRET_KEY`/
  `DRISHTI_AUDIT_KEYS` carried over unchanged from `.env` so the audit trail's HMAC signatures stay
  verifiable across the migration) both sit at the repo root, mode 600. Neither is in git, obviously.

- 2026-11-12: all 9 containers up with zero restarts; health and readiness report OK; login page and API docs load in a browser with no console or network errors; protected pages redirect to login.
- 2026-11-12, not verified: anything behind login. The live database is nearly empty: one case (`CASE-101`), no evidence.

- 2026-11-12: login rate-limiting revision 2 is committed and pushed to branch `worktree-auth-login-ratelimit` (386ff52). Not merged and not deployed; the live stack still fails open on Redis outage. Deploy after review: merge, then rebuild the API container. New env vars are optional with defaults. Not verified live.

- 2026-11-12: audit-logging commit c74a1cd pushed to `worktree-auth-login-ratelimit` on top of 386ff52. Not merged, not deployed; the live stack still runs the previous image. It adds an Alembic migration, so deploying means applying it. Migration up/down verified only on a disposable PostgreSQL container, not the live database. Not verified live.

- 2026-11-12: audit-logging branch passed an end-to-end check on an isolated copy (disposable Postgres, loopback API on port 8011, scratch Redis): 24 of 24. The live stack and live database were not touched. Rollout still needs owner decisions: the migration on live Postgres, a forced re-login for all users, and office assignment (live users currently have no office).

- 2026-11-12: a later git check reported branch `worktree-auth-login-ratelimit` at head 2171665, worktree clean, remote in sync. The audit-logging commit cited above is c74a1cd; 2171665 was not inspected. Still not merged or deployed.

- 2026-11-12: masking and reveal-policy commit 82d40d2 is on `worktree-auth-login-ratelimit`. Not merged or deployed, so the live stack has not received it. Until deployment, assume the pre-fix behaviour remains live: raw address and DOB to case roles, and 422 responses echoing rejected input. Not verified live.

- 2026-11-12: permission-override commit b0a452c is on `worktree-auth-login-ratelimit`. Not merged or deployed; the live stack has not received it. It adds a migration for the override tables. Not verified live.

- 2026-11-12: upload-limit and validation work is committed as 592d0ca on `worktree-auth-login-ratelimit`. Not merged or deployed; the live stack still runs the previous image and the 30 MB nginx limit on all routes. Deploying needs the Alembic migration applied and the nginx config reloaded (new streaming location, 50 GB, buffering off). Not verified live.

- 2026-11-12: live "Failed to fetch" errors have two causes. The HTTP-to-HTTPS redirect of `http://65.0.102.181` (from about 11:53 on 11 Nov) breaks tabs opened before it. The API hangs under about 50 concurrent users because requests hold database connections while waiting for a worker thread (pool exhaustion in `current_user`). The fix is on branch `worktree-auth-login-ratelimit` (3a1efae, pushed). Not merged or deployed; the live stack still runs the old code. The host nginx snippet `infrastructure/nginx/canonical-origin.conf` is recommended but not applied. Not verified live.

- 2026-11-12: user request management module committed and pushed as 62a7ee5. Not merged and not deployed; the live stack runs the previous image. Deploying needs its Alembic migration applied to the live database. Not verified live.

- 2026-11-12: P1.2 manual user ID allocation is committed as 349f18f and pushed to `worktree-auth-login-ratelimit`. Not merged and not deployed; the live stack runs the previous image. Deploying needs its Alembic migration (5bcde1234577, adds `users.org_user_id` and the `org_user_ids` history table) applied to the live database. Not verified live.

- 2026-11-12: P1.3 admin case assignment committed and pushed as 4af28f9. Not merged and not deployed; the live stack runs the previous image. Deploying needs Alembic migration 5bcde1234578 applied to the live database (adds assignment who/when/why columns and the `case_assignment_events` table). Not verified live.

- 2026-11-12: Graph fixes from P1.4 (commit 714bdc6) are pushed to the branch but not deployed. The running site has not been checked against them.














## Security posture (last fully verified 2026-11-11 -- see DRISTI_NET_SECURITY_AUDIT.md and
DRISTI_NET_PRODUCTION_READINESS_REPORT.md's dated addenda in the repo root for exact commands)

Verified live and currently true: TLS valid/trusted; HSTS + standard security headers; every
protected endpoint requires a valid token; JWT tampering/alg-confusion/malformed tokens all
rejected; login rate-limiting fires (429 after 5 failures); SQL-injection and XSS payloads handled
safely (ORM-parameterized, no reflection); the SPA path-traversal fix holds under live attack;
`api`/`worker` containers run as non-root `appuser`; only `paddlepaddle` (optional OCR, no stable
fix published) remains a known vulnerable dependency in the live containers; audit trail is
cryptographically intact (0 HMAC failures across all current events); Postgres/MinIO/the bare API
port are loopback-only, not internet-reachable; nginx no longer discloses its version.

Known, accepted, NOT fixed (deliberate, not oversights -- see the security audit doc for why):
Redis-down fails open on login throttling (LIVE ONLY: the branch `worktree-auth-login-ratelimit` replaces this with an in-process fallback, revision 2 of ADR-012; NOT deployed yet, so the live demo still fails open). SQLite deployments are never treated as "production"
regardless of secret key (by design, tested).

Genuinely still open, not yet decided/built: per-token/session revocation (deactivating an
*account* does work immediately, since `active` is checked every request -- there's just no way to
revoke one token while leaving a user's other sessions valid); Content-Security-Policy header;
localStorage token storage (vs. httpOnly cookies); a formal backup-restore drill specifically
against live Postgres/MinIO (the migration *to* them was verified, which is related but distinct);
the disaster recovery runbook (`operations/DISASTER_RECOVERY_PLAN.md`) is unsafe as written -- do
not follow it literally.

## Credentials

As of 2026-11-12 the live Postgres database has two users: `admin` (ADMIN role) and an inactive `smoketest`. The 8 demo users, 49 cases and 8 evidence files are only in the old SQLite store. Its password was set once this
session and has since been changed by the project owner directly through the app's own admin UI
(`/admin/users` → Reset password on your own row) -- nobody, including this memory file, should
record what it currently is. If you need to test authenticated flows and don't have it, ask the
owner rather than resetting it yourself; resetting an existing account's password without being
asked is exactly the kind of thing that should require explicit confirmation first.

## If you're picking this up fresh

1. Confirm the stack is actually still up before assuming anything below is current:
   `docker compose --env-file .env.compose ps` and `curl https://65.0.102.181.nip.io/api/v1/health`.
2. Read `docs/status.md` and `docs/context.md` first (per `AGENTS.md`/`CLAUDE.md`) -- they're the
   project's own authority, not this file.
3. This file and `DRISTI_NET_SECURITY_AUDIT.md`/`DRISTI_NET_PRODUCTION_READINESS_REPORT.md`'s dated
   addenda are the fastest way to know what's already been checked today vs. what's still open,
   so you don't redo work or, worse, assume something's fine that was never actually verified.

- 2026-11-13: P2.1 UI changes are on the branch at `b3ead04`. They were not deployed to the live host in this pass, so re-verify the live UI before relying on it.

