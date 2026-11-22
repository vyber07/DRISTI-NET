"""Upload policy, file validation and the streaming ingest path (docs/UPLOAD_POLICY.md).

Every upload, from either route, goes through `stage()` then `ingest()`:

  stage   bytes are written to a private staging file under STORAGE_ROOT/staging while the SHA-256 is computed and the
          size is counted. The category limit is enforced as bytes arrive, and a declared Content-Length must be met
          exactly (a short body is an interrupted upload). Any failure removes the staging file: nothing partial survives.
  validate  file name, extension -> category, category enabled, magic-byte signature (not the client's MIME type or
          the extension alone), no executable content, and for documents, structured data and archives the existing
          content checks (UTF-8, JSON/CSV structure, PDF page cap, archive central-directory controls).
  ingest  duplicate check on the hash, evidence row, move into quarantine (no read into memory), audit, commit. If
          the commit fails, the stored object is discarded. Quarantine -> malware scan -> promotion -> integrity checks
          are unchanged (services/pipeline.py).

Media and forensic categories are stored, hashed, scanned and integrity-checked, but their content is never parsed.
"""
from __future__ import annotations

import datetime
import hashlib
import logging
import secrets
import shutil
import threading
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool

from .. import config
from ..models import UploadPolicy, utcnow

logger = logging.getLogger("drishti.upload")

CATEGORIES: dict[str, dict] = {
    "DOCUMENT": {"extensions": (".pdf", ".txt"), "extractable": True, "description": "PDF and plain-text documents"},
    "STRUCTURED": {"extensions": (".csv", ".json"), "extractable": True, "description": "CSV and JSON records"},
    "ARCHIVE": {"extensions": (".zip",), "extractable": True, "description": "ZIP archives of documents and records"},
    "IMAGE": {"extensions": (".jpg", ".jpeg", ".png", ".tif", ".tiff"), "extractable": False, "description": "Photographs and scans"},
    "AUDIO": {"extensions": (".wav", ".mp3", ".m4a"), "extractable": False, "description": "Audio recordings"},
    "VIDEO": {"extensions": (".mp4", ".mov", ".avi", ".mkv"), "extractable": False, "description": "CCTV and other video"},
    "FORENSIC": {"extensions": (".e01", ".dd", ".img", ".raw", ".pcap", ".pcapng"), "extractable": False,
                 "description": "Disk images and packet captures"},
}
EXT_CATEGORY = {ext: cat for cat, spec in CATEGORIES.items() for ext in spec["extensions"]}
BINARY_RECORD_TYPES = {cat.lower() for cat, spec in CATEGORIES.items() if not spec["extractable"]}
RAW_IMAGE_EXTENSIONS = (".dd", ".img", ".raw")   # raw disk images have no signature to verify
_MP4_BRANDS = {b"isom", b"iso2", b"iso4", b"iso5", b"iso6", b"mp41", b"mp42", b"avc1", b"M4V ", b"dash", b"3gp4", b"3gp5", b"3g2a"}
_M4A_BRANDS = {b"M4A ", b"M4B ", b"mp42", b"isom"}
_EXECUTABLE_PREFIXES = (b"MZ", b"\x7fELF", b"#!", b"\xfe\xed\xfa\xce", b"\xfe\xed\xfa\xcf", b"\xcf\xfa\xed\xfe", b"\xca\xfe\xba\xbe")
HEAD_BYTES = 64


