# DRISTI-NET — Master Storage Technical Documentation

**Authority:** `docs/adr/003-object-storage.md`, `apps/api/app/services/storage.py`, `docs/context.md` §8  
**Consolidation Date:** 2026-11-19  

---

## 1. Dual-Tier Storage Architecture

DRISTI-NET enforces strict separation between application code, database records, and binary evidence files:
- **Object Storage (Production):** AWS S3-compatible MinIO object store running on TCP port 9000.
- **Local Filesystem Driver (Development / Test):** Transparent filesystem adapter mapping identical object storage semantics to local directories (`storage/quarantine/`, `storage/accepted/`, `storage/staging/`).
- **Unified Driver Interface:** Defined in `apps/api/app/services/storage.py`. Callers use high-level methods (`put_object`, `get_object`, `delete_object`, `iter_bytes`, `promote_from_quarantine`) regardless of the underlying storage backend.

---

## 2. Evidence Storage Zones & Lifecycle

Evidence files transition through three strictly isolated physical storage zones:

1. **Quarantine Zone (`storage/quarantine/` or bucket `drishti-quarantine`):**
   - Files are written directly to this zone upon initial HTTP upload.
   - Files here are untrusted, unparsed, and completely inaccessible to normal analysis, search, or graph pipelines.
   - File keys follow the naming convention: `quarantine/{case_id}/{evidence_id}_{safe_filename}`.

2. **Accepted Zone (`storage/accepted/` or bucket `drishti-accepted`):**
   - Files are moved to this zone **only after** successfully passing the ClamAV fail-closed scan gate.
   - Files in accepted storage are considered safe for OCR, text extraction, and analytical processing.
   - Original bytes are immutable; write access is prohibited post-promotion.

3. **Staging / Temporary Zone (`storage/staging/`):**
   - Ephemeral working directory used for multi-part chunk reassembly, PDF page extraction, or temporary OCR image rendering.
   - Cleared automatically upon job completion or failure.

---

## 3. Streaming Downloads and Heap Memory Protection

To avoid heap memory exhaustion when handling multi-gigabyte forensic disk images or CCTV video archives:
- The backend uses FastAPI `StreamingResponse` backed by `storage.iter_bytes(key, chunk_size=65536)`.
- Files are streamed from MinIO or disk directly to the HTTP client socket.
- The server injects the authoritative cryptographic hash header: `X-Evidence-SHA256: <hash>`, enabling the client to verify byte integrity on the fly.
