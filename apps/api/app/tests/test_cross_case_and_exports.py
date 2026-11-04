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


def test_missing_stored_object_is_a_controlled_integrity_failure(client, admin, officer, investigator, monkeypatch):
    """DEF-042: with the stored object gone, /download and /context raised inside verify_hash (HTTP 500) and
    /verify reported match=false without changing state. Now: 409 + INTEGRITY_MISMATCH + audit, record kept."""
    from ..services import storage
    case_id = "CASE-SEC3"
    assert client.post("/api/v1/cases", headers=admin, json={"case_id": case_id, "title": "Missing object probe", "jurisdiction": "Demo District A",
                       "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-SEC-3"}).status_code == 201
    for u in ("officer", "investigator"):
        client.post(f"/api/v1/cases/{case_id}/assign", headers=admin, json={"username": u})
    ev = upload(client, officer, case_id, "vehicles.csv").json()
    dl = lambda: client.post(f"/api/v1/evidence/{ev['evidence_id']}/download", headers=investigator, json={"reason": "integrity check"})
    assert dl().status_code == 200  # success path first (raw download: unmask-capable role + reason, DEF-101)
    path = client.get(f"/api/v1/evidence/{ev['evidence_id']}", headers=officer).json()
    from ..db import SessionLocal
    from ..models import Evidence
    db = SessionLocal()
    rel = db.get(Evidence, ev["evidence_id"]).storage_path
    db.close()
    if storage._using_s3():  # backend-agnostic: in the Compose stack the object lives in S3/MinIO
        from .. import config
        storage._client().delete_object(Bucket=config.S3_BUCKET, Key=rel)
    else:
        storage._abs(rel).unlink()
    r = dl()
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


def test_graph_ignores_a_neo4j_projection_that_disagrees_with_authoritative_rows(client, ingested, investigator, monkeypatch):
    """DEF-072: the uncentered listing trusted node ids returned by Neo4j. When the projection held another
    instance's data for the same case id (seen live: two app instances sharing one Neo4j), the API returned an
    empty graph. Ids not present in the authoritative projection must mark it stale and fall back."""
    from ..services import neo4j_store

    baseline = client.get("/api/v1/cases/CASE-0001/graph?limit=150", headers=investigator).json()
    monkeypatch.setattr(neo4j_store, "available", lambda: True)
    monkeypatch.setattr(neo4j_store, "write_projection", lambda *a, **k: None)
    monkeypatch.setattr(neo4j_store, "read_bounded", lambda *a, **k: ([{"entity_id": "ENT-foreign-1"}, {"entity_id": "ENT-foreign-2"}], [], False))
    body = client.get("/api/v1/cases/CASE-0001/graph?limit=150", headers=investigator).json()
    assert body["projection_stale"] is True
    assert {n["entity_id"] for n in body["nodes"]} == {n["entity_id"] for n in baseline["nodes"]}


def test_operational_endpoints_and_job_errors_do_not_leak_server_internals(client, officer, monkeypatch):
    """DEF-074: /health (unauthenticated) returned the absolute storage path; /ready echoed exception text; failed
    jobs stored the last 800 chars of a server traceback (file paths) and returned it to every case member."""
    h = client.get("/api/v1/health").json()
    assert not str(h.get("storage", "")).startswith("/"), h
    assert h["storage"] in ("local", "s3")

    from .. import main
    class Boom:
        def __enter__(self): raise RuntimeError("secret-host:5432 password authentication failed for user x")
        def __exit__(self, *a): return False
    monkeypatch.setattr(main.engine, "connect", lambda: Boom())
    r = client.get("/api/v1/ready")
    assert r.status_code == 503 and "password" not in r.text and "secret-host" not in r.text, r.text
    monkeypatch.undo()

    r = upload(client, officer, "CASE-0002", "corrupt/calls_corrupt.csv")
    assert r.status_code == 201, r.text
    jobs = client.get(f"/api/v1/evidence/{r.json()['evidence_id']}", headers=officer).json()["jobs"]
    failed = [j for j in jobs if j["status"] == "FAILED"]
    assert failed, jobs
    for j in failed:
        assert "Traceback" not in (j["error"] or "") and 'File "/' not in (j["error"] or ""), j["error"]


