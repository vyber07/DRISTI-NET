"""Audit logging: completeness of records, trusted-proxy and header-spoofing resistance, log-access control,
concurrency, record integrity (append-only database, signatures, digests) and fail-closed / best-effort behaviour.

Exercised through the real HTTP routes and the real database. Passwords and tokens are asserted absent from
every stored audit row. Tests that alter the database do so only for audit_events, and restore the append-only
triggers afterwards.
"""
import csv
import datetime
import io
import json
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from apps.api.app import config, db as db_module
from apps.api.app.core import request_context
from apps.api.app.db import SessionLocal
from apps.api.app.main import app
from apps.api.app.models import AuditEvent, User
from apps.api.app.services import audit as audit_svc

INVESTIGATOR_PW = "investigator-demo"


def _login(client, username, password, headers=None):
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password}, headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auditor(client):
    return _auth(_login(client, "auditor", "auditor-demo", {"X-Forwarded-For": "198.51.100.1"}))


def _rows(**filters):
    with SessionLocal() as s:
        q = s.query(AuditEvent)
        for key, value in filters.items():
            q = q.filter(getattr(AuditEvent, key) == value)
        return q.order_by(AuditEvent.created_at, AuditEvent.audit_id).all()


def _latest(action, **filters):
    rows = _rows(action=action, **filters)
    assert rows, f"no {action} audit row"
    return rows[-1]


def _api_audit(client, auditor_headers, **params):
    return client.get("/api/v1/audit", headers=auditor_headers, params={"limit": 1000, **params}).json()


# ------------------------------------------------------------------ required fields
def test_successful_login_records_actor_office_session_network_and_time(client):
    external = TestClient(app, client=("203.0.113.40", 5000))
    r = external.post("/api/v1/auth/login", json={"username": "investigator", "password": INVESTIGATOR_PW},
                      headers={"User-Agent": "Mozilla/5.0 (X11; Linux) TestBrowser/1.0"})
    assert r.status_code == 200
    row = _latest("LOGIN", actor_id=r.json()["user"]["user_id"])
    assert row.outcome == "OK" and row.failure_reason is None
    assert row.actor_username == "investigator" and row.actor_role == "INVESTIGATOR"
    assert row.office_id == "OFF-DDA"
    assert row.ip_address == "203.0.113.40"
    assert row.user_agent == "Mozilla/5.0 (X11; Linux) TestBrowser/1.0"
    assert row.session_id and row.trace_id.startswith("REQ-")
    assert r.headers["X-Request-Id"] == row.trace_id == r.headers["X-Trace-Id"]


def test_failed_login_records_outcome_reason_and_no_actor_and_no_password(client):
    secret = "NotTheRealPassword-91be"
    client.post("/api/v1/auth/login", json={"username": "investigator", "password": secret})
    row = _latest("LOGIN", target_id="investigator", outcome="DENIED")
    assert row.actor_id is None and row.failure_reason == "bad credentials"
    assert row.ip_address == "testclient"
    for stored in _rows(action="LOGIN"):
        assert secret not in json.dumps(stored.detail) and secret not in (stored.target_id or "")


def test_evidence_view_has_every_required_field(client, ingested):
    token = _login(client, "investigator", INVESTIGATOR_PW)
    ev = client.get("/api/v1/cases/CASE-0001/evidence", headers=_auth(token)).json()
    assert ev, "seeded case has evidence"
    evidence_id = ev[0]["evidence_id"]
    assert client.get(f"/api/v1/evidence/{evidence_id}", headers=_auth(token)).status_code == 200
    row = _latest("EVIDENCE_VIEW", target_id=evidence_id)
    assert row.actor_username == "investigator" and row.office_id == "OFF-DDA"
    assert row.case_id == "CASE-0001" and row.resource_office == "Demo District A"
    assert row.target_kind == "EVIDENCE" and row.outcome == "OK"
    assert row.session_id and row.ip_address and row.trace_id and row.created_at is not None


def test_api_output_gives_utc_and_local_time_and_the_legacy_field_names(client, auditor):
    rows = _api_audit(client, auditor, action="LOGIN")
    assert rows
    sample = rows[0]
    assert sample["occurred_at_utc"].endswith("Z")
    assert sample["occurred_at_local"].endswith("+05:30")  # Asia/Kolkata display zone (AUDIT_DISPLAY_TZ)
    assert sample["display_timezone"] == config.AUDIT_DISPLAY_TZ
    assert {"trace_id", "target_kind", "target_id", "created_at", "resource_type", "resource_id"} <= set(sample)


