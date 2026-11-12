"""Administrator case assignment (services/case_assignments.py, ADR-020, docs/CASE_ASSIGNMENT.md).

Covers: assignment with reason, history, audit and notification; eligibility (role, deactivated, cross-jurisdiction);
unassigned users; removal and immediate loss of access (also through other case endpoints with the same token);
handover of the primary investigator (KEEP / REMOVE, stale expectation, wrong role); concurrent changes; direct API
bypass by non-administrators; oversight listing and indicators; append-only history.
Each test creates its own case and users.
"""
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import text

from apps.api.app.db import SessionLocal
from apps.api.app.models import AuditEvent, Case, CaseAssignment, CaseAssignmentEvent, Notification

API = "/api/v1"
REASON = "Needed for the financial trail analysis."
PW = "Case-assign-pass-1"


def _user(client, admin, role="INVESTIGATOR", jurisdiction="Demo District A"):
    name = f"ca{role[:3].lower()}{uuid.uuid4().hex[:8]}"
    r = client.post(f"{API}/users", headers=admin, json={"username": name, "display_name": f"Test {name}", "role": role,
                                                          "jurisdiction": jurisdiction, "password": PW})
    assert r.status_code == 201, r.text
    tok = client.post(f"{API}/auth/login", json={"username": name, "password": PW}).json()["token"]
    return {"Authorization": f"Bearer {tok}"}, r.json()


def _case(client, owner_headers):
    cid = f"CASE-A{uuid.uuid4().hex[:8].upper()}"
    r = client.post(f"{API}/cases", headers=owner_headers, json={"case_id": cid, "title": "Assignment test",
                                                                 "jurisdiction": "Demo District A", "purpose": "test",
                                                                 "authority_reference": "FIR-TEST-CA"})
    assert r.status_code == 201, r.text
    return cid


def _assign(client, headers, cid, user, reason=REASON, purpose="analysis"):
    return client.post(f"{API}/cases/{cid}/assign", headers=headers,
                       json={"user_id": user["user_id"], "purpose": purpose, "reason": reason})


def _remove(client, headers, cid, user_id, reason=REASON):
    return client.post(f"{API}/cases/{cid}/assignments/{user_id}/remove", headers=headers, json={"reason": reason})


def _primary(client, headers, cid, user_id, expected, previous="KEEP", reason=REASON):
    return client.post(f"{API}/cases/{cid}/primary", headers=headers,
                       json={"user_id": user_id, "expected_primary_id": expected, "reason": reason, "previous": previous})


def _code(r):
    return r.json().get("code")


def _events(cid):
    with SessionLocal() as db:
        return [(e.event, e.user_id) for e in db.query(CaseAssignmentEvent).filter_by(case_id=cid)
                .order_by(CaseAssignmentEvent.at, CaseAssignmentEvent.event_id).all()]


@pytest.fixture()
def team(client, admin):
    """A fresh case owned by a fresh investigator, plus a second investigator and an analyst (not yet assigned)."""
    lead_h, lead = _user(client, admin)
    inv2_h, inv2 = _user(client, admin)
    ana_h, ana = _user(client, admin, role="ANALYST")
    cid = _case(client, lead_h)
    return {"cid": cid, "lead": (lead_h, lead), "inv2": (inv2_h, inv2), "ana": (ana_h, ana)}


# ------------------------------------------------------------------------------------------------ assign
def test_creation_records_primary_and_history(client, team):
    cid, (_, lead) = team["cid"], team["lead"]
    assert _events(cid) == [("ASSIGNED", lead["user_id"]), ("PRIMARY_SET", lead["user_id"])]
    with SessionLocal() as db:
        row = db.query(CaseAssignment).filter_by(case_id=cid, user_id=lead["user_id"]).one()
        assert row.assigned_by == lead["user_id"] and row.reason == "case created"


