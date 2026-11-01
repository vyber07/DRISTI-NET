"""Session-4 independent-review findings: cross-case attributes on graph/locations (DEF-033b), masking of
resolution block keys (DEF-038) and court-PDF analysis (DEF-039), PDF markup escaping (DEF-041), Merkle leaves
limited to scan-cleared evidence (DEF-040). Uses its own case so shared fixtures are not perturbed."""
import io

import pytest

from .. import config
from .conftest import upload

SEC_CASE = "CASE-SEC1"


@pytest.fixture(scope="module")
def sec_case(client, admin, officer, ingested):
    r = client.post("/api/v1/cases", headers=admin, json={"case_id": SEC_CASE, "title": "Isolation probe case",
                    "jurisdiction": "Demo District A", "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-SEC-1"})
    assert r.status_code == 201, r.text
    for u in ("officer", "unassigned"):
        assert client.post(f"/api/v1/cases/{SEC_CASE}/assign", headers=admin, json={"username": u}).status_code == 200
    # aliases.json mentions people whose attributes (DOB, address) exist only in CASE-0001
    assert upload(client, officer, SEC_CASE, "aliases.json").status_code == 201
    return SEC_CASE


def test_graph_and_locations_never_carry_other_cases_attributes(client, sec_case, unassigned):
    assert client.get("/api/v1/cases/CASE-0001", headers=unassigned).status_code == 403  # precondition
    nodes = client.get(f"/api/v1/cases/{sec_case}/graph?limit=150", headers=unassigned).json()["nodes"]
    assert nodes, "precondition: the probe case has graph nodes"
    for n in nodes:
        attrs = n.get("attributes") or {}
        assert not any(str(k).startswith("CASE-") for k in attrs), n
        assert "dob" not in attrs and "address" not in attrs, n
    r = client.get(f"/api/v1/cases/{sec_case}/locations", headers=unassigned)
    assert r.status_code == 200
    assert "CASE-0001" not in r.text


def test_candidate_block_keys_do_not_expose_phone_numbers(client, ingested, investigator):
    cands = client.get("/api/v1/cases/CASE-0001/candidates", headers=investigator).json()
    keys = [c["block_key"] for c in cands if c.get("block_key")]
    assert any("phone:" in k for k in keys), "precondition: some candidates were blocked on a phone"
    import re
    for k in keys:
        assert not re.search(r"phone:\d{6,}", k), k
    detail = client.get(f"/api/v1/candidates/{cands[0]['candidate_id']}", headers=investigator).json()
    assert not re.search(r"phone:\d{6,}", detail.get("block_key") or "")


def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(data)).pages)


def test_court_pdf_masks_rule_subjects_and_escapes_markup(client, ingested, investigator):
    analysis = client.get("/api/v1/cases/CASE-0001/analysis", headers=investigator).json()
    assert analysis.get("rules"), "precondition: rule candidates exist"
    hostile = '<img src="/etc/hostname"/><b>bold <font color="red">x'
    r = client.post("/api/v1/cases/CASE-0001/report/court-pdf", headers=investigator, json={"analyst_comments": hostile})
    assert r.status_code == 200, r.text[:300]
    assert r.headers["content-type"].startswith("application/pdf")
    text = _pdf_text(r.content)
    assert "<img" in text or "&lt;img" in text, "comment must appear as literal text, not be interpreted"
    import re
    assert not re.search(r"\+91 \d{5} \d{5}", text), "unmasked phone in PDF"
    assert not re.search(r"ACC-[A-Z]+-\d{4}\b", text), "unmasked account in PDF"


def test_merkle_anchor_excludes_evidence_that_never_cleared_the_scan_gate(client, admin, officer, investigator, monkeypatch):
    case_id = "CASE-SEC2"
    assert client.post("/api/v1/cases", headers=admin, json={"case_id": case_id, "title": "Anchor probe", "jurisdiction": "Demo District A",
                       "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-SEC-2"}).status_code == 201
    for u in ("officer", "investigator"):
        client.post(f"/api/v1/cases/{case_id}/assign", headers=admin, json={"username": u})
    monkeypatch.setattr(config, "SCANNER_MODE", "unavailable")
    ev = upload(client, officer, case_id, "vehicles.csv").json()
    assert ev["status"] == "SCANNER_UNAVAILABLE", ev["status"]
    # failure path: nothing has cleared the gate, so there is nothing to anchor
    assert client.post(f"/api/v1/cases/{case_id}/integrity/anchor", headers=investigator).status_code == 422
    # success path: once the same item is scanned clean it is anchorable
    monkeypatch.setattr(config, "SCANNER_MODE", "testgate")
    assert client.post(f"/api/v1/evidence/{ev['evidence_id']}/process", headers=officer).status_code == 200
    r = client.post(f"/api/v1/cases/{case_id}/integrity/anchor", headers=investigator)
    assert r.status_code == 201, r.text
    assert r.json()["leaf_count"] == 1


