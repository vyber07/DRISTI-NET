"""Secure ingestion + extraction.

validate_upload()  – name/extension/size/magic-byte/structure checks (before anything else touches the bytes)
extract()          – turns an ACCEPTED evidence file into Entity / Claim / Provenance rows

Every extracted item preserves BOTH the original value and the normalized value, and a locator
(row/column, json_path, page/line/char_offset) that points back into the source file.
"""
from __future__ import annotations

import csv
import io
import json
import re
import stat
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from sqlalchemy.orm import Session

from .. import config
from ..models import Claim, Entity, Evidence, Provenance

METHOD_VERSION = "0.1.0"


# ============================================================================ validation
@dataclass
class ValidationResult:
    ok: bool
    detected_type: str
    extension: str
    reason: str = ""


MAGIC = {
    ".pdf": (b"%PDF-", "application/pdf"),
    ".zip": (b"PK\x03\x04", "application/zip"),
}
_SAFE_NAME = re.compile(r"^[A-Za-z0-9._ -]{1,120}$")


def _is_safe_member_name(name: str) -> bool:
    if not name or name.startswith(("/", "\\")):
        return False
    parts = PurePosixPath(name.replace("\\", "/")).parts
    return ".." not in parts and not any(p in ("", ".") for p in parts[:-1])


