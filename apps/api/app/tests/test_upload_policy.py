"""Upload limits and file validation: boundary sizes, signature/MIME mismatches, executable content, unsafe names,
interrupted uploads, archive bombs (including a ZIP whose headers lie), concurrency, storage failures, low disk, large
media that must never be read into memory, the scanner-size limit, policy administration and monitoring.
"""
import hashlib
import io
import os
import struct
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from apps.api.app import config
from apps.api.app.db import SessionLocal
from apps.api.app.main import app
from apps.api.app.models import AuditEvent, Evidence
from apps.api.app.services import storage, upload_policy

PNG = b"\x89PNG\r\n\x1a\n"
MP4 = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2"
EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


def _login(client, user):
    r = client.post("/api/v1/auth/login", json={"username": user, "password": f"{user}-demo"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
def officer_h(client):
    return _login(client, "officer")


@pytest.fixture
def admin_h(client):
    return _login(client, "admin")


@pytest.fixture(autouse=True)
def _reset_policies():
    yield
    with SessionLocal() as s:
        s.execute(text("DELETE FROM upload_policies"))
        s.commit()


def _stream(client, headers, filename, data, case_id="CASE-0001", process=False, extra_headers=None):
    return client.post(f"/api/v1/cases/{case_id}/evidence/stream", headers={**headers, "Content-Type": "application/octet-stream", **(extra_headers or {})},
                       params={"filename": filename, "process": str(process).lower()}, content=data)


def _rows(case_id="CASE-0001"):
    with SessionLocal() as s:
        return s.query(Evidence).filter_by(case_id=case_id).count()


def _staging_files():
    return list(upload_policy.staging_dir().glob("*.part"))


def _set_policy(client, admin_h, category, max_mb, enabled=True):
    return client.put(f"/api/v1/upload-policies/{category}", headers=admin_h,
                      json={"max_mb": max_mb, "enabled": enabled, "reason": "test boundary configuration"})


def _last_rejection():
    with SessionLocal() as s:
        return (s.query(AuditEvent).filter(AuditEvent.action == "EVIDENCE_UPLOAD", AuditEvent.outcome == "DENIED")
                .order_by(AuditEvent.created_at.desc(), AuditEvent.audit_id.desc()).first())


# ------------------------------------------------------------------ boundary sizes
def test_exact_limit_accepted_one_byte_over_rejected(client, officer_h, admin_h):
    assert _set_policy(client, admin_h, "IMAGE", 1).status_code == 200
    limit = 1024 * 1024
    exact = PNG + os.urandom(limit - len(PNG))
    over = PNG + os.urandom(limit + 1 - len(PNG))
    before = _rows()
    assert _stream(client, officer_h, "exact.png", exact).status_code == 201
    r = _stream(client, officer_h, "over.png", over)
    assert r.status_code == 413 and "image limit of 1 MB" in r.json()["detail"]
    assert _rows() == before + 1 and not _staging_files()
    assert _last_rejection().detail["code"] == "TOO_LARGE"


def test_declared_length_over_limit_is_refused_before_reading(client, officer_h, admin_h, monkeypatch):
    _set_policy(client, admin_h, "IMAGE", 1)
    calls = []
    real_stage = upload_policy.stage

    async def spy(*a, **k):
        calls.append(1)
        return await real_stage(*a, **k)

    monkeypatch.setattr(upload_policy, "stage", spy)
    r = _stream(client, officer_h, "big.png", PNG + os.urandom(2 * 1024 * 1024))
    assert r.status_code == 413 and calls == []  # refused on Content-Length, no staging at all


def test_multipart_route_keeps_its_overall_cap(client, officer_h, monkeypatch):
    monkeypatch.setattr(config, "MAX_UPLOAD_MB", 1)
    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer_h,
                    files={"file": ("big.png", PNG + os.urandom(1024 * 1024 + 10))})
    assert r.status_code == 413 and not _staging_files()


# ------------------------------------------------------------------ signatures, MIME and executable content
@pytest.mark.parametrize("name,data", [
    ("photo.png", b"\xff\xd8\xff\xe0" + os.urandom(100)),          # JPEG bytes named .png
    ("clip.mp4", os.urandom(200)),                                  # no ftyp box
    ("scan.pdf", PNG + os.urandom(100)),                            # PNG bytes named .pdf
    ("call.wav", b"RIFF\x00\x00\x00\x00AVI " + os.urandom(100)),    # AVI named .wav
    ("image.e01", b"NOT-EWF" + os.urandom(100)),
    ("trace.pcap", os.urandom(100)),
])
def test_signature_mismatch_rejected(client, officer_h, name, data):
    before = _rows()
    r = _stream(client, officer_h, name, data)
    assert r.status_code == 422 and "magic-byte signature" in r.json()["detail"]
    assert _rows() == before and not _staging_files()
    assert _last_rejection().detail["code"] == "SIGNATURE_MISMATCH"


def test_client_mime_type_is_not_trusted(client, officer_h):
    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer_h,
                    files={"file": ("photo.png", b"MZ\x90\x00" + os.urandom(100), "image/png")})
    assert r.status_code == 422 and "executable" in r.json()["detail"]