def test_graph_degrades_to_authoritative_projection_when_neo4j_fails(client, ingested, investigator, monkeypatch):
    """DEF-043 / §6.1: with Neo4j configured but unreachable the graph route returned 500 (found by pointing a
    live instance at a closed port). It must serve the projection rebuilt from authoritative rows, marked stale."""
    from neo4j.exceptions import ServiceUnavailable
    from ..services import neo4j_store

    baseline = client.get("/api/v1/cases/CASE-0001/graph?limit=150", headers=investigator).json()
    assert baseline["projection_stale"] is False

    def down(*a, **k):
        raise ServiceUnavailable("simulated outage")
    monkeypatch.setattr(neo4j_store, "available", lambda: True)
    monkeypatch.setattr(neo4j_store, "write_projection", down)
    monkeypatch.setattr(neo4j_store, "read_bounded", down)
    r = client.get("/api/v1/cases/CASE-0001/graph?limit=150", headers=investigator)
    assert r.status_code == 200, r.text[:200]
    body = r.json()
    assert body["projection_stale"] is True
    assert {n["entity_id"] for n in body["nodes"]} == {n["entity_id"] for n in baseline["nodes"]}
    assert len(body["edges"]) == len(baseline["edges"])


def test_missing_stored_object_is_a_controlled_integrity_failure(client, admin, officer, monkeypatch):
    """DEF-042: with the stored object gone, /download and /context raised inside verify_hash (HTTP 500) and
    /verify reported match=false without changing state. Now: 409 + INTEGRITY_MISMATCH + audit, record kept."""
    from ..services import storage
    case_id = "CASE-SEC3"
    assert client.post("/api/v1/cases", headers=admin, json={"case_id": case_id, "title": "Missing object probe", "jurisdiction": "Demo District A",
                       "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-SEC-3"}).status_code == 201
    client.post(f"/api/v1/cases/{case_id}/assign", headers=admin, json={"username": "officer"})
    ev = upload(client, officer, case_id, "vehicles.csv").json()
    assert client.get(f"/api/v1/evidence/{ev['evidence_id']}/download", headers=officer).status_code == 200  # success path first
    path = client.get(f"/api/v1/evidence/{ev['evidence_id']}", headers=officer).json()
    from ..db import SessionLocal
    from ..models import Evidence
    db = SessionLocal()
    rel = db.get(Evidence, ev["evidence_id"]).storage_path
    db.close()
    storage._abs(rel).unlink()
    r = client.get(f"/api/v1/evidence/{ev['evidence_id']}/download", headers=officer)
    assert r.status_code == 409, r.text
    assert client.get(f"/api/v1/evidence/{ev['evidence_id']}/context", headers=officer).status_code == 409
    v = client.get(f"/api/v1/evidence/{ev['evidence_id']}/verify", headers=officer).json()
    assert v["match"] is False and v["status"] == "INTEGRITY_MISMATCH"
    after = client.get(f"/api/v1/evidence/{ev['evidence_id']}", headers=officer).json()
    assert after["status"] == "INTEGRITY_MISMATCH" and after["sha256"] == path["sha256"]


def test_storage_outage_on_upload_is_controlled_and_leaves_no_row(client, officer, monkeypatch):
    """DEF-044: an unreachable object store made upload return an unhandled 500."""
    from ..services import storage

    def down(*a, **k):
        raise ConnectionError("simulated object-store outage")
    monkeypatch.setattr(storage, "write_quarantine", down)
    before = len(client.get("/api/v1/cases/CASE-0002/evidence", headers=officer).json())
    r = client.post("/api/v1/cases/CASE-0002/evidence", headers=officer,
                    files={"file": ("outage.csv", b"name,phone\nOutage Probe,9000000009\n")})
    assert r.status_code == 503, r.text
    assert len(client.get("/api/v1/cases/CASE-0002/evidence", headers=officer).json()) == before


