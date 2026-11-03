"""Second-pass findings in the extraction pipeline (DEF-092..096): reviewer decisions must survive later uploads,
blank identifiers must not create shared phantom entities, and every locator must open the exact source line."""
import io

import pytest

from .conftest import upload


@pytest.fixture(scope="module")
def case(client, admin):
    cid = "CASE-PROV1"
    assert client.post("/api/v1/cases", headers=admin, json={"case_id": cid, "title": "provenance probe", "jurisdiction": "Demo District A",
                       "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-PROV"}).status_code == 201
    for u in ("officer", "investigator", "reviewer"):
        client.post(f"/api/v1/cases/{cid}/assign", headers=admin, json={"username": u})
    return cid


def _up(client, h, cid, name, data):
    r = client.post(f"/api/v1/cases/{cid}/evidence", headers=h, files={"file": (name, data)})
    assert r.status_code == 201, r.text
    return r.json()


def _claims(client, h, ev_id):
    return client.get(f"/api/v1/evidence/{ev_id}/claims?limit=500", headers=h).json()


def test_reviewer_decision_on_a_contradiction_survives_later_uploads(client, case, officer, reviewer):
    """DEF-092: flag_contradictions re-ran on every upload and turned an APPROVED (ALLOWED) claim back into
    CONTRADICTORY -- automation silently overwrote a human decision."""
    reg = _up(client, officer, case, "vehicles.csv", b"vehicle_id,registration,owner_person_id,owner_name,type\nVH-1,KA02 XY 1111,P-9,Kavya Iyer,van\n")
    doc = _up(client, officer, case, "note.txt", b"Statement\nThe vehicle with registration KA02 XY 1111 owned by Rohan Das was seen.\n")
    owner = lambda ev: next(c for c in _claims(client, reviewer, ev["evidence_id"]) if c.get("attribute") == "owner")
    reg_claim, doc_claim = owner(reg), owner(doc)
    assert reg_claim["state"] == doc_claim["state"] == "CONTRADICTORY"  # precondition
    assert client.post(f"/api/v1/claims/{reg_claim['claim_id']}/decision", headers=reviewer, json={"decision": "APPROVE", "reason": "registry confirmed"}).status_code == 200
    assert client.post(f"/api/v1/claims/{doc_claim['claim_id']}/decision", headers=reviewer, json={"decision": "REJECT", "reason": "statement mistaken"}).status_code == 200
    _up(client, officer, case, "calls.csv", b"call_id,caller,callee,start_time,duration_sec,cell_id\nC1,+91 90000 70001,+91 90000 70002,2025-01-01 10:00:00,10,\n")
    assert owner(reg)["state"] != "CONTRADICTORY", owner(reg)["state"]
    assert owner(doc)["state"] == "REJECT"


def test_blank_identifiers_never_become_a_shared_entity(client, case, officer, investigator):
    """DEF-093: an empty callee created one PHONE entity with an empty key, shared by every such row in every case:
    invented relationships and a fake top-degree hub. The gap must be recorded as missing data instead."""
    ev = _up(client, officer, case, "calls_blank_callee.csv",
             b"call_id,caller,callee,start_time,duration_sec,cell_id\nC1,+91 90000 71111,,2025-01-01 10:00:00,10,\nC2,+91 90000 72222,,2025-01-01 11:00:00,10,\n")
    claims = _claims(client, investigator, ev["evidence_id"])
    assert not [c for c in claims if c.get("rel_type") == "CALLED"], "no edge to a non-existent party"
    recorded = [c for c in claims if (c.get("missingness") or {}).get("callee")]
    assert len(recorded) == 2, claims  # the gap stays visible, once per row
    nodes = client.get(f"/api/v1/cases/{case}/graph?limit=150", headers=investigator).json()["nodes"]
    assert not [n for n in nodes if n["kind"] == "PHONE" and n["label"] in ("", "•••")], nodes


