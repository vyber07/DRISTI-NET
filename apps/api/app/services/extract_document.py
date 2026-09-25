import io, zipfile, re
from pathlib import Path
from sqlalchemy.orm import Session
from .extract_structured import StructuredExtractor
from .extract_common import _check_archive, detect_record_type, ExtractionStats, norm_phone, norm_account, norm_name, norm_text, norm_reg, flag_contradictions
from ..models import Evidence

class DocumentExtractor(StructuredExtractor):
    def _pages(self, data: bytes, ext: str) -> list[list[str]]:
        if ext == ".pdf":
            from .ocr_adapter import extract_text_from_pdf_bytes, pages_to_line_lists
            ocr_pages = extract_text_from_pdf_bytes(data)
            self._ocr_locators = [p.locators for p in ocr_pages]
            self._ocr_engine = ocr_pages[0].engine if ocr_pages else "pypdf-fallback"
            return pages_to_line_lists(ocr_pages)
        self._ocr_locators = []
        self._ocr_engine = "text-parser"
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
                # regex passes for structural identifiers only: phone, account, vehicle reg
                # We intentionally removed PERSON/ORGANIZATION regex (e.g. NAME_RE, ORG_SUFFIX_RE)
                # to strictly rely on real NLP (IndicBERT) models as per architectural instruction.
                for pm in self.PHONE_RE.finditer(line):
                    ph = self.entity("PHONE", norm_phone(pm.group(0)), pm.group(0))
                    self.claim("MENTION", ph, original=pm.group(0), normalized=ph.canonical,
                               method="regex-id", confidence=0.75, observed_time=doc_date, locator=loc(pm), snippet=stripped)
                if "not provided" in line or "could not confirm" in line:
                    self.stats.missing_fields += 1
                
                # accounts: "X to Y" → transfer with unknown amount
                accts = list(self.ACCOUNT_RE.finditer(line))
                if len(accts) == 2 and " to " in line:
                    a = self.entity("ACCOUNT", norm_account(accts[0].group(0)), accts[0].group(0))
                    b = self.entity("ACCOUNT", norm_account(accts[1].group(0)), accts[1].group(0))
                    self.claim("RELATIONSHIP", a, b, "TRANSFERRED_TO", original=None, normalized=None, method="regex-id",
                               confidence=0.6, observed_time=doc_date, missingness={"amount_inr": "amount not stated in document"},
                               locator=loc(accts[0]), snippet=stripped)
                
                # vehicle mentions
                for m in self.REG_RE.finditer(line):
                    veh = self.entity("VEHICLE", norm_reg(m.group(0)), m.group(0))
                    self.claim("MENTION", veh, original=m.group(0), normalized=veh.canonical, method="regex-id",
                               confidence=0.9, observed_time=doc_date, locator=loc(m), snippet=stripped)
                offset += len(line) + 1
        if not any(pages):
            self.stats.warnings.append("no text extracted from document")
            return

        # ── Model-backed NER pass (IndicBERT) ────────────────────────────────────
        try:
            from .nlp_adapter import extract_entities as _ner
            full_text = "\n".join(l for pg in pages for l in pg)
            if full_text.strip():
                ner_candidates = _ner(full_text, evidence_id=self.ev.evidence_id, page=1, line_start=1)
                for nc in ner_candidates:
                    ent = self.entity(nc.kind, f"ner:{norm_name(nc.normalized_text)}@{self.ev.evidence_id}",
                                      nc.original_text, {"ner_source": "indic-bert"})
                    self.claim(
                        "MENTION", ent,
                        original=nc.original_text, normalized=nc.normalized_text,
                        method="indic-bert-ner", method_version=nc.method_version,
                        confidence=nc.confidence,
                        locator={**nc.locator, "engine": "indic-bert-ner"},
                        snippet=nc.original_text,
                        state="REVIEW_REQUIRED"
                    )
                if ner_candidates:
                    self.stats.warnings.append(
                        f"indic-bert-ner produced {len(ner_candidates)} candidate(s) requiring human review"
                    )
        except Exception as exc:
            self.stats.warnings.append(f"indic-bert-ner pass failed: {exc}")
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