def test_duplicate_upload_is_audited(client, ingested, officer, auditor):
    """DEF-045: the EVIDENCE_UPLOAD_DUPLICATE audit row was written but never committed."""
    r = upload(client, officer, "CASE-0001", "vehicles.csv")
    assert r.status_code == 201
    rows = client.get("/api/v1/audit?action=EVIDENCE_UPLOAD_DUPLICATE", headers=auditor).json()
    assert any(a["target_id"] == r.json()["evidence_id"] for a in rows)


def test_role_denials_are_audited(client, ingested, auditor, admin):
    """DEF-049: require_roles raised 403 without an audit row."""
    analyst = client.post("/api/v1/auth/login", json={"username": "analyst", "password": "analyst-demo"}).json()["token"]
    h = {"Authorization": f"Bearer {analyst}"}
    before = len(client.get("/api/v1/audit?action=ACCESS_DENIED&limit=1000", headers=auditor).json())
    assert client.get("/api/v1/audit", headers=h).status_code == 403
    assert client.post("/api/v1/cases/CASE-0001/report", headers=h, json={}).status_code in (200, 403)  # analyst may be allowed
    rows = client.get("/api/v1/audit?action=ACCESS_DENIED&limit=1000", headers=auditor).json()
    assert len(rows) > before
    assert any((r.get("detail") or {}).get("reason") == "role not permitted" for r in rows)
    # success path unchanged: an allowed role still passes
    assert client.get("/api/v1/audit", headers=auditor).status_code == 200


def test_context_reveal_window_is_bounded(client, ingested, investigator):
    """DEF-046: window=1000000 unmasked an entire file in one audited-as-one-row call."""
    ev = ingested["calls.csv"]["evidence_id"]
    assert client.get(f"/api/v1/evidence/{ev}/context?row=2&window=1000000", headers=investigator).status_code == 422
    r = client.post(f"/api/v1/evidence/{ev}/context/reveal", headers=investigator, json={"reason": "bounded reveal test", "row": 2, "window": 1000000})
    assert r.status_code == 422
    ok = client.post(f"/api/v1/evidence/{ev}/context/reveal", headers=investigator, json={"reason": "bounded reveal test", "row": 2, "window": 2})
    assert ok.status_code == 200 and len(ok.json()["lines"]) <= 5


def test_corrupt_pdf_context_is_a_controlled_error(client, officer, investigator):
    """DEF-047: /context on a corrupt PDF (EXTRACTION_FAILED, original preserved) raised inside pypdf -> 500."""
    r = upload(client, officer, "CASE-0002", "corrupt/fir_001_truncated.pdf")
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "EXTRACTION_FAILED"
    c = client.get(f"/api/v1/evidence/{r.json()['evidence_id']}/context?page=1&line=1", headers=officer)
    assert c.status_code == 422, c.text


def test_case_listing_applies_jurisdiction(client, admin, outsider):
    """DEF-048: an out-of-jurisdiction user assigned to a case saw it in /cases while /cases/{id} returned 403."""
    client.post("/api/v1/cases/CASE-0001/assign", headers=admin, json={"username": "outsider"})
    assert client.get("/api/v1/cases/CASE-0001", headers=outsider).status_code == 403
    assert "CASE-0001" not in [c["case_id"] for c in client.get("/api/v1/cases", headers=outsider).json()]


def test_review_reasons_are_masked_in_candidate_output(client, admin, officer, reviewer):
    """DEF-050: a phone number typed into a review reason came back unmasked to every case member.
    Own case, so the decision does not touch CASE-0001 candidates other tests rely on."""
    case_id = "CASE-SEC4"
    assert client.post("/api/v1/cases", headers=admin, json={"case_id": case_id, "title": "Reason masking probe", "jurisdiction": "Demo District A",
                       "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-SEC-4"}).status_code == 201
    for u in ("officer", "reviewer"):
        client.post(f"/api/v1/cases/{case_id}/assign", headers=admin, json={"username": u})
    for rel in ("people.json", "aliases.json", "calls.csv"):
        assert upload(client, officer, case_id, rel).status_code == 201
    cands = client.get(f"/api/v1/cases/{case_id}/candidates", headers=reviewer).json()
    assert cands, "precondition: the probe case produced review candidates"
    cid = cands[-1]["candidate_id"]
    r = client.post(f"/api/v1/candidates/{cid}/decision", headers=reviewer, json={"decision": "DEFER", "reason": "called +91 90000 00101 per log"})
    assert r.status_code == 200, r.text
    reasons = [x["reason"] for x in client.get(f"/api/v1/candidates/{cid}", headers=reviewer).json()["reviews"]]
    assert reasons and not any("90000 00101" in x for x in reasons), reasons
