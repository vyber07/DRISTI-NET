"""Leak sweep: no raw sensitive identifier may appear in any non-reveal response, for any role.

The raw values are read from the database (entities of sensitive kinds), so the sweep checks what is actually
stored, not what a fixture claims. It calls every case-scoped read endpoint as every role and scans the status,
headers and body. The only endpoints allowed to return raw values are the explicit, reason-carrying, audited
reveal and raw-download routes, which are excluded here and tested separately in test_masking_authorization.py.
"""
import json

import pytest

from apps.api.app.db import SessionLocal
from apps.api.app.models import Claim, Entity, MatchCandidate, User
from apps.api.app.routes import graph_routes  # noqa: F401  (import check)

ROLES = {
    "investigator": "investigator-demo",
    "reviewer": "reviewer-demo",
    "analyst": "analyst-demo",
    "auditor": "auditor-demo",
    "admin": "admin-demo",
    "officer": "officer-demo",
    "outsider": "outsider-demo",       # INVESTIGATOR in another district, not assigned to CASE-0001
    "unassigned": "unassigned-demo",   # same district, not assigned to CASE-0001
}
SENSITIVE_KINDS = ("PHONE", "ACCOUNT")


def _raw_sensitive_labels():
    with SessionLocal() as s:
        labels = {e.label for e in s.query(Entity).filter(Entity.kind.in_(SENSITIVE_KINDS)).all() if e.label}
    return sorted(labels, key=len, reverse=True)


def _ids():
    with SessionLocal() as s:
        entity_ids = [e.entity_id for e in s.query(Entity).filter(Entity.kind.in_(SENSITIVE_KINDS)).limit(5).all()]
        claim_ids = [c.claim_id for c in s.query(Claim).filter_by(case_id="CASE-0001").limit(5).all()]
        cand_ids = [m.candidate_id for m in s.query(MatchCandidate).filter_by(case_id="CASE-0001").limit(5).all()]
        user_ids = {u.username: u.user_id for u in s.query(User).all()}
    return entity_ids, claim_ids, cand_ids, user_ids


def _token(client, username):
    r = client.post("/api/v1/auth/login", json={"username": username, "password": ROLES[username]})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _read_paths(client, token):
    """Every non-reveal read, for CASE-0001 and the entities/claims/candidates it contains."""
    entity_ids, claim_ids, cand_ids, _ = _ids()
    h = {"Authorization": f"Bearer {token}"}
    paths = [
        "/api/v1/cases", "/api/v1/cases/CASE-0001", "/api/v1/cases/CASE-0001/evidence",
        "/api/v1/cases/CASE-0001/evidence/summary", "/api/v1/cases/CASE-0001/candidates",
        "/api/v1/cases/CASE-0001/candidates/summary", "/api/v1/cases/CASE-0001/stats",
        "/api/v1/cases/CASE-0001/graph", "/api/v1/cases/CASE-0001/locations", "/api/v1/cases/CASE-0001/analysis",
        "/api/v1/cases/CASE-0001/timeline", "/api/v1/cases/CASE-0001/reviews", "/api/v1/cases/CASE-0001/contradictions",
        "/api/v1/cases/CASE-0001/audit", "/api/v1/cases/CASE-0001/integrity/anchors",
    ]
    paths += [f"/api/v1/entities/{e}" for e in entity_ids]
    paths += [f"/api/v1/claims/{c}" for c in claim_ids]
    paths += [f"/api/v1/candidates/{m}" for m in cand_ids]
    for p in list(paths):
        if p.endswith("/evidence"):
            pass
    responses = []
    for p in paths:
        responses.append((p, client.get(p, headers=h)))
    # evidence-level reads for every evidence item in the case
    ev = client.get("/api/v1/cases/CASE-0001/evidence", headers=h)
    for item in (ev.json() if ev.status_code == 200 else []):
        eid = item["evidence_id"]
        for suffix in ("", "/claims", "/verify"):
            responses.append((f"/api/v1/evidence/{eid}{suffix}", client.get(f"/api/v1/evidence/{eid}{suffix}", headers=h)))
    return responses


def _report_posts(client, token):
    h = {"Authorization": f"Bearer {token}"}
    out = []
    for fmt in ("json", "html"):
        out.append((f"POST report {fmt}", client.post("/api/v1/cases/CASE-0001/report", headers=h,
                                                      json={"format": fmt, "analyst_comments": "sweep"})))
    return out


@pytest.fixture(scope="module")
def sweep_results(client, ingested):
    labels = _raw_sensitive_labels()
    assert labels, "synthetic case must contain PHONE/ACCOUNT entities for the sweep to mean anything"
    results = {}
    for role in ROLES:
        token = _token(client, role)
        results[role] = _read_paths(client, token) + _report_posts(client, token)
    return labels, results


def test_sweep_covers_every_role_and_many_endpoints(sweep_results):
    labels, results = sweep_results
    assert set(results) == set(ROLES)
    assert all(len(v) >= 10 for v in results.values())


def test_no_raw_sensitive_identifier_in_any_non_reveal_response(sweep_results):
    labels, results = sweep_results
    leaks = []
    for role, pairs in results.items():
        for path, resp in pairs:
            text = resp.text
            for raw in labels:
                if raw and raw in text:
                    leaks.append(f"{role}: {path} [{resp.status_code}] contains a raw sensitive value")
                    break
            for key, value in resp.headers.items():
                if any(raw in value for raw in labels):
                    leaks.append(f"{role}: {path} header {key} contains a raw sensitive value")
    assert not leaks, "\n".join(sorted(set(leaks))[:60])
