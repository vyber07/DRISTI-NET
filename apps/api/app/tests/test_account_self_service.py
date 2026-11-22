"""Self-service account endpoints (P2.3, routes/account_routes.py, docs/frontend/PROFILE.md).

Covers: the profile shows identity/organisation fields; only the display name is self-editable (role, office,
jurisdiction, user ID, username, status and unknown fields refused; spoofing characters refused); password change
(wrong / unchanged / username-as-password refused, lockout shared with sign-in, success revokes other sessions and old
tokens, the returned token works, the new password signs in); sessions (listed without raw session IDs, revoke one,
revoke others, cannot revoke the current one or someone else's); activity (own sign-ins, failed sign-ins naming the
username, administrators' changes); audit records; unauthenticated access refused.
"""
import uuid

import pytest

from apps.api.app.db import SessionLocal
from apps.api.app.models import AuditEvent, User, UserSession
from apps.api.app.services import ratelimit

API = "/api/v1"
PW = "Self-service-pass-1"


def _new_user(client, admin, role="ANALYST"):
    name = f"self{uuid.uuid4().hex[:8]}"
    r = client.post(f"{API}/users", headers=admin, json={"username": name, "display_name": f"Self {name}", "role": role,
                                                          "jurisdiction": "Demo District A", "office_id": "OFF-DDA",
                                                          "password": PW, "org_user_id": f"S-{uuid.uuid4().hex[:6].upper()}"})
    assert r.status_code == 201, r.text
    return r.json()


def _login(client, username, password=PW):
    r = client.post(f"{API}/auth/login", json={"username": username, "password": password})
    return r


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def me(client, admin):
    u = _new_user(client, admin)
    tok = _login(client, u["username"]).json()["token"]
    return u, _h(tok)


def _audit(action, target, outcome=None):
    with SessionLocal() as db:
        q = db.query(AuditEvent).filter_by(action=action, target_id=target)
        if outcome:
            q = q.filter_by(outcome=outcome)
        return q.order_by(AuditEvent.created_at.desc()).first()


# ------------------------------------------------------------------------------------------------ profile
def test_profile_shows_identity_and_organisation(client, me):
    u, h = me
    r = client.get(f"{API}/auth/me", headers=h).json()
    for k in ("user_id", "org_user_id", "username", "display_name", "role", "jurisdiction", "office_id", "active"):
        assert k in r, k
    assert r["office_id"] == "OFF-DDA" and r["org_user_id"] == u["org_user_id"] and r["active"] is True
    assert "password_hash" not in r and "token_version" not in r


def test_display_name_is_editable_and_audited(client, me):
    u, h = me
    r = client.patch(f"{API}/auth/me", headers=h, json={"display_name": "  Analyst   Karan  Singh "})
    assert r.status_code == 200, r.text
    assert r.json()["display_name"] == "Analyst Karan Singh"
    ev = _audit("PROFILE_UPDATE", u["user_id"])
    assert ev.detail["before"] == u["display_name"] and ev.detail["after"] == "Analyst Karan Singh"
    assert client.patch(f"{API}/auth/me", headers=h, json={"display_name": "Analyst Karan Singh"}).json()["code"] == "UNCHANGED"


@pytest.mark.parametrize("field,value", [("role", "ADMIN"), ("office_id", "OFF-XYZ"), ("jurisdiction", "Demo District B"),
                                         ("org_user_id", "HIJACK-1"), ("username", "admin2"), ("active", True),
                                         ("user_id", "USR-x"), ("token_version", 0)])
def test_protected_fields_cannot_be_changed(client, me, field, value):
    u, h = me
    r = client.patch(f"{API}/auth/me", headers=h, json={"display_name": "Fine Name", field: value})
    assert r.status_code == 422
    with SessionLocal() as db:
        row = db.get(User, u["user_id"])
        assert (row.role, row.office_id, row.jurisdiction, row.org_user_id, row.username) == (
            u["role"], "OFF-DDA", "Demo District A", u["org_user_id"], u["username"])
        assert row.display_name == u["display_name"]  # the whole request was refused


