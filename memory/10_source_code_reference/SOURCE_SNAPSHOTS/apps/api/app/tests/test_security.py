"""Security gate: authn, server-side case authorization, masking, audit, scan gate, hash integrity."""
from .conftest import upload


def test_unauthenticated_denied(client):
    assert client.get("/api/v1/cases").status_code == 401
    assert client.get("/api/v1/cases/CASE-0001/graph").status_code == 401


def test_unassigned_user_denied_server_side(client, unassigned, auditor):
    r = client.get("/api/v1/cases/CASE-0001", headers=unassigned)
    assert r.status_code == 403
    # every protected surface is denied, not just the case card
    for path in ("/graph", "/evidence", "/candidates", "/timeline", "/analysis", "/audit"):
        assert client.get(f"/api/v1/cases/CASE-0001{path}", headers=unassigned).status_code == 403, path
    # ...and the denial itself is audited
    denials = [a for a in client.get("/api/v1/audit?action=ACCESS_DENIED", headers=auditor).json() if a["case_id"] == "CASE-0001"]
    assert denials and denials[0]["outcome"] == "DENIED"
    # case listing does not leak the case either
    assert "CASE-0001" not in [c["case_id"] for c in client.get("/api/v1/cases", headers=unassigned).json()]


def test_jurisdiction_mismatch_denied(client, outsider, admin):
    client.post("/api/v1/cases/CASE-0001/assign", headers=admin, json={"username": "outsider"})
    assert client.get("/api/v1/cases/CASE-0001", headers=outsider).status_code == 403


def test_role_gate_on_upload(client, reviewer):
    r = upload(client, reviewer, "CASE-0001", "locations.csv")
    assert r.status_code == 403


def test_upload_validation_rejects_bad_files(client, officer):
    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer, files={"file": ("evil.exe", b"MZ....")})
    assert r.status_code == 422 and "unsupported" in r.text
    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer, files={"file": ("fake.pdf", b"not a pdf")})
    assert r.status_code == 422 and "magic" in r.text
    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer, files={"file": ("broken.json", b"{oops")})
    assert r.status_code == 422 and "JSON" in r.text
    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer, files={"file": ("empty.csv", b"")})
    assert r.status_code == 422


def test_scan_gate_fail_closed(client, officer, admin):
    # EICAR test file → INFECTED, stays in quarantine, no claims extracted
    r = upload(client, officer, "CASE-0001", "documents/eicar_test.txt")
    d = r.json()
    assert d["status"] == "INFECTED" and d["storage_area"] == "quarantine" and d["claim_count"] == 0
    # context is refused for quarantined evidence
    r = client.post(f"/api/v1/evidence/{d['evidence_id']}/context/reveal", headers=admin, json={"reason":"testing", "line":1})
    assert r.status_code == 409

def test_hash_manifest_and_tamper_detection(client, officer, admin):
    r = upload(client, officer, "CASE-0002", "documents/fir_001.txt")  # case 2 so case-1 counts stay deterministic
    d = r.json()
    assert len(d["sha256"]) == 64
    assert client.get(f"/api/v1/evidence/{d['evidence_id']}/verify", headers=officer).json()["match"] is True
    # Tamper through the storage layer, not the demo HTTP route: /demo/* is deliberately NOT mounted on non-SQLite
    # deployments (see test_demo_routes_not_mounted_outside_sqlite). The previous version ignored the tamper
    # response, so on PostgreSQL it silently tampered nothing and failed with a misleading assertion.
    from apps.api.app.db import SessionLocal
    from apps.api.app.models import Evidence
    from apps.api.app.services import storage
    db = SessionLocal()
    try:
        path = db.get(Evidence, d["evidence_id"]).storage_path
    finally:
        db.close()
    storage.overwrite_for_demo(path, storage.read_bytes(path) + b"\n")
    assert storage.verify_hash(path, d["sha256"])[0] is False, "tamper precondition: stored bytes must now differ"
    assert client.get(f"/api/v1/evidence/{d['evidence_id']}/context?line=1", headers=officer).status_code == 409
    
    v = client.get(f"/api/v1/evidence/{d['evidence_id']}/verify", headers=officer).json()
    assert v["match"] is False and v["actual_sha256"] != v["expected_sha256"]
    # mismatch is a first-class evidence state: blocks reprocessing and source serving, and is audited
    assert v["status"] == "INTEGRITY_MISMATCH"
    assert client.get(f"/api/v1/evidence/{d['evidence_id']}", headers=officer).json()["status"] == "INTEGRITY_MISMATCH"
    assert client.post(f"/api/v1/evidence/{d['evidence_id']}/process", headers=officer, json={}).status_code == 409
    assert client.get(f"/api/v1/evidence/{d['evidence_id']}/context?line=1", headers=officer).status_code == 409
    assert any(a["action"] == "INTEGRITY_MISMATCH" for a in client.get("/api/v1/audit?action=INTEGRITY_MISMATCH", headers=admin).json())


