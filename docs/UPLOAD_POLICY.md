# Upload limits and file validation

Status: implemented on branch `worktree-auth-login-ratelimit`, not deployed. Decision record: ADR-016.

## 1. Inventory

| Upload path | Route | Body | Cap |
|---|---|---|---|
| Multipart form (existing) | `POST /api/v1/cases/{case_id}/evidence` | `multipart/form-data` (`file`, `source_label`, `process`) | the smaller of `DRISHTI_MAX_UPLOAD_MB` (25) and the category limit |
| Streaming (new) | `POST /api/v1/cases/{case_id}/evidence/stream?filename=&source_label=&process=` | raw file, `application/octet-stream`, `Content-Length` required | the category limit (up to 50 GB) |

There are no other upload routes. The web app now uses the streaming route for every upload. Both routes share the same
role and case checks (action `upload`, case assignment), validation and ingest code (`services/upload_policy.py`).

### Categories and defaults

| Category | Extensions | Default limit | Content |
|---|---|---|---|
| DOCUMENT | .pdf, .txt | 25 MB | extracted |
| STRUCTURED | .csv, .json | 25 MB | extracted |
| ARCHIVE | .zip | 100 MB | members extracted |
| IMAGE | .jpg, .jpeg, .png, .tif, .tiff | 50 MB | stored only |
| AUDIO | .wav, .mp3, .m4a | 500 MB | stored only |
| VIDEO (CCTV) | .mp4, .mov, .avi, .mkv | 20 GB | stored only |
| FORENSIC | .e01, .dd, .img, .raw, .pcap, .pcapng | 50 GB | stored only |

"Stored only" means the file is hashed, quarantined, malware-scanned, promoted, and integrity-checked like any other
evidence, but its content is never loaded or parsed.

## 2. Enforcement at each layer

| Layer | What it enforces |
|---|---|
| Frontend (`case-evidence-view.tsx`, `evidenceApi.ts`) | Shows accepted types and limits from `GET /upload-policies`. Refuses an unsupported type, an empty file or an oversized file before sending (courtesy only). Streams the file as the request body. |
| Gateway (`infrastructure/nginx/nginx.conf`) | The streaming route alone accepts up to `client_max_body_size 50g`, with `proxy_request_buffering off` (bytes go straight to the API) and long timeouts. Every other API route keeps the 30 MB cap. |
| Backend, before reading | Role and case access; file name; extension to category; category enabled; `Content-Length` present and within the category limit; enough free disk; a free upload slot. |
| Backend, while reading | Size counted as bytes arrive (stops at the limit). SHA-256 computed incrementally. A body shorter than `Content-Length`, or a dropped connection, is an interrupted upload. |
| Backend, after reading | Magic-byte signature for the declared extension. No executable or script content. For documents, structured data and archives: UTF-8, JSON and CSV structure and row caps, PDF page cap, and archive controls. |
| Storage and processing | Atomic move (local) or multipart upload (S3) into quarantine. Scan, promotion and hash verification stream from disk. Media and forensic content is never read into memory. |

## 3. Protections

- **Path traversal**: file names must match `[A-Za-z0-9._ -]{1,120}` with no `..`, `/` or `\`; storage paths are
  resolved under `STORAGE_ROOT` (`storage._abs`). Control characters (including NUL) never reach the database.
- **Archive traversal and bombs**: the central directory is checked before acceptance (member count, unsafe paths,
  symlinks, nested archives, member types, per-member and total uncompressed size, compression ratio). Extraction is
  bounded by the declared sizes: a ZIP whose headers understate a member's size stops at the declared size and fails
  its CRC check (tested).
- **MIME type**: the client's `Content-Type` and the extension alone are never trusted; the first bytes must match the extension.
- **Malformed files**: a signature mismatch is refused at upload. A file with a valid header but broken content (e.g.
  a truncated PDF) is accepted and then fails visibly as `EXTRACTION_FAILED`, as before.
- **Executable content**: files starting with a PE, ELF or Mach-O header, or a `#!` script line, are refused for every
  category except raw disk images (`.dd`, `.img`, `.raw`), which carry no signature to check. Raw disk images are the
  one category accepted on extension alone; the malware scan still applies.
