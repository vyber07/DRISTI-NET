"""Archive (.zip) upload controls: decompression-bomb ratio, path traversal, nested archives,
symlink members, member-count / size limits, unsupported member types -- and the positive path,
where a clean archive's members travel through the same extraction pipeline as a standalone upload.

directive Phase 8 ("archive controls, decompression limits, path traversal protection, symlink
protection, resource limits") / docs/status.md open item ("archive upload limits").
"""
import io
import stat
import zipfile

from .. import config
from ..services.extract import validate_upload


def _zip_bytes(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in members.items():
            zf.writestr(name, content)
    return buf.getvalue()


CALLS_CSV = b"caller,callee,start_time\n+919000000001,+919000000002,2025-07-02T10:00:00\n"
PEOPLE_JSON = b'[{"person_id": "p1", "name": "Test Person"}]'


def test_clean_archive_passes_validation():
    data = _zip_bytes({"calls.csv": CALLS_CSV, "people.json": PEOPLE_JSON})
    v = validate_upload("evidence.zip", data)
    assert v.ok is True, v.reason


def test_corrupt_archive_rejected():
    v = validate_upload("evidence.zip", b"PK\x03\x04" + b"not a real zip central directory")
    assert v.ok is False and "corrupt" in v.reason.lower()


def test_empty_archive_rejected():
    # an empty ZIP has no local file header, so it doesn't even start with the PK\x03\x04 magic bytes
    # (it's just an end-of-central-directory record) -- rejected earlier, at the magic-byte check.
    data = _zip_bytes({})
    v = validate_upload("evidence.zip", data)
    assert v.ok is False and "magic bytes" in v.reason


def test_path_traversal_member_rejected():
    data = _zip_bytes({"../../etc/evil.csv": CALLS_CSV})
    v = validate_upload("evidence.zip", data)
    assert v.ok is False and "unsafe member path" in v.reason


def test_absolute_path_member_rejected():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        info = zipfile.ZipInfo("/etc/passwd.csv")
        zf.writestr(info, CALLS_CSV)
    v = validate_upload("evidence.zip", buf.getvalue())
    assert v.ok is False and "unsafe member path" in v.reason


def test_nested_archive_rejected():
    inner = _zip_bytes({"calls.csv": CALLS_CSV})
    data = _zip_bytes({"inner.zip": inner})
    v = validate_upload("evidence.zip", data)
    assert v.ok is False and "nested archive" in v.reason


def test_unsupported_member_type_rejected():
    data = _zip_bytes({"payload.exe": b"MZ\x90\x00fake-pe-header"})
    v = validate_upload("evidence.zip", data)
    assert v.ok is False and "unsupported member type" in v.reason


def test_symlink_member_rejected():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        info = zipfile.ZipInfo("link.csv")
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        zf.writestr(info, "calls.csv")
    v = validate_upload("evidence.zip", buf.getvalue())
    assert v.ok is False and "symlink" in v.reason


def test_member_count_limit(monkeypatch):
    monkeypatch.setattr(config, "ARCHIVE_MAX_MEMBERS", 2)
    data = _zip_bytes({"a.csv": CALLS_CSV, "b.csv": CALLS_CSV, "c.csv": CALLS_CSV})
    v = validate_upload("evidence.zip", data)
    assert v.ok is False and "member limit" in v.reason


def test_total_uncompressed_size_limit(monkeypatch):
    monkeypatch.setattr(config, "ARCHIVE_MAX_TOTAL_UNCOMPRESSED_MB", 0)
    data = _zip_bytes({"a.csv": CALLS_CSV})
    v = validate_upload("evidence.zip", data)
    assert v.ok is False and "total uncompressed size limit" in v.reason


def test_member_uncompressed_size_limit(monkeypatch):
    monkeypatch.setattr(config, "ARCHIVE_MAX_MEMBER_UNCOMPRESSED_MB", 0)
    data = _zip_bytes({"a.csv": CALLS_CSV})
    v = validate_upload("evidence.zip", data)
    assert v.ok is False and "member" in v.reason and "uncompressed size limit" in v.reason


def test_decompression_bomb_ratio_rejected(monkeypatch):
    monkeypatch.setattr(config, "ARCHIVE_MAX_COMPRESSION_RATIO", 50)
    monkeypatch.setattr(config, "ARCHIVE_MAX_MEMBER_UNCOMPRESSED_MB", 1024)
    monkeypatch.setattr(config, "ARCHIVE_MAX_TOTAL_UNCOMPRESSED_MB", 1024)
    bomb = b"0" * (5 * 1024 * 1024)  # highly compressible -> ratio far above 50:1
    data = _zip_bytes({"bomb.csv": bomb})
    v = validate_upload("evidence.zip", data)
    assert v.ok is False and "compression-ratio limit" in v.reason


def test_archive_end_to_end_extracts_members_through_normal_pipeline(client, officer):
    """A clean archive travels the full pipeline (validate -> quarantine -> hash -> scan -> parse) and
    each member is extracted through the same handler a standalone upload of that file would use.
    Uses CASE-0002 (not CASE-0001) so the new claims don't perturb other tests' CASE-0001 event counts
    -- same convention as test_security.py's cross-case upload."""
    data = _zip_bytes({"calls.csv": CALLS_CSV, "people.json": PEOPLE_JSON})
    r = client.post(
        "/api/v1/cases/CASE-0002/evidence", headers=officer,
        files={"file": ("bundle.zip", data)}, data={"source_label": "synthetic-archive"},
    )
    assert r.status_code == 201, r.text
    ev = r.json()
    assert ev["record_type"] == "archive"
    assert ev["status"] == "EXTRACTED" or ev["status"] in ("ENTITY_CANDIDATES", "HITL", "GRAPH_PROJECTED", "ACTIVE")
    extract_job = [j for j in ev["jobs"] if j["kind"] == "EXTRACT"][-1]
    assert extract_job["status"] == "SUCCEEDED"
    assert extract_job["metrics"]["claims"] > 0
