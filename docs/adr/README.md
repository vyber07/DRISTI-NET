# Architecture Decision Records

Each ADR documents one real technology or design decision made in this codebase: the problem, the
options actually considered, what was decided, why, and the trade-offs accepted. These are not
aspirational — every "decision" here corresponds to code that exists and (where applicable) has been
live-verified against a real running instance of the technology chosen. See `TASK_BOARD.md` for the
verification history behind ADR-003/004/005/009/017.

| ADR | Decision | Status |
|---|---|---|
| [001](001-relational-database.md) | Relational database of record: SQLite default, PostgreSQL for real deployments | Accepted |
| [002](002-graph-store.md) | Graph projection: in-process NetworkX default, Neo4j for real deployments | Accepted |
| [003](003-object-storage.md) | Evidence bytes: local filesystem default, MinIO/S3 for real deployments | Accepted |
| [004](004-async-queue.md) | No message queue (Kafka/Redpanda) — in-process job model | Accepted |
| [005](005-redis-scope.md) | Redis limited to one justified use: login-throttle counters | Accepted |
| [006](006-graph-renderer.md) | Frontend graph rendering: Sigma.js/Graphology (WebGL), not raw SVG | Accepted |
| [007](007-authentication.md) | Authentication: JWT + PBKDF2, no OAuth/OIDC/MFA yet | Accepted |
| [008](008-masking-and-provenance.md) | Dynamic masking with audited reveal; every relationship traces to an exact source location | Accepted |
| [009](009-temporal-decay.md) | Temporal relevance decay: exponential half-life, never rewrites history | Accepted |
| [010](010-integrity-mechanism.md) | Evidence integrity: SHA-256 manifest, not a hash chain or blockchain | Accepted |
| [011](011-deployment-model.md) | Deployment: Docker Compose, not Kubernetes | Accepted |
| [015](015-permission-overrides.md) | Scoped, time-boxed ALLOW/DENY permission overrides with two-admin approval; deny wins; mandatory restrictions | Accepted (not yet deployed) |
| [014](014-masking-policy.md) | Masking policy table, one reveal check, ADMIN separated from reveal, field-level masking of personal attributes | Accepted (not yet deployed) |
| [013](013-audit-logging.md) | Audit logging: server-side context, append-only database storage, signed rows, daily digests, criticality-based failure handling | Accepted (not yet deployed) |
| [012](012-rate-limiting.md) | Layered rate limiting: role-based login lockout, per-IP spraying limit, API ceilings; memory fallback when Redis is down (partly supersedes ADR-005) | Accepted (not yet live-verified) |

## Format

Each ADR follows: **Problem**, **Options considered**, **Decision**, **Reason**, **Trade-offs**,
**Security implications**, **Performance implications**, **Migration**, **Rollback**. An ADR that has
been live-verified says so explicitly, with the specific check performed — "should work" is not a
substitute for "verified."
