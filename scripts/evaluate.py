"""Evaluation harness (docs/status.md Role 6 backlog item): runs the real ingestion pipeline over the
synthetic golden dataset (CASE-0001) and computes concrete metrics against the planted ground truth in
data/synthetic/truth-labels.json, then writes the results into reports/{extraction,entity-resolution,
graph}-evaluation.md, replacing the empty template tables.

Run: python3 -m scripts.evaluate

Uses a throwaway SQLite store and DRISHTI_SCANNER_MODE=testgate -- the same documented, honestly-named
substitute the automated test suite uses (apps/api/app/tests/conftest.py) -- never the demo database.
This measures the pipeline's own extraction / resolution / graph logic against known planted scenarios,
not filesystem antivirus availability, and is not a general-purpose NER/ER benchmark: the golden dataset
has ~20 people and a handful of planted scenarios, so these are exact hit/miss checks against specific
known cases, not statistically meaningful precision/recall over a large annotated corpus. That scope
limitation is stated in each report, not left implicit.
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="drishti-eval-")
os.environ["DRISHTI_STORAGE_ROOT"] = _tmp
os.environ["DRISHTI_DATABASE_URL"] = f"sqlite:///{Path(_tmp) / 'eval.db'}"
os.environ["DRISHTI_SCANNER_MODE"] = "testgate"

from fastapi.testclient import TestClient

from apps.api.app.config import REPO_ROOT, SYNTHETIC_DIR
from apps.api.app.db import SessionLocal
from apps.api.app.main import app
from apps.api.app.models import Claim, Entity, MatchCandidate
from apps.api.app.seed import seed
from apps.api.app.services import extract as extract_svc
from apps.api.app.services import graph as graph_svc

TRUTH = json.loads((SYNTHETIC_DIR / "truth-labels.json").read_text())
PEOPLE_BY_ID = {p["person_id"]: p for p in json.loads((SYNTHETIC_DIR / "people.json").read_text())}
REPORTS_DIR = REPO_ROOT / "reports"
CASE_ID = "CASE-0001"
INGEST_FILES = ["people.json", "aliases.json", "calls.csv", "transactions.csv", "vehicles.csv", "locations.csv", "documents/fir_001.pdf"]

# Decision thresholds this evaluation harness applies to a candidate's confidence score to compare
# against truth-labels' expected_decision -- a convention for measuring the matcher's signal quality,
# NOT a decision the system itself makes automatically (docs/context.md: no automatic person-level
# merge; every candidate still requires REVIEW_REQUIRED human disposition regardless of confidence).
APPROVE_THRESHOLD, REJECT_THRESHOLD = 0.65, 0.35


def login(client: TestClient, username: str) -> dict:
    r = client.post("/api/v1/auth/login", json={"username": username, "password": f"{username}-demo"})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['token']}"}


def ingest() -> None:
    seed()
    client = TestClient(app)
    officer = login(client, "officer")
    for rel in INGEST_FILES:
        p = SYNTHETIC_DIR / rel
        r = client.post(f"/api/v1/cases/{CASE_ID}/evidence", headers=officer,
                         files={"file": (p.name, p.read_bytes())}, data={"source_label": "evaluation"})
        r.raise_for_status()


def find_entity_by_label(db, label: str) -> Entity | None:
    return db.query(Entity).filter(Entity.label == label).first()


def find_entity_by_canonical_suffix(db, person_id: str) -> Entity | None:
    return db.query(Entity).filter(Entity.canonical == f"pid:{person_id}").first()


def resolve_identity_pair_side(db, text: str) -> Entity | None:
    """`text` looks like 'Arjun Malhotra (people.json)' or 'Rahul Verma (P-X1)'. A parenthetical that
    looks like a planted person_id (P-<letters><digits>) resolves by canonical; anything else (a source
    filename hint) resolves by the name alone, which is unique for these two specific pairs."""
    name = text.split(" (")[0].strip()
    hint = text.split("(")[-1].rstrip(")") if "(" in text else ""
    if hint.startswith("P-"):
        return find_entity_by_canonical_suffix(db, hint)
    return find_entity_by_label(db, name)


def find_phone_entity_for_person(db, person_id: str) -> Entity | None:
    """calls.csv links PHONE entities, not PERSON entities directly -- a person's own CALLED history
    lives on their phone number's entity, reached via the person's USES_PHONE edge, not on the person
    entity itself. Resolve by the person's own phone number from people.json, normalized the same way
    extract.py normalizes it, so this matches the phone entity's real canonical key exactly."""
    person = PEOPLE_BY_ID.get(person_id)
    if not person or not person.get("phone"):
        return None
    return db.query(Entity).filter(Entity.kind == "PHONE", Entity.canonical == extract_svc.norm_phone(person["phone"])).first()


