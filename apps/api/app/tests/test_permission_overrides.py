"""Administrator-controlled permission overrides.

Governance (who may create/approve/revoke, self-approval, self-revocation), input rules, deterministic precedence
(DENY over role, DENY over ALLOW), scheduled/expired/revoked overrides, cross-case scope, mandatory restrictions
(jurisdiction, non-overridable actions, ADMIN never gains reveal), direct API and database bypass attempts, history
immutability, audit content, and the effective-permissions endpoint used by the frontend.
"""
import datetime
import time

import pytest
from sqlalchemy import text

from apps.api.app import db as db_module
from apps.api.app.db import SessionLocal
from apps.api.app.models import AuditEvent, Claim, Entity, PermissionOverride, User
from apps.api.app.services import overrides as ovr

PW = {u: f"{u}-demo" for u in ("investigator", "reviewer", "analyst", "auditor", "admin", "officer", "outsider", "unassigned")}
ADMIN2 = ("admin2", "admin2-pass-1234")


def _login(client, username, password=None):
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password or PW[username]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
def admin(client):
    return _login(client, "admin")


@pytest.fixture
def admin2(client, admin):
    """A second administrator, for approvals (the creator may not approve their own override)."""
    client.post("/api/v1/users", headers=admin, json={"username": ADMIN2[0], "display_name": "Second Admin", "role": "ADMIN",
                                                      "jurisdiction": "Demo District A", "password": ADMIN2[1]})
    return _login(client, *ADMIN2)


@pytest.fixture(autouse=True)
def _clean_overrides():
    yield
    with SessionLocal() as s:  # overrides are revocable rows (the history table is the append-only one)
        s.execute(text("UPDATE permission_overrides SET status = 'REVOKED' WHERE status IN ('ACTIVE', 'PENDING')"))
        s.commit()


def _uid(username):
    with SessionLocal() as s:
        return s.query(User).filter_by(username=username).one().user_id


def _iso(delta_seconds):
    return (datetime.datetime.utcnow() + datetime.timedelta(seconds=delta_seconds)).isoformat() + "Z"


def _create(client, headers, **kw):
    body = {"effect": "ALLOW", "subject_type": "USER", "reason": "temporary cover for leave", "expires_at": _iso(3600), **kw}
    body = {k: v for k, v in body.items() if v is not None}  # a field passed as None is omitted from the request
    return client.post("/api/v1/permission-overrides", headers=headers, json=body)


def _active(client, creator, approver, **kw):
    r = _create(client, creator, **kw)
    assert r.status_code == 201, r.text
    oid = r.json()["override_id"]
    if r.json()["effect"] == "ALLOW":
        a = client.post(f"/api/v1/permission-overrides/{oid}/approve", headers=approver, json={"note": "approved for test"})
        assert a.status_code == 200, a.text
    return oid


def _stats(client, headers, case_id="CASE-0001"):
    return client.get(f"/api/v1/cases/{case_id}/stats", headers=headers).status_code


def _last(action, **f):
    with SessionLocal() as s:
        q = s.query(AuditEvent).filter(AuditEvent.action == action)
        for k, v in f.items():
            q = q.filter(getattr(AuditEvent, k) == v)
        return q.order_by(AuditEvent.created_at.desc(), AuditEvent.audit_id.desc()).first()


# ------------------------------------------------------------------ governance
@pytest.mark.parametrize("who", ["auditor", "investigator", "reviewer", "analyst", "officer"])
def test_only_admins_create_overrides(client, who):
    r = _create(client, _login(client, who), action="decide", subject=_uid("analyst"))
    assert r.status_code == 403
    assert _last("ACCESS_DENIED", actor_id=_uid(who)).detail["action"] == "manageOverrides"


def test_auditor_can_review_but_not_change(client, admin, admin2):
    oid = _active(client, admin, admin2, action="decide", subject=_uid("analyst"), case_id="CASE-0001")
    auditor = _login(client, "auditor")
    assert client.get("/api/v1/permission-overrides", headers=auditor).status_code == 200
    assert client.get(f"/api/v1/permission-overrides/{oid}", headers=auditor).status_code == 200
    assert client.post(f"/api/v1/permission-overrides/{oid}/revoke", headers=auditor, json={"reason": "auditor trying to revoke"}).status_code == 403