def test_admin_assigns_with_reason_history_audit_and_notification(client, admin, team):
    cid, (ana_h, ana) = team["cid"], team["ana"]
    assert client.get(f"{API}/cases/{cid}", headers=ana_h).status_code == 403
    r = _assign(client, admin, cid, ana)
    assert r.status_code == 200, r.text
    assert client.get(f"{API}/cases/{cid}", headers=ana_h).status_code == 200
    assert _events(cid)[-1] == ("ASSIGNED", ana["user_id"])
    with SessionLocal() as db:
        row = db.query(CaseAssignment).filter_by(case_id=cid, user_id=ana["user_id"]).one()
        assert row.reason == REASON and row.assigned_at is not None
        ev = db.query(AuditEvent).filter_by(action="CASE_ASSIGN", target_id=ana["user_id"], case_id=cid).one()
        assert ev.detail["reason"] == REASON
    notes = client.get(f"{API}/notifications", headers=ana_h).json()
    items = notes["items"] if isinstance(notes, dict) else notes
    assert any(n["kind"] == "CASE_ASSIGNED" and n["link"] == f"/cases/{cid}" for n in items)


def test_primary_investigator_may_still_add_people(client, team):
    cid, (lead_h, _), (_, ana) = team["cid"], team["lead"], team["ana"]
    assert _assign(client, lead_h, cid, ana).status_code == 200


def test_assignment_validation(client, admin, auditor, team):
    cid, (_, ana) = team["cid"], team["ana"]
    assert _code(_assign(client, admin, cid, ana, reason="")) == "REASON_REQUIRED"
    assert _assign(client, admin, cid, ana, reason="no").status_code == 422
    assert _assign(client, admin, cid, ana).status_code == 200
    r = _assign(client, admin, cid, ana)
    assert r.status_code == 409 and _code(r) == "ALREADY_ASSIGNED"
    for role in ("ADMIN", "AUDITOR"):
        _, u = _user(client, admin, role=role)
        r = _assign(client, admin, cid, u)
        assert r.status_code == 400 and _code(r) == "ROLE_NOT_ASSIGNABLE"
    r = client.post(f"{API}/cases/{cid}/assign", headers=admin, json={"reason": REASON})
    assert r.status_code == 422  # neither username nor user_id


def test_cross_jurisdiction_and_deactivated_refused(client, admin, outsider, team):
    cid = team["cid"]
    out_h, out = _user(client, admin, jurisdiction="Demo District B")
    r = _assign(client, admin, cid, out)
    assert r.status_code == 400 and _code(r) == "JURISDICTION_MISMATCH"
    assert client.get(f"{API}/cases/{cid}", headers=out_h).status_code == 403
    _, gone = _user(client, admin, role="ANALYST")
    client.post(f"{API}/users/{gone['user_id']}/deactivate", headers=admin)
    assert _code(_assign(client, admin, cid, gone)) == "USER_INACTIVE"


def test_unassigned_users_cannot_reach_the_case(client, unassigned, team):
    cid = team["cid"]
    for path in (f"/cases/{cid}", f"/cases/{cid}/evidence", f"/cases/{cid}/graph"):
        assert client.get(f"{API}{path}", headers=unassigned).status_code == 403, path


# ------------------------------------------------------------------------------------------------ remove
def test_removal_revokes_access_immediately_on_every_case_endpoint(client, admin, team):
    cid, (ana_h, ana) = team["cid"], team["ana"]
    _assign(client, admin, cid, ana)
    for path in (f"/cases/{cid}", f"/cases/{cid}/evidence", f"/cases/{cid}/graph"):
        assert client.get(f"{API}{path}", headers=ana_h).status_code == 200, path
    r = _remove(client, admin, cid, ana["user_id"])
    assert r.status_code == 200 and r.json()["access_remains_via_override"] is False
    for path in (f"/cases/{cid}", f"/cases/{cid}/evidence", f"/cases/{cid}/graph"):  # same token, next request
        assert client.get(f"{API}{path}", headers=ana_h).status_code == 403, path
    assert cid not in [c["case_id"] for c in client.get(f"{API}/cases", headers=ana_h).json()]
    assert cid not in client.get(f"{API}/auth/me", headers=ana_h).json()["assigned_cases"]
    assert _events(cid)[-1] == ("REMOVED", ana["user_id"])
    with SessionLocal() as db:
        assert db.query(Notification).filter_by(user_id=ana["user_id"], kind="CASE_REMOVED").count() == 1
        assert db.query(AuditEvent).filter_by(action="CASE_UNASSIGN", target_id=ana["user_id"], case_id=cid).count() == 1
    r = _remove(client, admin, cid, ana["user_id"])
    assert r.status_code == 409 and _code(r) == "NOT_ASSIGNED"


