"""One-time object migration: local evidence files -> MinIO (S3-compatible), same relative keys.

    python3 scripts/migrate_evidence_to_minio.py --storage-root storage \\
        --secret-key "$MINIO_ROOT_PASSWORD" [--endpoint-url http://127.0.0.1:9000] [--bucket drishti] [--access-key drishti]

Walks accepted/, quarantine/ and derived/ under --storage-root and uploads each file under its
identical relative key (apps/api/app/services/storage.py uses the same key shape for both the
local-filesystem and S3 backends, so no key is renamed or restructured). Idempotent: deletes every
existing object in the bucket first, so a wipe-and-redo cutover run leaves no stale objects behind.
"""
from __future__ import annotations

import argparse
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
    except ClientError:
        client.create_bucket(Bucket=args.bucket)

    existing = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=args.bucket):
        existing.extend(o["Key"] for o in page.get("Contents", []))
    if existing:
        for i in range(0, len(existing), 1000):  # DeleteObjects caps at 1000 keys per call
            client.delete_objects(Bucket=args.bucket, Delete={"Objects": [{"Key": k} for k in existing[i:i + 1000]]})
        print(f"Removed {len(existing)} pre-existing object(s) from bucket {args.bucket!r}.")

    root = args.storage_root.resolve()
    uploaded = 0
    for prefix in OBJECT_PREFIXES:
        base = root / prefix
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            key = str(path.relative_to(root))
            client.put_object(Bucket=args.bucket, Key=key, Body=path.read_bytes())
            uploaded += 1
    print(f"Uploaded {uploaded} object(s) to bucket {args.bucket!r} at {args.endpoint_url}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