def test_csv_row_locator_is_the_physical_line_even_with_blank_lines(client, case, officer, investigator):
    """DEF-094: csv.DictReader skips blank lines, so enumerate() drifted from the file's line numbers and the
    locator opened the wrong (or an empty) line."""
    ev = _up(client, officer, case, "calls_gap.csv",
             b"call_id,caller,callee,start_time,duration_sec,cell_id\nC1,+91 90000 73001,+91 90000 73002,2025-01-01 10:00:00,10,\n\n"
             b"C2,+91 90000 73003,+91 90000 73004,2025-01-01 11:00:00,10,\n")
    for c in [c for c in _claims(client, investigator, ev["evidence_id"]) if c.get("rel_type") == "CALLED"]:
        row = c["provenance"][0]["locator"]["row"]
        ctx = client.get(f"/api/v1/evidence/{ev['evidence_id']}/context?row={row}&window=0", headers=investigator).json()
        hit = [l["text"] for l in ctx["lines"] if l["hit"]]
        call_id = "C1" if c["original_value"].split(" -> ")[0].endswith("001") else "C2"  # values are masked
        assert hit and hit[0].startswith(call_id + ","), (c["original_value"], row, hit)


def test_ner_locator_points_at_the_right_page_and_line(client, case, officer, investigator):
    """DEF-095: the NER pass joined all pages and labelled every hit page 1, so a name on page 2 opened nothing."""
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    cv = canvas.Canvas(buf)
    for i, ln in enumerate(["Report page one", "nothing here", "more filler text"]):
        cv.drawString(72, 750 - 20 * i, ln)
    cv.showPage()
    for i, ln in enumerate(["Report page two", "Witness Kavita Rao was present"]):  # conftest's fake NER tags this name
        cv.drawString(72, 750 - 20 * i, ln)
    cv.showPage(); cv.save()
    ev = _up(client, officer, case, "two_pages.pdf", buf.getvalue())
    ner = [c for c in _claims(client, investigator, ev["evidence_id"]) if c.get("method") == "indic-bert-ner"]
    assert ner, "precondition: the NER pass produced a candidate"
    for c in ner:
        loc = c["provenance"][0]["locator"]
        ctx = client.get(f"/api/v1/evidence/{ev['evidence_id']}/context?page={loc['page']}&line={loc['line']}&window=0", headers=investigator).json()
        hit = [l["text"] for l in ctx["lines"] if l["hit"]]
        assert loc["page"] == 2 and hit and "Kavita Rao" in hit[0], (loc, hit)


def test_consecutive_ownership_sentences_give_one_claim_each_on_their_own_line(client, case, officer, investigator):
    """DEF-096: matching each line joined with the next produced the second sentence's owner twice (once on the
    previous line's locator)."""
    ev = _up(client, officer, case, "owners.txt", b"Summary\nThe vehicle with registration KA03 AA 0001 owned by Kavya Iyer was seen.\n"
                                                  b"The vehicle with registration KA03 BB 0002 owned by Sameer Qureshi was seen.\n")
    owners = sorted((c["original_value"], c["provenance"][0]["locator"]["line"]) for c in _claims(client, investigator, ev["evidence_id"]) if c.get("attribute") == "owner")
    assert owners == [("Kavya Iyer", 2), ("Sameer Qureshi", 3)], owners


@pytest.mark.parametrize("stuck_status, kind", [("MALWARE_SCANNING", "SCAN"), ("PROCESSING", "EXTRACT"), ("ENTITY_CANDIDATES", "RESOLVE")])
def test_job_abandoned_by_a_crashed_process_can_be_reclaimed(client, case, officer, auditor, stuck_status, kind):
    """DEF-098: a process that died mid-job left the job RUNNING and the evidence in an in-between state forever:
    _job() refused RUNNING jobs and /process refused those states. A RUNNING job past its lease is reclaimable; a fresh
    RUNNING job is still refused (two workers must not run the same job). The crash is simulated faithfully: earlier
    stages really ran, the crashed stage left only its RUNNING job (its transaction rolled back), later stages never ran."""
    import datetime
    from ..db import SessionLocal
    from ..models import Evidence, Job
    from ..services import pipeline
    n = {"SCAN": 1, "EXTRACT": 2, "RESOLVE": 3}[kind]
    r = client.post(f"/api/v1/cases/{case}/evidence", headers=officer, data={"process": "false"},
                    files={"file": (f"calls_crash_{kind.lower()}.csv",
                                    f"call_id,caller,callee,start_time,duration_sec,cell_id\nC1,+91 90000 8{n}001,+91 90000 8{n}002,2025-01-01 10:00:00,10,\n".encode())})
    assert r.status_code == 201, r.text
    ev_id = r.json()["evidence_id"]
    db = SessionLocal()
    e = db.get(Evidence, ev_id)
    if kind in ("EXTRACT", "RESOLVE"):
        assert pipeline.run_scan(db, e, "TRC-test", None)
    if kind == "RESOLVE":
        assert pipeline.run_extract(db, e, "TRC-test", None)
    now = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
    job = Job(evidence_id=ev_id, case_id=e.case_id, kind=kind, trace_id="TRC-crashed", idempotency_key=f"{ev_id}:{kind}",
              attempts=1, metrics={}, status="RUNNING", updated_at=now)
    db.add(job)
    e.status = stuck_status
    db.commit()
    # a worker may still hold a fresh job: refuse
    assert client.post(f"/api/v1/evidence/{ev_id}/process", headers=officer).status_code == 409
    job.updated_at = now - datetime.timedelta(hours=2)  # the lease has long expired: the holder died
    db.commit(); db.close()
    r = client.post(f"/api/v1/evidence/{ev_id}/process", headers=officer)
    assert r.status_code == 200, r.text
    assert r.json()["status"] in ("HITL", "GRAPH_PROJECTED"), r.json()["status"]
    rows = client.get("/api/v1/audit?action=JOB_LEASE_RECLAIMED&limit=500", headers=auditor).json()
    assert any(a["case_id"] == case for a in rows)