def test_allow_is_pending_until_a_different_admin_approves(client, admin, admin2):
    analyst = _login(client, "analyst")
    r = _create(client, admin, action="decide", subject=_uid("analyst"), case_id="CASE-0001")
    assert r.status_code == 201 and r.json()["status"] == "PENDING"
    assert _stats(client, analyst) == 403  # pending: no effect
    oid = r.json()["override_id"]
    self_approve = client.post(f"/api/v1/permission-overrides/{oid}/approve", headers=admin, json={})
    assert self_approve.status_code == 422 and "creator" in self_approve.json()["detail"]
    assert _last("OVERRIDE_APPROVE", outcome="DENIED", target_id=oid) is not None
    assert client.post(f"/api/v1/permission-overrides/{oid}/approve", headers=admin2, json={"note": "ok"}).status_code == 200
    assert _stats(client, analyst) == 200


def test_deny_is_active_immediately(client, admin):
    r = _create(client, admin, effect="DENY", action="listAnchors", subject=_uid("investigator"), case_id="CASE-0001")
    assert r.status_code == 201 and r.json()["status"] == "ACTIVE"
    assert client.get("/api/v1/cases/CASE-0001/integrity/anchors", headers=_login(client, "investigator")).status_code == 403


def test_admin_cannot_target_themselves_or_their_own_role(client, admin):
    for subject_type, subject in (("USER", _uid("admin")), ("ROLE", "ADMIN")):
        for effect in ("ALLOW", "DENY"):
            r = _create(client, admin, effect=effect, action="decide", subject_type=subject_type, subject=subject)
            assert r.status_code == 422 and "yourself" in r.json()["detail"]


def test_allow_cannot_target_an_administrator(client, admin, admin2):
    r = _create(client, admin, action="reveal", subject=_uid(ADMIN2[0]))
    assert r.status_code == 422 and "administrators" in r.json()["detail"]


def test_subject_cannot_revoke_a_deny_placed_on_them(client, admin, admin2):
    oid = _active(client, admin, admin2, effect="DENY", action="caseAccess", subject=_uid(ADMIN2[0]), case_id="CASE-0001")
    assert client.get("/api/v1/cases/CASE-0001", headers=admin2).status_code == 403  # DENY restricts an ADMIN too
    r = client.post(f"/api/v1/permission-overrides/{oid}/revoke", headers=admin2, json={"reason": "lifting my own restriction"})
    assert r.status_code == 422
    assert client.post(f"/api/v1/permission-overrides/{oid}/revoke", headers=admin, json={"reason": "restriction no longer needed"}).status_code == 200
    assert client.get("/api/v1/cases/CASE-0001", headers=admin2).status_code == 200


@pytest.mark.parametrize("action", ["globalAudit", "manageUsers", "manageOverrides", "viewOverrides", "manageMaskingPolicy", "demoTamper"])
def test_mandatory_actions_cannot_be_overridden(client, admin, action):
    for effect in ("ALLOW", "DENY"):
        r = _create(client, admin, effect=effect, action=action, subject=_uid("investigator"))
        assert r.status_code == 422 and "mandatory" in r.json()["detail"]


@pytest.mark.parametrize("change,fragment", [
    ({"expires_at": None}, None),
    ({"reason": "short"}, None),
    ({"expires_at": _iso(91 * 86400)}, "at most"),
    ({"starts_at": _iso(7200), "expires_at": _iso(3600)}, "after starts_at"),
    ({"starts_at": _iso(-86400)}, "past"),
    ({"subject": "USR-nobody"}, "unknown user"),
    ({"case_id": "CASE-9999"}, "unknown case"),
    ({"action": "launchMissiles"}, "unknown action"),
    ({"subject_type": "ROLE", "subject": "SUPERUSER"}, "unknown role"),
    ({"resource_type": "EVIDENCE"}, "go together"),
])
def test_input_rules(client, admin, change, fragment):
    r = _create(client, admin, **{"action": "decide", "subject": _uid("analyst"), **change})
    assert r.status_code == 422, r.text
    if fragment:
        assert fragment in r.json()["detail"]