def find_candidate(db, a: Entity, b: Entity) -> MatchCandidate | None:
    ids = sorted((a.entity_id, b.entity_id))
    return db.query(MatchCandidate).filter_by(case_id=CASE_ID, left_entity_id=ids[0], right_entity_id=ids[1]).first()


def predicted_decision(confidence: float) -> str:
    if confidence >= APPROVE_THRESHOLD:
        return "APPROVE"
    if confidence <= REJECT_THRESHOLD:
        return "REJECT"
    return "DEFER"


# ============================================================================ extraction
def evaluate_extraction(db) -> list[tuple[str, str, str]]:
    rows = []
    total_claims = db.query(Claim).filter_by(case_id=CASE_ID).count()
    total_entities = db.query(Entity).count()
    rows.append(("claims extracted (all evidence)", str(total_claims), "scale context, not a truth-label comparison"))
    rows.append(("entities created", str(total_entities), "scale context, not a truth-label comparison"))

    for c in TRUTH["contradictions"]:
        veh = db.query(Entity).filter(Entity.kind == "VEHICLE", Entity.canonical == extract_svc.norm_reg(c["subject"])).first()
        hit = False
        if veh:
            hit = db.query(Claim).filter(Claim.source_entity_id == veh.entity_id, Claim.attribute == c["attribute"], Claim.state == "CONTRADICTORY").count() >= 2
        rows.append((f"contradiction detected: {c['subject']} owner", "HIT" if hit else "MISS",
                     f"{c['source_a']} vs {c['source_b']}"))

    for m in TRUTH["missing_fields"]:
        hit = False
        if m["record"] == "transactions.csv" and m["field"] == "amount_inr":
            hit = db.query(Claim).filter(Claim.case_id == CASE_ID, Claim.rel_type == "TRANSFERRED_TO",
                                          Claim.missingness.isnot(None)).all()
            hit = any(c.missingness.get("amount_inr") for c in hit)
        rows.append((f"missing-field recorded: {m['record']}.{m['field']}", "HIT" if hit else "MISS", m["txn"]))

    for h in TRUTH["historical_relationships"]:
        a, b = h["pair"]
        # CALLED links PHONE entities, not PERSON entities directly -- resolve via each person's own
        # phone number (see find_phone_entity_for_person's docstring for why).
        ea, eb = find_phone_entity_for_person(db, a), find_phone_entity_for_person(db, b)
        hit = False
        if ea and eb:
            hit = db.query(Claim).filter(Claim.case_id == CASE_ID, Claim.rel_type == h["kind"],
                                          Claim.source_entity_id.in_([ea.entity_id, eb.entity_id]),
                                          Claim.target_entity_id.in_([ea.entity_id, eb.entity_id])).count() > 0
        rows.append((f"planted relationship extracted: {h['kind']} {a}↔{b}", "HIT" if hit else "MISS", h["note"]))
    return rows


# ============================================================================ entity resolution
def evaluate_resolution(db) -> tuple[list[tuple[str, str, str]], int, int]:
    rows = []
    correct = 0
    for pair in TRUTH["identity_pairs"]:
        a, b = resolve_identity_pair_side(db, pair["left"]), resolve_identity_pair_side(db, pair["right"])
        if a is None or b is None:
            rows.append((f"{pair['left']} / {pair['right']}", "NOT FOUND", "could not resolve one or both entities"))
            continue
        cand = find_candidate(db, a, b)
        if cand is None:
            rows.append((f"{pair['left']} / {pair['right']}", "NO CANDIDATE GENERATED", f"expected {pair['expected_decision']}"))
            continue
        predicted = predicted_decision(cand.confidence)
        ok = predicted == pair["expected_decision"]
        correct += int(ok)
        rows.append((f"{pair['left']} / {pair['right']}",
                     f"confidence {cand.confidence} → {predicted} ({'correct' if ok else 'WRONG'}, expected {pair['expected_decision']})",
                     pair["reason"]))
    return rows, correct, len(TRUTH["identity_pairs"])


