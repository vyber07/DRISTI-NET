# ADR-007: Authentication mechanism

## Problem

Users need to authenticate to get a session usable across subsequent authorized requests, without storing
plaintext passwords or inventing a bespoke crypto scheme.

## Options considered

- **OIDC/OAuth2 against an external identity provider** — matches "production" expectations and offloads
  password handling entirely, but requires an IdP to exist and be configured; nothing in this prototype's
  scope currently needs federated identity (single organization, demo users).
- **Session cookies with server-side session storage** — viable, but adds a stateful session store
  dependency for a prototype that already has one (Redis, see ADR-005) scoped to exactly one narrow use.
- **JWT (stateless) + PBKDF2 password hashing** — what was implemented: `hash_password`/`verify_password`
  use stdlib `hashlib.pbkdf2_hmac("sha256", ..., 120_000)` iterations with a random salt;
  `issue_token`/`current_user` use `PyJWT` with `HS256` and an 8-hour TTL.

## Decision

JWT (HS256, 8h TTL, no refresh token) + PBKDF2-SHA256 (120,000 iterations) password hashing.

## Reason

No external IdP exists to integrate with in this deployment, and inventing session-store infrastructure
purely for authentication when a stateless token already satisfies the requirement would be the same
"technology without justification" the directive's §64 warns against. PBKDF2 via the standard library
avoids adding a native-extension dependency (e.g. `bcrypt`/`argon2`) for a demo-scope password store; the
iteration count (120,000) is chosen to be meaningfully slow against brute force while staying fast enough
not to bottleneck the login test suite.

## Trade-offs

No MFA, no WebAuthn/passkeys, no refresh-token rotation, no OIDC — all explicitly out of scope until a
real requirement justifies them (directive §64; also flagged as Roadmap in `docs/status.md`). No
server-side session revocation is possible before a token's natural 8-hour expiry (a stateless JWT's
known limitation) — a real production deployment handling higher-sensitivity access would need a
revocation list or to move to short-lived tokens with refresh, not accept this trade-off unmodified.

## Security implications

`SECRET_KEY` must never be the demo default (`change-me-demo-only`) outside a demo — this is documented in
`.env.example` and enforced nowhere in code (a real production gate should refuse to boot on the default
secret; this is a known gap, not claimed handled). Passwords are never logged; `test_no_secrets_in_repo`
scans for hardcoded credentials/keys but does not (and cannot) verify runtime secret hygiene.

## Performance implications

PBKDF2 at 120,000 iterations adds measurable but small latency per login (tens of milliseconds); JWT
verification is fast (no per-request database lookup needed beyond loading the user row).

## Migration

Moving to OIDC would replace `issue_token`/`current_user` with a token-introspection or JWKS-verification
call against the IdP; the downstream `require_roles`/`authorize_case` authorization logic is independent
of how the token was issued and would not need to change.

## Rollback

N/A — no prior authentication mechanism existed before this one in the current codebase.

## Verification

Covered by the existing security test suite (`test_role_gate_on_upload`,
`test_unassigned_user_denied_server_side`, `test_jurisdiction_mismatch_denied`, and the new
`test_ratelimit.py` for the throttle layer in ADR-005) — login, denial, and rate-limiting all exercised
against a real running server with real HTTP requests (`TASK_BOARD.md` Phase 4/8), not only unit-tested in
isolation.
