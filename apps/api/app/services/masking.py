"""Default-on masking of sensitive identifiers. A reveal requires a reason and is audited."""
from __future__ import annotations

import re

PHONE_RE = re.compile(r"\+?91[\s-]?\d{5}[\s-]?\d{5}|\b\d{10,12}\b")
ACCOUNT_RE = re.compile(r"ACC-[A-Z]+-\d{4}")


def mask_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    return f"+91 •••••• {digits[-3:]}" if len(digits) >= 3 else "•••"


def mask_account(value: str) -> str:
    return re.sub(r"\d{4}$", lambda m: "••" + m.group(0)[-2:], value or "")


def mask_label(kind: str, label: str) -> str:
    if kind == "PHONE":
        return mask_phone(label)
    if kind == "ACCOUNT":
        return mask_account(label)
    return label


def mask_text(text: str | None) -> str | None:
    if not text:
        return text
    text = PHONE_RE.sub(lambda m: mask_phone(m.group(0)), text)
    return ACCOUNT_RE.sub(lambda m: mask_account(m.group(0)), text)


def mask_node(node: dict) -> dict:
    node = dict(node)
    node["label"] = mask_label(node.get("kind", ""), node.get("label", ""))
    node["masked"] = node.get("kind") in ("PHONE", "ACCOUNT")
    node["merged_from"] = [mask_label(node.get("kind", ""), x) for x in node.get("merged_from", [])]
    if "attributes" in node:
        node["attributes"] = mask_attributes(node["attributes"])
    return node


def case_attributes(attributes: dict | None, case_id: str) -> dict:
    """The attributes an entity carries for one case.

    Attributes are stored per case (`{"CASE-0001": {...}}`). DEF-033: the old inline expression fell back to the
    whole map when `case_id` was absent, returning every other case's attributes. Only an un-keyed legacy map (no
    `CASE-` keys at all) is returned as-is.
    """
    if not isinstance(attributes, dict) or not attributes:
        return {}
    if case_id in attributes:
        value = attributes[case_id]
        return dict(value) if isinstance(value, dict) else {}
    if any(isinstance(k, str) and k.startswith("CASE-") for k in attributes):
        return {}
    return dict(attributes)


def mask_analysis(analysis: dict) -> dict:
    """Mask every identifier an analysis payload can carry. Shared by the HTML/JSON report and the court PDF:
    DEF-039 -- the PDF masked degree/bridge labels but printed rule subjects (phones, accounts) raw."""
    for key in ("degree", "weighted_degree", "bridge_candidates"):
        for item in analysis.get(key, []):
            item["label"] = mask_label(item.get("kind", ""), item.get("label", ""))
    for comm in analysis.get("communities", []):
        for m in comm.get("members", []):
            m["label"] = mask_label(m.get("kind", ""), m.get("label", ""))
    for r in analysis.get("rules", []):
        for k in ("subject", "object"):
            if k in r and isinstance(r[k], str):
                r[k] = mask_text(r[k])
        if "sources" in r:
            r["sources"] = [mask_text(x) if isinstance(x, str) else x for x in r["sources"]]
    return analysis


def mask_block_key(block_key: str | None) -> str | None:
    """`phone:<normalized number>` components of a resolution block key, masked (DEF-038)."""
    if not block_key:
        return block_key
    return "|".join(f"phone:{mask_phone(p[6:])}" if p.startswith("phone:") else p for p in block_key.split("|"))


# ------------------------------------------------------------------ personal attributes (field-level)
# Entity attributes carry personal data beyond phones and accounts. These keys are masked on every default output
# path. The raw values stay in the database and are released only through the attribute-reveal endpoint, under the
# masking policy (services/masking_policy.py).
PII_ATTRIBUTE_KEYS = frozenset({"address", "dob"})
SENSITIVE_ATTRIBUTE_KEYS = PII_ATTRIBUTE_KEYS | frozenset({"phone", "account"})
_DOB_RE = re.compile(r"^(\d{4})-\d{2}-\d{2}")


def mask_attribute(key: str, value):
    """Default (masked) form of one attribute value. Unknown keys pass through unchanged."""
    if value is None or key not in SENSITIVE_ATTRIBUTE_KEYS:
        return value
    if key == "dob":
        match = _DOB_RE.match(str(value))
        return f"{match.group(1)}-**-**" if match else "[masked]"
    if key == "address":
        return "[masked address]"
    if key == "phone":
        return mask_phone(str(value))
    if key == "account":
        return mask_account(str(value))
    return "[masked]"


def mask_attributes(attributes: dict | None) -> dict:
    """Masked copy of an attribute map, for any response that is not an explicit reveal."""
    return {k: mask_attribute(k, v) for k, v in (attributes or {}).items()}


def case_pii_values(db, case_id: str) -> list[str]:
    """Every raw personal value (addresses, dates of birth, phone and account attributes) for one case's entities.
    Used to redact these values from free text such as provenance snippets, which may quote them."""
    from ..models import Entity  # local import: models depends on db, not the other way round

    values: set[str] = set()
    for entity in db.query(Entity).all():
        for key, value in case_attributes(entity.attributes, case_id).items():
            if key in SENSITIVE_ATTRIBUTE_KEYS and isinstance(value, str) and len(value) >= 4:
                values.add(value)
    return sorted(values, key=len, reverse=True)


def case_pii_values_cached(db, case_id: str) -> list[str]:
    """case_pii_values, computed once per request (claim lists call it for every claim)."""
    from ..core import request_context

    ctx = request_context.current()
    if ctx is None:
        return case_pii_values(db, case_id)
    key = ("case_pii_values", case_id)
    if key not in ctx.cache:
        ctx.cache[key] = case_pii_values(db, case_id)
    return ctx.cache[key]


def redact_structure(value, known_values, depth: int = 0):
    """Masked copy of a JSON structure produced by analysis code (match signals, conflicts). Strings get phone and
    account patterns masked and known personal values redacted; values under sensitive keys get the field mask."""
    if depth > 8:
        return "[masked]"
    if isinstance(value, dict):
        return {k: (mask_attribute(k, v) if k in SENSITIVE_ATTRIBUTE_KEYS and not isinstance(v, (dict, list))
                    else redact_structure(v, known_values, depth + 1)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact_structure(v, known_values, depth + 1) for v in value]
    if isinstance(value, str):
        return redact_known_values(mask_text(value), known_values)
    return value


def redact_known_values(text: str | None, values) -> str | None:
    """Replace each known raw personal value in free text (longest first). Applied on top of mask_text."""
    if not text:
        return text
    for raw in values:
        text = text.replace(raw, "[masked]")
    return text