@pytest.mark.parametrize("name,data", [
    ("tool.jpg", b"MZ\x90\x00" + os.urandom(64)),
    ("binary.png", b"\x7fELF\x02\x01" + os.urandom(64)),
    ("notes.txt", b"#!/bin/sh\nrm -rf /\n"),
])
def test_executable_content_rejected_whatever_the_extension(client, officer_h, name, data):
    r = _stream(client, officer_h, name, data)
    assert r.status_code == 422 and _last_rejection().detail["code"] == "EXECUTABLE_CONTENT"


@pytest.mark.parametrize("name", ["../escape.png", "a/b.png", "a\\b.png", "..png.png/..", "%2e%2e.png", "x" * 130 + ".png",
                                  "null\x00.png", "evil.exe", "noext"])
def test_unsafe_or_unsupported_names_rejected(client, officer_h, name):
    r = _stream(client, officer_h, name, PNG + os.urandom(50))
    assert r.status_code == 422, (name, r.status_code)
    assert not _staging_files()


def test_valid_media_and_forensic_types_accepted(client, officer_h):
    samples = {
        "cctv.mp4": MP4 + os.urandom(500), "cam.mkv": b"\x1a\x45\xdf\xa3" + os.urandom(500),
        "rec.wav": b"RIFF\x00\x00\x00\x00WAVE" + os.urandom(500), "photo.jpg": b"\xff\xd8\xff\xe0" + os.urandom(500),
        "disk.e01": b"EVF\x09\x0d\x0a\xff\x00" + os.urandom(500), "net.pcap": b"\xd4\xc3\xb2\xa1" + os.urandom(500),
        "drive.dd": os.urandom(500),
    }
    for name, data in samples.items():
        r = _stream(client, officer_h, name, data)
        assert r.status_code == 201, (name, r.text)
        body = r.json()
        assert body["sha256"] == hashlib.sha256(data).hexdigest() and body["size_bytes"] == len(data)
        assert body["status"] == "QUARANTINED" and body["storage_area"] == "quarantine"


# ------------------------------------------------------------------ interrupted and partial uploads
def test_short_body_is_an_interrupted_upload_and_leaves_nothing(client, officer_h):
    before = _rows()
    data = PNG + os.urandom(500)
    r = _stream(client, officer_h, "cut.png", data, extra_headers={"Content-Length": str(len(data) + 1000)})
    assert r.status_code == 400 and "incomplete" in r.json()["detail"]
    assert _rows() == before and not _staging_files()
    assert _last_rejection().detail["code"] == "INTERRUPTED"


def test_missing_content_length_is_refused(client, officer_h):
    def body():
        yield PNG
        yield os.urandom(100)
    r = client.post("/api/v1/cases/CASE-0001/evidence/stream", headers={**officer_h, "Content-Type": "application/octet-stream"},
                    params={"filename": "chunked.png"}, content=body())
    assert r.status_code == 411


def test_stale_staging_files_are_cleaned(monkeypatch):
    stale = upload_policy.staging_dir() / "abandoned.part"
    stale.write_bytes(b"partial upload from a crashed process")
    old = time.time() - (config.UPLOAD_STALE_STAGING_HOURS + 1) * 3600
    os.utime(stale, (old, old))
    assert upload_policy.cleanup_stale_staging() >= 1 and not stale.exists()