- **Oversized payloads**: refused on `Content-Length` before reading, then enforced byte by byte. The gateway caps
  every other route at 30 MB.
- **Resource exhaustion**: a per-process concurrency limit returns 429; a free-disk floor returns 507; staging files
  from a crashed process are removed at startup.

## 4. Integrity, duplicates and partial uploads

- The SHA-256 is computed while the bytes arrive and recorded on the evidence row, as in the existing integrity design.
  It is re-verified (streamed) before extraction and by `GET /evidence/{id}/verify`.
- **Duplicates**: the same file in the same case returns the existing evidence (audited as
  `EVIDENCE_UPLOAD_DUPLICATE`). Concurrent identical uploads are resolved by the `uix_evidence_case_sha` constraint:
  one row, and the others receive it.
- **Partial uploads**: nothing is written to the evidence store until the whole file is staged and validated. Any
  failure removes the staging file. If the database commit fails after the move into quarantine, the stored object
  is discarded. There is never a row without an object, or a partial object.

## 5. Malware scanning of large files

ClamAV refuses streams larger than its `StreamMaxLength` (25 MB by default). Files above `DRISHTI_SCAN_MAX_MB` are not
sent to the scanner. They stay in quarantine as `SCAN_FAILED`, with the message *"file is N MB, above the scanner limit
of M MB; raise clamd StreamMaxLength and DRISHTI_SCAN_MAX_MB, then reprocess"*. They are never promoted unscanned. To
ingest CCTV or disk images end to end:

1. Set clamd `StreamMaxLength` (and `MaxFileSize`, `MaxScanSize`) to at least the largest accepted file, for example
   `StreamMaxLength 20G` in the ClamAV container's `clamd.conf`.
2. Set `DRISHTI_SCAN_MAX_MB` to the same value.
3. Reprocess any held items (`POST /evidence/{id}/process`).

The scan timeout grows with file size: `DRISHTI_SCAN_TIMEOUT_S + size_in_GB × DRISHTI_SCAN_TIMEOUT_PER_GB_S`.

## 6. Errors

| Status | Code | Meaning shown to the uploader |
|---|---|---|
| 413 | TOO_LARGE | file exceeds the category limit (named, in MB) |
| 422 | UNSUPPORTED_TYPE, CATEGORY_DISABLED | type not accepted (lists the accepted types), or disabled by an administrator |
| 422 | UNSAFE_NAME, EMPTY, SIGNATURE_MISMATCH, EXECUTABLE_CONTENT, INVALID_CONTENT | name rules; empty file; content does not match the type; executable content; invalid PDF, CSV, JSON or archive |
| 400 | INTERRUPTED | the body was shorter than `Content-Length`, or the connection dropped; nothing was stored |
| 411 | LENGTH_REQUIRED | the streaming route needs `Content-Length` |
| 429 | BUSY | too many uploads in progress (`Retry-After: 30`) |
| 503 | STORAGE_UNAVAILABLE | the evidence store could not be written; nothing was stored |
| 507 | INSUFFICIENT_STORAGE | not enough free space |

Every refusal is audited as `EVIDENCE_UPLOAD` DENIED (or ERROR) with the code and reason.

## 7. Administration and configuration

- `GET /upload-policies` (any signed-in user): accepted types, current limits, the scanner limit.
- `PUT /upload-policies/{category}` (ADMIN, not overridable): `{max_mb, enabled, reason}`, audited with before and
  after. Limits are bounded by `DRISHTI_UPLOAD_HARD_MAX_MB` for every category, and by
  `DRISHTI_UPLOAD_EXTRACTABLE_MAX_MB` for the parsed categories (documents, structured data, archives).