@pytest.mark.parametrize("bad", ["A", "x" * 121, "Admin‮evil", "Bell\x07char", "Zero​width", "   "])
def test_display_name_validation(client, me, bad):
    _, h = me
    assert client.patch(f"{API}/auth/me", headers=h, json={"display_name": bad}).status_code == 422


def test_display_name_whitespace_is_normalised(client, me):
    _, h = me
    r = client.patch(f"{API}/auth/me", headers=h, json={"display_name": "Tab\there  and\nnewline"})
    assert r.status_code == 200 and r.json()["display_name"] == "Tab here and newline"


def test_unauthenticated_requests_are_refused(client):
    assert client.patch(f"{API}/auth/me", json={"display_name": "Nobody Here"}).status_code == 401
    assert client.post(f"{API}/auth/me/password", json={"current_password": "x", "new_password": "longenough1"}).status_code == 401
    assert client.get(f"{API}/auth/me/sessions").status_code == 401
    assert client.get(f"{API}/auth/me/activity").status_code == 401


# ------------------------------------------------------------------------------------------------ password
def test_password_change_success_revokes_other_sessions(client, admin):
    u = _new_user(client, admin)
    t1 = _login(client, u["username"]).json()["token"]
    t2 = _login(client, u["username"]).json()["token"]          # another device
    r = client.post(f"{API}/auth/me/password", headers=_h(t1), json={"current_password": PW, "new_password": "Brand-new-pass-2"})
    assert r.status_code == 200, r.text
    assert r.json()["other_sessions_revoked"] == 1
    new = r.json()["token"]
    assert client.get(f"{API}/auth/me", headers=_h(new)).status_code == 200    # this session continues with the new token
    assert client.get(f"{API}/auth/me", headers=_h(t1)).status_code == 401     # old token of this session: stale tv
    assert client.get(f"{API}/auth/me", headers=_h(t2)).status_code == 401     # other session revoked
    assert _login(client, u["username"]).status_code == 401
    assert _login(client, u["username"], "Brand-new-pass-2").status_code == 200
    ev = _audit("PASSWORD_CHANGE", u["user_id"], "OK")
    assert ev is not None and "Brand-new" not in str(ev.detail) and PW not in str(ev.detail)


def test_password_change_refusals(client, me):
    u, h = me
    r = client.post(f"{API}/auth/me/password", headers=h, json={"current_password": "wrong-pass-1", "new_password": "Another-pass-3"})
    assert r.status_code == 400 and r.json()["code"] == "CURRENT_PASSWORD_INVALID"
    assert _audit("PASSWORD_CHANGE", u["user_id"], "DENIED").detail["reason"] == "current password incorrect"
    r = client.post(f"{API}/auth/me/password", headers=h, json={"current_password": PW, "new_password": PW})
    assert r.status_code == 422 and r.json()["code"] == "PASSWORD_UNCHANGED"
    r = client.post(f"{API}/auth/me/password", headers=h, json={"current_password": PW, "new_password": u["username"]})
    assert r.status_code == 422 and r.json()["code"] == "PASSWORD_WEAK"
    assert client.post(f"{API}/auth/me/password", headers=h, json={"current_password": PW, "new_password": "short"}).status_code == 422
    assert client.post(f"{API}/auth/me/password", headers=h, json={"current_password": PW, "new_password": "Another-pass-3",
                                                                  "username": "x"}).status_code == 422
    assert client.get(f"{API}/auth/me", headers=h).status_code == 200      # refusals did not end the session
    assert _login(client, u["username"]).status_code == 200               # and did not change the password


def test_wrong_current_password_shares_the_sign_in_lockout(client, admin):
    u = _new_user(client, admin)
    h = _h(_login(client, u["username"]).json()["token"])
    codes = [client.post(f"{API}/auth/me/password", headers=h, json={"current_password": f"bad-{i}-pass",
                                                                     "new_password": "Another-pass-3"}).status_code for i in range(8)]
    assert 429 in codes, codes          # the per-account, per-source limit applies as for sign-in
    assert codes[0] == 400
    ratelimit.reset_memory()


