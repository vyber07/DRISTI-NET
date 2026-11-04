"""Generate the synthetic NER evaluation set (data/evaluation/ner_synthetic_v1.json).

Deterministic (fixed seed). Fictional people and organisations; place names are ordinary Indian city/district names
used only as locations. Every gold entity is recorded with its exact character span, so scoring can distinguish a
missed entity from a boundary error. This is a *synthetic, template-based* benchmark: it measures how the pinned model
behaves on FIR-style English sentences like the demo data, not real-world accuracy.

Run: python3 scripts/make_ner_eval_set.py
"""
from __future__ import annotations

import json
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "evaluation" / "ner_synthetic_v1.json"

FIRST = ["Aarav", "Ishita", "Kabir", "Meera", "Rohan", "Sneha", "Vikram", "Ananya", "Farhan", "Lakshmi", "Arjun", "Nandini",
         "Siddharth", "Pooja", "Imran", "Kavya", "Tanvir", "Divya", "Harish", "Zoya", "Gurpreet", "Revathi", "Manoj", "Asha"]
LAST = ["Sharma", "Iyer", "Khan", "Menon", "Reddy", "Patel", "Nair", "Banerjee", "Singh", "Kulkarni", "Das", "Fernandes",
        "Chowdhury", "Pillai", "Joshi", "Ahmed", "Rao", "Mehta", "Bhat", "Verma"]
ORG_HEAD = ["Sunrise", "Silverline", "Riverside", "Lakeside", "Hilltop", "Northgate", "Bluewater", "Greenfield", "Starlight", "Coastal"]
ORG_TAIL = ["Traders", "Logistics", "Enterprises", "Freight", "Exports", "Holdings Pvt Ltd", "Finance Ltd", "Textiles", "Motors", "Agencies"]
LOC = ["Pune", "Nagpur", "Kochi", "Indore", "Mysuru", "Guwahati", "Bhopal", "Lucknow", "Coimbatore", "Vadodara", "Ranchi",
       "Madurai", "Jaipur", "Patna", "Surat", "Nashik"]

TEMPLATES = [
    "{PER} met {PER} near {LOC} on 12 March.",
    "{PER}, a director of {ORG}, was questioned in {LOC}.",
    "The complainant {PER} stated that funds were transferred to {ORG}.",
    "A van registered to {ORG} was seen in {LOC} late at night.",
    "{PER} called {PER} twice from {LOC}.",
    "Witness {PER} works at {ORG}.",
    "{ORG} has a warehouse in {LOC}.",
    "According to {PER}, the meeting took place at the {ORG} office in {LOC}.",
    "Statement of {PER} recorded at {LOC} police station.",
    "{PER} and {PER} were both employed by {ORG}.",
]


def build(seed: int = 20261104, n_sentences: int = 80) -> list[dict]:
    rng = random.Random(seed)
    items = []
    for i in range(n_sentences):
        tpl = TEMPLATES[i % len(TEMPLATES)]
        text, ents, pos = "", [], 0
        parts = tpl.replace("{", "\x00{").replace("}", "}\x00").split("\x00")
        for part in parts:
            if part in ("{PER}", "{ORG}", "{LOC}"):
                kind = {"{PER}": "PERSON", "{ORG}": "ORGANIZATION", "{LOC}": "LOCATION"}[part]
                value = (f"{rng.choice(FIRST)} {rng.choice(LAST)}" if kind == "PERSON"
                         else f"{rng.choice(ORG_HEAD)} {rng.choice(ORG_TAIL)}" if kind == "ORGANIZATION" else rng.choice(LOC))
                ents.append({"type": kind, "start": len(text), "end": len(text) + len(value), "text": value})
                text += value
            else:
                text += part
        items.append({"id": f"S{i + 1:03d}", "text": text, "entities": ents})
    return items


def main() -> None:
    items = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"dataset": "ner_synthetic_v1", "seed": 20261104, "sentences": items}, indent=1))
    n = sum(len(x["entities"]) for x in items)
    by = {}
    for x in items:
        for e in x["entities"]:
            by[e["type"]] = by.get(e["type"], 0) + 1
    print(f"wrote {OUT} -- {len(items)} sentences, {n} gold entities {by}")


if __name__ == "__main__":
    main()