def test_storage_failure_during_scan_is_retryable_not_stuck(client, admin, officer, monkeypatch):
    """DEF-083: run_scan committed MALWARE_SCANNING + a RUNNING job before reading the object. A storage error there
    escaped, leaving the evidence permanently in MALWARE_SCANNING with a RUNNING job (both rejected by /process)."""
    from contextlib import contextmanager
    from ..services import storage
    case_id = "CASE-SEC5"
    assert client.post("/api/v1/cases", headers=admin, json={"case_id": case_id, "title": "Scan storage failure", "jurisdiction": "Demo District A",
                       "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-SEC-5"}).status_code == 201
    client.post(f"/api/v1/cases/{case_id}/assign", headers=admin, json={"username": "officer"})

    real = storage.local_copy

    @contextmanager
    def broken(*a, **k):
        raise ConnectionError("simulated object-store read failure")
        yield  # pragma: no cover

    monkeypatch.setattr(storage, "local_copy", broken)
    r = upload(client, officer, case_id, "vehicles.csv")
    assert r.status_code == 201, r.text
    ev = r.json()
    assert ev["status"] == "SCAN_FAILED", ev["status"]  # never CLEAN, never stuck
    # recovery: once storage works again the same item can be re-processed to a clean, extracted state
    monkeypatch.setattr(storage, "local_copy", real)
    rp = client.post(f"/api/v1/evidence/{ev['evidence_id']}/process", headers=officer)
    assert rp.status_code == 200, rp.text
    assert rp.json()["status"] in ("HITL", "GRAPH_PROJECTED", "EXTRACTED"), rp.json()["status"]


def test_resolution_failure_is_visible_and_retryable(client, admin, officer, auditor, monkeypatch):
    """DEF-084: run_resolve had no error handling. An exception in candidate generation left the evidence in
    ENTITY_CANDIDATES with a RUNNING job -- a state /process does not accept -- and surfaced as a 500."""
    from ..services import resolution
    case_id = "CASE-SEC6"
    assert client.post("/api/v1/cases", headers=admin, json={"case_id": case_id, "title": "Resolution failure", "jurisdiction": "Demo District A",
                       "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-SEC-6"}).status_code == 201
    client.post(f"/api/v1/cases/{case_id}/assign", headers=admin, json={"username": "officer"})
    real = resolution.generate_candidates

    def boom(*a, **k):
        raise RuntimeError("simulated resolver failure")
    monkeypatch.setattr(resolution, "generate_candidates", boom)
    r = upload(client, officer, case_id, "people.json")
    assert r.status_code == 201, r.text
    ev = r.json()
    assert ev["status"] == "EXTRACTED", ev["status"]  # claims kept; resolution not marked done
    assert any(j["kind"] == "RESOLVE" and j["status"] == "FAILED" for j in ev["jobs"]), ev["jobs"]
    rows = client.get("/api/v1/audit?action=RESOLUTION_FAILED", headers=auditor).json()
    assert any(a["target_id"] == ev["evidence_id"] for a in rows)
    monkeypatch.setattr(resolution, "generate_candidates", real)
    rp = client.post(f"/api/v1/evidence/{ev['evidence_id']}/process", headers=officer)
    assert rp.status_code == 200, rp.text
    assert rp.json()["status"] in ("HITL", "GRAPH_PROJECTED"), rp.json()["status"]


def test_time_window_filters_are_parsed_or_rejected_never_ignored(client, ingested, investigator):
    """DEF-087: t_from/t_to only parsed 'YYYY-MM-DD[ HH:MM:SS]'. An ISO value with 'T' (what a datetime-local input
    sends) was silently ignored, so a "filtered" timeline returned every event."""
    base = "/api/v1/cases/CASE-0001/timeline"
    full = client.get(base, headers=investigator).json()["count"]
    spaced = client.get(f"{base}?t_from=2025-07-01 00:00:00", headers=investigator).json()["count"]
    iso_t = client.get(f"{base}?t_from=2025-07-01T00:00", headers=investigator)
    assert iso_t.status_code == 200
    assert iso_t.json()["count"] == spaced < full, (full, spaced, iso_t.json()["count"])
    for bad in ("garbage", "2025-13-01", "2025-07-01T00:00:00+05:30"):
        r = client.get(f"{base}?t_from={bad.replace('+', '%2B')}", headers=investigator)
        assert r.status_code == 422, (bad, r.status_code)
    assert client.get("/api/v1/cases/CASE-0001/graph?t_to=nope", headers=investigator).status_code == 422


def test_bridge_communities_use_full_membership_not_the_displayed_top_12():
    """DEF-089: touches_communities was looked up in each community's displayed member list (top 12 by degree), so a
    bridge whose neighbours were real members outside the top 12 reported touching no community. Two 20-cliques; the
    first 13 members of each get extra leaves so they fill the top 12; the bridge attaches to member 19 of each."""
    import networkx as nx
    from ..services import graph as g
    G = nx.MultiDiGraph()
    k = 0

    def edge(a, b):
        nonlocal k
        k += 1
        for n in (a, b):
            if n not in G:
                G.add_node(n, label=n, kind="PHONE", flags={})
        G.add_edge(a, b, key=str(k), rel_type="CALLED", observed_time=None)
    for grp in ("A", "B"):
        for i in range(20):
            for j in range(i + 1, 20):
                edge(f"{grp}{i}", f"{grp}{j}")
        for i in range(13):
            for x in range(3):
                edge(f"{grp}{i}", f"{grp}{i}-leaf{x}")
    edge("A19", "BR"); edge("BR", "B19")
    res = g.analyze(G)
    displayed = {m["entity_id"] for c in res["communities"] for m in c["members"]}
    assert "A19" not in displayed and "B19" not in displayed, "precondition: neighbours outside the displayed top 12"
    core = nx.Graph(G.to_undirected())
    part = {n: i for i, c in enumerate(nx.community.greedy_modularity_communities(core)) for n in c}
    assert part["A19"] != part["B19"], "precondition: the neighbours sit in different communities"
    br = next(b for b in res["bridge_candidates"] if b["entity_id"] == "BR")
    assert len(br["touches_communities"]) == 2, br


