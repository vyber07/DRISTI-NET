"""Server-side search and paging on the list endpoints (frontend redesign). All parameters are optional and additive."""


def test_cases_search_paging_and_total(client, investigator):
    full = client.get("/api/v1/cases", headers=investigator)
    assert full.status_code == 200 and int(full.headers["X-Total-Count"]) == len(full.json())  # old behaviour kept
    r = client.get("/api/v1/cases", params={"q": "lakeside"}, headers=investigator)
    assert [c["case_id"] for c in r.json()] == ["CASE-0002"] and r.headers["X-Total-Count"] == "1"
    p1 = client.get("/api/v1/cases", params={"limit": 1, "offset": 0}, headers=investigator)
    p2 = client.get("/api/v1/cases", params={"limit": 1, "offset": 1}, headers=investigator)
    assert len(p1.json()) == 1 and len(p2.json()) == 1 and p1.json()[0]["case_id"] != p2.json()[0]["case_id"]
    assert p1.headers["X-Total-Count"] == full.headers["X-Total-Count"]


def test_case_search_never_widens_access(client, unassigned, outsider):
    # unassigned is only on CASE-0002; outsider has no cases. A search must not reach other cases.
    r = client.get("/api/v1/cases", params={"q": "river bridge"}, headers=unassigned)
    assert r.json() == [] and r.headers["X-Total-Count"] == "0"
    assert client.get("/api/v1/cases", params={"q": "case"}, headers=outsider).json() == []


def test_case_search_escapes_wildcards(client, investigator):
    """% and _ are matched literally, not as LIKE wildcards: every hit must contain the character itself."""
    fields = ("case_id", "title", "purpose", "jurisdiction", "authority_reference")
    for ch in ("%", "_"):
        hits = client.get("/api/v1/cases", params={"q": ch}, headers=investigator).json()
        everything = client.get("/api/v1/cases", headers=investigator).json()
        assert all(any(ch in (c.get(f) or "") for f in fields) for c in hits), ch
        assert len(hits) == sum(1 for c in everything if any(ch in (c.get(f) or "") for f in fields)), ch


def test_paging_parameters_are_validated(client, investigator):
    assert client.get("/api/v1/cases", params={"limit": 0}, headers=investigator).status_code == 422
    assert client.get("/api/v1/cases", params={"offset": -1}, headers=investigator).status_code == 422
    assert client.get("/api/v1/cases", params={"limit": 10_000}, headers=investigator).status_code == 422


def test_evidence_search_status_paging_and_summary(client, investigator, ingested):
    full = client.get("/api/v1/cases/CASE-0001/evidence", headers=investigator).json()
    calls = client.get("/api/v1/cases/CASE-0001/evidence", params={"q": "calls"}, headers=investigator)
    names = [e["filename"] for e in calls.json()]
    assert "calls.csv" in names and all("calls" in n.lower() for n in names)
    sha = next(e["sha256"] for e in full if e["filename"] == "calls.csv")
    assert [e["filename"] for e in client.get("/api/v1/cases/CASE-0001/evidence", params={"q": sha[:10]}, headers=investigator).json()] == ["calls.csv"]
    st = full[0]["status"]
    by_status = client.get("/api/v1/cases/CASE-0001/evidence", params={"status": st}, headers=investigator).json()
    assert by_status and all(e["status"] == st for e in by_status)
    page = client.get("/api/v1/cases/CASE-0001/evidence", params={"limit": 2, "offset": 2}, headers=investigator)
    assert [e["evidence_id"] for e in page.json()] == [e["evidence_id"] for e in full[2:4]]
    assert page.headers["X-Total-Count"] == str(len(full))
    summ = client.get("/api/v1/cases/CASE-0001/evidence/summary", headers=investigator).json()
    assert summ["total"] == len(full) and sum(summ["by_status"].values()) == len(full)


def test_evidence_listing_and_summary_denied_without_access(client, unassigned, ingested):
    assert client.get("/api/v1/cases/CASE-0001/evidence", params={"q": "calls"}, headers=unassigned).status_code == 403
    assert client.get("/api/v1/cases/CASE-0001/evidence/summary", headers=unassigned).status_code == 403


def test_candidate_search_paging_summary(client, investigator, ingested):
    full = client.get("/api/v1/cases/CASE-0001/candidates", headers=investigator).json()
    assert full
    name = full[0]["left"]["label"].split()[0]
    hits = client.get("/api/v1/cases/CASE-0001/candidates", params={"q": name}, headers=investigator)
    assert hits.json() and all(name.lower() in (c["left"]["label"] + c["right"]["label"]).lower() for c in hits.json())
    page = client.get("/api/v1/cases/CASE-0001/candidates", params={"limit": 2}, headers=investigator)
    assert len(page.json()) == min(2, len(full)) and page.headers["X-Total-Count"] == str(len(full))
    summ = client.get("/api/v1/cases/CASE-0001/candidates/summary", headers=investigator).json()
    assert summ["total"] == len(full)
    two = client.get("/api/v1/cases/CASE-0001/candidates", params={"state": "REVIEW_REQUIRED,DEFER"}, headers=investigator).json()
    assert {c["state"] for c in two} <= {"REVIEW_REQUIRED", "DEFER"}
    assert len(two) == summ["by_state"].get("REVIEW_REQUIRED", 0) + summ["by_state"].get("DEFER", 0)
    assert client.get("/api/v1/cases/CASE-0001/candidates/summary", headers={}).status_code == 401


def test_candidate_search_cannot_probe_masked_numbers(client, investigator, ingested):
    """A phone or account number is masked in every response; searching for it must not reveal that it exists.
    Deterministic: plant a candidate between a person and a phone, then search for the phone's digits."""
    from apps.api.app.db import SessionLocal
    from apps.api.app.models import Entity, MatchCandidate
    db = SessionLocal()
    try:
        person = Entity(kind="PERSON", label="Probe Person Zeta", canonical="probe person zeta")
        phone = Entity(kind="PHONE", label="+91 9000011122", canonical="+919000011122")
        db.add_all([person, phone]); db.flush()
        m = MatchCandidate(case_id="CASE-0001", left_entity_id=person.entity_id, right_entity_id=phone.entity_id,
                           state="REVIEW_REQUIRED", confidence=0.5, matcher_version="test", block_key="test",
                           positive_signals=[], counter_evidence=[], conflicts=[], missing=[], evidence_ids=[])
        db.add(m); db.commit()
        cid = m.candidate_id
    finally:
        db.close()
    try:
        by_number = client.get("/api/v1/cases/CASE-0001/candidates", params={"q": "9000011122"}, headers=investigator)
        assert by_number.status_code == 200 and cid not in [c["candidate_id"] for c in by_number.json()], "masked number was searchable"
        assert by_number.headers["X-Total-Count"] == "0"
        by_name = client.get("/api/v1/cases/CASE-0001/candidates", params={"q": "probe person zeta"}, headers=investigator)
        assert cid in [c["candidate_id"] for c in by_name.json()], "control: the person's name must still match"
    finally:
        db = SessionLocal()
        try:
            db.query(MatchCandidate).filter_by(candidate_id=cid).delete()
            db.query(Entity).filter(Entity.label.in_(["Probe Person Zeta", "+91 9000011122"])).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