def test_primary_cannot_be_removed(client, admin, team):
    cid, (_, lead) = team["cid"], team["lead"]
    r = _remove(client, admin, cid, lead["user_id"])
    assert r.status_code == 409 and _code(r) == "PRIMARY_CANNOT_BE_REMOVED"


# ------------------------------------------------------------------------------------------------ handover
def test_handover_keep_and_remove(client, admin, team):
    cid, (lead_h, lead), (inv2_h, inv2) = team["cid"], team["lead"], team["inv2"]
    r = _primary(client, admin, cid, inv2["user_id"], lead["user_id"], previous="KEEP")
    assert r.status_code == 200, r.text
    with SessionLocal() as db:
        assert db.get(Case, cid).owner_id == inv2["user_id"]
    for h in (lead_h, inv2_h):
        assert client.get(f"{API}/cases/{cid}", headers=h).status_code == 200
    people = {p["user_id"]: p for p in client.get(f"{API}/cases/{cid}", headers=admin).json()["people"]}
    assert people[inv2["user_id"]]["is_owner"] and not people[lead["user_id"]]["is_owner"]
    # the former primary is now a supporting member: can no longer add people
    _, ana = team["ana"]
    assert _assign(client, lead_h, cid, ana).status_code == 403
    # hand back with REMOVE: inv2 loses access entirely
    r = _primary(client, admin, cid, lead["user_id"], inv2["user_id"], previous="REMOVE")
    assert r.status_code == 200
    assert client.get(f"{API}/cases/{cid}", headers=inv2_h).status_code == 403
    lid, iid = lead["user_id"], inv2["user_id"]
    assert _events(cid) == [("ASSIGNED", lid), ("PRIMARY_SET", lid),                              # creation
                            ("ASSIGNED", iid), ("PRIMARY_SET", iid), ("PRIMARY_RELEASED", lid),   # hand over, KEEP
                            ("PRIMARY_SET", lid), ("PRIMARY_RELEASED", iid), ("REMOVED", iid)]    # hand back, REMOVE


def test_handover_rules(client, admin, team):
    cid, (_, lead), (_, inv2), (_, ana) = team["cid"], team["lead"], team["inv2"], team["ana"]
    r = _primary(client, admin, cid, inv2["user_id"], "USR-someoneelse")
    assert r.status_code == 409 and _code(r) == "PRIMARY_CHANGED"
    r = _primary(client, admin, cid, ana["user_id"], lead["user_id"])
    assert r.status_code == 400 and _code(r) == "PRIMARY_ROLE_REQUIRED"
    r = _primary(client, admin, cid, lead["user_id"], lead["user_id"])
    assert r.status_code == 409 and _code(r) == "ALREADY_PRIMARY"
    _, out = _user(client, admin, jurisdiction="Demo District B")
    assert _code(_primary(client, admin, cid, out["user_id"], lead["user_id"])) == "JURISDICTION_MISMATCH"
    assert _primary(client, admin, cid, inv2["user_id"], lead["user_id"], reason="").status_code == 422
    assert _primary(client, admin, cid, inv2["user_id"], lead["user_id"], previous="DROP").status_code == 422
    assert _primary(client, admin, cid, "USR-doesnotexist", lead["user_id"]).status_code == 404


# ------------------------------------------------------------------------------------------------ authorization
def test_non_admins_cannot_remove_or_hand_over(client, admin, auditor, team):
    cid, (lead_h, lead), (inv2_h, inv2), (ana_h, ana) = team["cid"], team["lead"], team["inv2"], team["ana"]
    _assign(client, admin, cid, ana)
    for h in (lead_h, ana_h, inv2_h, auditor):
        assert _remove(client, h, cid, ana["user_id"]).status_code == 403
        assert _primary(client, h, cid, inv2["user_id"], lead["user_id"]).status_code == 403
    # a supporting member cannot add people, and a non-member cannot even reach the case
    assert _assign(client, ana_h, cid, inv2).status_code == 403
    assert _assign(client, inv2_h, cid, inv2).status_code == 403
    with SessionLocal() as db:
        assert db.get(Case, cid).owner_id == lead["user_id"]
        assert db.query(CaseAssignment).filter_by(case_id=cid, user_id=ana["user_id"]).count() == 1


