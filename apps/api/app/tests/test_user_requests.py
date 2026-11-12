"""User request management (services/user_requests.py, ADR-018, docs/USER_REQUESTS.md).

Covers: the workflow and history, user isolation, unauthorized decisions, duplicate requests, invalid transitions,
concurrent updates, fulfilment, validation, notifications, paging/search/filters, and permission-override integration.
Each test creates its own users, so open-request limits and duplicates never leak between tests.
"""
import datetime
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import text

from apps.api.app.db import SessionLocal
from apps.api.app.models import AuditEvent, UserRequestEvent

API = "/api/v1"
REASON = "Checked against the duty roster and case file."


def _user(client, admin, role="INVESTIGATOR", jurisdiction="Demo District A"):
    name = f"ur{role[:3].lower()}{uuid.uuid4().hex[:8]}"
    r = client.post(f"{API}/users", headers=admin, json={"username": name, "display_name": f"Test {name}", "role": role,
                                                          "jurisdiction": jurisdiction, "password": "Request-test-pass-1"})
    assert r.status_code == 201, r.text
    tok = client.post(f"{API}/auth/login", json={"username": name, "password": "Request-test-pass-1"})
    assert tok.status_code == 200, tok.text
    return {"Authorization": f"Bearer {tok.json()['token']}"}, r.json()["user_id"]


def _req(client, headers, category="SUPPORT", submit=True, title=None, details=None, **kw):
    body = {"category": category, "title": title or f"Need help {uuid.uuid4().hex[:6]}",
            "justification": "This is needed for the ongoing investigation work.", "details": details or {},
            "submit": submit, **kw}
    return client.post(f"{API}/user-requests", headers=headers, json=body)


def _act(client, headers, row, action, reason=None, version=None):
    body = {"version": version if version is not None else row["version"]}
    if reason is not None:
        body["reason"] = reason
    return client.post(f"{API}/user-requests/{row['request_id']}/{action}", headers=headers, json=body)


def _code(r):
    return r.json().get("code")


@pytest.fixture(scope="module")
def admin2(client, admin):
    return _user(client, admin, role="ADMIN")[0]