# ------------------------------------------------------------------ spoofed headers
def test_spoofed_forwarded_headers_from_direct_caller_are_ignored(client):
    spoof = {"X-Forwarded-For": "10.66.66.66", "X-Real-IP": "10.66.66.66", "Forwarded": "for=10.66.66.66"}
    client.post("/api/v1/auth/login", json={"username": "investigator", "password": "wrong-pw"}, headers=spoof)
    row = _latest("LOGIN", target_id="investigator", outcome="DENIED")
    assert row.ip_address == "testclient"  # the socket peer, not the header


def test_trusted_proxy_chain_is_recorded_as_the_real_client(client):
    proxy = TestClient(app, client=("172.18.0.5", 5000))
    proxy.post("/api/v1/auth/login", json={"username": "investigator", "password": "wrong-pw"},
               headers={"X-Forwarded-For": "9.9.9.9, 198.51.100.77"})
    row = _latest("LOGIN", target_id="investigator", outcome="DENIED")
    assert row.ip_address == "198.51.100.77"  # the spoofed leftmost 9.9.9.9 is not used


def test_client_supplied_trace_id_cannot_write_into_the_audit_trail(client):
    forged = "TRC-forged-by-attacker"
    r = client.post("/api/v1/auth/login", json={"username": "investigator", "password": "wrong-pw"},
                    headers={"X-Trace-Id": forged})
    assert r.headers["X-Trace-Id"] != forged and r.headers["X-Trace-Id"].startswith("REQ-")
    assert _rows(trace_id=forged) == []


def test_correlation_id_is_kept_only_when_it_matches_a_safe_pattern(client):
    client.post("/api/v1/auth/login", json={"username": "investigator", "password": "wrong-pw"},
                headers={"X-Correlation-Id": "case-sync:2026-11-12_001"})
    assert _latest("LOGIN", target_id="investigator", outcome="DENIED").correlation_id == "case-sync:2026-11-12_001"
    client.post("/api/v1/auth/login", json={"username": "investigator", "password": "wrong-pw"},
                headers={"X-Correlation-Id": "x'); DROP TABLE audit_events;--"})
    rows = _rows(action="LOGIN", target_id="investigator", outcome="DENIED")
    assert rows[-1].correlation_id is None


def test_user_agent_cannot_inject_log_lines_and_is_truncated(client):
    client.post("/api/v1/auth/login", json={"username": "investigator", "password": "wrong-pw"},
                headers={"User-Agent": "evil\r\nLOGIN OK forged\x00 " + "A" * 900})
    ua = _latest("LOGIN", target_id="investigator", outcome="DENIED").user_agent
    assert "\r" not in ua and "\n" not in ua and "\x00" not in ua
    assert len(ua) <= request_context.USER_AGENT_MAX


def test_office_is_taken_from_the_user_record_not_from_headers(client):
    token = _login(client, "investigator", INVESTIGATOR_PW)
    client.get("/api/v1/cases", headers={**_auth(token), "X-Office-Id": "OFF-HACKED", "X-Jurisdiction": "Elsewhere"})
    row = _latest("CASE_LIST", actor_id=_user_id("investigator"))
    assert row.office_id == "OFF-DDA"


def _user_id(username):
    with SessionLocal() as s:
        return s.query(User).filter_by(username=username).one().user_id


# ------------------------------------------------------------------ logout, sessions and rejected tokens
def test_logout_is_audited_and_the_token_stops_working(client):
    token = _login(client, "analyst", "analyst-demo")
    assert client.get("/api/v1/auth/me", headers=_auth(token)).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=_auth(token)).status_code == 200
    assert _latest("LOGOUT", actor_id=_user_id("analyst")).session_id
    reuse = client.get("/api/v1/auth/me", headers=_auth(token))
    assert reuse.status_code == 401
    rejected = _latest("AUTH_TOKEN_REJECTED", actor_id=_user_id("analyst"))
    assert rejected.outcome == "DENIED" and rejected.failure_reason == "session revoked"


def test_logout_only_revokes_the_caller_session(client):
    first = _login(client, "reviewer", "reviewer-demo")
    second = _login(client, "reviewer", "reviewer-demo")
    client.post("/api/v1/auth/logout", headers=_auth(first))
    assert client.get("/api/v1/auth/me", headers=_auth(second)).status_code == 200


