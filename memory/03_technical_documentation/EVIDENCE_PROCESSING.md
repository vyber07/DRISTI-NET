# DRISTI-NET — Master Evidence Processing Documentation

**Authority:** `docs/UPLOAD_POLICY.md`, `docs/adr/016-upload-policy.md`, `apps/api/app/services/extract.py`, `apps/api/app/services/pipeline.py`  
**Consolidation Date:** 2026-11-19  

---

## 1. Upload Policy & Pre-Ingestion Defense

Every file submitted to `POST /api/v1/cases/{id}/evidence` undergoes strict pre-ingestion screening before touching disk storage:
1. **Magic Header Sniffing:** MIME type is determined via libmagic byte sniffing rather than relying on client-supplied `Content-Type` headers or file extensions.
2. **Permitted Media Formats:**
   - Documents: PDF (`application/pdf`), TXT (`text/plain`), CSV (`text/csv`), JSON (`application/json`).
   - Forensic Archives: ZIP (`application/zip`).
   - Image Evidence: PNG (`image/png`), JPEG (`image/jpeg`).
   - Executable, script, or macro formats (`.exe`, `.bat`, `.sh`, `.vbs`, `.js`, `.py`, `.elf`) are unconditionally rejected with HTTP 422 and an audited `UPLOAD_DENIED` event.
3. **Archive Traversal & Bomb Defense (`_check_archive` in `extract.py`):**
   - ZIP files are inspected exclusively via central-directory headers **before any byte is decompressed**.
   - **Path Traversal Defense:** Rejects any member containing `..`, absolute paths (`/etc/`), or Windows drive letters (`C:\`).
   - **Symlink Defense:** Rejects any archive containing symlinks or hardlinks.
   - **Decompression Ratio Limits:** Rejects archives exceeding a 100:1 uncompressed-to-compressed ratio (anti-zip bomb).
   - **Size Limits:** Enforces a maximum total uncompressed size limit (default 250 MB) and member count cap (default 500 members).

---

## 2. Ingestion Pipeline Orchestration (`pipeline.py`)

The pipeline orchestrates the fail-closed sequence:
1. **Quarantine Storage:** Writes incoming bytes directly to the quarantine bucket.
2. **SHA-256 Checksum Calculation:** Streaming hash calculation during upload ensures byte-for-byte integrity without loading the full file into memory.
3. **Antivirus Scanning Gate:** Dispatches scan to ClamAV daemon.
   - Result: `CLEAN` -> File promoted to accepted storage; extraction dispatched.
   - Result: `INFECTED` -> File retained in quarantine; status marked `INFECTED`; audit logged; pipeline halted.
   - Result: `ERROR` / `TIMEOUT` -> Status marked `EXTRACTION_FAILED`; pipeline halted; retryable.
4. **Coordinate Extraction:** Specialized parsers parse text, tables, and entities, persisting claims with exact source coordinate references.
