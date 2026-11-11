"""Case creation and assignment, as used by the new Cases and Overview screens."""
from datetime import datetime, timezone

GOOD = {"title": "Test creation case", "jurisdiction": "Demo District A", "purpose": "UI test of case creation", "authority_reference": "FIR-TEST-01"}


def test_investigator_creates_case_dated_today_and_owns_it(client, investigator):
    r = client.post("/api/v1/cases", json={"case_id": "CASE-T100", **GOOD}, headers=investigator)
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["opened_at"] == datetime.now(timezone.utc).date().isoformat(), "was always 2025-01-01"
    me = client.get("/api/v1/auth/me", headers=investigator).json()
    assert c["owner_id"] == me["user_id"] and [p["user_id"] for p in c["people"]] == [me["user_id"]]
    assert client.post("/api/v1/cases", json={"case_id": "CASE-T100", **GOOD}, headers=investigator).status_code == 409


def test_case_creation_refused_for_other_roles_and_other_jurisdictions(client, reviewer, outsider):
    assert client.post("/api/v1/cases", json={"case_id": "CASE-T101", **GOOD}, headers=reviewer).status_code == 403
    # outsider is an investigator in District B
    assert client.post("/api/v1/cases", json={"case_id": "CASE-T102", **GOOD}, headers=outsider).status_code == 403


def test_blank_or_missing_text_rejected(client, investigator):
    for field in ("title", "purpose", "authority_reference"):
        body = {"case_id": "CASE-T103", **GOOD, field: "   "}
        assert client.post("/api/v1/cases", json=body, headers=investigator).status_code == 422, field
    assert client.post("/api/v1/cases", json={"case_id": "bad id", **GOOD}, headers=investigator).status_code == 422


def test_owner_assigns_a_user_who_then_sees_the_case(client, investigator, reviewer):
    client.post("/api/v1/cases", json={"case_id": "CASE-T104", **GOOD}, headers=investigator)
    assert client.get("/api/v1/cases/CASE-T104", headers=reviewer).status_code == 403
    r = client.post("/api/v1/cases/CASE-T104/assign", json={"username": "reviewer", "purpose": "review"}, headers=investigator)
    assert r.status_code == 200 and any(p["role"] == "REVIEWER" for p in r.json()["people"])
    assert client.get("/api/v1/cases/CASE-T104", headers=reviewer).status_code == 200


def test_only_owner_or_admin_may_assign(client, investigator, reviewer):
    client.post("/api/v1/cases", json={"case_id": "CASE-T105", **GOOD}, headers=investigator)
    client.post("/api/v1/cases/CASE-T105/assign", json={"username": "reviewer"}, headers=investigator)
    # reviewer is now on the case but is not its owner
    assert client.post("/api/v1/cases/CASE-T105/assign", json={"username": "analyst"}, headers=reviewer).status_code == 403
    assert client.post("/api/v1/cases/CASE-T105/assign", json={"username": "no-such-user"}, headers=investigator).status_code == 404


def test_assign_refuses_a_different_jurisdiction(client, investigator, outsider):
    """BUG-NEW-10: previously this recorded the assignment, then authorize_case() silently refused
    the outsider the next time they tried to actually open the case -- a misleading success."""
    client.post("/api/v1/cases", json={"case_id": "CASE-T106", **GOOD}, headers=investigator)  # Demo District A
    r = client.post("/api/v1/cases/CASE-T106/assign", json={"username": "outsider"}, headers=investigator)  # District B
    assert r.status_code == 400
    assert client.get("/api/v1/cases/CASE-T106", headers=outsider).status_code == 403


def test_assign_refuses_a_deactivated_user(client, admin, investigator):
    created = client.post("/api/v1/users", json={"username": "assign-deactivated", "display_name": "Deactivated",
                                                   "role": "ANALYST", "jurisdiction": "Demo District A",
                                                   "password": "assign-deactivated1"}, headers=admin).json()
    client.post(f"/api/v1/users/{created['user_id']}/deactivate", headers=admin)
    client.post("/api/v1/cases", json={"case_id": "CASE-T107", **GOOD}, headers=investigator)
    r = client.post("/api/v1/cases/CASE-T107/assign", json={"username": "assign-deactivated"}, headers=investigator)
    assert r.status_code == 400
