import io, zipfile, re
from pathlib import Path
from sqlalchemy.orm import Session
from .extract_structured import StructuredExtractor
from .extract_common import _check_archive, detect_record_type, ExtractionStats, norm_phone, norm_account, norm_name, norm_text, norm_reg, flag_contradictions
from ..models import Evidence

class DocumentExtractor(StructuredExtractor):
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
    x = DocumentExtractor(db, ev)
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