def test_demo_routes_not_mounted_outside_sqlite(client, admin):
    """Production control: the evidence-tampering demo endpoint exists only on the SQLite demo path."""
    from apps.api.app import config
    r = client.post("/api/v1/demo/tamper/EVD-does-not-exist", headers=admin)
    if config.DATABASE_URL.startswith("sqlite"):
        assert r.status_code == 404  # mounted: unknown evidence
    else:
        assert r.status_code in (404, 405)  # not mounted at all
        assert not any(getattr(rt, "path", "").startswith("/api/v1/demo") for rt in client.app.routes)


def test_masking_and_audited_reveal(client, investigator, ingested, auditor, reviewer):
    g = client.get("/api/v1/cases/CASE-0001/graph?max_nodes=150", headers=investigator).json()
    phones = [n for n in g["nodes"] if n["kind"] == "PHONE"]
    assert phones and all("••" in n["label"] for n in phones)
    assert all("••" in n["label"] for n in g["nodes"] if n["kind"] == "ACCOUNT")
    # provenance snippets are masked too
    ev = ingested["calls.csv"]["evidence_id"]
    ctx = client.get(f"/api/v1/evidence/{ev}/context?row=2", headers=investigator).json()
    assert "90000" not in "".join(l["text"] for l in ctx["lines"])
    # reveal needs a reason and is audited
    r = client.post(f"/api/v1/entities/{phones[0]['entity_id']}/reveal", headers=investigator, json={"case_id": "CASE-0001", "reason": "x"})
    assert r.status_code == 422
    r = client.post(f"/api/v1/entities/{phones[0]['entity_id']}/reveal", headers=investigator, json={"case_id": "CASE-0001", "reason": "verify subscriber for review"})
    assert r.status_code == 200 and "••" not in r.json()["value"]
    audit = client.get("/api/v1/audit?action=UNMASK", headers=auditor).json()
    assert audit[0]["audit_id"] == r.json()["audit_id"] and audit[0]["detail"]["reason"] == "verify subscriber for review"


def test_frontend_cannot_reach_graph_store(client):
    # there is no graph-store endpoint at all; the only graph surface is the bounded, authorized API
    from apps.api.app.main import app
    paths = " ".join(app.openapi()["paths"]).lower()
    assert "cypher" not in paths and "neo4j" not in paths and "bolt" not in paths
    for p in ("/api/v1/neo4j", "/api/v1/cypher", "/api/v1/graph/raw"):
        assert client.get(p).status_code in (404, 401, 405), p


def test_no_secrets_in_repo():
    import re
    from apps.api.app.config import REPO_ROOT
    bad = re.compile(r"(AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----|sk-[A-Za-z0-9]{20,})")
    skip = {"node_modules", ".venv", ".venv311", "venv", ".git", "storage", "dist", "__pycache__", ".pytest_cache"}
    for p in REPO_ROOT.rglob("*"):
        if p.is_file() and p.suffix in (".py", ".ts", ".tsx", ".md", ".yml", ".yaml", ".json", ".example") and not (skip & set(p.parts)):
            assert not bad.search(p.read_text(errors="ignore")), p