# ------------------------------------------------------------------------------------------------ workflow
def test_categories_define_required_fields(client, investigator):
    r = client.get(f"{API}/user-requests/categories", headers=investigator)
    assert r.status_code == 200
    cats = {c["code"]: c for c in r.json()["categories"]}
    assert set(cats) == {"CASE_ACCESS", "ROLE_CHANGE", "TEMPORARY_PERMISSION", "DATA_CORRECTION", "SUPPORT"}
    assert [f["name"] for f in cats["CASE_ACCESS"]["fields"]] == ["case_id", "purpose"]
    assert "ADMIN" not in next(f for f in cats["ROLE_CHANGE"]["fields"] if f["name"] == "requested_role")["choices"]
    assert set(r.json()["statuses"]) >= {"PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "COMPLETED"}


def test_full_lifecycle_records_reviewer_reason_timestamps_and_history(client, admin):
    user, uid = _user(client, admin)
    draft = _req(client, user, submit=False).json()
    assert draft["status"] == "DRAFT" and draft["reference"].startswith("UR-") and draft["allowed_actions"] == ["edit", "submit", "cancel"]
    edited = client.patch(f"{API}/user-requests/{draft['request_id']}", headers=user,
                          json={"version": draft["version"], "priority": "HIGH"}).json()
    assert edited["priority"] == "HIGH" and edited["version"] == 2
    row = _act(client, user, edited, "submit").json()
    assert row["status"] == "PENDING" and row["submitted_at"]
    row = _act(client, admin, row, "claim").json()
    assert row["status"] == "UNDER_REVIEW" and row["reviewer"]["username"] == "admin"
    row = _act(client, admin, row, "approve", reason=REASON).json()
    assert row["status"] == "APPROVED" and row["decision_reason"] == REASON and row["decided_at"]
    row = _act(client, admin, row, "complete", reason="Account settings corrected as requested.").json()
    assert row["status"] == "COMPLETED" and row["completed_by"]["username"] == "admin" and row["completed_at"]
    events = [(e["event"], e["from_status"], e["to_status"], e["actor"]["username"] is not None) for e in row["history"]]
    assert [e[0] for e in events] == ["CREATED", "EDITED", "SUBMITTED", "CLAIMED", "APPROVED", "COMPLETED"]
    approved = next(e for e in row["history"] if e["event"] == "APPROVED")
    assert approved["actor"]["username"] == "admin" and approved["actor_role"] == "ADMIN" and approved["reason"] == REASON and approved["at"]
    with SessionLocal() as db:
        actions = {a for (a,) in db.query(AuditEvent.action).filter(AuditEvent.target_id == row["reference"]).all()}
    assert {"USER_REQUEST_CREATE", "USER_REQUEST_EDIT", "USER_REQUEST_SUBMIT", "USER_REQUEST_CLAIM",
            "USER_REQUEST_APPROVE", "USER_REQUEST_COMPLETE"} <= actions


def test_reject_and_release_need_a_reason(client, admin, admin2):
    user, _ = _user(client, admin)
    row = _act(client, admin, _req(client, user).json(), "claim").json()
    assert _code(_act(client, admin, row, "reject")) == "INVALID_REQUEST"
    assert _code(_act(client, admin, row, "reject", reason="short")) == "INVALID_REQUEST"
    released = _act(client, admin2, row, "release", reason="Reviewer is on leave this week.")
    assert released.status_code == 200 and released.json()["status"] == "PENDING" and released.json()["reviewer"] is None
    row = _act(client, admin2, released.json(), "claim").json()
    row = _act(client, admin2, row, "reject", reason="Not enough detail to act on.").json()
    assert row["status"] == "REJECTED" and row["reviewer"]["user_id"] != row["requester"]["user_id"]


# ------------------------------------------------------------------------------------------------ isolation
def test_user_isolation(client, admin, auditor):
    a, _ = _user(client, admin)
    b, _ = _user(client, admin)
    row = _req(client, a).json()
    rid = row["request_id"]
    for call in (lambda: client.get(f"{API}/user-requests/{rid}", headers=b),
                 lambda: client.patch(f"{API}/user-requests/{rid}", headers=b, json={"version": 1, "priority": "LOW"}),
                 lambda: _act(client, b, row, "cancel")):
        r = call()
        assert r.status_code == 404 and _code(r) == "NOT_FOUND"
    assert client.get(f"{API}/user-requests/999999", headers=b).status_code == 404   # same answer as "not yours"
    assert all(x["request_id"] != rid for x in client.get(f"{API}/user-requests", headers=b).json())
    assert client.get(f"{API}/user-requests?scope=all", headers=b).status_code == 403
    assert client.get(f"{API}/user-requests/summary?scope=all", headers=b).status_code == 403
    # Oversight: the auditor may read it (audited) but may not act on it.
    seen = client.get(f"{API}/user-requests/{rid}", headers=auditor)
    assert seen.status_code == 200 and seen.json()["allowed_actions"] == [] and "review_context" in seen.json()
    assert "review_context" not in client.get(f"{API}/user-requests/{rid}", headers=a).json()
    with SessionLocal() as db:
        assert db.query(AuditEvent).filter(AuditEvent.action == "USER_REQUEST_VIEW", AuditEvent.target_id == row["reference"]).count() >= 1


# ------------------------------------------------------------------------------------------------ unauthorized decisions
def test_unauthorized_decisions_are_refused_and_audited(client, admin, admin2, auditor, reviewer):
    user, _ = _user(client, admin)
    row = _req(client, user).json()
    assert _code(_act(client, user, row, "claim")) == "FORBIDDEN"          # requester is not an administrator
    assert _code(_act(client, auditor, row, "claim")) == "FORBIDDEN"       # oversight is read-only
    row = _act(client, admin, row, "claim").json()
    for headers in (user, auditor):
        assert _code(_act(client, headers, row, "approve", reason=REASON)) == "FORBIDDEN"
    r = _act(client, admin2, row, "approve", reason=REASON)                # not the claiming administrator
    assert r.status_code == 403 and _code(r) == "NOT_CLAIMER"
    with SessionLocal() as db:
        denied = db.query(AuditEvent).filter(AuditEvent.target_id == row["reference"], AuditEvent.outcome == "DENIED").count()
    assert denied >= 5
    assert client.get(f"{API}/user-requests/{row['request_id']}", headers=admin).json()["status"] == "UNDER_REVIEW"


def test_administrator_cannot_review_own_request(client, admin, admin2):
    own = _req(client, admin2).json()
    r = _act(client, admin2, own, "claim")
    assert r.status_code == 403 and _code(r) == "SELF_REVIEW"
    assert _act(client, admin, own, "claim").status_code == 200   # another administrator may


def test_requester_only_actions(client, admin):
    user, _ = _user(client, admin)
    draft = _req(client, user, submit=False).json()
    r = _act(client, admin, draft, "submit")
    assert r.status_code == 403 and _code(r) == "NOT_REQUESTER"
    r = client.patch(f"{API}/user-requests/{draft['request_id']}", headers=admin, json={"version": 1, "priority": "LOW"})
    assert r.status_code == 403 and _code(r) == "NOT_REQUESTER"


def test_a_deny_override_withdraws_the_right_to_raise_requests(client, admin, admin2):
    user, uid = _user(client, admin)
    r = client.post(f"{API}/permission-overrides", headers=admin, json={
        "effect": "DENY", "action": "createUserRequest", "subject_type": "USER", "subject": uid,
        "reason": "Repeated duplicate requests after warnings",
        "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).isoformat() + "Z"})
    assert r.status_code in (200, 201), r.text
    assert _req(client, user).status_code == 403
    assert client.get(f"{API}/user-requests", headers=user).status_code == 200   # still sees their own


# ------------------------------------------------------------------------------------------------ duplicates
def test_duplicate_requests_are_refused_until_the_first_is_closed(client, admin):
    user, _ = _user(client, admin, jurisdiction="Demo District A")
    first = _req(client, user, "CASE_ACCESS", details={"case_id": "case-0001", "purpose": "analysis"})
    assert first.status_code == 201, first.text
    assert first.json()["details"]["case_id"] == "CASE-0001"          # normalised, so case does not dodge the check
    dup = _req(client, user, "CASE_ACCESS", details={"case_id": "CASE-0001", "purpose": "review"})
    assert dup.status_code == 409 and _code(dup) == "DUPLICATE_REQUEST" and first.json()["reference"] in dup.json()["detail"]
    assert _act(client, user, first.json(), "cancel").status_code == 200
    assert _req(client, user, "CASE_ACCESS", details={"case_id": "CASE-0001", "purpose": "review"}).status_code == 201
    # Free-text categories: the same title (ignoring case and spacing) is a duplicate.
    assert _req(client, user, title="Printer   access please").status_code == 201
    assert _code(_req(client, user, title="printer access PLEASE")) == "DUPLICATE_REQUEST"


def test_editing_a_draft_into_a_duplicate_is_refused(client, admin):
    user, _ = _user(client, admin)
    _req(client, user, title="Reset my two factor token")
    draft = _req(client, user, submit=False, title="Something else entirely").json()
    r = client.patch(f"{API}/user-requests/{draft['request_id']}", headers=user,
                     json={"version": draft["version"], "title": "Reset my two-factor token".replace("-", " ")})
    assert r.status_code == 409 and _code(r) == "DUPLICATE_REQUEST"


def test_open_request_limit(client, admin):
    user, _ = _user(client, admin)
    for i in range(10):
        assert _req(client, user, title=f"Separate issue number {i}").status_code == 201
    r = _req(client, user, title="One more separate issue")
    assert r.status_code == 409 and _code(r) == "TOO_MANY_OPEN"


def test_concurrent_duplicate_creates_give_exactly_one_request(client, admin):
    user, _ = _user(client, admin)
    body = {"category": "ROLE_CHANGE", "title": "Move to analyst duties", "justification": "Transferred to the analysis cell this month.",
            "details": {"requested_role": "ANALYST"}, "submit": True}
    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(lambda _: client.post(f"{API}/user-requests", headers=user, json=body), range(8)))
    codes = sorted(r.status_code for r in results)
    assert codes.count(201) == 1 and codes.count(409) == 7, codes
    assert all(_code(r) == "DUPLICATE_REQUEST" for r in results if r.status_code == 409)


# ------------------------------------------------------------------------------------------------ invalid transitions
def test_invalid_transitions(client, admin):
    user, _ = _user(client, admin)
    row = _req(client, user).json()                                       # PENDING
    assert _code(_act(client, admin, row, "approve", reason=REASON)) == "INVALID_TRANSITION"   # must be claimed first
    assert _code(_act(client, admin, row, "complete", reason=REASON)) == "INVALID_TRANSITION"
    assert _code(_act(client, user, row, "submit")) == "INVALID_TRANSITION"                      # already submitted
    r = client.patch(f"{API}/user-requests/{row['request_id']}", headers=user, json={"version": row["version"], "priority": "LOW"})
    assert _code(r) == "INVALID_TRANSITION"                                                      # only drafts are editable
    row = _act(client, admin, row, "claim").json()
    row = _act(client, admin, row, "reject", reason="Duplicate of an earlier ticket.").json()
    for action, who in (("claim", admin), ("approve", admin), ("complete", admin), ("cancel", user), ("release", admin)):
        r = _act(client, who, row, action, reason=REASON)
        assert r.status_code == 409 and _code(r) == "INVALID_TRANSITION", (action, r.text)
    approved = _act(client, admin, _act(client, admin, _req(client, user).json(), "claim").json(), "approve", reason=REASON).json()
    assert _code(_act(client, user, approved, "cancel")) == "INVALID_TRANSITION"    # too late to withdraw
    assert client.post(f"{API}/user-requests/{row['request_id']}/delete", headers=admin, json={"version": 1}).status_code == 422


# ------------------------------------------------------------------------------------------------ concurrency
def test_stale_version_is_refused(client, admin):
    user, _ = _user(client, admin)
    row = _req(client, user, submit=False).json()
    client.patch(f"{API}/user-requests/{row['request_id']}", headers=user, json={"version": 1, "priority": "LOW"})
    r = client.patch(f"{API}/user-requests/{row['request_id']}", headers=user, json={"version": 1, "priority": "URGENT"})
    assert r.status_code == 409 and _code(r) == "VERSION_CONFLICT"
    assert client.get(f"{API}/user-requests/{row['request_id']}", headers=user).json()["priority"] == "LOW"


def test_concurrent_claims_have_exactly_one_winner(client, admin, admin2):
    user, _ = _user(client, admin)
    row = _req(client, user).json()
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda h: _act(client, h, row, "claim"), (admin, admin2)))
    assert sorted(r.status_code for r in results) == [200, 409], [r.text for r in results]
    loser = next(r for r in results if r.status_code == 409)
    assert _code(loser) in ("VERSION_CONFLICT", "INVALID_TRANSITION")
    detail = client.get(f"{API}/user-requests/{row['request_id']}", headers=admin).json()
    assert [e["event"] for e in detail["history"]].count("CLAIMED") == 1 and detail["version"] == row["version"] + 1


