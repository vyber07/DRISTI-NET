# ADR-013: Kafka event bus (async evidence processing)

## Problem

Evidence pipeline (scan → extract → resolve) currently runs in-process from the upload
request path (ADR-004 decision, retained for unit/dev mode). At scale, heavy processing
blocks the API response and makes horizontal scaling harder.

## Decision

Add `services/kafka_bus.py` as an **opt-in Kafka publisher** and `workers/worker.py` as a
separate consumer process.

- The API publishes to topic `drishti.evidence.jobs` when `DRISHTI_KAFKA_BOOTSTRAP_SERVERS`
  is set.
- When Kafka is absent (env not set, or `kafka-python` not installed), `publish()` returns
  `False` and the caller falls through to the existing direct in-process path — no behaviour
  change.
- The `Job` table in PostgreSQL remains the idempotency and status source of truth for both
  paths.
- The worker uses the same `pipeline.process_evidence()` as the direct path — no logic
  duplication.

## Kafka choice

Apache Kafka 3.8 in KRaft mode (Bitnami image, single-broker for the evaluation stack).  
No Zookeeper required (KRaft controller built into the broker).  
Topic: `drishti.evidence.jobs`.  Partitions: 3 (scalable by adding consumers).

## Trade-offs

- Direct path (ADR-004) is preserved and tested independently — Kafka is purely additive.
- kafka-python is NOT added to `requirements.txt` (install separately in the worker image if
  needed) to avoid breaking the lightweight API dev environment.
- In the evaluation stack, `kafka_bus.publish()` can still fail after a Kafka crash and fall
  back to direct execution — the Job row ensures idempotency across both paths.
- Production: use ACLs, TLS, and SASL authentication on the Kafka broker.

## Migration

Swap direct calls for `kafka_bus.publish()` in `pipeline.process_evidence()` — already done.
Roll back by removing the `kafka_bus.kafka_enabled()` guard (direct path remains).

## Verification

`test_new_components.py::TestKafkaBus` — covers no-bootstrap (returns False) and
kafka-not-installed (returns False). Integration test of the full Kafka path requires a running
broker (not part of `make test`; add to `make test-stack`).