class UploadRejected(Exception):
    """A rejected upload: HTTP status, a stable reason code for monitoring, and a message safe to show the uploader."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


# ------------------------------------------------------------------ signatures
def check_signature(ext: str, head: bytes) -> tuple[bool, str, str]:
    """(ok, mime, reason) from the first bytes. The declared extension must match what the bytes are."""
    if ext not in RAW_IMAGE_EXTENSIONS and head.startswith(_EXECUTABLE_PREFIXES):
        return False, "application/octet-stream", "executable or script content is not accepted as evidence"
    ftyp_brand = head[8:12] if head[4:8] == b"ftyp" else None
    checks = {
        ".pdf": (head.startswith(b"%PDF-"), "application/pdf"),
        ".zip": (head.startswith(b"PK\x03\x04"), "application/zip"),
        ".jpg": (head.startswith(b"\xff\xd8\xff"), "image/jpeg"),
        ".jpeg": (head.startswith(b"\xff\xd8\xff"), "image/jpeg"),
        ".png": (head.startswith(b"\x89PNG\r\n\x1a\n"), "image/png"),
        ".tif": (head[:4] in (b"II*\x00", b"MM\x00*"), "image/tiff"),
        ".tiff": (head[:4] in (b"II*\x00", b"MM\x00*"), "image/tiff"),
        ".wav": (head[:4] == b"RIFF" and head[8:12] == b"WAVE", "audio/wav"),
        ".mp3": (head.startswith(b"ID3") or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0), "audio/mpeg"),
        ".m4a": (ftyp_brand in _M4A_BRANDS, "audio/mp4"),
        ".mp4": (ftyp_brand in _MP4_BRANDS, "video/mp4"),
        ".mov": (ftyp_brand == b"qt  " or head[4:8] in (b"moov", b"mdat", b"wide", b"free"), "video/quicktime"),
        ".avi": (head[:4] == b"RIFF" and head[8:12] == b"AVI ", "video/x-msvideo"),
        ".mkv": (head.startswith(b"\x1a\x45\xdf\xa3"), "video/x-matroska"),
        ".e01": (head.startswith(b"EVF\x09\x0d\x0a\xff\x00"), "application/x-ewf"),
        ".pcap": (head[:4] in (b"\xd4\xc3\xb2\xa1", b"\xa1\xb2\xc3\xd4", b"\x4d\x3c\xb2\xa1", b"\xa1\xb2\x3c\x4d"), "application/vnd.tcpdump.pcap"),
        ".pcapng": (head.startswith(b"\x0a\x0d\x0d\x0a"), "application/x-pcapng"),
    }
    if ext in RAW_IMAGE_EXTENSIONS:
        return True, "application/octet-stream", ""
    if ext in (".txt", ".csv", ".json"):
        return True, {".txt": "text/plain", ".csv": "text/csv", ".json": "application/json"}[ext], ""  # content-checked later
    ok, mime = checks.get(ext, (False, "application/octet-stream"))
    return (True, mime, "") if ok else (False, mime, f"file content does not match the {ext} format (magic-byte signature check failed)")


# ------------------------------------------------------------------ policy
def _ceiling(cat: str) -> int:
    return min(config.UPLOAD_HARD_MAX_MB, config.UPLOAD_EXTRACTABLE_MAX_MB) if CATEGORIES[cat]["extractable"] else config.UPLOAD_HARD_MAX_MB


def _clamp(cat: str, mb: int) -> int:
    return max(1, min(int(mb), _ceiling(cat)))


def effective_policies(db) -> dict[str, dict]:
    rows = {r.category: r for r in db.query(UploadPolicy).all()}
    out = {}
    for cat, spec in CATEGORIES.items():
        row = rows.get(cat)
        mb = _clamp(cat, row.max_mb if row else config.UPLOAD_DEFAULT_LIMITS_MB[cat])
        out[cat] = {"category": cat, "description": spec["description"], "extensions": list(spec["extensions"]),
                    "max_mb": mb, "max_bytes": mb * 1024 * 1024, "enabled": row.enabled if row else True,
                    "content_extracted": spec["extractable"], "ceiling_mb": _ceiling(cat),
                    "updated_at": row.updated_at.isoformat() + "Z" if row and row.updated_at else None,
                    "updated_by": row.updated_by if row else None, "reason": row.reason if row else None}
    return out


def update_policy(db, actor, category: str, max_mb: int, enabled: bool, reason: str, trace) -> dict:
    from .audit import record_audit

    if category not in CATEGORIES:
        raise LookupError(category)
    if not 1 <= max_mb <= _ceiling(category):
        raise ValueError(f"max_mb must be between 1 and {_ceiling(category)} for {category}")
    before = effective_policies(db)[category]
    row = db.get(UploadPolicy, category) or UploadPolicy(category=category)
    db.add(row)
    row.max_mb, row.enabled, row.reason = max_mb, enabled, reason
    row.updated_at, row.updated_by = utcnow().replace(tzinfo=None), actor.user_id
    record_audit(db, trace, actor.user_id, "UPLOAD_POLICY_UPDATE", "UPLOAD_POLICY", category,
                 detail={"before": {"max_mb": before["max_mb"], "enabled": before["enabled"]},
                         "after": {"max_mb": max_mb, "enabled": enabled}, "reason": reason})
    return row


# ------------------------------------------------------------------ monitoring
@dataclass
class _Metrics:
    started_at: str = field(default_factory=lambda: datetime.datetime.utcnow().isoformat() + "Z")
    rejections: Counter = field(default_factory=Counter)
    accepted: int = 0
    accepted_bytes: int = 0
    in_progress: int = 0
    peak_in_progress: int = 0


METRICS = _Metrics()
_slots = threading.Lock()


def note_rejection(code: str, **context) -> None:
    METRICS.rejections[code] += 1
    level = logging.WARNING if code in ("INSUFFICIENT_STORAGE", "BUSY", "STORAGE_UNAVAILABLE") else logging.INFO
    logger.log(level, "upload rejected: %s", code, extra={"action": "EVIDENCE_UPLOAD", "outcome": code, **{k: v for k, v in context.items() if k in ("case_id",)}})


class upload_slot:
    """Per-process concurrency limit. Exceeding it is a 429, so a burst cannot exhaust disk, memory or workers."""

    def __enter__(self):
        with _slots:
            if METRICS.in_progress >= config.UPLOAD_MAX_CONCURRENT:
                note_rejection("BUSY")
                raise UploadRejected(429, "BUSY", "Too many uploads are in progress; try again shortly")
            METRICS.in_progress += 1
            METRICS.peak_in_progress = max(METRICS.peak_in_progress, METRICS.in_progress)
        return self

    def __exit__(self, *exc):
        with _slots:
            METRICS.in_progress -= 1
        return False


def staging_dir() -> Path:
    d = config.STORAGE_ROOT / "staging"
    d.mkdir(parents=True, exist_ok=True)
    return d


def disk_free_bytes() -> int:
    return shutil.disk_usage(staging_dir()).free


def cleanup_stale_staging() -> int:
    """Remove staging files left by a crashed process (normal failures clean up immediately)."""
    cutoff = time.time() - config.UPLOAD_STALE_STAGING_HOURS * 3600
    removed = 0
    for p in staging_dir().glob("*.part"):
        try:
            if p.stat().st_mtime < cutoff:
                p.unlink()
                removed += 1
        except OSError:
            pass
    if removed:
        logger.warning("removed %d stale staging files from interrupted uploads", removed)
    return removed


def staging_usage_bytes() -> int:
    return sum(p.stat().st_size for p in staging_dir().glob("*.part") if p.exists())


# ------------------------------------------------------------------ staging and validation
@dataclass
class Staged:
    path: Path
    filename: str
    ext: str
    category: str
    size: int
    sha256: str
    head: bytes
    mime: str = ""
    record_type: str = ""


def classify(filename: str, policies: dict) -> tuple[str, str, dict]:
    """(ext, category, policy) for a file name, before a single byte is read."""
    from .extract_common import _SAFE_NAME

    if not filename or not _SAFE_NAME.match(filename) or ".." in filename or "/" in filename or "\\" in filename:
        raise UploadRejected(422, "UNSAFE_NAME", "unsafe file name: use letters, digits, spaces, '.', '_' or '-' (at most 120 characters)")
    ext = Path(filename).suffix.lower()
    cat = EXT_CATEGORY.get(ext)
    if cat is None:
        # 422 (not 415) for compatibility with existing clients, which treat every validation refusal as 422.
        raise UploadRejected(422, "UNSUPPORTED_TYPE", f"unsupported file type {ext or '(none)'!r}; accepted: {', '.join(sorted(EXT_CATEGORY))}")
    pol = policies[cat]
    if not pol["enabled"]:
        raise UploadRejected(422, "CATEGORY_DISABLED", f"{cat.lower()} uploads are currently disabled by an administrator")
    return ext, cat, pol


def check_capacity(expected_bytes: int | None) -> None:
    need = (expected_bytes or 0) + config.UPLOAD_MIN_FREE_MB * 1024 * 1024
    if disk_free_bytes() < need:
        note_rejection("INSUFFICIENT_STORAGE")
        raise UploadRejected(507, "INSUFFICIENT_STORAGE", "The evidence store does not have enough free space for this upload")


async def stage(chunks, filename: str, ext: str, category: str, limit_bytes: int, expected_length: int | None = None) -> Staged:
    """Write the incoming bytes to a private staging file, hashing and counting as they arrive."""
    path = staging_dir() / f"{secrets.token_hex(16)}.part"
    h = hashlib.sha256()
    size = 0
    head = b""
    try:
        fh = await run_in_threadpool(open, path, "wb")
        try:
            async for chunk in chunks:
                if not chunk:
                    continue
                size += len(chunk)
                if size > limit_bytes:
                    raise UploadRejected(413, "TOO_LARGE", f"file exceeds the {category.lower()} limit of {limit_bytes // (1024 * 1024)} MB")
                if len(head) < HEAD_BYTES:
                    head += chunk[:HEAD_BYTES - len(head)]
                h.update(chunk)
                await run_in_threadpool(fh.write, chunk)
        finally:
            await run_in_threadpool(fh.close)
        if expected_length is not None and size != expected_length:
            raise UploadRejected(400, "INTERRUPTED", f"upload was incomplete: received {size} of {expected_length} bytes; nothing was stored")
        if size == 0:
            raise UploadRejected(422, "EMPTY", "empty file")
        return Staged(path=path, filename=filename, ext=ext, category=category, size=size, sha256=h.hexdigest(), head=head)
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def validate_staged(st: Staged) -> None:
    """Signature and content checks on the staged file. Raises UploadRejected; on success sets mime and record_type."""
    from . import extract as extract_svc
    from .extract_common import validate_upload

    ok, mime, reason = check_signature(st.ext, st.head)
    if not ok:
        raise UploadRejected(422, "EXECUTABLE_CONTENT" if "executable" in reason else "SIGNATURE_MISMATCH", reason)
    st.mime = mime
    if not CATEGORIES[st.category]["extractable"]:
        st.record_type = st.category.lower()
        return
    data = st.path.read_bytes()  # bounded: extractable categories are capped at UPLOAD_EXTRACTABLE_MAX_MB
    v = validate_upload(st.filename, data, max_bytes=st.size)
    if not v.ok:
        raise UploadRejected(422, "INVALID_CONTENT", v.reason)
    st.mime = v.detected_type or mime
    st.record_type = extract_svc.detect_record_type(st.filename, data, st.ext)


async def iter_upload_file(file, chunk_size: int = 1 << 20):
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            return
        yield chunk
