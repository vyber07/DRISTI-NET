# ADR-004: No message queue (Kafka/Redpanda)

## Problem

The evidence pipeline (scan → extract → resolve) needs to run asynchronously relative to the upload
request, with retries, idempotency, and visible failure states.

## Options considered

- **Kafka/Redpanda-backed workers** — matches the "target architecture" diagram in the master directive,
  and is a real, common pattern for this kind of pipeline at scale.
- **In-process job model** — each pipeline stage is a function (`services/pipeline.py::run_scan`,
  `run_extract`, `run_resolve`) invoked against a `Job` row (idempotency key, attempts, trace id) directly
  from the request path or a background call, with no separate broker.

## Decision

In-process job model. No Kafka/Redpanda in this codebase.

## Reason

The directive's own §64 rule: "Do not introduce distributed infrastructure merely for architectural
fashion" / "no technology without justification." There is currently no measured throughput or
availability requirement in this project that an in-process job model fails to meet — the demo pipeline
processes single-digit files per case, synchronously, well within request-timeout budgets. Standing up a
Kafka cluster (even a single-broker Redpanda) with no workload to justify it would be exactly the
speculative-technology-adoption the directive warns against, and would add a real operational burden
(another service to keep healthy, another failure mode to test) for a benefit this project doesn't
currently need.

## Trade-offs

If evidence volume or processing latency ever became a real bottleneck, the current design would need
genuine rework, not just a config flag — `run_extract`/`run_resolve` etc. would need to become message
handlers instead of direct calls. `docs/architecture.md`'s swap-points table already documents this: "each
`run_*` function already is a stage with a `Job` row; publish the evidence_id instead of calling directly"
— the `Job` row's idempotency key was deliberately designed so this migration path stays open.

## Security implications

None specific to this decision (no broker to secure or misconfigure).

## Performance implications

Not benchmarked — see ADR-001/002/003. The in-process model's real limit is untested (no load test has
been run against it), which is itself the honest gap: this decision is justified by *absence of current
need*, not by a measured performance ceiling.

## Migration

If/when volume justifies it: swap the direct `run_*` calls in `pipeline.py` for message publish/consume,
keeping the same `Job` row schema and idempotency-key contract so retries and audit remain unchanged.

## Rollback

N/A — nothing to roll back from; this documents a decision *not* to add something.

## Verification

Not applicable in the "live-verified" sense other ADRs use — this ADR documents a deliberate non-adoption,
recorded per directive §67 ("no silent scope changes") rather than left unstated.