- Environment (`apps/api/app/config.py`, `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `DRISHTI_UPLOAD_MAX_<CATEGORY>_MB` | see section 1 | default limit per category (used until an administrator sets one) |
| `DRISHTI_UPLOAD_HARD_MAX_MB` | 51200 | ceiling for any category; must equal the gateway limit for the streaming route |
| `DRISHTI_UPLOAD_EXTRACTABLE_MAX_MB` | 512 | ceiling for documents, structured data and archives (parsed in memory) |
| `DRISHTI_MAX_UPLOAD_MB` | 25 | overall cap of the multipart route |
| `DRISHTI_UPLOAD_MIN_FREE_MB` | 2048 | free disk to keep after an upload |
| `DRISHTI_UPLOAD_MAX_CONCURRENT` | 4 | simultaneous uploads per API process |
| `DRISHTI_UPLOAD_STALE_STAGING_HOURS` | 6 | age at which leftover staging files are removed at startup |
| `DRISHTI_SCAN_MAX_MB` | 25 | the scanner's stream limit (match clamd `StreamMaxLength`) |
| `DRISHTI_SCAN_TIMEOUT_PER_GB_S` | 120 | extra scan time per GB |

## 8. Monitoring

`GET /upload-policies/metrics` (ADMIN, AUDITOR; audited) returns:

- **This process:** accepted count and bytes, rejections by code, in-progress and peak uploads, and the concurrency limit.
- **Storage:** free disk, the configured floor, a low-disk flag, and staging usage.
- **Last 24 hours, from the audit log:** rejected and failed uploads across all processes, grouped by reason.

Resource refusals (`BUSY`, `INSUFFICIENT_STORAGE`, `STORAGE_UNAVAILABLE`) are also logged at WARNING for log alerting.

## 9. Verification

- `test_upload_policy.py` (41) covers:
  - boundary sizes, plus refusal on `Content-Length` before staging;
  - signature mismatches for six types, client MIME types not trusted, and executable content;
  - nine unsafe or unsupported names;
  - valid media and forensic types, with hash and size checked;
  - interrupted and length-less uploads, and stale staging cleanup;
  - archive bombs and traversal, plus the lying-header ZIP;
  - concurrent identical uploads, and the concurrency limit;
  - storage failure and low disk;
  - a 30 MB video never read into memory, the scanner-limit message, and EICAR inside media;
  - policy permissions, ceilings, disabling, and monitoring.
- **Full suite:** SQLite 441 passed. A disposable PostgreSQL 16 container passed 443, after fixing a NUL-in-file-name
  audit failure that only PostgreSQL exposed. Migration `5bcde1234575` builds, downgrades and re-upgrades.
- **Live checks against an isolated instance** (`scripts/upload_live_check.py`), 11 of 11:
  - a real dropped connection mid-upload leaves no row and no staging file, and is audited;
  - a 200 MB streamed video is hashed correctly while the server's peak memory grows by about 1 MB;
  - in the browser, the panel lists the limits, a CSV uploads through the streaming route and is processed, and an
    oversized image is refused before sending, with no console errors.
- **Gateway:** `nginx -t` passes on the edited configuration (Compose's nginx image).

## 10. Not done, and deployment notes

- **Host nginx:** the live site's nginx is the host one (`/etc/nginx`, site `dristinet`), not the Compose config in
  this repo. Its body limit and buffering must be set the same way before large uploads work in production.
- **ClamAV:** must be reconfigured for large files (section 5). Until then, large files are stored and held, not promoted.
- **No resumable or chunked uploads.** A dropped 20 GB upload must restart. A resumable protocol (tus or S3 multipart
  from the browser) is the next step if this matters.
- **Raw disk images** (`.dd`, `.img`, `.raw`) are accepted without a signature check.
- **No content analysis for media.** There's no CCTV frame extraction or image EXIF parsing yet.
- **Starlette's multipart parser** spools the whole form body to a temporary file before the handler runs. That's why
  large files use the streaming route, and the gateway caps the form route at 30 MB.