def test_oversight_views(client, admin, auditor, investigator, team):
    cid, (_, ana) = team["cid"], team["ana"]
    for h in (admin, auditor):
        d = client.get(f"{API}/cases/{cid}/assignments", headers=h)
        assert d.status_code == 200
        assert d.json()["primary"]["user_id"] == team["lead"][1]["user_id"]
        assert "NO_SUPPORTING_MEMBERS" in d.json()["issues"]
        lst = client.get(f"{API}/case-assignments", headers=h, params={"q": cid, "unstaffed": True})
        assert lst.status_code == 200 and [c["case_id"] for c in lst.json()] == [cid]
        assert lst.headers["X-Total-Count"] == "1"
    assert client.get(f"{API}/cases/{cid}/assignments", headers=investigator).status_code == 403
    assert client.get(f"{API}/case-assignments", headers=investigator).status_code == 403
    # an assigned member who is deactivated is flagged, and the case needs attention
    _assign(client, admin, cid, ana)
    client.post(f"{API}/users/{ana['user_id']}/deactivate", headers=admin)
    d = client.get(f"{API}/cases/{cid}/assignments", headers=admin).json()
    assert {m["user_id"]: m["access"] for m in d["members"]}[ana["user_id"]] == "DEACTIVATED"
    assert "MEMBER_ACCESS_BLOCKED" in d["issues"]
    att = client.get(f"{API}/case-assignments", headers=admin, params={"q": cid, "attention": True}).json()
    assert [c["case_id"] for c in att] == [cid]
    hist = d["history"]
    assert hist[0]["event"] == "ASSIGNED" and hist[0]["reason"] == REASON and hist[0]["actor_username"] == "admin"


def test_listing_search_escapes_wildcards(client, admin):
    assert client.get(f"{API}/case-assignments", headers=admin, params={"q": "%"}).json() == []


# ------------------------------------------------------------------------------------------------ concurrency
def test_concurrent_assignment_of_one_person_only_one_wins(client, admin, team):
    cid, (_, ana) = team["cid"], team["ana"]
    with ThreadPoolExecutor(6) as pool:
        results = list(pool.map(lambda _: _assign(client, admin, cid, ana), range(6)))
    assert sum(r.status_code == 200 for r in results) == 1, [r.status_code for r in results]
    assert all(_code(r) == "ALREADY_ASSIGNED" for r in results if r.status_code != 200)
    with SessionLocal() as db:
        assert db.query(CaseAssignment).filter_by(case_id=cid, user_id=ana["user_id"]).count() == 1
    assert [e for e, u in _events(cid) if u == ana["user_id"]] == ["ASSIGNED"]


def test_concurrent_handovers_only_one_wins(client, admin, team):
    cid, (_, lead) = team["cid"], team["lead"]
    others = [_user(client, admin)[1] for _ in range(4)]
    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(lambda u: _primary(client, admin, cid, u["user_id"], lead["user_id"]), others))
    assert sum(r.status_code == 200 for r in results) == 1, [r.status_code for r in results]
    assert all(_code(r) == "PRIMARY_CHANGED" for r in results if r.status_code != 200)
    with SessionLocal() as db:
        owner = db.get(Case, cid).owner_id
        assert db.query(CaseAssignment).filter_by(case_id=cid, user_id=owner).count() == 1


def test_concurrent_remove_only_one_wins(client, admin, team):
    cid, (_, ana) = team["cid"], team["ana"]
    _assign(client, admin, cid, ana)
    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(lambda _: _remove(client, admin, cid, ana["user_id"]), range(4)))
    assert sum(r.status_code == 200 for r in results) == 1
    assert [e for e, u in _events(cid) if u == ana["user_id"]] == ["ASSIGNED", "REMOVED"]


# ------------------------------------------------------------------------------------------------ integrity
def test_history_is_append_only(client, team):
    cid = team["cid"]
    for sql in ("UPDATE case_assignment_events SET reason = 'rewritten' WHERE case_id = :c",
                "DELETE FROM case_assignment_events WHERE case_id = :c"):
        with SessionLocal() as db:
            with pytest.raises(Exception):
                db.execute(text(sql), {"c": cid})
                db.commit()
    assert len(_events(cid)) == 2