def test_password_change_rejection_is_audited_with_its_reason(client, auditor):
    admin = _auth(_login(client, "admin", "admin-demo"))
    created = client.post("/api/v1/users", headers=admin, json={
        "username": "audit-pw-user", "display_name": "Audit Pw", "role": "ANALYST", "jurisdiction": "Demo District A",
        "password": "audit-pw-1234"}).json()
    token = _login(client, "audit-pw-user", "audit-pw-1234")
    client.post(f"/api/v1/users/{created['user_id']}/reset-password", headers=admin, json={"new_password": "audit-pw-5678"})
    assert client.get("/api/v1/auth/me", headers=_auth(token)).status_code == 401
    assert _latest("AUTH_TOKEN_REJECTED", actor_id=created["user_id"]).failure_reason == "password changed after token issued"


# ------------------------------------------------------------------ searches are recorded without their text
def test_search_is_recorded_as_a_fingerprint_never_as_text(client):
    secret_query = "Arjun Malhotara confidential"
    token = _login(client, "investigator", INVESTIGATOR_PW)
    assert client.get("/api/v1/cases", headers=_auth(token), params={"q": secret_query}).status_code == 200
    row = _latest("CASE_LIST", actor_id=_user_id("investigator"))
    assert row.detail["search_length"] == len(secret_query) and len(row.detail["search_sha256"]) == 16
    for stored in _rows():
        assert "Arjun Malhotara" not in json.dumps(stored.detail) and "confidential" not in json.dumps(stored.detail)


# ------------------------------------------------------------------ unauthorized log access
def test_investigator_cannot_read_or_export_the_audit_log(client):
    token = _auth(_login(client, "investigator", INVESTIGATOR_PW))
    for path in ("/api/v1/audit", "/api/v1/audit/export", "/api/v1/audit/verify", "/api/v1/audit/digest?day=2026-11-12"):
        assert client.get(path, headers=token).status_code == 403, path
    denials = _rows(action="ACCESS_DENIED", actor_id=_user_id("investigator"))
    assert len(denials) >= 4 and all(d.outcome == "DENIED" for d in denials)


def test_anonymous_cannot_read_the_audit_log(client):
    assert client.get("/api/v1/audit").status_code == 401
    assert client.get("/api/v1/audit/export").status_code in (401, 403)


def test_reading_the_audit_log_is_itself_audited(client, auditor):
    _api_audit(client, auditor, action="LOGIN")
    assert _latest("AUDIT_LOG_VIEW", actor_id=_user_id("auditor")).outcome == "OK"


def test_case_audit_hides_network_details_from_assigned_investigators(client):
    token = _auth(_login(client, "investigator", INVESTIGATOR_PW))
    assert client.get("/api/v1/cases/CASE-0001/audit", headers=token).status_code == 200
    body = client.get("/api/v1/cases/CASE-0001/audit", headers=token).json()
    assert body and all("ip_address" not in row and "session_id" not in row and "user_agent" not in row for row in body)
    rows = client.get("/api/v1/cases/CASE-0001/audit", headers=_auth(_login(client, "auditor", "auditor-demo"))).json()
    assert rows and all("ip_address" in row for row in rows)


def test_unassigned_user_cannot_read_a_case_audit(client):
    token = _auth(_login(client, "outsider", "outsider-demo"))
    assert client.get("/api/v1/cases/CASE-0001/audit", headers=token).status_code == 403


def test_export_csv_and_json_carry_utc_local_and_network_fields(client, auditor):
    _login(client, "reviewer", "reviewer-demo")
    csv_resp = client.get("/api/v1/audit/export", headers=auditor, params={"format": "csv", "limit": 50})
    assert csv_resp.status_code == 200 and csv_resp.headers["content-type"].startswith("text/csv")
    header = next(csv.reader(io.StringIO(csv_resp.text)))
    assert {"occurred_at_utc", "occurred_at_local", "ip_address", "session_id", "failure_reason", "office_id"} <= set(header)
    json_resp = client.get("/api/v1/audit/export", headers=auditor, params={"format": "json", "limit": 50})
    assert isinstance(json_resp.json(), list) and json_resp.headers["cache-control"] == "no-store"
    assert _latest("AUDIT_EXPORT", actor_id=_user_id("auditor")).detail["format"] == "json"


def test_export_rejects_a_malformed_date(client, auditor):
    assert client.get("/api/v1/audit/export", headers=auditor, params={"start": "not-a-date"}).status_code == 422