def test_cancel_racing_a_decision_cannot_both_succeed(client, admin):
    user, _ = _user(client, admin)
    row = _act(client, admin, _req(client, user).json(), "claim").json()
    with ThreadPoolExecutor(2) as pool:
        f1 = pool.submit(_act, client, user, row, "cancel")
        f2 = pool.submit(_act, client, admin, row, "approve", REASON)
        results = [f1.result(), f2.result()]
    assert sorted(r.status_code for r in results) == [200, 409], [r.text for r in results]
    final = client.get(f"{API}/user-requests/{row['request_id']}", headers=admin).json()
    assert final["status"] in ("CANCELLED", "APPROVED")
    assert len([e for e in final["history"] if e["event"] in ("CANCELLED", "APPROVED")]) == 1


# ------------------------------------------------------------------------------------------------ fulfilment
def test_case_access_completion_assigns_the_case(client, admin):
    user, _ = _user(client, admin)
    assert client.get(f"{API}/cases/CASE-0002", headers=user).status_code == 403
    row = _req(client, user, "CASE_ACCESS", details={"case_id": "CASE-0002", "purpose": "investigation"}).json()
    row = _act(client, admin, row, "claim").json()
    assert row["allowed_actions"] == ["release", "approve", "reject"]   # what the claiming administrator is offered
    detail = client.get(f"{API}/user-requests/{row['request_id']}", headers=admin).json()
    assert detail["review_context"]["can_apply"] is True and detail["review_context"]["case"]["case_id"] == "CASE-0002"
    row = _act(client, admin, row, "approve", reason=REASON).json()
    done = _act(client, admin, row, "complete")                         # automatic: no note required
    assert done.status_code == 200, done.text
    assert "Assigned to CASE-0002" in done.json()["completion_note"]
    assert client.get(f"{API}/cases/CASE-0002", headers=user).status_code == 200
    assert _code(_req(client, user, "CASE_ACCESS", details={"case_id": "CASE-0002", "purpose": "review"})) == "ALREADY_GRANTED"