def test_scanner_bypass_not_allowed(client, officer):
    """P0-4/P0-5 regression: force_scan_outcome is rejected, automatic testgate fallback disabled."""
    eicar = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer,
                    files={"file": ("test.txt", eicar)}, data={"force_scan_outcome": "CLEAN"})
    # It either fails upload or rejects the extra form data because it's not in the schema anymore
    assert r.status_code in (422, 403, 400) or (r.status_code == 201 and "CLEAN" not in r.text)

def test_cross_case_entity_reveal_idor(client, outsider, unassigned):
    """P0-6 regression: must not reveal an entity from a case the user doesn't have access to, or if the entity is in a different case."""
    # Assuming outsider has access to CASE-0002 but not CASE-0001
    r = client.post("/api/v1/entities/P-A1/reveal", headers=outsider,
                    json={"case_id": "CASE-0002", "reason": "IDOR check"})
    assert r.status_code in (403, 404)

def test_unmasked_true_bypass_removed(client, officer, investigator):
    """P0-7 regression: GET /evidence/{id}/context?unmasked=true must not return unmasked values."""
    # Context endpoint doesn't accept unmasked=true anymore, it should still return masked values.
    # Upload evidence with an Indian phone number (which will be masked)
    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer, files={"file": ("test.txt", b"call John at +91-98765-43210")}, data={"source_label": "synthetic"})
    d = r.json()
    evidence_id = d["evidence_id"]
    client.post(f"/api/v1/evidence/{evidence_id}/process", headers=officer, json={})
    
    # Try with unmasked=true in query (should be ignored, still masked)
    r = client.get(f"/api/v1/evidence/{evidence_id}/context?line=1&unmasked=true", headers=officer)
    assert r.status_code == 200
    assert "98765" not in r.json()["lines"][0]["text"]
    assert "••" in r.json()["lines"][0]["text"]
    
    # Correct unmasking requires POST /context/reveal with auth and reason
    r = client.post(f"/api/v1/evidence/{evidence_id}/context/reveal", headers=investigator, json={"reason": "investigation", "line": 1})
    assert r.status_code == 200
    assert "98765" in r.json()["lines"][0]["text"]


def test_audit_hmac_verification(client, officer):
    from ..services.audit import verify_audit_event
    from ..models import AuditEvent
    from ..db import SessionLocal
    db = SessionLocal()
    
    # generate some audit event
    client.get("/api/v1/cases/CASE-0001", headers=officer)
    ev = db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).first()
    
    import copy
    import datetime
    
    # 1. it should verify successfully
    assert verify_audit_event(ev) is True
    
    def tamper_and_check(field, value):
        tampered_ev = copy.copy(ev)
        setattr(tampered_ev, field, value)
        assert verify_audit_event(tampered_ev) is False, f"Tampering {field} did not fail verification"
        
    # 2. tampering with fields breaks it
    tamper_and_check("audit_id", "AUD-tampered")
    tamper_and_check("created_at", ev.created_at + datetime.timedelta(seconds=1))
    tamper_and_check("actor_id", "USR-tampered")
    tamper_and_check("action", "TAMPERED_ACTION")
    tamper_and_check("target_id", "TGT-tampered")
    tamper_and_check("case_id", "CASE-tampered")
    tamper_and_check("outcome", "TAMPERED")
    tamper_and_check("detail", {"tampered": True})
    
    # 3. signature mutations
    tampered_sig_ev = copy.copy(ev)
    
    tampered_sig_ev.signature = ev.signature[:-1] + ("0" if ev.signature[-1] != "0" else "1")
    assert verify_audit_event(tampered_sig_ev) is False, "Tampered signature matched"
    
    tampered_sig_ev.signature = ev.signature.replace("hmac-sha256", "hmac-md5")
    assert verify_audit_event(tampered_sig_ev) is False, "Algorithm change matched"
    
    tampered_sig_ev.signature = ev.signature.replace("k1-2026", "k2-2027")
    assert verify_audit_event(tampered_sig_ev) is False, "Key ID change matched"
    
    tampered_sig_ev.signature = None
    assert verify_audit_event(tampered_sig_ev) is False, "NULL signature matched"
    
    tampered_sig_ev.signature = "invalid-format"
    assert verify_audit_event(tampered_sig_ev) is False, "Malformed signature matched"
    
    db.close()