def test_resource_must_belong_to_the_case(client, admin, ingested):
    other_case_evidence = ingested["transactions_case2.csv"]["evidence_id"]
    r = _create(client, admin, action="upload", subject=_uid("analyst"), case_id="CASE-0001",
                resource_type="EVIDENCE", resource_id=other_case_evidence)
    assert r.status_code == 422 and "does not belong" in r.json()["detail"]


# ------------------------------------------------------------------ precedence and scope
def test_deny_beats_role(client, admin):
    investigator = _login(client, "investigator")
    assert client.get("/api/v1/cases/CASE-0001/integrity/anchors", headers=investigator).status_code == 200
    _create(client, admin, effect="DENY", action="listAnchors", subject=_uid("investigator"), case_id="CASE-0001")
    r = client.get("/api/v1/cases/CASE-0001/integrity/anchors", headers=investigator)
    assert r.status_code == 403 and r.json()["detail"] == "This action is not permitted for your account"
    assert _last("ACCESS_DENIED", actor_id=_uid("investigator")).detail["reason"] == "denied by permission override"
    assert client.get("/api/v1/cases/CASE-0002/integrity/anchors", headers=investigator).status_code == 200  # other case


def test_deny_beats_allow_whatever_the_scope(client, admin, admin2):
    analyst = _login(client, "analyst")
    _active(client, admin, admin2, action="decide", subject=_uid("analyst"), case_id="CASE-0001")
    assert _stats(client, analyst) == 200
    _create(client, admin, effect="DENY", action="decide", subject_type="ROLE", subject="ANALYST")  # broader scope
    assert _stats(client, analyst) == 403


def test_case_scope_does_not_leak_to_other_cases(client, admin, admin2):
    analyst = _login(client, "analyst")
    _active(client, admin, admin2, action="decide", subject=_uid("analyst"), case_id="CASE-0002")
    assert _stats(client, analyst, "CASE-0001") == 403


def test_allow_case_access_grants_entry_but_jurisdiction_stays_mandatory(client, admin, admin2):
    unassigned = _login(client, "unassigned")      # Demo District A, not assigned to CASE-0001
    outsider = _login(client, "outsider")          # Demo District B
    assert client.get("/api/v1/cases/CASE-0001", headers=unassigned).status_code == 403
    _active(client, admin, admin2, action="caseAccess", subject=_uid("unassigned"), case_id="CASE-0001")
    _active(client, admin, admin2, action="caseAccess", subject=_uid("outsider"), case_id="CASE-0001")
    assert client.get("/api/v1/cases/CASE-0001", headers=unassigned).status_code == 200
    assert client.get("/api/v1/cases/CASE-0001", headers=outsider).status_code == 403
    assert _last("OVERRIDE_APPLIED", actor_id=_uid("unassigned")).detail["action"] == "caseAccess"


def test_overrides_reach_resource_routes_through_their_case(client, admin, ingested):
    """A case-scoped DENY applies to routes addressed by resource id (the case comes from the database)."""
    eid = ingested["calls.csv"]["evidence_id"]
    officer = _login(client, "officer")
    _create(client, admin, effect="DENY", action="upload", subject=_uid("officer"), case_id="CASE-0001")
    assert client.post(f"/api/v1/evidence/{eid}/process", headers=officer).status_code == 403


# ------------------------------------------------------------------ time: scheduled, expired, revoked
def test_scheduled_override_has_no_effect_before_it_starts(client, admin, admin2):
    analyst = _login(client, "analyst")
    oid = _active(client, admin, admin2, action="decide", subject=_uid("analyst"), case_id="CASE-0001",
                  starts_at=_iso(600), expires_at=_iso(3600))
    assert _stats(client, analyst) == 403
    listed = {o["override_id"]: o for o in client.get("/api/v1/permission-overrides?status=scheduled", headers=admin).json()}
    assert listed[oid]["effective_status"] == "SCHEDULED"