# ------------------------------------------------------------------------------------------------ sessions
def test_sessions_listed_without_raw_ids_and_revocable(client, admin):
    u = _new_user(client, admin)
    t1 = _login(client, u["username"]).json()["token"]
    t2 = _login(client, u["username"]).json()["token"]
    r = client.get(f"{API}/auth/me/sessions", headers=_h(t1)).json()["sessions"]
    assert len([s for s in r if s["status"] == "active"]) == 2
    assert sum(s["current"] for s in r) == 1
    with SessionLocal() as db:
        raw = {s.sid for s in db.query(UserSession).filter_by(user_id=u["user_id"]).all()}
    assert not any(s["id"] in raw for s in r), "raw session ids must never be returned"
    current = next(s for s in r if s["current"])
    other = next(s for s in r if not s["current"])
    resp = client.post(f"{API}/auth/me/sessions/{current['id']}/revoke", headers=_h(t1))
    assert resp.status_code == 409 and resp.json()["code"] == "CURRENT_SESSION"
    assert client.post(f"{API}/auth/me/sessions/{other['id']}/revoke", headers=_h(t1)).status_code == 200
    assert client.get(f"{API}/auth/me", headers=_h(t2)).status_code == 401
    assert client.get(f"{API}/auth/me", headers=_h(t1)).status_code == 200
    assert _audit("SESSION_REVOKE", u["user_id"]).detail["scope"] == "one"


def test_revoke_others_and_no_cross_user_revocation(client, admin):
    a, b = _new_user(client, admin), _new_user(client, admin)
    ta1, ta2 = _login(client, a["username"]).json()["token"], _login(client, a["username"]).json()["token"]
    tb = _login(client, b["username"]).json()["token"]
    b_sessions = client.get(f"{API}/auth/me/sessions", headers=_h(tb)).json()["sessions"]
    # a cannot revoke b's session, even knowing its public id
    assert client.post(f"{API}/auth/me/sessions/{b_sessions[0]['id']}/revoke", headers=_h(ta1)).status_code == 404
    assert client.get(f"{API}/auth/me", headers=_h(tb)).status_code == 200
    r = client.post(f"{API}/auth/me/sessions/revoke-others", headers=_h(ta1))
    assert r.status_code == 200 and r.json()["revoked"] == 1
    assert client.get(f"{API}/auth/me", headers=_h(ta2)).status_code == 401
    assert client.get(f"{API}/auth/me", headers=_h(ta1)).status_code == 200
    assert client.get(f"{API}/auth/me", headers=_h(tb)).status_code == 200


# ------------------------------------------------------------------------------------------------ activity
def test_activity_shows_own_security_events_only(client, admin):
    u = _new_user(client, admin)
    other = _new_user(client, admin)
    assert _login(client, u["username"], "wrong-password-1").status_code == 401
    h = _h(_login(client, u["username"]).json()["token"])
    _login(client, other["username"])                                       # someone else's sign-in
    client.patch(f"{API}/users/{u['user_id']}", headers=admin, json={"jurisdiction": "Demo District A"})
    ev = client.get(f"{API}/auth/me/activity", headers=h).json()["events"]
    kinds = [(e["action"], e["outcome"]) for e in ev]
    assert ("LOGIN", "OK") in kinds and ("LOGIN", "DENIED") in kinds and ("USER_UPDATE", "OK") in kinds
    assert next(e for e in ev if e["action"] == "USER_UPDATE")["by"] == "admin"
    assert next(e for e in ev if e["action"] == "LOGIN" and e["outcome"] == "DENIED")["reason"] == "bad credentials"
    with SessionLocal() as db:
        other_login = db.query(AuditEvent).filter_by(action="LOGIN", actor_id=other["user_id"]).first()
    assert other_login is not None
    assert all(e["at"] != other_login.created_at.isoformat() for e in ev if e["action"] == "LOGIN" and e["outcome"] == "OK" and e.get("by"))
    assert len([e for e in ev if e["action"] == "LOGIN" and e["outcome"] == "OK"]) == 1   # only u's own sign-in