def test_production_rejects_testgate(monkeypatch):
    import pytest
    from .. import config
    
    monkeypatch.setattr(config, "DATABASE_URL", "postgresql://user:pass@localhost/db")
    monkeypatch.setattr(config, "SECRET_KEY", "r" * 64)  # >= 32 chars since DEF-057
    monkeypatch.setattr(config, "SCANNER_MODE", "testgate")
    monkeypatch.delenv("DRISHTI_ALLOW_TEST_SCANNER", raising=False)
    
    with pytest.raises(ValueError, match="testgate"):
        config.validate_production_secrets()

def test_testgate_override_requires_explicit_flag(monkeypatch):
    from .. import config
    
    monkeypatch.setattr(config, "DATABASE_URL", "postgresql://user:pass@localhost/db")
    monkeypatch.setattr(config, "SECRET_KEY", "r" * 64)  # >= 32 chars since DEF-057
    monkeypatch.setattr(config, "SCANNER_MODE", "testgate")
    monkeypatch.setenv("DRISHTI_ALLOW_TEST_SCANNER", "1")
    
    # Should not raise
    config.validate_production_secrets()

def test_audit_hmac_historical_key_rotation(monkeypatch):
    from .. import config
    from ..services.audit import verify_audit_event
    from ..models import AuditEvent
    
    # Positive historical key rotation test
    monkeypatch.setattr(config, "AUDIT_KEYS", {
        "k1-2026": "old-secret-key-that-was-used",
        "k2-2027": "new-current-secret-key"
    })
    monkeypatch.setattr(config, "CURRENT_AUDIT_KEY_ID", "k2-2027")
    
    # 1. Simulate an event signed by the old key
    ev_old = AuditEvent(audit_id="AUD-old", trace_id="trace-1", action="TEST", outcome="OK")
    from ..models import utcnow
    ev_old.created_at = utcnow()
    
    from ..services.audit import _compute_hmac
    old_sig = _compute_hmac(b"old-secret-key-that-was-used", ev_old)
    ev_old.signature = f"k1-2026:hmac-sha256:{old_sig}"
    
    # Verify the old event works with the old key
    assert verify_audit_event(ev_old) is True
    
    # 2. Simulate an event signed by the new key
    ev_new = AuditEvent(audit_id="AUD-new", trace_id="trace-2", action="TEST", outcome="OK")
    ev_new.created_at = utcnow()
    new_sig = _compute_hmac(b"new-current-secret-key", ev_new)
    ev_new.signature = f"k2-2027:hmac-sha256:{new_sig}"
    
    assert verify_audit_event(ev_new) is True
    
    # 3. Simulate an unknown key
    ev_unk = AuditEvent(audit_id="AUD-unk", trace_id="trace-3", action="TEST", outcome="OK")
    ev_unk.signature = f"k9-9999:hmac-sha256:{new_sig}"
    assert verify_audit_event(ev_unk) is False


def test_spa_fallback_serves_only_files_inside_dist(tmp_path):
    """DEF-028: the SPA fallback must never serve a file outside the web build directory."""
    from apps.api.app.main import safe_dist_file

    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html>")
    (dist / "favicon.svg").write_text("<svg/>")
    secret = tmp_path / ".env"
    secret.write_text("DRISHTI_SECRET_KEY=not-a-real-key")
    (dist / "escape-link").symlink_to(secret)

    # success: a real file inside dist is returned
    assert safe_dist_file(dist, "favicon.svg") == (dist / "favicon.svg").resolve()
    # failure: traversal, absolute paths, symlink escape, directories and missing files are all refused
    for bad in ("../.env", "assets/../../.env", "/etc/passwd", str(secret), "escape-link", "assets", "", "missing.js"):
        assert safe_dist_file(dist, bad) is None, bad


