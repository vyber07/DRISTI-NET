"""Organisational user ID allocation (services/org_user_ids.py, ADR-019, docs/USER_ID_ALLOCATION.md).

Covers: allocation at creation and later, validation and normalisation, duplicates (also case-insensitive), no reuse of
retired IDs, corrections and their window, compare-and-set staleness, concurrent assignments, authorization boundaries
(non-admins, auditors, self-change), the PATCH bypass, registry immutability against direct SQL, history and lookup,
audit records, and that the internal user_id and everything referencing it never change.
Each test creates its own users and IDs, so tests do not depend on each other.
"""
import datetime
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import text

from apps.api.app import config
from apps.api.app.db import SessionLocal
from apps.api.app.models import AuditEvent, CaseAssignment, OrgUserIdAssignment, User
from apps.api.app.services import org_user_ids

API = "/api/v1"
REASON = "Service number issued by the personnel office."


def _oid(prefix="T"):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def _create(client, admin, org_user_id=None, role="ANALYST", expect=201):
    name = f"oid{uuid.uuid4().hex[:10]}"
    body = {"username": name, "display_name": f"Test {name}", "role": role, "jurisdiction": "Demo District A",
            "password": "Org-id-test-pass-1"}
    if org_user_id is not None:
        body["org_user_id"] = org_user_id
    r = client.post(f"{API}/users", headers=admin, json=body)
    assert r.status_code == expect, r.text
    return r.json() if expect == 201 else (r, name)