def test_case_access_that_cannot_be_applied_stays_approved(client, admin):
    user, _ = _user(client, admin, jurisdiction="Demo District B")
    row = _req(client, user, "CASE_ACCESS", details={"case_id": "CASE-0001", "purpose": "investigation"}).json()
    row = _act(client, admin, _act(client, admin, row, "claim").json(), "approve", reason=REASON).json()
    r = _act(client, admin, row, "complete")
    assert r.status_code == 409 and _code(r) == "FULFILMENT_FAILED" and "jurisdiction" in r.json()["detail"]
    after = client.get(f"{API}/user-requests/{row['request_id']}", headers=admin).json()
    assert after["status"] == "APPROVED" and after["version"] == row["version"]
    assert client.get(f"{API}/cases/CASE-0001", headers=user).status_code == 403


def test_request_for_an_unknown_case_does_not_reveal_existence(client, admin):
    user, _ = _user(client, admin)
    r = _req(client, user, "CASE_ACCESS", details={"case_id": "CASE-9999", "purpose": "investigation"})
    assert r.status_code == 201                                           # requester learns nothing
    detail = client.get(f"{API}/user-requests/{r.json()['request_id']}", headers=admin).json()
    assert detail["review_context"]["case"] is None and detail["review_context"]["can_apply"] is False
    bad = _req(client, user, "DATA_CORRECTION", details={"case_id": "CASE-9999"})
    other = _req(client, user, "DATA_CORRECTION", details={"case_id": "CASE-0001"})   # exists, not assigned
    assert bad.status_code == other.status_code == 422 and bad.json()["detail"] == other.json()["detail"]