def test_spa_route_does_not_leak_repository_files(client):
    """DEF-028 over HTTP: percent-encoded `..` reaches the route decoded; it must get the app shell, never the file."""
    from apps.api.app import config

    if not config.WEB_DIST.exists():
        import pytest
        pytest.skip("web build absent: the SPA route is not mounted")
    for path in ("/%2e%2e/%2e%2e/%2e%2e/README.md", "/..%2f..%2f..%2f.env.example", "/%2e%2e%2f%2e%2e%2f%2e%2e%2fCLAUDE.md"):
        r = client.get(path)
        assert r.status_code == 200, path
        assert r.text.lower().startswith("<!doctype html"), (path, r.text[:80])
        assert "DRISHTI_" not in r.text and "DRISHTI-NET — working prototype" not in r.text, path


def test_candidate_assign_and_stats_enforce_case_authorization(client, ingested, unassigned, reviewer, auditor):
    """DEF-031: `POST /candidates/{id}/assign` and `GET /cases/{id}/stats` had a role check but no case check, so a
    user not assigned to CASE-0001 could claim its review tasks (and read the candidate) and read its review stats."""
    cands = client.get("/api/v1/cases/CASE-0001/candidates", headers=reviewer).json()
    assert cands, "precondition: CASE-0001 has review candidates"
    cid = cands[0]["candidate_id"]

    # failure: unassigned investigator is denied on both, and the candidate is not modified
    r = client.post(f"/api/v1/candidates/{cid}/assign", headers=unassigned)
    assert r.status_code == 403, r.text
    assert "signals" not in r.text and "left" not in r.json()
    assert client.get(f"/api/v1/candidates/{cid}", headers=reviewer).json().get("assigned_to") in (None, "")
    assert client.get("/api/v1/cases/CASE-0001/stats", headers=unassigned).status_code == 403
    denials = [a for a in client.get("/api/v1/audit?action=ACCESS_DENIED", headers=auditor).json()
               if a["case_id"] == "CASE-0001" and (a.get("detail") or {}).get("attempted_action") in ("HITL_TASK_ASSIGN", "HITL_STATS")]
    assert len(denials) >= 2

    # success: an assigned reviewer can still claim the task and read the stats
    r = client.post(f"/api/v1/candidates/{cid}/assign", headers=reviewer)
    assert r.status_code == 200, r.text
    assert r.json()["assigned_to"]
    assert client.get("/api/v1/cases/CASE-0001/stats", headers=reviewer).status_code == 200


def test_entity_card_does_not_leak_entities_or_attributes_from_other_cases(client, ingested, investigator, unassigned):
    """DEF-033: `GET /entities/{id}?case_id=X` authorized case X but never checked that the entity belongs to X, and
    when the entity had no attributes for X it fell back to the whole per-case attribute map. `unassigned` is
    legitimately assigned to CASE-0002, so it could read CASE-0001 people's DOB/address by passing case_id=CASE-0002."""
    nodes = client.get("/api/v1/cases/CASE-0001/graph?limit=150", headers=investigator).json()["nodes"]
    persons = [n["entity_id"] for n in nodes if n.get("kind") == "PERSON"]
    case2 = {n["entity_id"] for n in client.get("/api/v1/cases/CASE-0002/graph?limit=150", headers=investigator).json()["nodes"]}
    only_case1 = [p for p in persons if p not in case2]
    assert only_case1, "precondition: a CASE-0001-only person"
    eid = only_case1[0]

    # success: within its own case the card is returned, with that case's attributes only
    ok = client.get(f"/api/v1/entities/{eid}?case_id=CASE-0001", headers=investigator)
    assert ok.status_code == 200, ok.text
    assert "CASE-0001" not in ok.json()["attributes"], "attributes must be the flattened per-case view"

    # failure: a user authorized only for CASE-0002 cannot read it through CASE-0002
    r = client.get(f"/api/v1/entities/{eid}?case_id=CASE-0002", headers=unassigned)
    assert r.status_code == 403, r.text
    assert "dob" not in r.text and "address" not in r.text


