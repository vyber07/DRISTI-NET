# ADR-016: Streaming uploads, per-category limits and signature validation

**Status:** Accepted. Tested (SQLite 441, disposable PostgreSQL 16 443, live isolated checks 11 of 11). Not deployed.
Configuration and operations: `docs/UPLOAD_POLICY.md`.

## Problem

- **One size for everything:** a single 25 MB limit applied to all evidence, and only CSV, JSON, PDF, TXT and ZIP were
  accepted. CCTV, photos, audio and disk images could not be ingested at all.
- **Everything in memory:** each upload was read fully into memory, hashed from memory and written from memory, so
  raising the limit would have exhausted the API.
- **Signatures for two types only:** they were checked for PDF and ZIP only.
- **Large files would fail:** the scanner, S3 hash checks and extraction all read whole files.

## Decision

- **Categories:** seven categories, each with a configurable limit (environment defaults, and runtime administrator
  policy within hard ceilings). Media and forensic categories are stored only: hashed, scanned, promoted and
  integrity-checked, but never parsed.
- **One staging and ingest path for both routes:**
  - stream to a staging file under `STORAGE_ROOT`, hashing and counting as bytes arrive;
  - validate the signature and content;
  - check for duplicates on the hash;
  - move atomically into quarantine;
  - commit, discarding the stored object if the commit fails.
- **A streaming route** for large files, with `Content-Length` checked before reading. The frontend uses it for every
  upload. The multipart route stays for compatibility, capped at 25 MB.
- **Signature checks** for every type that has one, plus a refusal of executable content.
- **Streaming everywhere else:** the scan, S3 hash and S3 download now stream. Files over the scanner's stream limit
  are held with an explicit message, never promoted unscanned.
- **Guards:** a concurrency limit (429), a free-disk floor (507), stale staging cleanup, and monitoring by rejection code.
- **Gateway:** a dedicated nginx location for the streaming route only (large body, buffering off).

## Trade-offs

- **ClamAV must be reconfigured** for large files. Until it is, large files are stored and held (fail-closed).
- **No resumable uploads.** A dropped multi-gigabyte upload restarts from zero.
- **Raw disk images** can't be signature-checked.
- **Script files are refused.** Text files beginning with `#!` are rejected as executable content. Code captured as
  evidence must be uploaded inside an archive, or with a different first line.
- **One status code changed.** An unsupported type stays 422 for client compatibility (415 would be more precise).

## Migration and rollback

`5bcde1234575` adds an empty `upload_policies` table (environment defaults apply until an administrator sets a limit).
Rollback: revert the commit and downgrade one revision. Evidence stored by the new path is ordinary evidence and remains valid.