def _login(client, username):
    r = client.post(f"{API}/auth/login", json={"username": username, "password": "Org-id-test-pass-1"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _assign(client, headers, user_id, org_user_id, current, reason=REASON, correction=False):
    return client.put(f"{API}/users/{user_id}/org-user-id", headers=headers,
                      json={"org_user_id": org_user_id, "current_org_user_id": current, "reason": reason,
                            "correction": correction})


def _retire(client, headers, user_id, current, reason=REASON):
    return client.post(f"{API}/users/{user_id}/org-user-id/retire", headers=headers,
                       json={"current_org_user_id": current, "reason": reason})


def _code(r):
    return r.json().get("code")


def _audit(action, target):
    with SessionLocal() as db:
        return db.query(AuditEvent).filter_by(action=action, target_id=target).order_by(AuditEvent.created_at.desc()).first()


@pytest.fixture(scope="module")
def admin2(client, admin):
    u = _create(client, admin, role="ADMIN")
    return _login(client, u["username"]), u


# ------------------------------------------------------------------------------------------------ allocation
def test_allocate_at_creation_normalises_and_records(client, admin):
    raw = _oid("dl").lower()
    u = _create(client, admin, org_user_id=f"  {raw}  ")
    assert u["org_user_id"] == raw.upper()
    assert u["user_id"].startswith("USR-")  # internal key unchanged in form
    me = client.get(f"{API}/auth/me", headers=_login(client, u["username"])).json()
    assert me["org_user_id"] == raw.upper() and me["user_id"] == u["user_id"]
    with SessionLocal() as db:
        rows = db.query(OrgUserIdAssignment).filter_by(user_id=u["user_id"]).all()
    assert [(r.org_user_id, r.status) for r in rows] == [(raw.upper(), "ACTIVE")]
    assert _audit("USER_CREATE", u["user_id"]).detail["org_user_id"] == raw.upper()


def test_missing_id_means_not_allocated_and_can_be_assigned_later(client, admin):
    u = _create(client, admin)
    assert u["org_user_id"] is None
    new = _oid()
    r = _assign(client, admin, u["user_id"], new, None)
    assert r.status_code == 200, r.text
    assert r.json()["org_user_id"] == new and r.json()["previous_org_user_id"] is None
    assert r.json()["user"]["org_user_id"] == new
    ev = _audit("USER_ID_ASSIGN", u["user_id"])
    assert ev is not None and ev.detail["org_user_id"] == new and ev.detail["reason"] == REASON


@pytest.mark.parametrize("bad", ["AB", "X" * 33, "USR-1234", "usr-abcd", "-ABC1", "ABC1-", "AB--12", "AB 12", "AB_12",
                                 "ÄBC12", "AB/12", "' OR 1=1"])
def test_invalid_ids_rejected_on_assign_and_create_leaves_no_account(client, admin, bad):
    u = _create(client, admin)
    r = _assign(client, admin, u["user_id"], bad, None)
    assert r.status_code == 422, (bad, r.text)
    (r, name) = _create(client, admin, org_user_id=bad, expect=422)
    with SessionLocal() as db:
        assert db.query(User).filter_by(username=name).first() is None  # the whole creation rolled back


def test_duplicate_ids_rejected_case_insensitively(client, admin):
    oid = _oid()
    holder = _create(client, admin, org_user_id=oid)
    other = _create(client, admin)
    r = _assign(client, admin, other["user_id"], oid.lower(), None)
    assert r.status_code == 409 and _code(r) == "ORG_USER_ID_IN_USE"
    (r, name) = _create(client, admin, org_user_id=oid, expect=409)
    with SessionLocal() as db:
        assert db.query(User).filter_by(username=name).first() is None
    # assigning the holder the ID it already has is refused, not silently "succeeded"
    r = _assign(client, admin, holder["user_id"], oid, oid)
    assert r.status_code == 409 and _code(r) == "ORG_USER_ID_UNCHANGED"


# ------------------------------------------------------------------------------------------------ no reuse
def test_changed_id_is_retired_and_never_reusable(client, admin):
    old, new = _oid(), _oid()
    u = _create(client, admin, org_user_id=old)
    r = _assign(client, admin, u["user_id"], new, old)
    assert r.status_code == 200 and r.json()["previous_status"] == "RETIRED"
    assert _audit("USER_ID_CHANGE", u["user_id"]).detail["previous_org_user_id"] == old
    other = _create(client, admin)
    for target, current in ((other["user_id"], None), (u["user_id"], new)):  # neither someone else nor the old holder
        r = _assign(client, admin, target, old, current)
        assert r.status_code == 409 and _code(r) == "ORG_USER_ID_RETIRED", r.text
    assert _create(client, admin, org_user_id=old, expect=409)[0].json()["code"] == "ORG_USER_ID_RETIRED"


def test_retire_without_replacement(client, admin):
    oid = _oid()
    u = _create(client, admin, org_user_id=oid)
    r = _retire(client, admin, u["user_id"], oid)
    assert r.status_code == 200 and r.json()["user"]["org_user_id"] is None
    assert _audit("USER_ID_RETIRE", u["user_id"]).detail["org_user_id"] == oid
    assert _retire(client, admin, u["user_id"], None).json()["code"] == "ORG_USER_ID_NONE"
    assert _code(_assign(client, admin, u["user_id"], oid, None)) == "ORG_USER_ID_RETIRED"
    # a fresh ID can still be allocated afterwards
    assert _assign(client, admin, u["user_id"], _oid(), None).status_code == 200


# ------------------------------------------------------------------------------------------------ corrections
def test_correction_voids_the_mistaken_id_so_its_rightful_holder_can_get_it(client, admin):
    mistaken, right = _oid(), _oid()
    wrong_holder = _create(client, admin, org_user_id=mistaken)
    r = _assign(client, admin, wrong_holder["user_id"], right, mistaken, reason="Typo at creation", correction=True)
    assert r.status_code == 200 and r.json()["previous_status"] == "VOIDED"
    assert _audit("USER_ID_CORRECT", wrong_holder["user_id"]) is not None
    rightful = _create(client, admin)
    assert _assign(client, admin, rightful["user_id"], mistaken, None).status_code == 200
    lookup = client.get(f"{API}/org-user-ids/{mistaken.lower()}", headers=admin).json()
    assert [(a["user_id"], a["status"]) for a in lookup["allocations"]] == [
        (rightful["user_id"], "ACTIVE"), (wrong_holder["user_id"], "VOIDED")]


def test_correction_limits(client, admin, monkeypatch):
    u = _create(client, admin)
    r = _assign(client, admin, u["user_id"], _oid(), None, correction=True)
    assert r.status_code == 422 and _code(r) == "CORRECTION_NOT_APPLICABLE"

    oid = _oid()
    assert _assign(client, admin, u["user_id"], oid, None).status_code == 200
    later = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(
        hours=config.ORG_USER_ID_CORRECTION_HOURS + 1)
    monkeypatch.setattr(org_user_ids, "_now", lambda: later)
    r = _assign(client, admin, u["user_id"], _oid(), oid, correction=True)
    assert r.status_code == 422 and _code(r) == "CORRECTION_WINDOW_PASSED"
    monkeypatch.undo()

    monkeypatch.setattr(config, "ORG_USER_ID_CORRECTION_HOURS", 0)
    r = _assign(client, admin, u["user_id"], _oid(), oid, correction=True)
    assert r.status_code == 422 and _code(r) == "CORRECTION_DISABLED"
    # nothing changed by the refused attempts
    assert client.get(f"{API}/users/{u['user_id']}/org-user-id/history", headers=admin).json()["org_user_id"] == oid


# ------------------------------------------------------------------------------------------------ concurrency
def test_stale_expected_value_is_refused(client, admin):
    oid = _oid()
    u = _create(client, admin, org_user_id=oid)
    r = _assign(client, admin, u["user_id"], _oid(), None)          # caller thinks there is none
    assert r.status_code == 409 and _code(r) == "ORG_USER_ID_STALE"
    r = _assign(client, admin, u["user_id"], _oid(), _oid())        # caller thinks it is something else
    assert r.status_code == 409 and _code(r) == "ORG_USER_ID_STALE"
    r = client.put(f"{API}/users/{u['user_id']}/org-user-id", headers=admin, json={"org_user_id": _oid(), "reason": REASON})
    assert r.status_code == 422  # current_org_user_id must be stated explicitly


def test_concurrent_assignments_to_one_user_only_one_wins(client, admin):
    u = _create(client, admin)
    candidates = [_oid() for _ in range(8)]
    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(lambda o: _assign(client, admin, u["user_id"], o, None), candidates))
    ok = [r for r in results if r.status_code == 200]
    assert len(ok) == 1, [r.status_code for r in results]
    assert all(r.status_code == 409 for r in results if r.status_code != 200)
    with SessionLocal() as db:
        active = db.query(OrgUserIdAssignment).filter_by(user_id=u["user_id"], status="ACTIVE").all()
        assert len(active) == 1 and db.get(User, u["user_id"]).org_user_id == active[0].org_user_id


def test_concurrent_assignment_of_one_id_to_many_users_only_one_wins(client, admin):
    users = [_create(client, admin) for _ in range(6)]
    oid = _oid()
    with ThreadPoolExecutor(6) as pool:
        results = list(pool.map(lambda u: _assign(client, admin, u["user_id"], oid, None), users))
    assert sum(r.status_code == 200 for r in results) == 1, [r.status_code for r in results]
    with SessionLocal() as db:
        assert db.query(User).filter_by(org_user_id=oid).count() == 1
        assert db.query(OrgUserIdAssignment).filter_by(org_user_id=oid).count() == 1


# ------------------------------------------------------------------------------------------------ authorization
def test_only_admins_allocate_and_never_their_own(client, admin, admin2, investigator, reviewer, auditor):
    u = _create(client, admin)
    for headers in (investigator, reviewer, auditor):
        assert _assign(client, headers, u["user_id"], _oid(), None).status_code == 403
        assert _retire(client, headers, u["user_id"], None).status_code == 403
    headers2, admin2_user = admin2
    r = _assign(client, headers2, admin2_user["user_id"], _oid(), None)
    assert r.status_code == 403 and _code(r) == "SELF_CHANGE_FORBIDDEN"
    assert _retire(client, headers2, admin2_user["user_id"], None).status_code == 403
    # another administrator may
    assert _assign(client, admin, admin2_user["user_id"], _oid(), None).status_code == 200
    assert _assign(client, admin, "USR-doesnotexist", _oid(), None).status_code == 404


def test_patch_cannot_change_the_id(client, admin):
    oid = _oid()
    u = _create(client, admin, org_user_id=oid)
    r = client.patch(f"{API}/users/{u['user_id']}", headers=admin, json={"org_user_id": _oid()})
    assert r.status_code == 422
    r = client.patch(f"{API}/users/{u['user_id']}", headers=admin, json={"user_id": "USR-hijack"})
    assert r.status_code == 422
    with SessionLocal() as db:
        assert db.get(User, u["user_id"]).org_user_id == oid


def test_history_and_lookup_are_oversight_only(client, admin, auditor, investigator, officer):
    old, new = _oid(), _oid()
    u = _create(client, admin, org_user_id=old)
    _assign(client, admin, u["user_id"], new, old)
    for headers in (admin, auditor):
        h = client.get(f"{API}/users/{u['user_id']}/org-user-id/history", headers=headers)
        assert h.status_code == 200
        rows = h.json()["history"]
        assert [(r["org_user_id"], r["status"]) for r in rows] == [(new, "ACTIVE"), (old, "RETIRED")]
        assert rows[1]["ended_by_username"] == "admin" and rows[1]["end_reason"] == REASON
        assert rows[1]["assign_reason"] == org_user_ids.CREATION_REASON
        assert client.get(f"{API}/org-user-ids/{old}", headers=headers).json()["allocations"][0]["user_id"] == u["user_id"]
    for headers in (investigator, officer):
        assert client.get(f"{API}/users/{u['user_id']}/org-user-id/history", headers=headers).status_code == 403
        assert client.get(f"{API}/org-user-ids/{old}", headers=headers).status_code == 403
    assert client.get(f"{API}/org-user-ids/NOPE-NOPE", headers=admin).json()["allocations"] == []


# ------------------------------------------------------------------------------------------------ integrity
def test_registry_rows_cannot_be_rewritten_or_deleted(client, admin):
    oid = _oid()
    u = _create(client, admin, org_user_id=oid)
    _retire(client, admin, u["user_id"], oid)
    for sql in ("UPDATE org_user_ids SET org_user_id = 'HIJACK-1' WHERE org_user_id = :o",
                "UPDATE org_user_ids SET status = 'VOIDED' WHERE org_user_id = :o",   # RETIRED -> VOIDED would free it
                "UPDATE org_user_ids SET status = 'ACTIVE', ended_at = NULL WHERE org_user_id = :o",
                "DELETE FROM org_user_ids WHERE org_user_id = :o"):
        with SessionLocal() as db:
            with pytest.raises(Exception):
                db.execute(text(sql), {"o": oid})
                db.commit()
    with SessionLocal() as db:
        row = db.query(OrgUserIdAssignment).filter_by(org_user_id=oid).one()
        assert row.status == "RETIRED" and row.user_id == u["user_id"]


def test_internal_key_and_relationships_survive_changes(client, admin):
    oid = _oid()
    u = _create(client, admin, org_user_id=oid, role="INVESTIGATOR")
    assert client.post(f"{API}/cases/CASE-0001/assign", headers=admin,
                       json={"username": u["username"], "purpose": "investigation"}).status_code in (200, 201)
    new = _oid()
    assert _assign(client, admin, u["user_id"], new, oid).status_code == 200
    with SessionLocal() as db:
        assert db.query(CaseAssignment).filter_by(case_id="CASE-0001", user_id=u["user_id"]).count() == 1
    headers = _login(client, u["username"])  # login is by username, unaffected
    me = client.get(f"{API}/auth/me", headers=headers).json()
    assert me["user_id"] == u["user_id"] and me["org_user_id"] == new and "CASE-0001" in me["assigned_cases"]
    people = client.get(f"{API}/cases/CASE-0001", headers=admin).json()["people"]
    assert {"user_id": u["user_id"], "org_user_id": new} == {k: p[k] for p in people if p["user_id"] == u["user_id"]
                                                              for k in ("user_id", "org_user_id")}


def test_demo_accounts_are_seeded_with_ids_and_listed(client, admin):
    users = {u["username"]: u for u in client.get(f"{API}/users", headers=admin).json()}
    assert users["admin"]["org_user_id"] == "DDA-1006" and users["outsider"]["org_user_id"] == "DDB-2001"
    assert all("org_user_id" in u for u in users.values())


def test_denied_attempts_are_audited(client, admin, investigator):
    u = _create(client, admin)
    _assign(client, investigator, u["user_id"], _oid(), None)
    with SessionLocal() as db:
        ev = (db.query(AuditEvent).filter_by(action="ACCESS_DENIED", outcome="DENIED")
              .order_by(AuditEvent.created_at.desc()).first())
    assert ev is not None and ev.target_id == f"PUT /api/v1/users/{u['user_id']}/org-user-id"