# ------------------------------------------------------------------ permission and admin changes
def test_permission_and_office_changes_record_before_and_after(client):
    admin = _auth(_login(client, "admin", "admin-demo"))
    target = _user_id("analyst")
    assert client.patch(f"/api/v1/users/{target}", headers=admin, json={"office_id": "OFF-EAST"}).status_code == 200
    row = _latest("USER_UPDATE", target_id=target)
    assert row.detail["before"]["office_id"] == "OFF-DDA" and row.detail["after"]["office_id"] == "OFF-EAST"
    assert client.patch(f"/api/v1/users/{target}", headers=admin, json={"office_id": "OFF-DDA"}).status_code == 200


def test_invalid_office_code_is_rejected(client):
    admin = _auth(_login(client, "admin", "admin-demo"))
    r = client.post("/api/v1/users", headers=admin, json={
        "username": "bad-office", "display_name": "Bad Office", "role": "ANALYST", "office_id": "x y",
        "jurisdiction": "Demo District A", "password": "bad-office-1"})
    assert r.status_code == 422


# ------------------------------------------------------------------ record integrity
def test_audit_rows_are_append_only_at_the_database(client):
    _login(client, "reviewer", "reviewer-demo")  # ensure at least one row
    with db_module.engine.begin() as conn:
        with pytest.raises(Exception, match="append-only"):
            conn.execute(text("UPDATE audit_events SET outcome = 'FORGED'"))
    with db_module.engine.begin() as conn:
        with pytest.raises(Exception, match="append-only"):
            conn.execute(text("DELETE FROM audit_events"))


def test_verify_detects_a_row_altered_while_the_triggers_are_absent(client, auditor):
    _login(client, "reviewer", "reviewer-demo")
    baseline = client.get("/api/v1/audit/verify", headers=auditor).json()
    assert baseline["invalid"] == 0 and baseline["valid"] > 0
    victim = _rows(action="LOGIN", outcome="OK")[-1].audit_id
    try:
        with db_module.engine.begin() as conn:
            _drop_block_triggers(conn)
            conn.execute(text("UPDATE audit_events SET outcome = 'DENIED' WHERE audit_id = :id"), {"id": victim})
        after = client.get("/api/v1/audit/verify", headers=auditor).json()
        assert after["invalid"] >= 1 and victim in after["invalid_audit_ids"]
    finally:
        db_module.install_audit_immutability()


def test_daily_digest_changes_when_a_row_is_removed(client):
    _login(client, "reviewer", "reviewer-demo")
    now = datetime.datetime.utcnow()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + datetime.timedelta(days=1)
    with SessionLocal() as s:
        before = audit_svc.digest_range(s, start, end)
    victim = _rows(action="LOGIN")[-1].audit_id
    try:
        with db_module.engine.begin() as conn:
            _drop_block_triggers(conn)
            conn.execute(text("DELETE FROM audit_events WHERE audit_id = :id"), {"id": victim})
        with SessionLocal() as s:
            after = audit_svc.digest_range(s, start, end)
        assert after["count"] == before["count"] - 1 and after["sha256"] != before["sha256"]
    finally:
        db_module.install_audit_immutability()


def _drop_block_triggers(conn):
    """Simulates a database owner removing the append-only protection, which is the case the digest and the
    signatures are there to detect. Works on both SQLite and PostgreSQL syntax."""
    if conn.dialect.name == "postgresql":
        conn.execute(text("DROP TRIGGER IF EXISTS audit_events_no_update_delete ON audit_events"))
    else:
        conn.execute(text("DROP TRIGGER audit_events_no_update"))
        conn.execute(text("DROP TRIGGER audit_events_no_delete"))


def test_signatures_cover_the_new_fields(client):
    _login(client, "reviewer", "reviewer-demo")
    row = _latest("LOGIN", actor_id=_user_id("reviewer"), outcome="OK")
    assert audit_svc.verify_audit_event(row)
    original = row.ip_address
    row.ip_address = "10.0.0.99"  # tampering with a network field must invalidate the signature
    assert not audit_svc.verify_audit_event(row)
    row.ip_address = original


def test_sanitizer_redacts_secrets_and_keeps_hashes():
    cleaned = request_context.sanitize_detail({
        "password": "p", "access_token": "t", "nested": {"Authorization": "Bearer x", "ok": 1},
        "content_sha256": "ab" * 32, "jwt": "eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl", "text": "x" * 2000})
    assert cleaned["password"] == request_context.REDACTED and cleaned["access_token"] == request_context.REDACTED
    assert cleaned["nested"]["Authorization"] == request_context.REDACTED and cleaned["nested"]["ok"] == 1
    assert cleaned["content_sha256"] == "ab" * 32  # evidence hashes are integrity facts and stay
    assert cleaned["jwt"] == request_context.REDACTED
    assert cleaned["text"].endswith("[TRUNCATED]")