def _check_archive(data: bytes) -> str:
    """Central-directory-only inspection (no member is decompressed here). Returns '' if the archive
    is safe to accept, else the rejection reason. Any failure to read the metadata itself is treated
    as unsafe (fail-closed) -- see config.py's archive-controls comment."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
        infos = zf.infolist()
    except (zipfile.BadZipFile, OSError) as exc:
        return f"corrupt or unreadable ZIP archive: {exc}"
    if len(infos) > config.ARCHIVE_MAX_MEMBERS:
        return f"archive exceeds member limit ({len(infos)} > {config.ARCHIVE_MAX_MEMBERS})"
    total_uncompressed = 0
    for info in infos:
        if info.is_dir():
            continue
        if not _is_safe_member_name(info.filename):
            return f"unsafe member path {info.filename!r} (path traversal or absolute path)"
        if stat.S_ISLNK(info.external_attr >> 16):
            return f"symlink member not allowed: {info.filename!r}"
        member_ext = Path(info.filename).suffix.lower()
        if member_ext == ".zip":
            return f"nested archive not allowed: {info.filename!r}"
        if member_ext not in config.ARCHIVE_MEMBER_EXTENSIONS:
            return f"unsupported member type {member_ext!r} in {info.filename!r}"
        if info.file_size > config.ARCHIVE_MAX_MEMBER_UNCOMPRESSED_MB * 1024 * 1024:
            return f"member {info.filename!r} exceeds uncompressed size limit ({config.ARCHIVE_MAX_MEMBER_UNCOMPRESSED_MB} MB)"
        if info.compress_size > 0 and info.file_size / info.compress_size > config.ARCHIVE_MAX_COMPRESSION_RATIO:
            return f"member {info.filename!r} exceeds compression-ratio limit (possible decompression bomb)"
        total_uncompressed += info.file_size
    if total_uncompressed > config.ARCHIVE_MAX_TOTAL_UNCOMPRESSED_MB * 1024 * 1024:
        return f"archive exceeds total uncompressed size limit ({config.ARCHIVE_MAX_TOTAL_UNCOMPRESSED_MB} MB)"
    return ""


def validate_upload(filename: str, data: bytes) -> ValidationResult:
    ext = Path(filename).suffix.lower()
    if not _SAFE_NAME.match(filename) or ".." in filename or "/" in filename:
        return ValidationResult(False, "unknown", ext, "unsafe file name")
    if ext not in config.ALLOWED_EXTENSIONS:
        return ValidationResult(False, "unknown", ext, f"unsupported format {ext!r}; allowed: {sorted(config.ALLOWED_EXTENSIONS)}")
    if len(data) == 0:
        return ValidationResult(False, "unknown", ext, "empty file")
    if len(data) > config.MAX_UPLOAD_MB * 1024 * 1024:
        return ValidationResult(False, "unknown", ext, f"file exceeds {config.MAX_UPLOAD_MB} MB")
    if ext in MAGIC:
        magic, mime = MAGIC[ext]
        if not data.startswith(magic):
            return ValidationResult(False, mime, ext, "magic bytes do not match declared type")
        if ext == ".zip":
            reason = _check_archive(data)
            if reason:
                return ValidationResult(False, mime, ext, reason)
            return ValidationResult(True, mime, ext)
        if ext == ".pdf":
            # Page-count cap only -- deliberately not a full parse/text-extraction here. A corrupt-but-
            # well-formed-header PDF (see the truncated-PDF fixture, TASK_BOARD.md Phase 9) must still
            # pass validation and fail visibly at EXTRACTION_FAILED, not be silently rejected here for
            # an unrelated reason, so a page-count read that itself raises is not treated as a breach.
            try:
                from pypdf import PdfReader
                page_count = len(PdfReader(io.BytesIO(data)).pages)
            except Exception:
                page_count = None
            if page_count is not None and page_count > config.PDF_MAX_PAGES:
                return ValidationResult(False, mime, ext, f"PDF exceeds page limit ({page_count} > {config.PDF_MAX_PAGES})")
        return ValidationResult(True, mime, ext)
    # text formats: must decode as UTF-8 and (for csv/json) parse structurally
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return ValidationResult(False, "text/plain", ext, "file is not valid UTF-8 text")
    if ext == ".json":
        try:
            obj = json.loads(text)
        except json.JSONDecodeError as exc:
            return ValidationResult(False, "application/json", ext, f"invalid JSON: {exc.msg}")
        if isinstance(obj, list) and len(obj) > config.JSON_MAX_RECORDS:
            return ValidationResult(False, "application/json", ext, f"JSON exceeds record limit ({config.JSON_MAX_RECORDS})")
        return ValidationResult(True, "application/json", ext)
    if ext == ".csv":
        try:
            rows = list(csv.reader(io.StringIO(text)))
        except csv.Error as exc:
            return ValidationResult(False, "text/csv", ext, f"invalid CSV: {exc}")
        if not rows or not rows[0]:
            return ValidationResult(False, "text/csv", ext, "CSV has no header row")
        if len(rows) > config.CSV_MAX_ROWS:
            return ValidationResult(False, "text/csv", ext, f"CSV exceeds row limit ({config.CSV_MAX_ROWS})")
        return ValidationResult(True, "text/csv", ext)
    return ValidationResult(True, "text/plain", ext)


# ============================================================================ normalization
def norm_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = "91" + digits
    return digits


def norm_account(raw: str) -> str:
    return re.sub(r"\s+", "", (raw or "").upper())


def norm_name(raw: str) -> str:
    return re.sub(r"[^a-z ]", "", (raw or "").lower()).strip()


def norm_reg(raw: str) -> str:
    return re.sub(r"\s+", "", (raw or "").upper())


def norm_text(raw: str) -> str:
    return re.sub(r"\s+", " ", (raw or "")).strip().lower()


# ============================================================================ record-type detection
SIGNATURES = {
    "calls": {"caller", "callee", "start_time"},
    "transactions": {"from_account", "to_account", "timestamp"},
    "vehicles": {"registration", "owner_name"},
    "locations": {"location_id", "lat", "lon"},
}


def detect_record_type(filename: str, data: bytes, ext: str) -> str:
    if ext == ".csv":
        header = set(next(csv.reader(io.StringIO(data.decode("utf-8", "replace")))))
        for kind, needed in SIGNATURES.items():
            if needed <= header:
                return kind
        return "csv-generic"
    if ext == ".json":
        obj = json.loads(data.decode("utf-8", "replace"))
        if isinstance(obj, list) and obj and isinstance(obj[0], dict):
            if "person_id" in obj[0] and "alias" in obj[0]:
                return "aliases"
            if "person_id" in obj[0] and "name" in obj[0]:
                return "people"
        return "json-generic"
    if ext == ".pdf" or ext == ".txt":
        return "fir" if "fir" in filename.lower() else "text"
    if ext == ".zip":
        return "archive"
    return "unknown"


# ============================================================================ extraction context
@dataclass
class ExtractionStats:
    entities_created: int = 0
    claims: int = 0
    provenance: int = 0
    rows: int = 0
    missing_fields: int = 0
    warnings: list[str] = field(default_factory=list)


class ExtractorBase:
    def __init__(self, db: Session, ev: Evidence):
        self.db = db
        self.ev = ev
        self.stats = ExtractionStats()
        self._entity_cache: dict[tuple[str, str], Entity] = {}
        self._archive_member: str | None = None

    # ---------------------------------------------------------------- entities
    def entity(self, kind: str, canonical: str, label: str, attributes: dict | None = None) -> Entity:
        key = (kind, canonical)
        if key in self._entity_cache:
            return self._entity_cache[key]
        case_id = self.ev.case_id
        
        ent = self.db.query(Entity).filter_by(kind=kind, canonical=canonical).first()
        if ent is None:
            new_attrs = {case_id: attributes} if attributes else {}
            ent = Entity(kind=kind, canonical=canonical, label=label, attributes=new_attrs,
                         access_class="SENSITIVE" if kind in ("PHONE", "ACCOUNT") else "RESTRICTED")
            self.db.add(ent)
            self.db.flush()
            self.stats.entities_created += 1
        elif attributes:
            current = dict(ent.attributes or {})
            case_attrs = dict(current.get(case_id, {}))
            case_attrs.update(attributes)
            current[case_id] = case_attrs
            ent.attributes = current
            self.db.add(ent)
            self.db.flush()
        self._entity_cache[key] = ent
        return ent

    # ---------------------------------------------------------------- claims
    def claim(self, kind: str, source: Entity, target: Entity | None = None, rel_type: str | None = None,
              attribute: str | None = None, original: str | None = None, normalized: str | None = None,
              observed_time: str | None = None, method: str = "structured-parser", confidence: float = 1.0,
              missingness: dict | None = None, weight: float = 1.0, locator: dict | None = None,
              snippet: str | None = None, state: str = "ALLOWED") -> Claim:
        c = Claim(case_id=self.ev.case_id, evidence_id=self.ev.evidence_id, kind=kind, rel_type=rel_type,
                  source_entity_id=source.entity_id, target_entity_id=target.entity_id if target else None,
                  attribute=attribute, original_value=original, normalized_value=normalized,
                  observed_time=observed_time, valid_from=observed_time, method=method, method_version=METHOD_VERSION,
                  confidence=confidence, missingness=missingness or {}, weight=weight, state=state)
        self.db.add(c)
        self.db.flush()
        full_locator = dict(locator or {})
        if self._archive_member:
            full_locator["archive_member"] = self._archive_member
        self.db.add(Provenance(claim_id=c.claim_id, evidence_id=self.ev.evidence_id, locator=full_locator,
                               snippet=snippet, method=method, method_version=METHOD_VERSION))
        self.stats.claims += 1
        self.stats.provenance += 1
        if missingness:
            self.stats.missing_fields += len(missingness)
        return c

    def case_entity(self) -> Entity:
        return self.entity("CASE", self.ev.case_id, self.ev.case_id)

    # ---------------------------------------------------------------- CSV: calls
def flag_contradictions(db: Session, case_id: str) -> int:
    """Two ATTRIBUTE claims on the same entity+attribute with different normalized values from different evidence."""
    claims = db.query(Claim).filter(Claim.case_id == case_id, Claim.kind == "ATTRIBUTE", Claim.attribute.in_(["owner", "dob", "address"])).all()
    by_key: dict[tuple[str, str], list[Claim]] = {}
    for c in claims:
        by_key.setdefault((c.source_entity_id, c.attribute), []).append(c)
    flagged = 0
    for group in by_key.values():
        values = {c.normalized_value for c in group}
        if len(values) > 1:
            for c in group:
                others = [o.claim_id for o in group if o.claim_id != c.claim_id and o.normalized_value != c.normalized_value]
                if others and c.state in ("ALLOWED", "CONTRADICTORY"):
                    c.state = "CONTRADICTORY"
                    c.flags = {**(c.flags or {}), "contradicts": others}
                    flagged += 1
    return flagged
