import os
"""Storage layer against S3: a fast moto-mocked unit pass (portable, no live server needed) plus,
where a real MinIO is reachable, live-verified checks that exercise the actual network path.

The moto tests alone are not "live verification" of anything -- they're mocked at the botocore
level, standard practice for boto3 code. The live checks below are what actually proves the S3
backend works against a real running S3-compatible server (TASK_BOARD.md Phase 2 requirement).
"""
import boto3
import pytest
from botocore.config import Config as BotoConfig
from moto import mock_aws

from apps.api.app import config
from apps.api.app.services import storage

def _real_minio_reachable() -> bool:
    try:
        c = boto3.client(
            "s3", endpoint_url=os.environ.get("DRISHTI_TEST_MINIO_ENDPOINT", "http://minio:9000"),
            aws_access_key_id="drishti", aws_secret_access_key=os.environ.get("DRISHTI_S3_SECRET_KEY", ""),
            region_name="us-east-1", config=BotoConfig(signature_version="s3v4"),
        )
        c.list_buckets()
        return True
    except Exception:
        return False

_HAS_MINIO = _real_minio_reachable()
if os.environ.get("REQUIRE_LIVE_TESTS") == "1" and not _HAS_MINIO:
    raise RuntimeError("Live tests required but MinIO is not reachable")

@mock_aws
def test_s3_backend_round_trip_moto(monkeypatch):
    # moto intercepts requests that match AWS's own endpoint shape, not an arbitrary host -- so this
    # must look like a real AWS S3 endpoint even though moto never lets it hit the network.
    monkeypatch.setattr(config, "S3_ENDPOINT_URL", "https://s3.us-east-1.amazonaws.com")
    monkeypatch.setattr(config, "S3_BUCKET", "drishti-moto-test")
    storage._s3_client = None  # force a fresh client bound to the mocked endpoint
    storage._s3_client_key = None

    rel = storage.write_quarantine("CASE-TEST", "EVD-TEST", "sample.csv", b"a,b\n1,2\n")
    assert rel == "quarantine/CASE-TEST/EVD-TEST/sample.csv"
    assert storage.exists(rel)
    assert storage.read_bytes(rel) == b"a,b\n1,2\n"
    ok, digest = storage.verify_hash(rel, storage.sha256_bytes(b"a,b\n1,2\n"))
    assert ok and len(digest) == 64

    new_rel = storage.promote_to_accepted(rel)
    assert new_rel == "accepted/CASE-TEST/EVD-TEST/sample.csv"
    assert storage.exists(new_rel) and not storage.exists(rel)

    with storage.local_copy(new_rel) as p:
        assert p.read_bytes() == b"a,b\n1,2\n"

    storage.overwrite_for_demo(new_rel, b"a,b\n1,2\nTAMPERED\n")
    assert storage.read_bytes(new_rel) == b"a,b\n1,2\nTAMPERED\n"

def test_abs_path_rejected_on_s3_backend(monkeypatch):
    monkeypatch.setattr(config, "S3_ENDPOINT_URL", "http://mocked")
    with pytest.raises(RuntimeError):
        storage.abs_path("accepted/x/y/z")

@pytest.mark.skipif(not _HAS_MINIO, reason=f"no live MinIO reachable on {os.environ.get('DRISHTI_TEST_MINIO_ENDPOINT', 'http://minio:9000')}")
@pytest.mark.skipif(not _HAS_MINIO, reason=f"no live MinIO reachable on {os.environ.get('DRISHTI_TEST_MINIO_ENDPOINT', 'http://minio:9000')}")
def test_s3_backend_round_trip_live_minio(monkeypatch):
    monkeypatch.setattr(config, "S3_ENDPOINT_URL", os.environ.get("DRISHTI_TEST_MINIO_ENDPOINT", "http://minio:9000"))
    monkeypatch.setattr(config, "S3_ACCESS_KEY", "drishti")
    monkeypatch.setattr(config, "S3_SECRET_KEY", os.environ.get("DRISHTI_S3_SECRET_KEY", ""))
    storage._s3_client = None
    storage._s3_client_key = None
    
    import uuid
    bucket_name = f"drishti-live-test-{uuid.uuid4()}"
    monkeypatch.setattr(config, "S3_BUCKET", bucket_name)
    c = storage.s3()
    try:
        c.create_bucket(Bucket=bucket_name)
    except Exception:
        pass

    try:
        rel = storage.write_quarantine("CASE-LIVE", "EVD-LIVE", "sample.csv", b"live,minio\n1,2\n")
        assert storage.exists(rel)
        assert storage.read_bytes(rel) == b"live,minio\n1,2\n"
        new_rel = storage.promote_to_accepted(rel)
        assert storage.exists(new_rel) and not storage.exists(rel)
    finally:
        try:
            objs = c.list_objects_v2(Bucket=bucket_name)
            if "Contents" in objs:
                for obj in objs["Contents"]:
                    c.delete_object(Bucket=bucket_name, Key=obj["Key"])
            c.delete_bucket(Bucket=bucket_name)
        except Exception:
            pass