def test_role_change_completion_changes_role_and_ends_old_sessions(client, admin):
    user, uid = _user(client, admin, role="ANALYST")
    assert _req(client, user, "ROLE_CHANGE", details={"requested_role": "ADMIN"}).status_code == 422
    assert _req(client, user, "ROLE_CHANGE", details={"requested_role": "ANALYST"}).status_code == 422
    row = _req(client, user, "ROLE_CHANGE", details={"requested_role": "REVIEWER"}).json()
    row = _act(client, admin, _act(client, admin, row, "claim").json(), "approve", reason=REASON).json()
    done = _act(client, admin, row, "complete").json()
    assert done["status"] == "COMPLETED" and "ANALYST to REVIEWER" in done["completion_note"]
    assert client.get(f"{API}/auth/me", headers=user).status_code == 401   # must sign in again
    roles = {u["user_id"]: u["role"] for u in client.get(f"{API}/users", headers=admin).json()}
    assert roles[uid] == "REVIEWER"


def test_manual_completion_requires_a_note(client, admin):
    user, _ = _user(client, admin)
    row = _req(client, user, "TEMPORARY_PERMISSION", details={"action": "report", "case_id": "CASE-0001", "duration_days": 7}).json()
    row = _act(client, admin, _act(client, admin, row, "claim").json(), "approve", reason=REASON).json()
    assert _code(_act(client, admin, row, "complete")) == "INVALID_REQUEST"
    done = _act(client, admin, row, "complete", reason="Granted as override OVR-1234 after second approval.")
    assert done.status_code == 200 and done.json()["completion_note"].startswith("Granted as override")


