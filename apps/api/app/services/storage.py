"""Evidence object storage: local filesystem (default, zero-install) or a real S3-compatible
store (MinIO in dev/compose; any S3-compatible endpoint in production) when
`DRISHTI_S3_ENDPOINT_URL` is set (TASK_BOARD.md Phase 2). Same "empty = fallback" pattern used for
Neo4j/Redis elsewhere in this codebase -- never both backends active for the same deployment.

Layout (same key/path shape either way):
  quarantine/<case_id>/<evidence_id>/<filename>
  accepted/<case_id>/<evidence_id>/<filename>
  derived/<case_id>/<evidence_id>/...      (extraction outputs)
"""
from __future__ import annotations

import contextlib
import hashlib
import shutil
import tempfile
from pathlib import Path

from .. import config


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _using_s3() -> bool:
    return bool(config.S3_ENDPOINT_URL)


# ------------------------------------------------------------------ local filesystem backend
def _abs(rel: str) -> Path:
    p = (config.STORAGE_ROOT / rel).resolve()
    if config.STORAGE_ROOT not in p.parents:
        raise ValueError("storage path escapes STORAGE_ROOT")
    return p


def _local_write(rel: str, data: bytes) -> None:
    p = _abs(rel)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)


def _local_read(rel: str) -> bytes:
    return _abs(rel).read_bytes()


def _local_exists(rel: str) -> bool:
    return _abs(rel).exists()


def _local_move(src_rel: str, dst_rel: str) -> None:
    src, dst = _abs(src_rel), _abs(dst_rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))


# ------------------------------------------------------------------ S3/MinIO backend
_s3_client = None
_s3_client_key = None


def _client():
    """Lazily built boto3 client; rebuilt if config changes (mirrors services/ratelimit.py's pattern)."""
    global _s3_client, _s3_client_key
    import boto3
    from botocore.config import Config as BotoConfig

    key = (config.S3_ENDPOINT_URL, config.S3_ACCESS_KEY, config.S3_SECRET_KEY, config.S3_REGION)
    if _s3_client is None or _s3_client_key != key:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=config.S3_ENDPOINT_URL,
            aws_access_key_id=config.S3_ACCESS_KEY,
            aws_secret_access_key=config.S3_SECRET_KEY,
            region_name=config.S3_REGION,
            config=BotoConfig(signature_version="s3v4"),
        )
        _s3_client_key = key
        _ensure_bucket(_s3_client)
    return _s3_client


def _ensure_bucket(client) -> None:
    from botocore.exceptions import ClientError

    try:
        client.head_bucket(Bucket=config.S3_BUCKET)
    except ClientError:
        client.create_bucket(Bucket=config.S3_BUCKET)


def _s3_write(rel: str, data: bytes) -> None:
    _client().put_object(Bucket=config.S3_BUCKET, Key=rel, Body=data)


def _s3_read(rel: str) -> bytes:
    return _client().get_object(Bucket=config.S3_BUCKET, Key=rel)["Body"].read()


def _s3_exists(rel: str) -> bool:
    from botocore.exceptions import ClientError

    try:
        _client().head_object(Bucket=config.S3_BUCKET, Key=rel)
        return True
    except ClientError:
        return False


def _s3_move(src_rel: str, dst_rel: str) -> None:
    _client().copy_object(Bucket=config.S3_BUCKET, CopySource={"Bucket": config.S3_BUCKET, "Key": src_rel}, Key=dst_rel)
    _client().delete_object(Bucket=config.S3_BUCKET, Key=src_rel)


# ------------------------------------------------------------------ public API (backend-dispatching)
def write_quarantine(case_id: str, evidence_id: str, filename: str, data: bytes) -> str:
    rel = f"quarantine/{case_id}/{evidence_id}/{filename}"
    (_s3_write if _using_s3() else _local_write)(rel, data)
    return rel


def promote_to_accepted(rel: str) -> str:
    """Move a CLEAN file out of quarantine. The file bytes are unchanged; only the key/path changes."""
    new_rel = rel.replace("quarantine/", "accepted/", 1)
    (_s3_move if _using_s3() else _local_move)(rel, new_rel)
    return new_rel


def read_bytes(rel: str) -> bytes:
    return (_s3_read if _using_s3() else _local_read)(rel)


def exists(rel: str) -> bool:
    return (_s3_exists if _using_s3() else _local_exists)(rel)


def verify_hash(rel: str, expected_sha256: str) -> tuple[bool, str]:
    actual = sha256_bytes(read_bytes(rel)) if _using_s3() else sha256_file(_abs(rel))
    return actual == expected_sha256, actual


def abs_path(rel: str) -> Path:
    """Local filesystem only. Callers that need a real path for any backend must use `local_copy`."""
    if _using_s3():
        raise RuntimeError("abs_path() is not meaningful for the S3 backend -- use local_copy() instead")
    return _abs(rel)


@contextlib.contextmanager
def local_copy(rel: str):
    """Yield a real local filesystem path to the object's bytes, for tools that require one (the
    ClamAV CLI, which scans a real file). Local backend: yields the real path directly, zero copy.
    S3 backend: downloads to a temp file, yields it, and always cleans up afterward."""
    if not _using_s3():
        yield _abs(rel)
        return
    suffix = Path(rel).suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(_s3_read(rel))
        tmp_path = Path(tmp.name)
    try:
        yield tmp_path
    finally:
        tmp_path.unlink(missing_ok=True)


def overwrite_for_demo(rel: str, data: bytes) -> None:
    """Used only by routes/demo_routes.py's tamper endpoint to deliberately corrupt a stored object
    and demonstrate hash-mismatch detection. Never called by the real evidence lifecycle, which never
    overwrites an accepted object in place."""
    (_s3_write if _using_s3() else _local_write)(rel, data)
