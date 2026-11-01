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