def test_source_person_ids_never_merge_people_across_cases(client, admin, officer, unassigned):
    """DEF-090: person entities were keyed globally by the source file's person_id ('pid:P-001'). Two different people
    who happened to share that local id in two cases became ONE entity, labelled with the first case's name -- an
    automatic person-level merge by shared identifier (constitution §2.2) that also showed a CASE-A name to CASE-B
    users. Person ids are now scoped to the case; within one case they still join records across files."""
    import json
    for cid in ("CASE-PID1", "CASE-PID2"):
        assert client.post("/api/v1/cases", headers=admin, json={"case_id": cid, "title": "pid scope", "jurisdiction": "Demo District A",
                           "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-PID"}).status_code == 201
        client.post(f"/api/v1/cases/{cid}/assign", headers=admin, json={"username": "officer"})
    client.post("/api/v1/cases/CASE-PID2/assign", headers=admin, json={"username": "unassigned"})
    a = json.dumps([{"person_id": "P-001", "name": "Asha Verma", "dob": "1990-01-01", "phone": "+91 90000 12345"}]).encode()
    b = json.dumps([{"person_id": "P-001", "name": "Nikhil Rao", "dob": "1975-05-05", "phone": "+91 90000 67890"}]).encode()
    for cid, data in (("CASE-PID1", a), ("CASE-PID2", b)):
        r = client.post(f"/api/v1/cases/{cid}/evidence", headers=officer, files={"file": ("people.json", data)})
        assert r.status_code == 201, r.text
    labels = [n["label"] for n in client.get("/api/v1/cases/CASE-PID2/graph", headers=unassigned).json()["nodes"] if n["kind"] == "PERSON"]
    assert labels == ["Nikhil Rao"], labels  # failure mode was ["Asha Verma"]
    # success path: within one case the same person_id still links records from different files
    veh = b"vehicle_id,registration,owner_person_id,owner_name,type\nVH-9,KA01 AB 0001,P-001,Nikhil Rao,van\n"
    r = client.post("/api/v1/cases/CASE-PID2/evidence", headers=officer, files={"file": ("vehicles.csv", veh)})
    assert r.status_code == 201, r.text
    persons = [n for n in client.get("/api/v1/cases/CASE-PID2/graph", headers=unassigned).json()["nodes"] if n["kind"] == "PERSON"]
    assert len(persons) == 1, persons


def test_audit_signature_is_unambiguous_and_legacy_signatures_still_verify():
    """DEF-091: the HMAC payload joined fields with '|', so moving text across a field boundary
    (trace 'T|USR-a' + actor 'USR-b'  vs  trace 'T' + actor 'USR-a|USR-b') kept a valid signature. New events are
    signed over a JSON array ('hmac-sha256-json'); existing 'hmac-sha256' signatures keep verifying."""
    from ..models import AuditEvent, utcnow
    from ..services import audit
    t = utcnow()
    e1 = AuditEvent(audit_id="AUD-1", trace_id="T|USR-a", actor_id="USR-b", action="EXPORT", target_kind="CASE", target_id="X",
                    case_id="C", outcome="OK", detail={}, created_at=t)
    e1.signature = audit.sign_audit_event(e1)
    assert e1.signature.split(":")[1] == "hmac-sha256-json"
    assert audit.verify_audit_event(e1)  # success path
    e2 = AuditEvent(audit_id="AUD-1", trace_id="T", actor_id="USR-a|USR-b", action="EXPORT", target_kind="CASE", target_id="X",
                    case_id="C", outcome="OK", detail={}, created_at=t, signature=e1.signature)
    assert not audit.verify_audit_event(e2)  # the boundary-shift forgery no longer verifies
    # an event signed before this change (legacy '|' payload) still verifies, and is still tamper-evident
    legacy = AuditEvent(audit_id="AUD-2", trace_id="T", actor_id="USR-a", action="EXPORT", target_kind="CASE", target_id="X",
                        case_id="C", outcome="OK", detail={"k": 1}, created_at=t)
    key_id = audit.config.CURRENT_AUDIT_KEY_ID
    legacy.signature = f"{key_id}:hmac-sha256:{audit._compute_hmac(audit.config.AUDIT_KEYS[key_id].encode(), legacy)}"
    assert audit.verify_audit_event(legacy)
    legacy.outcome = "DENIED"
    assert not audit.verify_audit_event(legacy)