# ------------------------------------------------------------------ concurrency
def test_concurrent_events_are_all_recorded_and_all_signatures_verify():
    before = len(_rows(action="CONCURRENCY_PROBE"))

    def write(i):
        with SessionLocal() as s:
            audit_svc.record_audit(s, f"REQ-probe-{i}", None, "CONCURRENCY_PROBE", "PROBE", str(i), outcome="OK",
                                   detail={"i": i})
            s.commit()

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(write, range(60)))
    rows = _rows(action="CONCURRENCY_PROBE")
    assert len(rows) - before == 60
    assert len({r.audit_id for r in rows}) == len(rows)
    assert all(audit_svc.verify_audit_event(r) for r in rows)


def test_concurrent_logins_each_produce_exactly_one_audit_row():
    def login(i):
        c = TestClient(app, client=(f"203.0.113.{100 + i}", 4000))
        return c.post("/api/v1/auth/login", json={"username": "reviewer", "password": "reviewer-demo"}).status_code

    with ThreadPoolExecutor(max_workers=6) as pool:
        codes = list(pool.map(login, range(6)))
    assert codes.count(200) == 6
    ips = {r.ip_address for r in _rows(action="LOGIN", actor_id=_user_id("reviewer"), outcome="OK")}
    assert {f"203.0.113.{100 + i}" for i in range(6)} <= ips


# ------------------------------------------------------------------ criticality
def test_sensitive_change_fails_closed_when_its_audit_cannot_be_written(client, monkeypatch):
    admin = _auth(_login(client, "admin", "admin-demo"))
    target = _user_id("reviewer")
    before_role = _role_of("reviewer")

    def broken(*_a, **_k):
        raise RuntimeError("audit signing unavailable")

    monkeypatch.setattr(audit_svc, "sign_audit_event", broken)
    with pytest.raises(RuntimeError):
        client.patch(f"/api/v1/users/{target}", headers=admin, json={"role": "ANALYST"})
    monkeypatch.undo()
    assert _role_of("reviewer") == before_role  # the change did not happen


def _role_of(username):
    with SessionLocal() as s:
        return s.query(User).filter_by(username=username).one().role


def test_read_view_is_served_when_its_best_effort_audit_fails(client, monkeypatch):
    token = _auth(_login(client, "investigator", INVESTIGATOR_PW))

    def broken(*_a, **_k):
        raise RuntimeError("audit signing unavailable")

    monkeypatch.setattr(audit_svc, "sign_audit_event", broken)
    try:
        r = client.get("/api/v1/cases/CASE-0001/evidence/summary", headers=token)
    finally:
        monkeypatch.undo()
    assert r.status_code == 200 and r.json()["case_id"] == "CASE-0001"


def test_search_is_fail_closed_when_its_audit_fails(client, monkeypatch):
    token = _auth(_login(client, "investigator", INVESTIGATOR_PW))

    def broken(*_a, **_k):
        raise RuntimeError("audit signing unavailable")

    monkeypatch.setattr(audit_svc, "sign_audit_event", broken)
    with pytest.raises(RuntimeError):
        client.get("/api/v1/cases", headers=token, params={"q": "anything"})
    monkeypatch.undo()


# ------------------------------------------------------------------ schema presence
def test_append_only_triggers_and_new_columns_exist():
    with db_module.engine.connect() as conn:
        if conn.dialect.name == "postgresql":
            triggers = {r[0] for r in conn.execute(text(
                "SELECT tgname FROM pg_trigger WHERE tgrelid = 'audit_events'::regclass AND NOT tgisinternal"))}
            columns = {r[0] for r in conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_events'"))}
            sessions = {r[0] for r in conn.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))}
            assert {"audit_events_no_update_delete", "audit_events_no_truncate"} <= triggers
        else:
            triggers = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='trigger'"))}
            columns = {r[1] for r in conn.execute(text("PRAGMA table_info(audit_events)"))}
            sessions = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
            assert {"audit_events_no_update", "audit_events_no_delete"} <= triggers
    assert {"actor_username", "office_id", "resource_office", "session_id", "ip_address", "user_agent",
            "correlation_id", "failure_reason"} <= columns
    assert "user_sessions" in sessions
