# ADR-003: Evidence object storage

## Problem

Uploaded evidence bytes (originals, never overwritten) need durable storage with a quarantine/accepted
lifecycle, addressable by case and evidence id.

## Options considered

- **Local filesystem only** — simplest, but not what a multi-instance or production deployment would use,
  and doesn't exercise the access patterns (network calls, partial failure) a real object store has.
- **MinIO/S3 only** — matches the target architecture but requires a running object-storage server for
  every dev/test environment.
- **Local filesystem by default, S3-compatible when configured** — `services/storage.py` picks a backend
  based on whether `DRISHTI_S3_ENDPOINT_URL` is set, same "empty = not configured" convention as the
  database and graph store.

## Decision

Local filesystem under `DRISHTI_STORAGE_ROOT` by default; a real S3-compatible backend (MinIO in this
deployment) via `boto3` when `DRISHTI_S3_ENDPOINT_URL` is set. A `local_copy()` context manager gives
callers that need a real filesystem path (the ClamAV scanner) one either way — a genuine temp-file
download for S3, zero-copy for local.

## Reason

Same reasoning as ADR-001/002: a contributor shouldn't need a running MinIO instance to run the test
suite, but the production-shaped path (network object storage, not a local directory) needs to be real
code that's actually exercised, not a documented intention.

## Trade-offs

Every storage operation needs a code path for both backends (or a shared interface both satisfy) —
`overwrite_for_demo()` exists specifically because S3 has no shared local file to mutate in place the way
the filesystem path could, which is a real API-shape difference the abstraction has to account for, not
paper over.

## Security implications

Bucket/key construction stays path-traversal-safe on both backends (same validation as before the S3
support was added). Credentials (`DRISHTI_S3_ACCESS_KEY`/`SECRET_KEY`) come from environment, never
hardcoded.

## Performance implications

Not benchmarked. S3 network round-trips are inherently slower than local filesystem reads for the same
bytes; not yet measured how much slower for this workload.

## Migration

Set `DRISHTI_S3_ENDPOINT_URL`/`BUCKET`/`ACCESS_KEY`/`SECRET_KEY`; existing local-storage evidence is not
automatically migrated (no migration tool exists yet — a real production cutover would need one).

## Rollback

Unset `DRISHTI_S3_ENDPOINT_URL` to return to the local-filesystem path; both are tested by the same suite.

## Verification

Live-verified (`TASK_BOARD.md` Phase 2, Phase 7) against a real running MinIO container: full test suite
(27/27) with `DRISHTI_S3_ENDPOINT_URL` pointed at it, then independently confirmed via a separate `boto3`
client outside the test process (real object count and byte sizes matched). Also failure-injection tested
(Phase 8): stopping the MinIO container mid-session produces a `500` in ~7s with no leaked internals, and
the rest of the application (cases, graph) is unaffected — verified live, not assumed from the code
structure.