def test_undecided_candidates_refresh_and_decided_ones_show_new_evidence(client, admin, officer, reviewer):
    """DEF-099: candidates were frozen at creation -- later evidence about the same two records never reached the
    signals a reviewer sees. Undecided candidates are now recomputed; decided ones keep the signals and decision the
    reviewer saw, and list the evidence that arrived after that snapshot."""
    import json
    cid = "CASE-PROV2"
    assert client.post("/api/v1/cases", headers=admin, json={"case_id": cid, "title": "candidate refresh", "jurisdiction": "Demo District A",
                       "purpose": "RETROSPECTIVE_REVIEW", "authority_reference": "TEST-PROV2"}).status_code == 201
    for u in ("officer", "reviewer"):
        client.post(f"/api/v1/cases/{cid}/assign", headers=admin, json={"username": u})
    people = [{"person_id": "P-1", "name": "Meera Joshi"},
              {"person_id": "P-2", "name": "Meera Joshi"},
              {"person_id": "P-3", "name": "Ravi Menon"},
              {"person_id": "P-4", "name": "Ravi Menon"}]
    assert _up(client, officer, cid, "people.json", json.dumps(people).encode())["status"] in ("HITL", "GRAPH_PROJECTED")
    cands = {tuple(sorted((c["left"]["label"], c["right"]["label"]))): c for c in client.get(f"/api/v1/cases/{cid}/candidates", headers=reviewer).json()}
    meera, ravi = cands[("Meera Joshi", "Meera Joshi")], cands[("Ravi Menon", "Ravi Menon")]
    assert all("dob_match" not in [s["signal"] for s in c["positive_signals"]] for c in (meera, ravi))
    # the reviewer decides Ravi; Meera stays undecided
    assert client.post(f"/api/v1/candidates/{ravi['candidate_id']}/decision", headers=reviewer, json={"decision": "DEFER", "reason": "need more data"}).status_code == 200
    # new evidence: matching DOBs for both pairs
    more = [{"person_id": "P-1", "name": "Meera Joshi", "dob": "1991-02-03"}, {"person_id": "P-2", "name": "Meera Joshi", "dob": "1991-02-03"},
            {"person_id": "P-3", "name": "Ravi Menon", "dob": "1980-01-01"}, {"person_id": "P-4", "name": "Ravi Menon", "dob": "1980-01-01"}]
    new_ev = _up(client, officer, cid, "people_update.json", json.dumps(more).encode())
    m2 = client.get(f"/api/v1/candidates/{meera['candidate_id']}", headers=reviewer).json()
    r2 = client.get(f"/api/v1/candidates/{ravi['candidate_id']}", headers=reviewer).json()
    assert "dob_match" in [s["signal"] for s in m2["positive_signals"]] and m2["confidence"] > meera["confidence"]
    assert new_ev["evidence_id"] in m2["evidence_ids"] and m2["state"] == "REVIEW_REQUIRED"
    assert r2["state"] == "DEFER" and r2["positive_signals"] == ravi["positive_signals"]  # decision + snapshot kept
    assert new_ev["evidence_id"] in r2["new_evidence_since_snapshot"], r2.get("new_evidence_since_snapshot")