# ------------------------------------------------------------------ archives
def _zip(members: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in members.items():
            zf.writestr(name, data)
    return buf.getvalue()


def test_archive_bomb_rejected_on_both_routes(client, officer_h):
    bomb = _zip({"zeros.txt": b"0" * (20 * 1024 * 1024)})  # ~1000:1
    assert _stream(client, officer_h, "bomb.zip", bomb).status_code == 422
    assert client.post("/api/v1/cases/CASE-0001/evidence", headers=officer_h, files={"file": ("bomb.zip", bomb)}).status_code == 422
    assert "decompression bomb" in _last_rejection().detail["reason"]


def test_archive_traversal_rejected_on_the_stream_route(client, officer_h):
    r = _stream(client, officer_h, "trav.zip", _zip({"../../etc/cron.txt": b"x"}))
    assert r.status_code == 422 and "path traversal" in r.json()["detail"]


def test_zip_whose_headers_understate_the_size_cannot_expand_past_them():
    """A bomb that lies about its uncompressed size passes the metadata check, so extraction must be bounded by the
    declared size. Python's zipfile stops at the declared size and then fails the CRC check."""
    raw = bytearray(_zip({"lie.txt": b"A" * (5 * 1024 * 1024)}))
    struct.pack_into("<I", raw, 22, 10)                       # local header: uncompressed size
    cd = raw.find(b"PK\x01\x02")
    struct.pack_into("<I", raw, cd + 24, 10)                  # central directory: uncompressed size
    zf = zipfile.ZipFile(io.BytesIO(bytes(raw)))
    assert zf.infolist()[0].file_size == 10
    got = b""
    with pytest.raises(zipfile.BadZipFile):
        with zf.open(zf.infolist()[0]) as fh:
            got = fh.read()
    assert len(got) <= 10


# ------------------------------------------------------------------ concurrency
def test_concurrent_uploads_of_the_same_file_create_one_evidence_row():
    data = MP4 + os.urandom(4096)

    def go(_):
        c = TestClient(app)
        h = _login(c, "officer")
        return _stream(c, h, "same.mp4", data).json()["evidence_id"]

    with ThreadPoolExecutor(max_workers=4) as pool:
        ids = list(pool.map(go, range(4)))
    assert len(set(ids)) == 1
    with SessionLocal() as s:
        assert s.query(Evidence).filter_by(sha256=hashlib.sha256(data).hexdigest()).count() == 1
    assert not _staging_files()


def test_concurrency_limit_returns_429(client, officer_h, monkeypatch):
    monkeypatch.setattr(config, "UPLOAD_MAX_CONCURRENT", 0)
    r = _stream(client, officer_h, "busy.png", PNG + os.urandom(64))
    assert r.status_code == 429 and r.headers["Retry-After"] == "30"


# ------------------------------------------------------------------ storage failures and exhaustion
def test_storage_failure_leaves_no_row_and_no_staging(client, officer_h, monkeypatch):
    def down(*a, **k):
        raise ConnectionError("object store unreachable")
    monkeypatch.setattr(storage, "store_quarantine_file", down)
    before = _rows()
    r = _stream(client, officer_h, "lost.mp4", MP4 + os.urandom(1000))
    assert r.status_code == 503 and _rows() == before and not _staging_files()


def test_low_disk_refuses_upload_with_507(client, officer_h, monkeypatch):
    monkeypatch.setattr(upload_policy, "disk_free_bytes", lambda: 10 * 1024 * 1024)
    r = _stream(client, officer_h, "low.mp4", MP4 + os.urandom(1000))
    assert r.status_code == 507 and "free space" in r.json()["detail"]
    assert upload_policy.METRICS.rejections["INSUFFICIENT_STORAGE"] >= 1


# ------------------------------------------------------------------ large media: no memory load, scanner limit
def test_large_cctv_above_the_old_limit_is_accepted_and_never_read_into_memory(client, officer_h, monkeypatch):
    data = MP4 + os.urandom(30 * 1024 * 1024)  # above the old 25 MB global cap
    monkeypatch.setattr(config, "SCAN_MAX_MB", 100)

    def forbidden(*a, **k):
        raise AssertionError("media content must not be read into memory")
    monkeypatch.setattr(storage, "read_bytes", forbidden)
    r = _stream(client, officer_h, "cctv-cam3.mp4", data, process=True)
    assert r.status_code == 201, r.text
    body = r.json()
    # Past scanning and promotion; with no content extracted there are no candidates, so the pipeline completes.
    assert body["record_type"] == "video" and body["status"] in ("EXTRACTED", "ENTITY_CANDIDATES", "GRAPH_PROJECTED", "HITL", "ACTIVE")
    assert body["claim_count"] == 0
    assert body["storage_area"] == "accepted" and body["sha256"] == hashlib.sha256(data).hexdigest()
    verify = client.get(f"/api/v1/evidence/{body['evidence_id']}/verify", headers=officer_h)
    assert verify.status_code == 200 and verify.json().get("match", verify.json().get("ok", True)) is not False


def test_file_above_the_scanner_limit_stays_quarantined_with_a_clear_reason(client, officer_h, monkeypatch):
    monkeypatch.setattr(config, "SCAN_MAX_MB", 1)
    r = _stream(client, officer_h, "long.mp4", MP4 + os.urandom(2 * 1024 * 1024), process=True)
    body = r.json()
    assert r.status_code == 201 and body["status"] == "SCAN_FAILED" and body["storage_area"] == "quarantine"
    assert "StreamMaxLength" in body["jobs"][0]["metrics"]["detail"]


def test_eicar_inside_media_is_caught_and_held(client, officer_h):
    r = _stream(client, officer_h, "infected.mp4", MP4 + os.urandom(2 * 1024 * 1024) + EICAR + os.urandom(100), process=True)
    body = r.json()
    assert body["status"] == "INFECTED" and body["storage_area"] == "quarantine"


# ------------------------------------------------------------------ administrator policy and monitoring
def test_everyone_can_read_limits_but_only_admin_changes_them(client, officer_h, admin_h):
    listing = client.get("/api/v1/upload-policies", headers=officer_h).json()
    cats = {p["category"]: p for p in listing["policies"]}
    assert cats["VIDEO"]["max_mb"] == config.UPLOAD_DEFAULT_LIMITS_MB["VIDEO"] and ".mp4" in cats["VIDEO"]["extensions"]
    assert client.put("/api/v1/upload-policies/VIDEO", headers=officer_h, json={"max_mb": 5, "reason": "officer attempt"}).status_code == 403
    r = _set_policy(client, admin_h, "VIDEO", 4096)
    assert r.status_code == 200 and r.json()["max_mb"] == 4096
    with SessionLocal() as s:
        ev = (s.query(AuditEvent).filter_by(action="UPLOAD_POLICY_UPDATE", target_id="VIDEO")
              .order_by(AuditEvent.created_at.desc()).first())
        assert ev.detail["after"]["max_mb"] == 4096 and ev.detail["reason"] == "test boundary configuration"


def test_policy_ceilings_are_enforced(client, admin_h):
    r = _set_policy(client, admin_h, "DOCUMENT", config.UPLOAD_EXTRACTABLE_MAX_MB + 1)
    assert r.status_code == 422 and "between 1 and" in r.json()["detail"]
    assert _set_policy(client, admin_h, "VIDEO", config.UPLOAD_HARD_MAX_MB + 1).status_code == 422
    assert _set_policy(client, admin_h, "VIDEO", 0).status_code == 422
    assert client.put("/api/v1/upload-policies/WEAPONS", headers=admin_h, json={"max_mb": 5, "reason": "unknown category"}).status_code == 404


def test_disabled_category_is_refused_with_a_clear_message(client, officer_h, admin_h):
    _set_policy(client, admin_h, "AUDIO", 10, enabled=False)
    r = _stream(client, officer_h, "call.wav", b"RIFF\x00\x00\x00\x00WAVE" + os.urandom(100))
    assert r.status_code == 422 and "disabled by an administrator" in r.json()["detail"]


def test_monitoring_reports_rejections_and_storage(client, officer_h, admin_h):
    _stream(client, officer_h, "bad.png", b"not a png at all")
    m = client.get("/api/v1/upload-policies/metrics", headers=_login(client, "auditor")).json()
    assert m["process"]["rejections_by_code"].get("SIGNATURE_MISMATCH", 0) >= 1
    assert m["storage"]["disk_free_mb"] > 0 and m["audit_last_24h"]["rejected_or_failed"] >= 1
    assert client.get("/api/v1/upload-policies/metrics", headers=officer_h).status_code == 403


def test_upload_policy_actions_are_not_overridable():
    from apps.api.app.services import overrides
    assert {"manageUploadPolicy", "viewUploadMetrics"} <= overrides.NON_OVERRIDABLE