# ------------------------------------------------------------------------------------------------ validation
@pytest.mark.parametrize("category, details, field", [
    ("CASE_ACCESS", {"purpose": "investigation"}, "case_id"),
    ("CASE_ACCESS", {"case_id": "CASE 1; drop", "purpose": "investigation"}, "case_id"),
    ("CASE_ACCESS", {"case_id": "CASE-0002", "purpose": "curiosity"}, "purpose"),
    ("TEMPORARY_PERMISSION", {"action": "report", "duration_days": 120}, "duration_days"),
    ("TEMPORARY_PERMISSION", {"action": "manageUsers", "duration_days": 5}, "action"),
    ("SUPPORT", {"surprise": "field"}, "surprise"),
])
def test_category_fields_are_validated(client, admin, category, details, field):
    user, _ = _user(client, admin)
    r = _req(client, user, category, details=details)
    assert r.status_code == 422 and _code(r) == "INVALID_REQUEST"
    assert any(e["loc"][-1] == field for e in r.json()["detail"]), r.text


def test_common_fields_are_validated(client, admin):
    user, _ = _user(client, admin)
    assert _req(client, user, justification="too short").status_code == 422
    assert _req(client, user, title="abc").status_code == 422
    assert _req(client, user, priority="CRITICAL").status_code == 422
    assert _req(client, user, category="NOPE").status_code == 422
    assert client.get(f"{API}/user-requests?status=BOGUS", headers=user).status_code == 422
    assert client.get(f"{API}/user-requests?created_from=yesterday", headers=user).status_code == 422


def test_oversight_roles_cannot_request_case_access(client, auditor):
    r = _req(client, auditor, "CASE_ACCESS", details={"case_id": "CASE-0001", "purpose": "oversight"})
    assert r.status_code == 422


