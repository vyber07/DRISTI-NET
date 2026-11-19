"""Tests for streaming evidence download and storage chunk iteration."""
import io
import pytest
from ..services import storage


def test_storage_iter_bytes_local(tmp_path, monkeypatch):
    """storage.iter_bytes yields chunks without reading the entire file at once."""
    test_file = tmp_path / "test_stream.bin"
    chunk1 = b"A" * 1024
    chunk2 = b"B" * 1024
    chunk3 = b"C" * 512
    test_file.write_bytes(chunk1 + chunk2 + chunk3)

    monkeypatch.setattr(storage, "_abs", lambda rel: test_file)
    monkeypatch.setattr(storage, "_using_s3", lambda: False)

    chunks = list(storage.iter_bytes("test_stream.bin", chunk_size=1024))
    assert len(chunks) == 3
    assert chunks[0] == chunk1
    assert chunks[1] == chunk2
    assert chunks[2] == chunk3
    assert b"".join(chunks) == chunk1 + chunk2 + chunk3


def test_storage_iter_bytes_missing_file_raises():
    """storage.iter_bytes raises FileNotFoundError for missing object."""
    gen = storage.iter_bytes("nonexistent_path_xyz_123.bin")
    with pytest.raises(FileNotFoundError):
        next(gen)


def test_evidence_download_streaming_response(client, ingested, investigator):
    """Evidence download returns streaming response with integrity reference and disposition headers."""
    eid = ingested["vehicles.csv"]["evidence_id"]
    url = f"/api/v1/evidence/{eid}/download"

    # Success path
    r = client.post(url, headers=investigator, json={"reason": "Streaming download verification"})
    assert r.status_code == 200
    assert r.headers.get("X-Evidence-SHA256") is not None
    assert "attachment; filename=" in r.headers.get("Content-Disposition", "")
    assert r.content.startswith(b"vehicle_id")

    # Failure path: empty reason rejected
    bad_req = client.post(url, headers=investigator, json={"reason": ""})
    assert bad_req.status_code == 422