def test_expired_override_stops_working(client, admin, admin2):
    analyst = _login(client, "analyst")
    oid = _active(client, admin, admin2, action="decide", subject=_uid("analyst"), case_id="CASE-0001", expires_at=_iso(3))
    assert _stats(client, analyst) == 200
    time.sleep(3.5)
    assert _stats(client, analyst) == 403
    expired = [o["override_id"] for o in client.get("/api/v1/permission-overrides?status=expired", headers=admin).json()]
    assert oid in expired


def test_revoked_override_stops_working_and_history_is_complete(client, admin, admin2):
    analyst = _login(client, "analyst")
    oid = _active(client, admin, admin2, action="decide", subject=_uid("analyst"), case_id="CASE-0001")
    assert _stats(client, analyst) == 200
    assert client.post(f"/api/v1/permission-overrides/{oid}/revoke", headers=admin, json={"reason": "cover period ended early"}).status_code == 200
    assert _stats(client, analyst) == 403
    detail = client.get(f"/api/v1/permission-overrides/{oid}", headers=admin).json()
    assert detail["status"] == "REVOKED" and detail["revoke_reason"] == "cover period ended early"
    assert [h["event"] for h in detail["history"]] == ["CREATED", "APPROVED", "REVOKED"]
    assert detail["created_by_username"] == "admin" and detail["approved_by_username"] == ADMIN2[0]
    revoked = _last("OVERRIDE_REVOKED", target_id=oid)
    for key in ("created_by", "approved_by", "revoked_by", "subject", "expires_at", "reason", "action", "case_id"):
        assert key in revoked.detail
    assert revoked.detail["subject"] == _uid("analyst")


def test_rejected_override_never_takes_effect(client, admin, admin2):
    r = _create(client, admin, action="decide", subject=_uid("analyst"), case_id="CASE-0001")
    oid = r.json()["override_id"]
    assert client.post(f"/api/v1/permission-overrides/{oid}/reject", headers=admin2, json={"reason": "not justified by the case"}).status_code == 200
    assert client.post(f"/api/v1/permission-overrides/{oid}/approve", headers=admin2, json={}).status_code == 422
    assert _stats(client, _login(client, "analyst")) == 403


# ------------------------------------------------------------------ masking separation
def _phone_in_case():
    with SessionLocal() as s:
        for e in s.query(Entity).filter_by(kind="PHONE").all():
            if s.query(Claim.claim_id).filter(Claim.case_id == "CASE-0001", (Claim.source_entity_id == e.entity_id) |
                                              (Claim.target_entity_id == e.entity_id)).first():
                return e.entity_id, e.label
    pytest.skip("no phone entity")


def test_allow_reveal_for_a_non_admin_and_deny_reveal_for_a_permitted_role(client, admin, admin2, ingested):
    entity_id, raw = _phone_in_case()
    body = {"case_id": "CASE-0001", "reason": "override test reveal"}
    analyst, investigator = _login(client, "analyst"), _login(client, "investigator")
    assert client.post(f"/api/v1/entities/{entity_id}/reveal", headers=analyst, json=body).status_code == 403
    _active(client, admin, admin2, action="reveal", subject=_uid("analyst"), case_id="CASE-0001")
    assert client.post(f"/api/v1/entities/{entity_id}/reveal", headers=analyst, json=body).json()["value"] == raw
    _create(client, admin, effect="DENY", action="reveal", subject=_uid("investigator"), case_id="CASE-0001")
    assert client.post(f"/api/v1/entities/{entity_id}/reveal", headers=investigator, json=body).status_code == 403


def test_admin_cannot_gain_reveal_even_from_a_row_written_directly(client, admin, ingested):
    """Mandatory: a row inserted outside the API that ALLOWs reveal to an ADMIN still has no effect."""
    entity_id, raw = _phone_in_case()
    now = datetime.datetime.utcnow()
    with SessionLocal() as s:
        s.add(PermissionOverride(effect="ALLOW", action="reveal", subject_type="USER", subject=_uid("admin"),
                                 reason="inserted directly", starts_at=now, expires_at=now + datetime.timedelta(hours=1),
                                 status="ACTIVE", created_by="direct-sql", created_at=now))
        s.commit()
    r = client.post(f"/api/v1/entities/{entity_id}/reveal", headers=admin, json={"case_id": "CASE-0001", "reason": "bypass attempt"})
    assert r.status_code == 403 and raw not in r.text


