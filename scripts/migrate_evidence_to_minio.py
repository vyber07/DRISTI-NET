"""One-time object migration: local evidence files -> MinIO (S3-compatible), same relative keys.

    python3 scripts/migrate_evidence_to_minio.py --storage-root storage \\
        --secret-key "$MINIO_ROOT_PASSWORD" [--endpoint-url http://127.0.0.1:9000] [--bucket drishti] [--access-key drishti]

Walks accepted/, quarantine/ and derived/ under --storage-root and uploads each file under its
identical relative key (apps/api/app/services/storage.py uses the same key shape for both the
local-filesystem and S3 backends, so no key is renamed or restructured). Existing objects at those
keys are skipped only when their content matches; conflicting keys abort before any upload. Other
objects in the bucket are left untouched. This makes retries safe without wiping unrelated data.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

OBJECT_PREFIXES = ("accepted", "quarantine", "derived")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--storage-root", required=True, type=Path)
    ap.add_argument("--endpoint-url", default="http://127.0.0.1:9000")
    ap.add_argument("--bucket", default="drishti")
    ap.add_argument("--access-key", default="drishti")
    ap.add_argument("--secret-key", required=True)
    args = ap.parse_args()

    client = boto3.client(
        "s3", endpoint_url=args.endpoint_url, aws_access_key_id=args.access_key,
        aws_secret_access_key=args.secret_key, region_name="us-east-1",
        config=BotoConfig(signature_version="s3v4", connect_timeout=5, read_timeout=30, retries={"max_attempts": 3, "mode": "standard"}),
    )
    try:
        client.head_bucket(Bucket=args.bucket)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code not in {"404", "NoSuchBucket", "NotFound"}:
            raise
        client.create_bucket(Bucket=args.bucket)

    root = args.storage_root.resolve()
    planned: list[tuple[Path, str, str, bool]] = []
    for prefix in OBJECT_PREFIXES:
        base = root / prefix
        if not base.is_dir():
            continue
        if base.is_symlink():
            raise SystemExit(f"refusing to follow symlink storage prefix: {base}")
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            if path.is_symlink():
                raise SystemExit(f"refusing to follow symlink evidence path: {path}")
            key = path.relative_to(root).as_posix()
            source_hash = hashlib.sha256(path.read_bytes()).hexdigest()
            try:
                client.head_object(Bucket=args.bucket, Key=key)
            except ClientError as exc:
                code = exc.response.get("Error", {}).get("Code", "")
                if code not in {"404", "NoSuchKey", "NotFound"}:
                    raise
                planned.append((path, key, source_hash, False))
                continue

            response = client.get_object(Bucket=args.bucket, Key=key)
            with response["Body"] as body:
                existing_hash = hashlib.sha256(body.read()).hexdigest()
            if existing_hash != source_hash:
                raise SystemExit(f"refusing to overwrite conflicting object s3://{args.bucket}/{key}")
            planned.append((path, key, source_hash, True))

    # Complete conflict checks before the first write. If a source file changed after preflight,
    # stop rather than uploading content different from the bytes that were checked.
    uploaded = skipped = 0
    for path, key, source_hash, already_matches in planned:
        if already_matches:
            skipped += 1
            continue
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != source_hash:
            raise SystemExit(f"source changed during migration; no upload attempted for {key}")
        # Conditional create closes the gap between preflight and upload: if another writer
        # creates the key in that interval, the provider must reject rather than overwrite it.
        client.put_object(Bucket=args.bucket, Key=key, Body=data, IfNoneMatch="*")
        uploaded += 1
    print(f"Uploaded {uploaded} object(s), skipped {skipped} identical object(s); other bucket objects were left untouched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