# ------------------------------------------------------------------------------------------------ listing
def test_paging_search_and_filters(client, admin):
    user, _ = _user(client, admin)
    made = [_req(client, user, title=f"Batch item {i:02d} about scanners", priority="HIGH" if i % 2 else "LOW").json() for i in range(7)]
    _act(client, user, made[0], "cancel")
    r = client.get(f"{API}/user-requests?limit=3&offset=0&sort=reference", headers=user)
    assert r.status_code == 200 and r.headers["X-Total-Count"] == "7" and len(r.json()) == 3
    assert [x["request_id"] for x in r.json()] == [m["request_id"] for m in made[:3]]
    page3 = client.get(f"{API}/user-requests?limit=3&offset=6&sort=reference", headers=user).json()
    assert [x["request_id"] for x in page3] == [made[6]["request_id"]]
    assert client.get(f"{API}/user-requests?priority=HIGH", headers=user).headers["X-Total-Count"] == "3"
    assert client.get(f"{API}/user-requests?status=CANCELLED", headers=user).headers["X-Total-Count"] == "1"
    assert client.get(f"{API}/user-requests?status=PENDING,CANCELLED", headers=user).headers["X-Total-Count"] == "7"
    assert client.get(f"{API}/user-requests?q=item 03", headers=user).json()[0]["request_id"] == made[3]["request_id"]
    by_ref = client.get(f"{API}/user-requests?q={made[5]['reference']}", headers=user).json()
    assert [x["request_id"] for x in by_ref] == [made[5]["request_id"]]
    assert client.get(f"{API}/user-requests?q=100%", headers=user).headers["X-Total-Count"] == "0"   # wildcard escaped
    summary = client.get(f"{API}/user-requests/summary", headers=user).json()
    assert summary["by_status"]["PENDING"] == 6 and summary["by_status"]["CANCELLED"] == 1 and summary["open"] == 6
    everyone = client.get(f"{API}/user-requests?scope=all&requester={made[0]['requester']['username']}", headers=admin)
    assert everyone.headers["X-Total-Count"] == "7"
    today = datetime.date.today().isoformat()
    assert client.get(f"{API}/user-requests?created_from={today}&created_to={today}", headers=user).headers["X-Total-Count"] == "7"
    assert client.get(f"{API}/user-requests?limit=101", headers=user).status_code == 422


# ------------------------------------------------------------------------------------------------ notifications
def test_notifications_follow_the_request_and_are_private(client, admin, admin2):
    user, _ = _user(client, admin)
    other, _ = _user(client, admin)
    before = client.get(f"{API}/notifications/unread-count", headers=admin).json()["unread"]
    row = _req(client, user).json()
    assert client.get(f"{API}/notifications/unread-count", headers=admin).json()["unread"] == before + 1
    assert client.get(f"{API}/notifications/unread-count", headers=user).json()["unread"] == 0   # not told about own submit
    row = _act(client, admin, row, "claim").json()
    _act(client, admin, row, "approve", reason=REASON)
    mine = client.get(f"{API}/notifications", headers=user)
    titles = [n["title"] for n in mine.json()]
    assert mine.headers["X-Unread-Count"] == "2" and any("was approved" in t for t in titles) and any("under review" in t for t in titles)
    approved = next(n for n in mine.json() if "was approved" in n["title"])
    assert REASON in approved["body"] and approved["link"] == f"/requests/{row['request_id']}"
    assert client.post(f"{API}/notifications/{approved['notification_id']}/read", headers=other).status_code == 404
    assert client.post(f"{API}/notifications/{approved['notification_id']}/read", headers=user).json()["unread"] == 1
    assert client.post(f"{API}/notifications/read-all", headers=user).json()["unread"] == 0
    assert client.get(f"{API}/notifications?unread_only=true", headers=user).json() == []


# ------------------------------------------------------------------------------------------------ history integrity
def test_request_history_is_append_only(client, admin):
    user, _ = _user(client, admin)
    rid = _req(client, user).json()["request_id"]
    with SessionLocal() as db:
        for stmt in ("UPDATE user_request_events SET reason = 'rewritten' WHERE request_id = :r",
                     "DELETE FROM user_request_events WHERE request_id = :r"):
            with pytest.raises(Exception, match="append-only"):
                db.execute(text(stmt), {"r": rid})
                db.commit()
            db.rollback()
        assert db.query(UserRequestEvent).filter_by(request_id=rid).count() == 2   # CREATED + SUBMITTED, untouched


def test_effective_permissions_expose_the_request_capabilities(client, admin, auditor, investigator):
    def caps(h):
        return {k: v["allowed"] for k, v in client.get(f"{API}/auth/me/permissions", headers=h).json()["capabilities"].items()}
    assert caps(admin)["reviewUserRequests"] is True and caps(admin)["viewAllUserRequests"] is True
    assert caps(auditor)["reviewUserRequests"] is False and caps(auditor)["viewAllUserRequests"] is True
    assert caps(investigator)["createUserRequest"] is True and caps(investigator)["viewAllUserRequests"] is False