def test_short_secret_key_rejected_even_on_sqlite(monkeypatch):
    """DEF-057: any non-default key was accepted (DRISHTI_SECRET_KEY=x); the check was skipped for SQLite."""
    import pytest
    from .. import config
    monkeypatch.setattr(config, "DATABASE_URL", "sqlite:///demo.db")
    monkeypatch.setattr(config, "SECRET_KEY", "x")
    with pytest.raises(ValueError, match="at least 32"):
        config.validate_production_secrets()
    monkeypatch.setattr(config, "SECRET_KEY", "k" * 64)
    config.validate_production_secrets()  # success path: a strong key is accepted


def test_raw_download_requires_unmask_role_and_an_audited_reason(client, ingested, officer, investigator, auditor):
    """DEF-101 (owner decision 2026-11-04): raw evidence bytes are unmasked, so only roles allowed to reveal masked
    values may download them (investigator, reviewer, admin), and only with a reason recorded in the audit log.
    Previously EVIDENCE_OFFICER and AUDITOR could download raw files they were not allowed to unmask, with no reason."""
    ev = ingested["vehicles.csv"]["evidence_id"]
    url = f"/api/v1/evidence/{ev}/download"
    g = client.get(url, headers=investigator)  # the reason must travel in a POST body, never a URL
    assert g.status_code in (404, 405) and b"vehicle_id" not in g.content, g.status_code  # 404: the SPA catch-all owns GET
    assert client.post(url, headers=officer, json={"reason": "need the original file"}).status_code == 403
    assert client.post(url, headers=auditor, json={"reason": "need the original file"}).status_code == 403
    assert client.post(url, headers=investigator, json={}).status_code == 422
    assert client.post(url, headers=investigator, json={"reason": "x"}).status_code == 422
    r = client.post(url, headers=investigator, json={"reason": "compare with registry extract"})
    assert r.status_code == 200 and r.content.startswith(b"vehicle_id")  # success path: the exact original bytes
    rows = [a for a in client.get("/api/v1/audit?action=EVIDENCE_DOWNLOAD&limit=500", headers=auditor).json() if a["target_id"] == ev]
    assert rows and rows[0]["detail"].get("reason") == "compare with registry extract", rows[:1]
    denials = client.get("/api/v1/audit?action=ACCESS_DENIED&limit=1000", headers=auditor).json()
    assert any(f"/evidence/{ev}/download" in (a.get("target_id") or "") for a in denials)


def test_seed_cli_refuses_the_public_default_key(tmp_path):
    """DEF-102: the live demo's first 33 audit events were signed with the built-in default key (published in
    config.py) because `seed --ingest` ran without .env loaded -- those signatures prove nothing. The CLI now refuses
    the default key unless explicitly allowed."""
    import os, subprocess, sys
    from pathlib import Path
    repo = Path(__file__).resolve().parents[4]
    base = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(tmp_path), "DRISHTI_STORAGE_ROOT": str(tmp_path),
            "DRISHTI_DATABASE_URL": f"sqlite:///{tmp_path}/seed.db", "DRISHTI_SCANNER_MODE": "testgate"}
    run = lambda extra: subprocess.run([sys.executable, "-m", "apps.api.app.seed"], cwd=repo, env={**base, **extra},
                                       capture_output=True, text=True, timeout=300)
    r = run({})
    assert r.returncode == 2 and "default" in (r.stderr + r.stdout).lower(), (r.returncode, r.stderr[-300:])
    assert run({"DRISHTI_SECRET_KEY": "s" * 64}).returncode == 0  # success path: a real key
