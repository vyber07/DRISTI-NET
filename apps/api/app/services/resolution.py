"""Conservative, explainable entity-resolution candidates.

The matcher never merges. It proposes MatchCandidate rows with positive signals, counter-evidence,
conflicts and missing data so a human reviewer can decide. A shared phone/address/vehicle/tower is a
*signal*, never proof of identity.
"""
from __future__ import annotations

import difflib
from itertools import combinations

from sqlalchemy.orm import Session

from ..models import Claim, Entity, MatchCandidate

MATCHER_VERSION = "0.1.0"


def _persons_in_case(db: Session, case_id: str) -> dict[str, Entity]:
    ids = {r[0] for r in db.query(Claim.source_entity_id).filter(Claim.case_id == case_id).distinct()}
    ids |= {r[0] for r in db.query(Claim.target_entity_id).filter(Claim.case_id == case_id, Claim.target_entity_id.isnot(None)).distinct()}
    ents = db.query(Entity).filter(Entity.entity_id.in_(ids), Entity.kind == "PERSON").all() if ids else []
    return {e.entity_id: e for e in ents}


def _profile(db: Session, case_id: str, ent: Entity) -> dict:
    """Collect what the case's evidence says about one person entity."""
    claims = db.query(Claim).filter(Claim.case_id == case_id, Claim.source_entity_id == ent.entity_id, Claim.state != "REJECT").all()
    prof = {"names": set(), "phones": set(), "accounts": set(), "orgs": set(), "dob": set(), "address": set(), "evidence": set(), "aliases": set()}
    for c in claims:
        prof["evidence"].add(c.evidence_id)
        if c.kind == "ATTRIBUTE":
            if c.attribute == "name":
                prof["names"].add(c.normalized_value)
            elif c.attribute == "alias":
                prof["aliases"].add(c.normalized_value)
            elif c.attribute in ("dob", "address"):
                prof[c.attribute].add(c.normalized_value)
        elif c.kind == "RELATIONSHIP" and c.target_entity_id:
            key = {"USES_PHONE": "phones", "HOLDS_ACCOUNT": "accounts", "MEMBER_OF": "orgs"}.get(c.rel_type)
            if key:
                prof[key].add(c.normalized_value)
    if not prof["names"]:
        prof["names"].add((ent.label or "").lower())
    return prof


def _block_keys(prof: dict) -> set[str]:
    keys = set()
    for n in prof["names"] | prof["aliases"]:
        toks = n.split()
        if toks:
            keys.add(f"name:{toks[-1]}:{toks[0][0]}")
    for p in prof["phones"]:
        keys.add(f"phone:{p}")
    return keys


def _name_similarity(a: set[str], b: set[str]) -> tuple[float, str, str]:
    best = (0.0, "", "")
    for x in a:
        for y in b:
            r = difflib.SequenceMatcher(None, x, y).ratio()
            if r > best[0]:
                best = (r, x, y)
    return best


def generate_candidates(db: Session, case_id: str) -> list[MatchCandidate]:
    persons = _persons_in_case(db, case_id)
    profiles = {eid: _profile(db, case_id, e) for eid, e in persons.items()}
    blocks = {eid: _block_keys(p) for eid, p in profiles.items()}
    existing = {tuple(sorted((m.left_entity_id, m.right_entity_id))) for m in db.query(MatchCandidate).filter_by(case_id=case_id).all()}
    created: list[MatchCandidate] = []

    for a, b in combinations(sorted(persons), 2):
        pair = tuple(sorted((a, b)))
        if pair in existing:
            continue
        shared_blocks = blocks[a] & blocks[b]
        if not shared_blocks:
            continue
        pa, pb = profiles[a], profiles[b]
        positive, counter, conflicts, missing = [], [], [], []
        score = 0.0

        sim, na, nb = _name_similarity(pa["names"] | pa["aliases"], pb["names"] | pb["aliases"])
        if sim >= 0.999:
            positive.append({"signal": "name_exact", "detail": f"'{na}' == '{nb}'", "weight": 0.35}); score += 0.35
        elif sim >= 0.8:
            positive.append({"signal": "name_similar", "detail": f"'{na}' ~ '{nb}' (ratio {sim:.2f})", "weight": 0.25}); score += 0.25
        else:
            counter.append({"signal": "name_differs", "detail": f"'{na}' vs '{nb}' (ratio {sim:.2f})", "weight": -0.3}); score -= 0.3

        shared_phones = pa["phones"] & pb["phones"]
        if shared_phones:
            positive.append({"signal": "shared_phone", "detail": f"{len(shared_phones)} shared phone(s)", "weight": 0.3,
                             "caveat": "a shared identifier is a candidate relationship, not proof of identity"}); score += 0.3
        shared_accounts = pa["accounts"] & pb["accounts"]
        if shared_accounts:
            positive.append({"signal": "shared_account", "detail": f"{len(shared_accounts)} shared account(s)", "weight": 0.25}); score += 0.25
        shared_orgs = pa["orgs"] & pb["orgs"]
        if shared_orgs:
            positive.append({"signal": "shared_organisation", "detail": ", ".join(sorted(shared_orgs)), "weight": 0.1}); score += 0.1
        elif pa["orgs"] and pb["orgs"]:
            conflicts.append({"attribute": "organisation", "left": sorted(pa["orgs"]), "right": sorted(pb["orgs"]), "weight": -0.15}); score -= 0.15

        for attr in ("dob", "address"):
            if pa[attr] and pb[attr]:
                if pa[attr] & pb[attr]:
                    positive.append({"signal": f"{attr}_match", "detail": sorted(pa[attr])[0], "weight": 0.2}); score += 0.2
                else:
                    conflicts.append({"attribute": attr, "left": sorted(pa[attr]), "right": sorted(pb[attr]), "weight": -0.35}); score -= 0.35
            else:
                sides = [s for s, p in (("left", pa), ("right", pb)) if not p[attr]]
                missing.append({"attribute": attr, "missing_on": sides})
        if not (pa["phones"] and pb["phones"]):
            missing.append({"attribute": "phone", "missing_on": [s for s, p in (("left", pa), ("right", pb)) if not p["phones"]]})

        if positive and len(positive) == 1 and positive[0]["signal"] == "shared_phone":
            counter.append({"signal": "identifier_only", "detail": "only a shared phone links these records; no person-level corroboration", "weight": 0.0})

        confidence = max(0.02, min(0.98, round(0.5 + score, 2)))  # never 0 or 1: the matcher is a heuristic
        cand = MatchCandidate(case_id=case_id, left_entity_id=a, right_entity_id=b, block_key="|".join(sorted(shared_blocks)),
                              positive_signals=positive, counter_evidence=counter, conflicts=conflicts, missing=missing,
                              confidence=confidence, matcher_version=MATCHER_VERSION, state="REVIEW_REQUIRED",
                              evidence_ids=sorted(pa["evidence"] | pb["evidence"]))
        db.add(cand)
        created.append(cand)
    db.flush()
    return created
