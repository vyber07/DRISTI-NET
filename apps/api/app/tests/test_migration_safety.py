from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select

from apps.api.app.db import Base
from apps.api.app.models import User
from scripts import migrate_evidence_to_minio, migrate_sqlite_to_postgres


class _Paginator:
    def __init__(self, client):
        self.client = client

    def paginate(self, **_kwargs):
        yield {"Contents": [{"Key": key} for key in self.client.objects]}


class _FakeS3:
    def __init__(self, objects):
        self.objects = dict(objects)
        self.puts = []

    def head_bucket(self, **_kwargs):
        return {}

    def get_paginator(self, _name):
        return _Paginator(self)

    def head_object(self, Bucket, Key):
        if Key not in self.objects:
            from botocore.exceptions import ClientError
            raise ClientError({"Error": {"Code": "404", "Message": "missing"}}, "HeadObject")
        return {"ContentLength": len(self.objects[Key])}

    def get_object(self, Bucket, Key):
        return {"Body": BytesIO(self.objects[Key])}

    def put_object(self, Bucket, Key, Body, IfNoneMatch=None):
        assert IfNoneMatch == "*"
        self.puts.append(Key)
        self.objects[Key] = Body


def test_object_migration_preserves_unrelated_objects_and_skips_identical_keys(tmp_path, monkeypatch, capsys):
    root = tmp_path / "storage"
    (root / "accepted" / "case").mkdir(parents=True)
    (root / "quarantine" / "case").mkdir(parents=True)
    (root / "accepted" / "case" / "same.txt").write_bytes(b"same evidence bytes")
    (root / "quarantine" / "case" / "new.txt").write_bytes(b"new evidence bytes")
    client = _FakeS3({
        "unrelated/keep.txt": b"leave this object untouched",
        "accepted/case/same.txt": b"same evidence bytes",
    })
    monkeypatch.setattr(migrate_evidence_to_minio.boto3, "client", lambda *_args, **_kwargs: client)
    monkeypatch.setattr("sys.argv", ["migrate_evidence_to_minio", "--storage-root", str(root), "--secret-key", "synthetic-test-key"])

    assert migrate_evidence_to_minio.main() == 0

    assert client.objects["unrelated/keep.txt"] == b"leave this object untouched"
    assert client.objects["accepted/case/same.txt"] == b"same evidence bytes"
    assert client.objects["quarantine/case/new.txt"] == b"new evidence bytes"
    assert client.puts == ["quarantine/case/new.txt"]
    assert "Uploaded 1 object(s)" in capsys.readouterr().out


def test_object_migration_refuses_conflicting_key_before_uploading(tmp_path, monkeypatch):
    root = tmp_path / "storage"
    (root / "accepted").mkdir(parents=True)
    (root / "accepted" / "a-new.txt").write_bytes(b"new source bytes")
    (root / "accepted" / "z-conflict.txt").write_bytes(b"source bytes")
    client = _FakeS3({"accepted/z-conflict.txt": b"different destination bytes", "unrelated/keep.txt": b"keep"})
    monkeypatch.setattr(migrate_evidence_to_minio.boto3, "client", lambda *_args, **_kwargs: client)
    monkeypatch.setattr("sys.argv", ["migrate_evidence_to_minio", "--storage-root", str(root), "--secret-key", "synthetic-test-key"])

    with pytest.raises(SystemExit, match="refusing to overwrite"):
        migrate_evidence_to_minio.main()

    assert client.puts == []
    assert "accepted/a-new.txt" not in client.objects
    assert client.objects["accepted/z-conflict.txt"] == b"different destination bytes"
    assert client.objects["unrelated/keep.txt"] == b"keep"


def _prepare_migration_databases(tmp_path: Path):
    source_path = tmp_path / "source.sqlite"
    target_path = tmp_path / "target.sqlite"
    source = create_engine(f"sqlite:///{source_path}", future=True)
    target = create_engine(f"sqlite:///{target_path}", future=True)
    Base.metadata.create_all(source)
    Base.metadata.create_all(target)
    return source_path, target_path, source, target


def _user_row(user_id: str, username: str) -> dict[str, object]:
    return {
        "user_id": user_id,
        "username": username,
        "display_name": f"{username} synthetic",
        "role": "ADMIN",
        "jurisdiction": "Synthetic District",
        "password_hash": "synthetic-hash",
        "active": True,
    }


def _run_sqlite_migration(source_path: Path, target_path: Path, monkeypatch):
    source_url = f"sqlite:///{source_path}"
    target_url = f"sqlite:///{target_path}"
    source_engine = create_engine(source_url, future=True)
    target_engine = create_engine(target_url, future=True)
    original_create_engine = migrate_sqlite_to_postgres.create_engine

    def engine_for(url, **kwargs):
        if url == source_url:
            return source_engine
        if url == target_url:
            return target_engine
        return original_create_engine(url, **kwargs)

    monkeypatch.setattr(migrate_sqlite_to_postgres, "create_engine", engine_for)
    monkeypatch.setattr("sys.argv", ["migrate_sqlite_to_postgres", "--sqlite", str(source_path), "--pg-url", target_url])
    return source_engine, target_engine


def test_relational_migration_copies_into_empty_target_without_replacing_data(tmp_path, monkeypatch):
    source_path, target_path, source, target = _prepare_migration_databases(tmp_path)
    with source.begin() as conn:
        conn.execute(User.__table__.insert(), _user_row("USR-SYNTH-001", "source-user"))
    source.dispose()
    target.dispose()
    _source_engine, target_engine = _run_sqlite_migration(source_path, target_path, monkeypatch)

    assert migrate_sqlite_to_postgres.main() == 0

    with target_engine.connect() as conn:
        rows = conn.execute(select(User.username)).scalars().all()
    assert rows == ["source-user"]
    target_engine.dispose()


def test_relational_migration_refuses_nonempty_target_and_preserves_both_sides(tmp_path, monkeypatch):
    source_path, target_path, source, target = _prepare_migration_databases(tmp_path)
    with source.begin() as conn:
        conn.execute(User.__table__.insert(), _user_row("USR-SYNTH-SRC", "source-user"))
    with target.begin() as conn:
        conn.execute(User.__table__.insert(), _user_row("USR-SYNTH-TGT", "target-user"))
    source.dispose()
    target.dispose()
    source_engine, target_engine = _run_sqlite_migration(source_path, target_path, monkeypatch)

    with pytest.raises(SystemExit, match="target tables are not empty"):
        migrate_sqlite_to_postgres.main()

    with source_engine.connect() as conn:
        source_rows = conn.execute(select(User.username)).scalars().all()
    with target_engine.connect() as conn:
        target_rows = conn.execute(select(User.username)).scalars().all()
    assert source_rows == ["source-user"]
    assert target_rows == ["target-user"]
    source_engine.dispose()
    target_engine.dispose()
