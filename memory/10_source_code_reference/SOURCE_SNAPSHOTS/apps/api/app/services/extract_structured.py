import csv, io, json, re
from .extract_common import ExtractorBase, norm_phone, norm_account, norm_name, norm_text, norm_reg

class StructuredExtractor(ExtractorBase):
    def _missing_party(self, kind, norm, row, cols, line, observed_time):
        """DEF-093: a row with a blank identifier used to create one shared entity with an empty key (a phantom hub
        linking every such row, across cases). Record the present party with the gap as missing data instead."""
        present = [c for c in cols if norm(row.get(c) or "")]
        missing = {c: "missing in source" for c in cols if not norm(row.get(c) or "")}
        self.stats.missing_fields += len(missing)
        if not present:
            return
        c = present[0]
        ent = self.entity(kind, norm(row[c]), row[c])
        self.claim("MENTION", ent, original=row[c], normalized=ent.canonical, observed_time=observed_time, missingness=missing,
                   confidence=0.6, locator={"row": line, "columns": list(cols)}, snippet=",".join(v or "" for v in row.values()))

    def extract_calls(self, text: str):
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            i = reader.line_num  # DEF-094: physical line (blank lines are skipped by DictReader)
            self.stats.rows += 1
            if not norm_phone(row.get("caller") or "") or not norm_phone(row.get("callee") or ""):
                self._missing_party("PHONE", norm_phone, row, ("caller", "callee"), i, row.get("start_time"))
                continue
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
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            i = reader.line_num  # DEF-094
            self.stats.rows += 1
            if not norm_account(row.get("from_account") or "") or not norm_account(row.get("to_account") or ""):
                self._missing_party("ACCOUNT", norm_account, row, ("from_account", "to_account"), i, row.get("timestamp"))
                continue
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
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            i = reader.line_num  # DEF-094
            self.stats.rows += 1
            veh = self.entity("VEHICLE", norm_reg(row["registration"]), row["registration"], {"type": row.get("type")})
            self.claim("ATTRIBUTE", veh, attribute="owner", original=row["owner_name"], normalized=norm_name(row["owner_name"]),
                       locator={"row": i, "columns": ["registration", "owner_name"]}, snippet=",".join(row.values()))
            if row.get("owner_person_id"):
                person = self.entity("PERSON", self.pid(row["owner_person_id"]), row["owner_name"])
                self.claim("RELATIONSHIP", person, veh, "OWNS_VEHICLE", original=row["registration"], normalized=veh.canonical,
                           locator={"row": i, "columns": ["owner_person_id", "registration"]}, snippet=",".join(row.values()))

    # ---------------------------------------------------------------- CSV: locations
    def extract_locations(self, text: str):
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            i = reader.line_num  # DEF-094
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
            person = self.entity("PERSON", self.pid(rec["person_id"]), rec["name"],
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
            person = self.entity("PERSON", self.pid(rec["person_id"]), rec.get("person_id"))
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
