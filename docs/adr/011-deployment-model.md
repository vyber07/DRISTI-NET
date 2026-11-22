# ADR-011: Deployment model

## Problem

The system needs a reproducible way to run its full stack (API, Postgres, Neo4j, MinIO, Redis) on a real
host, distinct from the zero-install single-process dev/test loop.

## Options considered

- **Kubernetes** — matches "production" expectations in the abstract, but this project has exactly one
  deployment target today (a single Docker-capable host) and no demonstrated need for pod scheduling,
  horizontal autoscaling, or multi-node orchestration.
- **Docker Compose** — a single `docker-compose.yml` wiring `api` + `postgres` + `neo4j` + `redis` +
  `minio` with health checks and service dependencies, runnable with `docker compose up`.
- **User-space processes with no container runtime at all** — the fallback this project actually used
  *before* Docker was available on the dev host (ClamAV, Neo4j, Redis all built/run from source under
  `~/.cache/drishti/`, documented in `TASK_BOARD.md`'s earlier phases) — kept as a real, tested path for
  hosts without Docker/root access, not discarded once Docker became available.

## Decision

Docker Compose for hosts with Docker; the user-space fallback remains a documented, previously-verified
alternative for hosts without it. No Kubernetes.

## Reason

Directive §46 says this directly: "Do not introduce Kubernetes if it is not required for the actual
deployment environment." Nothing about this project's actual deployment target (a single host) requires
orchestration across multiple nodes. Docker Compose already gives real service isolation, health-checked
startup ordering, and a reproducible `docker compose up` — the concrete requirement — without the
operational overhead of a cluster this project has no plan to run on.

## Trade-offs

No horizontal scaling story, no rolling deployments, no automatic failover if the single host goes down —
all real limitations of this choice, honestly a non-issue for a prototype/demo but a genuine gap a real
multi-tenant production deployment would need to address (Phase 7 in the master directive's roadmap
sections, not this one).

## Security implications

Service-to-service traffic stays on the Compose-created bridge network, not exposed to the host except
where explicitly published (`ports:` — Postgres/Neo4j/MinIO are published to the host in this
configuration for local development/debugging convenience; a real production Compose file would keep
internal-only services unpublished).

## Performance implications

Not benchmarked. Single-host resource contention (all services sharing one machine's CPU/memory) is a real
constraint this deployment model accepts.

## Migration

Moving to Kubernetes later would mean translating each Compose service into a Deployment/StatefulSet +
Service + PVC — a real, non-trivial migration, not a config toggle. Nothing in the application code itself
is Compose-specific (it only reads connection URLs from environment variables), so the application layer
would not need to change.

## Rollback

Falling back to the user-space process model (documented in `TASK_BOARD.md`'s earlier phases) remains
possible on hosts without Docker/root — this was the actual state of this project before Docker access was
available, not a hypothetical fallback.

## Verification

Live-verified (`TASK_BOARD.md` Phase 7): `docker compose up` brought up all four services with health
checks passing, independently queried outside the app (`psql`, `cypher-shell`, `boto3`) to confirm real
data, then the full test suite run against all four simultaneously, 5 consecutive times for stability.
Also failure-injection tested (Phase 8): `docker stop`/`docker start` on each service in turn, confirming
the application's own degradation and recovery behavior — the deployment model itself doesn't hide or
paper over a service outage, the application code has to (and, after two bug fixes, does) handle it.