# ============================================================================ graph
def evaluate_graph(db) -> list[tuple[str, str, str]]:
    rows = []
    G = graph_svc.build_projection(db, CASE_ID)
    analysis = graph_svc.analyze(G)

    # communities: map each detected community's members back to person_id (pid:P-xx canonical only --
    # a FIR-derived "mention:" person has no person_id and can't be scored against the planted labels)
    ent_by_id = {e.entity_id: e for e in db.query(Entity).all()}

    def person_id_of(entity_id: str) -> str | None:
        e = ent_by_id.get(entity_id)
        return e.canonical[len("pid:"):] if e and e.canonical.startswith("pid:") else None

    truth_communities = {name: set(members) for name, members in TRUTH["communities"].items()}
    for comm in analysis["communities"]:
        if "error" in comm:
            rows.append(("community detection", "ERROR", comm["error"]))
            continue
        detected_pids = {pid for m in comm["members"] if (pid := person_id_of(m["entity_id"]))}
        best_name, best_j = None, 0.0
        for name, truth_pids in truth_communities.items():
            union = detected_pids | truth_pids
            j = len(detected_pids & truth_pids) / len(union) if union else 0.0
            if j > best_j:
                best_name, best_j = name, j
        rows.append((f"community {comm['community_id']} (size {comm['size']}, stability {comm.get('stability')})",
                     f"best match: truth community {best_name} (Jaccard {best_j:.2f})" if best_name else "no overlap with any truth community",
                     f"members: {', '.join(m['label'] for m in comm['members'][:6])}"))

    # The planted bridge/burst scenario is between Manish Tiwari (P-BR) and Devika Nair (P-B1)'s own
    # PHONE entities -- CALLED edges (and therefore betweenness/burst detection on this core subgraph)
    # connect PHONE entities, not PERSON entities directly (same reason as the historical-relationship
    # check in evaluate_extraction). Resolve both people's phone entities rather than matching on the
    # person's own name, which would never appear as the subject of a CALLED-derived rule/bridge.
    bridge_phone = find_phone_entity_for_person(db, "P-BR")
    devika_phone = find_phone_entity_for_person(db, "P-B1")
    bridge_hit = bridge_phone is not None and any(b["entity_id"] == bridge_phone.entity_id for b in analysis["bridge_candidates"])
    rows.append(("bridge candidate detected: Manish Tiwari's phone (P-BR)", "HIT" if bridge_hit else "MISS",
                 "planted intermediary between community A and community B"))

    burst = TRUTH["rule_candidates"][0]
    burst_hit = bridge_phone is not None and devika_phone is not None and any(
        r["rule"] == "communication_burst" and r["source"] == bridge_phone.entity_id and r["target"] == devika_phone.entity_id
        for r in analysis["rules"])
    rows.append(("rule detected: communication_burst (Manish Tiwari's phone → Devika Nair's phone)", "HIT" if burst_hit else "MISS", burst["window"]))

    fanin = TRUTH["rule_candidates"][1]
    fanin_hit = any(r["rule"] == "transaction_fan_in" and r["subject"] == "ACC-DEMO-0301" and r["distinct_sources"] >= 4 for r in analysis["rules"])
    rows.append(("rule detected: transaction_fan_in (ACC-DEMO-0301)", "HIT" if fanin_hit else "MISS", fanin["window"]))
    return rows


# ============================================================================ report writing
def write_report(filename: str, title: str, rows: list[tuple[str, str, str]], extra_note: str = "") -> None:
    lines = [
        f"# {title}",
        "",
        (f"Computed {datetime.now(timezone.utc).isoformat(timespec='seconds')} by `scripts/evaluate.py` against the "
         "real ingestion pipeline (upload → scan[testgate] → extract → resolve → graph) run on a "
         "throwaway SQLite store, compared to `data/synthetic/truth-labels.json`."),
        "",
        ("**Scope limitation**: this is exact hit/miss verification of specific planted scenarios in a "
         "~20-person synthetic dataset, not a statistically meaningful precision/recall benchmark over a "
         "large annotated corpus -- the golden dataset simply isn't that size. Treat HIT/MISS counts as "
         "\"does the pipeline still correctly handle this known case\", a regression check, not a claim "
         "about real-world accuracy."),
        "",
    ]
    if extra_note:
        lines += [extra_note, ""]
    lines += ["| check | result | detail |", "|---|---|---|"]
    for check, result, detail in rows:
        lines.append(f"| {check} | {result} | {detail} |")
    lines.append("")
    (REPORTS_DIR / filename).write_text("\n".join(lines))


def main() -> None:
    print("Ingesting synthetic dataset into a throwaway store (testgate scanner)...")
    ingest()
    db = SessionLocal()
    try:
        print("Evaluating extraction...")
        extraction_rows = evaluate_extraction(db)
        write_report("extraction-evaluation.md", "extraction evaluation", extraction_rows)

        print("Evaluating entity resolution...")
        resolution_rows, correct, total = evaluate_resolution(db)
        note = f"**Decision accuracy over the {total} planted identity pairs: {correct}/{total}.** " \
               f"Predicted decision is derived from confidence using this harness's own thresholds " \
               f"(≥{APPROVE_THRESHOLD} → APPROVE, ≤{REJECT_THRESHOLD} → REJECT, else DEFER) " \
               "purely to score the matcher's signal quality -- the system itself never auto-decides; " \
               "every candidate still requires human REVIEW_REQUIRED disposition."
        write_report("entity-resolution-evaluation.md", "entity resolution evaluation", resolution_rows, note)

        print("Evaluating graph...")
        graph_rows = evaluate_graph(db)
        write_report("graph-evaluation.md", "graph evaluation", graph_rows)
    finally:
        db.close()
    print("Done. Reports written to reports/*-evaluation.md")


if __name__ == "__main__":
    main()
