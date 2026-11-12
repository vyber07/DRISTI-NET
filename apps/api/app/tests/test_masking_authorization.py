"""Masking-policy administration, reveal authorization, separation of duties and alternate retrieval paths.

Covers: policy view/update permissions and validation; ADMIN/AUDITOR cannot reveal; legitimate reveals still work;
policy changes take effect; a missing policy row fails closed; a tampered row cannot grant ADMIN; case-level
conflicts deny; IDOR; role manipulation; client-side parameter tampering; court PDF; audit content; error text;
caching headers; and the frontend permission mirror.
"""
import re
from pathlib import Path

import jwt
import pytest

from apps.api.app import config
from apps.api.app.db import SessionLocal
from apps.api.app.models import AuditEvent, Claim, Entity, MaskingPolicy
from apps.api.app.services import masking_policy
from apps.api.app.services.masking import case_attributes

PASSWORDS = {u: f"{u}-demo" for u in ("investigator", "reviewer", "analyst", "auditor", "admin", "officer", "outsider", "unassigned")}


def _h(client, username):
    r = client.post("/api/v1/auth/login", json={"username": username, "password": PASSWORDS[username]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _entity(kind, case_id="CASE-0001", only_case=False, not_in=None):
    """An entity of `kind` that has a claim in case_id (and, with only_case, no claim in CASE-0001; with not_in, no claim
    in that case). Entities are a global registry shared across cases, so a cross-case test must exclude the other case
    explicitly: otherwise it passes or fails depending on which entity the unordered query happens to return first."""
    with SessionLocal() as s:
        for e in s.query(Entity).filter_by(kind=kind).order_by(Entity.entity_id).all():
            cases = {c for (c,) in s.query(Claim.case_id).filter(
                (Claim.source_entity_id == e.entity_id) | (Claim.target_entity_id == e.entity_id)).distinct()}
            if case_id in cases and (not only_case or "CASE-0001" not in cases) and (not_in is None or not_in not in cases):
                return e.entity_id, e.label
    pytest.skip(f"no {kind} entity in {case_id}")


def _person_with(key):
    with SessionLocal() as s:
        for e in s.query(Entity).all():
            attrs = case_attributes(e.attributes, "CASE-0001")
            if isinstance(attrs.get(key), str):
                in_case = s.query(Claim.claim_id).filter(Claim.case_id == "CASE-0001", (Claim.source_entity_id == e.entity_id) |
                                                         (Claim.target_entity_id == e.entity_id)).first()
                if in_case:
                    return e.entity_id, attrs[key]
    pytest.skip(f"no entity with {key}")


def _reveal(client, headers, entity_id, case_id="CASE-0001", reason="identify the caller for the FIR", extra=None):
    body = {"case_id": case_id, "reason": reason, **(extra or {})}
    return client.post(f"/api/v1/entities/{entity_id}/reveal", headers=headers, json=body)


def _set_policy(client, kind, roles, reason="test change of reveal roles"):
    return client.put(f"/api/v1/masking-policies/{kind}", headers=_h(client, "admin"), json={"reveal_roles": roles, "reason": reason})


@pytest.fixture(autouse=True)
def _restore_policies():
    yield
    with SessionLocal() as s:
        for kind in masking_policy.KINDS:
            row = s.get(MaskingPolicy, kind)
            if row is None:
                s.add(MaskingPolicy(kind=kind, reveal_roles=list(masking_policy.DEFAULT_REVEAL_ROLES), reason="default policy"))
            else:
                row.reveal_roles = list(masking_policy.DEFAULT_REVEAL_ROLES)
        s.commit()


def _last_audit(action, **filters):
    with SessionLocal() as s:
        q = s.query(AuditEvent).filter(AuditEvent.action == action)
        for k, v in filters.items():
            q = q.filter(getattr(AuditEvent, k) == v)
        return q.order_by(AuditEvent.created_at.desc(), AuditEvent.audit_id.desc()).first()


# ------------------------------------------------------------------ policy administration
def test_admin_and_auditor_can_view_policy_and_the_view_is_audited(client):
    for who in ("admin", "auditor"):
        r = client.get("/api/v1/masking-policies", headers=_h(client, who))
        assert r.status_code == 200
        body = r.json()
        assert {p["kind"] for p in body["policies"]} == set(masking_policy.KINDS) and body["missing_kinds"] == []
        assert all("ADMIN" not in p["reveal_roles"] for p in body["policies"])
    assert _last_audit("MASKING_POLICY_VIEW") is not None


@pytest.mark.parametrize("who", ["investigator", "reviewer", "analyst", "officer"])
def test_other_roles_cannot_view_policy(client, who):
    assert client.get("/api/v1/masking-policies", headers=_h(client, who)).status_code == 403


def test_anonymous_cannot_view_or_change_policy(client):
    assert client.get("/api/v1/masking-policies").status_code == 401
    assert client.put("/api/v1/masking-policies/PHONE", json={"reveal_roles": [], "reason": "x" * 12}).status_code == 401


@pytest.mark.parametrize("who", ["auditor", "investigator", "reviewer", "officer"])
def test_only_admin_can_change_policy(client, who):
    r = client.put("/api/v1/masking-policies/PHONE", headers=_h(client, who),
                   json={"reveal_roles": ["INVESTIGATOR", "ANALYST"], "reason": "attempted change by non-admin"})
    assert r.status_code == 403
    with SessionLocal() as s:
        assert sorted(s.get(MaskingPolicy, "PHONE").reveal_roles) == sorted(masking_policy.DEFAULT_REVEAL_ROLES)


def test_admin_change_is_validated_and_audited_with_before_and_after(client):
    r = _set_policy(client, "PHONE", ["INVESTIGATOR", "REVIEWER", "ANALYST"], "analysts need phone reveal for CDR work")
    assert r.status_code == 200 and r.json()["reveal_roles"] == ["ANALYST", "INVESTIGATOR", "REVIEWER"]
    ev = _last_audit("MASKING_POLICY_UPDATE", target_id="PHONE", outcome="OK")
    assert ev.detail["before"] == ["INVESTIGATOR", "REVIEWER"] and "ANALYST" in ev.detail["after"]
    assert ev.detail["reason"] == "analysts need phone reveal for CDR work"


def test_admin_cannot_grant_reveal_to_admin(client):
    r = _set_policy(client, "PHONE", ["INVESTIGATOR", "ADMIN"], "trying to give myself reveal")
    assert r.status_code == 422 and "separation of duties" in r.json()["detail"]
    assert _last_audit("MASKING_POLICY_UPDATE", target_id="PHONE", outcome="DENIED") is not None
    with SessionLocal() as s:
        assert "ADMIN" not in s.get(MaskingPolicy, "PHONE").reveal_roles


@pytest.mark.parametrize("body,status", [
    ({"reveal_roles": ["SUPERUSER"], "reason": "unknown role attempt"}, 422),
    ({"reveal_roles": ["INVESTIGATOR"], "reason": "short"}, 422),
    ({"reveal_roles": ["INVESTIGATOR"]}, 422),
])
def test_policy_change_input_validation(client, body, status):
    assert client.put("/api/v1/masking-policies/PHONE", headers=_h(client, "admin"), json=body).status_code == status


def test_unknown_kind_is_404_and_audited(client):
    assert _set_policy(client, "PASSPORT", ["INVESTIGATOR"]).status_code == 404
    assert _last_audit("MASKING_POLICY_UPDATE", outcome="DENIED") is not None


# ------------------------------------------------------------------ separation of duties and legitimate reveals
@pytest.mark.parametrize("who", ["admin", "auditor", "analyst", "officer"])
def test_roles_outside_the_policy_cannot_reveal_and_the_denial_is_audited(client, ingested, who):
    entity_id, raw = _entity("PHONE")
    r = _reveal(client, _h(client, who), entity_id)
    assert r.status_code == 403 and raw not in r.text
    assert r.json()["detail"] in (masking_policy.DENIED_MESSAGE, "Access to this case is denied for the current user, purpose, or jurisdiction")


def test_admin_cannot_download_raw_files_or_reveal_context(client, ingested):
    admin = _h(client, "admin")
    eid = ingested["calls.csv"]["evidence_id"]
    assert client.post(f"/api/v1/evidence/{eid}/download", headers=admin, json={"reason": "admin wants the file"}).status_code == 403
    assert client.post(f"/api/v1/evidence/{eid}/context/reveal", headers=admin, json={"reason": "admin wants context", "row": 1}).status_code == 403
    denied = _last_audit("UNMASK", target_id=eid, outcome="DENIED")
    assert denied is not None and denied.detail["reason"] == "role not permitted by masking policy"


@pytest.mark.parametrize("who", ["investigator", "reviewer"])
def test_permitted_roles_still_reveal_phone_labels(client, ingested, who):
    entity_id, raw = _entity("PHONE")
    r = _reveal(client, _h(client, who), entity_id)
    assert r.status_code == 200 and r.json()["value"] == raw
    ok = _last_audit("UNMASK", target_id=entity_id, outcome="OK")
    assert ok.detail["masked_kind"] == "PHONE" and raw not in str(ok.detail)  # the revealed value never enters the audit


def test_attribute_reveal_returns_the_raw_value_only_to_permitted_roles(client, ingested):
    entity_id, raw_address = _person_with("address")
    body = {"case_id": "CASE-0001", "key": "address", "reason": "serve notice at the address"}
    ok = client.post(f"/api/v1/entities/{entity_id}/attributes/reveal", headers=_h(client, "investigator"), json=body)
    assert ok.status_code == 200 and ok.json()["value"] == raw_address
    for who in ("admin", "auditor", "analyst"):
        r = client.post(f"/api/v1/entities/{entity_id}/attributes/reveal", headers=_h(client, who), json=body)
        assert r.status_code == 403 and raw_address not in r.text


def test_default_views_mask_attributes_even_for_reveal_holders(client, ingested):
    entity_id, raw_address = _person_with("address")
    r = client.get(f"/api/v1/entities/{entity_id}", headers=_h(client, "investigator"), params={"case_id": "CASE-0001"})
    assert r.status_code == 200 and raw_address not in r.text
    assert r.json()["attributes"]["address"] == "[masked address]"


def test_policy_change_takes_effect_and_can_be_withdrawn(client, ingested):
    entity_id, raw = _entity("PHONE")
    analyst = _h(client, "analyst")
    assert _reveal(client, analyst, entity_id).status_code == 403
    assert _set_policy(client, "PHONE", ["INVESTIGATOR", "REVIEWER", "ANALYST"]).status_code == 200
    assert _reveal(client, analyst, entity_id).json()["value"] == raw
    assert _set_policy(client, "PHONE", ["INVESTIGATOR", "REVIEWER"]).status_code == 200
    assert _reveal(client, analyst, entity_id).status_code == 403


def test_empty_policy_means_nobody_reveals(client, ingested):
    entity_id, _ = _entity("PHONE")
    assert _set_policy(client, "PHONE", []).status_code == 200
    assert _reveal(client, _h(client, "investigator"), entity_id).status_code == 403


# ------------------------------------------------------------------ missing and conflicting permissions
def test_missing_policy_row_fails_closed(client, ingested):
    entity_id, raw = _entity("PHONE")
    with SessionLocal() as s:
        s.delete(s.get(MaskingPolicy, "PHONE"))
        s.commit()
    r = _reveal(client, _h(client, "investigator"), entity_id)
    assert r.status_code == 403 and raw not in r.text
    listing = client.get("/api/v1/masking-policies", headers=_h(client, "admin")).json()
    assert "PHONE" in listing["missing_kinds"]


def test_admin_written_directly_into_the_table_still_cannot_reveal(client, ingested):
    """Defence in depth: a row edited outside the API to include ADMIN does not grant ADMIN anything."""
    entity_id, _ = _entity("PHONE")
    with SessionLocal() as s:
        s.get(MaskingPolicy, "PHONE").reveal_roles = ["INVESTIGATOR", "ADMIN"]
        s.commit()
    assert _reveal(client, _h(client, "admin"), entity_id).status_code == 403


def test_permitted_role_without_case_assignment_is_denied(client, ingested):
    """Conflict rule: the role is permitted by policy, but the user is not assigned to the case. Deny wins."""
    entity_id, raw = _entity("PHONE")
    for who in ("unassigned", "outsider"):  # both INVESTIGATOR, neither assigned to CASE-0001
        r = _reveal(client, _h(client, who), entity_id)
        assert r.status_code == 403 and raw not in r.text


def test_idor_entity_from_another_case_under_an_assigned_case_id(client, ingested):
    """'unassigned' is an INVESTIGATOR (a reveal role) assigned to CASE-0002 only. Naming their own case while asking for
    a CASE-0001 entity must fail: the entity has to belong to the case named, not just to some case."""
    entity_id, raw = _entity("PHONE", case_id="CASE-0001", not_in="CASE-0002")
    h = _h(client, "unassigned")
    for path, body in ((f"/api/v1/entities/{entity_id}/reveal", {"case_id": "CASE-0002", "reason": "cross-case attempt"}),
                       (f"/api/v1/entities/{entity_id}/attributes/reveal", {"case_id": "CASE-0002", "key": "phone", "reason": "cross-case attempt"}),
                       (f"/api/v1/entities/{entity_id}", None)):
        r = client.post(path, headers=h, json=body) if body else client.get(path, headers=h, params={"case_id": "CASE-0002"})
        assert r.status_code == 403 and raw not in r.text, path


def test_unknown_entity_gives_the_same_answer_as_out_of_case(client, ingested):
    r = _reveal(client, _h(client, "investigator"), "ENT-doesnotexist")
    assert r.status_code == 403 and r.json()["detail"] == "entity does not belong to this case"


# ------------------------------------------------------------------ role manipulation and client-side tampering
def test_forged_role_claim_is_rejected(client, ingested):
    entity_id, _ = _entity("PHONE")
    token = client.post("/api/v1/auth/login", json={"username": "officer", "password": "officer-demo"}).json()["token"]
    claims = jwt.decode(token, options={"verify_signature": False})
    forged = jwt.encode({**claims, "role": "INVESTIGATOR"}, "not-the-server-key-" * 3, algorithm="HS256")
    r = _reveal(client, {"Authorization": f"Bearer {forged}"}, entity_id)
    assert r.status_code == 401


def test_role_from_headers_query_or_body_is_ignored(client, ingested):
    entity_id, raw = _entity("PHONE")
    officer = {**_h(client, "officer"), "X-User-Role": "INVESTIGATOR", "X-Role": "ADMIN"}
    r = client.post(f"/api/v1/entities/{entity_id}/reveal?role=INVESTIGATOR", headers=officer,
                    json={"case_id": "CASE-0001", "reason": "pretending to be someone else", "role": "INVESTIGATOR", "unmasked": True})
    assert r.status_code == 403 and raw not in r.text


@pytest.mark.parametrize("params", [{"unmasked": "true"}, {"mask": "false"}, {"reveal": "1"}, {"masked": "0"}, {"raw": "1"}])
def test_unmask_query_parameters_have_no_effect(client, ingested, params):
    entity_id, raw = _entity("PHONE")
    person_id, raw_address = _person_with("address")
    h = _h(client, "investigator")
    for path in ("/api/v1/cases/CASE-0001/graph", f"/api/v1/entities/{entity_id}", f"/api/v1/entities/{person_id}"):
        r = client.get(path, headers=h, params={**params, "case_id": "CASE-0001"})
        assert raw not in r.text and raw_address not in r.text, path


# ------------------------------------------------------------------ documents, audit, errors, caching
def test_court_pdf_text_contains_no_raw_values(client, ingested):
    fitz = pytest.importorskip("fitz")
    r = client.post("/api/v1/cases/CASE-0001/report/court-pdf", headers=_h(client, "investigator"), json={"analyst_comments": "x"})
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    text = "".join(page.get_text() for page in fitz.open(stream=r.content, filetype="pdf"))
    _, raw_phone = _entity("PHONE")
    _, raw_address = _person_with("address")
    assert text.strip() and raw_phone not in text and raw_address not in text


def test_audit_records_of_reveals_never_contain_the_revealed_value(client, ingested):
    entity_id, raw = _entity("PHONE")
    _reveal(client, _h(client, "investigator"), entity_id)
    rows = client.get("/api/v1/audit", headers=_h(client, "auditor"), params={"action": "UNMASK", "limit": 1000}).json()
    assert rows and all(raw not in str(row) for row in rows)


def test_denial_messages_name_no_role_kind_or_value(client, ingested):
    entity_id, raw = _entity("PHONE")
    detail = _reveal(client, _h(client, "analyst"), entity_id).json()["detail"]
    assert detail == masking_policy.DENIED_MESSAGE
    assert "ANALYST" not in detail and "PHONE" not in detail and raw not in detail


def test_reveal_responses_are_not_cacheable(client, ingested):
    entity_id, _ = _entity("PHONE")
    r = _reveal(client, _h(client, "investigator"), entity_id)
    assert r.headers["Cache-Control"] == "no-store"


def test_frontend_reveal_permission_mirrors_the_backend_default():
    """apps/web/src/lib/permissions.ts only decides which buttons show; it must not offer reveal to roles the server
    will refuse. Kept in step with masking_policy.DEFAULT_REVEAL_ROLES."""
    source = (Path(config.REPO_ROOT) / "apps/web/src/lib/permissions.ts").read_text()
    match = re.search(r"reveal:\s*\[([^\]]*)\]", source)
    assert match, "reveal entry not found in permissions.ts"
    roles = set(re.findall(r'"([A-Z_]+)"', match.group(1)))
    assert roles == set(masking_policy.DEFAULT_REVEAL_ROLES)
