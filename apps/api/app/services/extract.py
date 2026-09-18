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


class Extractor:
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
    def extract_calls(self, text: str):
        for i, row in enumerate(csv.DictReader(io.StringIO(text)), start=2):  # row 1 = header
            self.stats.rows += 1
            caller = self.entity("PHONE", norm_phone(row["caller"]), row["caller"])
            callee = self.entity("PHONE", norm_phone(row["callee"]), row["callee"])
            missing = {}
            dur = row.get("duration_sec") or ""
            if not dur:
                missing["duration_sec"] = "missing in source"
            weight = float(dur) if dur else 1.0
            self.claim("RELATIONSHIP", caller, callee, "CALLED", original=f'{row["caller"]} -> {row["callee"]}',
                       normalized=f"{caller.canonical}->{callee.canonical}", observed_time=row.get("start_time"),
                       weight=weight, missingness=missing, locator={"row": i, "columns": ["caller", "callee", "start_time"]},
                       snippet=",".join(row.values()))
            if row.get("cell_id"):
                loc = self.entity("LOCATION", row["cell_id"], row["cell_id"], {"kind": "cell_tower"})
                self.claim("RELATIONSHIP", caller, loc, "OBSERVED_AT", original=row["cell_id"], normalized=row["cell_id"],
                           observed_time=row.get("start_time"), locator={"row": i, "columns": ["caller", "cell_id"]}, snippet=",".join(row.values()))

    # ---------------------------------------------------------------- CSV: transactions
    def extract_transactions(self, text: str):
        for i, row in enumerate(csv.DictReader(io.StringIO(text)), start=2):
            self.stats.rows += 1
            src = self.entity("ACCOUNT", norm_account(row["from_account"]), row["from_account"])
            dst = self.entity("ACCOUNT", norm_account(row["to_account"]), row["to_account"])
            amt = (row.get("amount_inr") or "").strip()
            missing = {} if amt else {"amount_inr": "missing in source"}
            self.claim("RELATIONSHIP", src, dst, "TRANSFERRED_TO", original=amt or None, normalized=amt or None,
                       observed_time=row.get("timestamp"), weight=float(amt) if amt else 0.0, missingness=missing,
                       confidence=1.0 if amt else 0.6, locator={"row": i, "columns": ["from_account", "to_account", "amount_inr"]},
                       snippet=",".join(row.values()))

    # ---------------------------------------------------------------- CSV: vehicles
    def extract_vehicles(self, text: str):
        for i, row in enumerate(csv.DictReader(io.StringIO(text)), start=2):
            self.stats.rows += 1
            veh = self.entity("VEHICLE", norm_reg(row["registration"]), row["registration"], {"type": row.get("type")})
            self.claim("ATTRIBUTE", veh, attribute="owner", original=row["owner_name"], normalized=norm_name(row["owner_name"]),
                       locator={"row": i, "columns": ["registration", "owner_name"]}, snippet=",".join(row.values()))
            if row.get("owner_person_id"):
                person = self.entity("PERSON", f"pid:{row['owner_person_id']}", row["owner_name"])
                self.claim("RELATIONSHIP", person, veh, "OWNS_VEHICLE", original=row["registration"], normalized=veh.canonical,
                           locator={"row": i, "columns": ["owner_person_id", "registration"]}, snippet=",".join(row.values()))

    # ---------------------------------------------------------------- CSV: locations
    def extract_locations(self, text: str):
        for i, row in enumerate(csv.DictReader(io.StringIO(text)), start=2):
            self.stats.rows += 1
            loc = self.entity("LOCATION", row["location_id"], row.get("name") or row["location_id"],
                              {"lat": row.get("lat"), "lon": row.get("lon"), "kind": row.get("kind")})
            self.claim("MENTION", loc, original=row.get("name"), normalized=row["location_id"],
                       locator={"row": i, "columns": list(row.keys())}, snippet=",".join(row.values()))

    # ---------------------------------------------------------------- JSON: people
    def extract_people(self, text: str):
        case = self.case_entity()
        for i, rec in enumerate(json.loads(text)):
            self.stats.rows += 1
            jp = f"$[{i}]"
            person = self.entity("PERSON", f"pid:{rec['person_id']}", rec["name"],
                                 {"dob": rec.get("dob"), "address": rec.get("address"), "person_id": rec["person_id"]})
            self.claim("RELATIONSHIP", person, case, "APPEARS_IN", original=rec["person_id"], normalized=rec["person_id"],
                       locator={"json_path": jp}, snippet=json.dumps(rec)[:200])
            for attr in ("dob", "address", "name"):
                if rec.get(attr):
                    self.claim("ATTRIBUTE", person, attribute=attr, original=rec[attr],
                               normalized=norm_name(rec[attr]) if attr == "name" else norm_text(rec[attr]),
                               locator={"json_path": f"{jp}.{attr}"}, snippet=f"{attr}: {rec[attr]}")
                else:
                    self.stats.missing_fields += 1
            if rec.get("phone"):
                ph = self.entity("PHONE", norm_phone(rec["phone"]), rec["phone"])
                self.claim("RELATIONSHIP", person, ph, "USES_PHONE", original=rec["phone"], normalized=ph.canonical,
                           locator={"json_path": f"{jp}.phone"}, snippet=f"phone: {rec['phone']}")
            if rec.get("account"):
                ac = self.entity("ACCOUNT", norm_account(rec["account"]), rec["account"])
                self.claim("RELATIONSHIP", person, ac, "HOLDS_ACCOUNT", original=rec["account"], normalized=ac.canonical,
                           locator={"json_path": f"{jp}.account"}, snippet=f"account: {rec['account']}")
            if rec.get("org"):
                org = self.entity("ORGANIZATION", norm_text(rec["org"]), rec["org"])
                self.claim("RELATIONSHIP", person, org, "MEMBER_OF", original=rec["org"], normalized=org.canonical,
                           locator={"json_path": f"{jp}.org"}, snippet=f"org: {rec['org']}")

    # ---------------------------------------------------------------- JSON: aliases
    def extract_aliases(self, text: str):
        for i, rec in enumerate(json.loads(text)):
            self.stats.rows += 1
            person = self.entity("PERSON", f"pid:{rec['person_id']}", rec.get("person_id"))
            self.claim("ATTRIBUTE", person, attribute="alias", original=rec["alias"], normalized=norm_name(rec["alias"]),
                       locator={"json_path": f"$[{i}].alias"}, snippet=json.dumps(rec))

    # ---------------------------------------------------------------- PDF / TXT (narrow regex NER on FIR fixture)
    PHONE_RE = re.compile(r"\+91[\s-]?\d{5}[\s-]?\d{5}")
    ACCOUNT_RE = re.compile(r"ACC-[A-Z]+-\d{4}")
    REG_RE = re.compile(r"\b[A-Z]{2}\d{2} [A-Z]{2} \d{4}\b")
    NAME_RE = re.compile(r"\b([A-Z][a-z]+ [A-Z][a-z]+)\b")
    ORG_SUFFIX_RE = re.compile(
        r"\b([A-Z][A-Za-z&]+(?: [A-Z][A-Za-z&]+)* "
        r"(?:Traders|Logistics|Freight|Enterprises|Industries|Corporation|Company|Ltd|Limited|"
        r"Pvt Ltd|LLC|Inc|Group|Bank|Foundation|Association|Society|Trust))\b"
    )
    OWNER_RE = re.compile(
        r"registration ([A-Z]{2}\d{2} [A-Z]{2} \d{4}),?\s*"
        r"(?:said to belong to|belonging to|belongs to|owned by|registered to|registered in the name of)\s+"
        r"([A-Z][a-z]+ [A-Z][a-z]+)"
    )
    DATE_RE = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
    STOP_NAMES = {"Demo District", "First Information", "Case Ref", "River Bridge", "Junction Square", "Summary of", "Persons named", "Organisations named", "Police (FICTIONAL)"}

    def _pages(self, data: bytes, ext: str) -> list[list[str]]:
        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            return [(page.extract_text() or "").splitlines() for page in reader.pages]
        return [data.decode("utf-8", "replace").splitlines()]

    def extract_document(self, data: bytes, ext: str):
        case = self.case_entity()
        pages = self._pages(data, ext)
        doc_date = None
        section = ""
        for pno, lines in enumerate(pages, start=1):
            offset = 0
            for lno, line in enumerate(lines, start=1):
                self.stats.rows += 1
                loc = lambda m, extra=None: {"page": pno, "line": lno, "char_offset": offset + m.start(), **(extra or {})}
                stripped = line.strip()
                if re.match(r"^\d+\.\s", stripped):
                    section = stripped
                if doc_date is None and "Date:" in line:
                    dm = self.DATE_RE.search(line)
                    doc_date = dm.group(1) if dm else None
                # organisations
                for m in self.ORG_SUFFIX_RE.finditer(line):
                    org = self.entity("ORGANIZATION", norm_text(m.group(1)), m.group(1))
                    self.claim("MENTION", org, original=m.group(1), normalized=org.canonical, method="regex-ner",
                               confidence=0.85, observed_time=doc_date, locator=loc(m), snippet=stripped)
                # vehicle ownership asserted by the document → ATTRIBUTE claim (may contradict a registry).
                # The sentence may wrap, so match against this line joined with the next one.
                joined = line + " " + (lines[lno] if lno < len(lines) else "")
                for m in self.OWNER_RE.finditer(re.sub(r"\s+", " ", joined)):
                    if "registration" not in line:
                        continue
                    veh = self.entity("VEHICLE", norm_reg(m.group(1)), m.group(1))
                    self.claim("ATTRIBUTE", veh, attribute="owner", original=m.group(2), normalized=norm_name(m.group(2)),
                               method="regex-ner", confidence=0.7, observed_time=doc_date,
                               locator={"page": pno, "line": lno, "line_end": lno + 1, "char_offset": offset + line.find("registration")},
                               snippet=re.sub(r"\s+", " ", joined).strip())
                # person mentions: "Name: X" or lines in the persons section, or "X, <org>, contact <phone>"
                names = []
                nm = re.search(r"Name:\s*([A-Z][a-z]+ [A-Z][a-z]+)", line)
                if nm:
                    names.append(nm)
                elif section.startswith("3.") or section.startswith("2."):
                    for m in self.NAME_RE.finditer(line):
                        if m.group(1) not in self.STOP_NAMES and not self.ORG_SUFFIX_RE.match(m.group(1)):
                            names.append(m)
                for m in names:
                    name = m.group(1)
                    person = self.entity("PERSON", f"mention:{norm_name(name)}@{self.ev.evidence_id}", name,
                                         {"mention_of": name, "source_document": self.ev.filename})
                    self.claim("RELATIONSHIP", person, case, "NAMED_IN", original=name, normalized=norm_name(name),
                               method="regex-ner", confidence=0.8, observed_time=doc_date, locator=loc(m), snippet=stripped)
                    self.claim("ATTRIBUTE", person, attribute="name", original=name, normalized=norm_name(name),
                               method="regex-ner", confidence=0.8, locator=loc(m), snippet=stripped)
                    for om in self.ORG_SUFFIX_RE.finditer(line):
                        org = self.entity("ORGANIZATION", norm_text(om.group(1)), om.group(1))
                        self.claim("RELATIONSHIP", person, org, "MEMBER_OF", original=om.group(1), normalized=org.canonical,
                                   method="regex-ner", confidence=0.7, observed_time=doc_date, locator=loc(om), snippet=stripped)
                    for pm in self.PHONE_RE.finditer(line):
                        ph = self.entity("PHONE", norm_phone(pm.group(0)), pm.group(0))
                        self.claim("RELATIONSHIP", person, ph, "USES_PHONE", original=pm.group(0), normalized=ph.canonical,
                                   method="regex-ner", confidence=0.75, observed_time=doc_date, locator=loc(pm), snippet=stripped)
                    if "not provided" in line or "could not confirm" in line:
                        self.stats.missing_fields += 1
                # accounts: "X to Y" → transfer with unknown amount
                accts = list(self.ACCOUNT_RE.finditer(line))
                if len(accts) == 2 and " to " in line:
                    a = self.entity("ACCOUNT", norm_account(accts[0].group(0)), accts[0].group(0))
                    b = self.entity("ACCOUNT", norm_account(accts[1].group(0)), accts[1].group(0))
                    self.claim("RELATIONSHIP", a, b, "TRANSFERRED_TO", original=None, normalized=None, method="regex-ner",
                               confidence=0.6, observed_time=doc_date, missingness={"amount_inr": "amount not stated in document"},
                               locator=loc(accts[0]), snippet=stripped)
                # vehicle mentions
                for m in self.REG_RE.finditer(line):
                    veh = self.entity("VEHICLE", norm_reg(m.group(0)), m.group(0))
                    self.claim("MENTION", veh, original=m.group(0), normalized=veh.canonical, method="regex-ner",
                               confidence=0.9, observed_time=doc_date, locator=loc(m), snippet=stripped)
                offset += len(line) + 1
        if not any(pages):
            self.stats.warnings.append("no text extracted from document (OCR route not available in prototype)")

    # ---------------------------------------------------------------- ZIP archive: extract each member
    def extract_archive(self, data: bytes):
        """Re-validates the archive (defence in depth -- validate_upload already checked it at upload
        time, but the bytes on disk could in principle differ) then extracts every member through the
        same per-type handlers used for a standalone upload, tagging each resulting claim's locator
        with which archive member it came from."""
        reason = _check_archive(data)
        if reason:
            raise ValueError(f"archive failed re-validation at extract time: {reason}")
        handlers = {
            "calls": self.extract_calls, "transactions": self.extract_transactions, "vehicles": self.extract_vehicles,
            "locations": self.extract_locations, "people": self.extract_people, "aliases": self.extract_aliases,
        }
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                member_ext = Path(info.filename).suffix.lower()
                member_bytes = zf.read(info)
                self._archive_member = info.filename
                try:
                    if member_ext in (".pdf", ".txt"):
                        self.extract_document(member_bytes, member_ext)
                        continue
                    member_text = member_bytes.decode("utf-8")
                    record_type = detect_record_type(info.filename, member_bytes, member_ext)
                    handler = handlers.get(record_type)
                    if handler is None:
                        self.stats.warnings.append(f"no extractor for member {info.filename!r} (record type {record_type!r})")
                        continue
                    handler(member_text)
                finally:
                    self._archive_member = None


# ============================================================================ entry point
def extract(db: Session, ev: Evidence, data: bytes) -> ExtractionStats:
    x = Extractor(db, ev)
    ext = ev.extension
    if ext == ".zip":
        x.extract_archive(data)
    elif ext in (".pdf", ".txt"):
        x.extract_document(data, ext)
    else:
        text = data.decode("utf-8")
        handler = {
            "calls": x.extract_calls, "transactions": x.extract_transactions, "vehicles": x.extract_vehicles,
            "locations": x.extract_locations, "people": x.extract_people, "aliases": x.extract_aliases,
        }.get(ev.record_type)
        if handler is None:
            raise ValueError(f"no extractor for record type {ev.record_type!r}")
        handler(text)
    db.flush()
    flag_contradictions(db, ev.case_id)
    return x.stats


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