def test_mandatory_action_ignores_a_row_written_directly(client):
    now = datetime.datetime.utcnow()
    with SessionLocal() as s:
        s.add(PermissionOverride(effect="ALLOW", action="globalAudit", subject_type="USER", subject=_uid("investigator"),
                                 reason="inserted directly", starts_at=now, expires_at=now + datetime.timedelta(hours=1),
                                 status="ACTIVE", created_by="direct-sql", created_at=now))
        s.commit()
    assert client.get("/api/v1/audit", headers=_login(client, "investigator")).status_code == 403


# ------------------------------------------------------------------ direct API bypass attempts
def test_no_endpoint_edits_or_deletes_an_override(client, admin, admin2):
    oid = _active(client, admin, admin2, action="decide", subject=_uid("analyst"), case_id="CASE-0001")
    for method in ("put", "patch", "delete"):
        r = getattr(client, method)(f"/api/v1/permission-overrides/{oid}", headers=admin, **({} if method == "delete" else {"json": {"status": "ACTIVE"}}))
        assert r.status_code in (404, 405), method


def test_client_supplied_override_hints_are_ignored(client):
    analyst = _login(client, "analyst")
    r = client.get("/api/v1/cases/CASE-0001/stats", headers={**analyst, "X-Override-Id": "OVR-anything", "X-Permission": "decide"},
                   params={"override": "1", "allow": "decide"})
    assert r.status_code == 403


def test_status_cannot_be_set_through_creation(client, admin):
    r = client.post("/api/v1/permission-overrides", headers=admin, json={
        "effect": "ALLOW", "action": "decide", "subject_type": "USER", "subject": _uid("analyst"), "case_id": "CASE-0001",
        "reason": "trying to skip approval", "expires_at": _iso(3600), "status": "ACTIVE", "approved_by": _uid("auditor")})
    assert r.status_code == 201 and r.json()["status"] == "PENDING" and r.json()["approved_by"] is None
    assert _stats(client, _login(client, "analyst")) == 403


def test_override_history_is_append_only(client, admin):
    _create(client, admin, effect="DENY", action="decide", subject=_uid("analyst"))
    with db_module.engine.begin() as conn:
        with pytest.raises(Exception, match="append-only"):
            conn.execute(text("UPDATE permission_override_events SET reason = 'rewritten'"))
    with db_module.engine.begin() as conn:
        with pytest.raises(Exception, match="append-only"):
            conn.execute(text("DELETE FROM permission_override_events"))


# ------------------------------------------------------------------ frontend presentation
def test_effective_permissions_reflect_overrides_per_case(client, admin, admin2):
    analyst = _login(client, "analyst")
    before = client.get("/api/v1/auth/me/permissions", headers=analyst, params={"case_id": "CASE-0001"}).json()
    assert before["capabilities"]["decide"] == {"allowed": False, "source": "role"}
    _active(client, admin, admin2, action="decide", subject=_uid("analyst"), case_id="CASE-0001")
    in_case = client.get("/api/v1/auth/me/permissions", headers=analyst, params={"case_id": "CASE-0001"}).json()
    global_ = client.get("/api/v1/auth/me/permissions", headers=analyst).json()
    assert in_case["capabilities"]["decide"] == {"allowed": True, "source": "override_allow"}
    assert global_["capabilities"]["decide"]["allowed"] is False  # case-scoped grant is not a global one


def test_effective_permissions_for_admin_never_show_reveal(client, admin):
    caps = client.get("/api/v1/auth/me/permissions", headers=admin).json()["capabilities"]
    assert caps["reveal"]["allowed"] is False and caps["downloadOriginal"]["allowed"] is False
    assert caps["manageOverrides"]["allowed"] is True


def test_registry_covers_every_route_gate():
    """Every action named by a route gate is in the registry, so no gate silently falls back to 'mandatory'."""
    import re
    from pathlib import Path

    names = set()
    for f in (Path(__file__).resolve().parents[1] / "routes").glob("*.py"):
        names |= set(re.findall(r'require_roles\([^)]*action="(\w+)"\)', f.read_text()))
    assert names and names <= set(ovr.ACTIONS), names - set(ovr.ACTIONS)
