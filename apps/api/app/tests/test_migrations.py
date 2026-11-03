"""Alembic migrations against a FRESH, EMPTY PostgreSQL database (P0-2).

The rest of the suite builds its Postgres schema with Base.metadata.create_all() (conftest.py), so it never
proves that the migration chain produces the schema the models expect. This test does, on its own throwaway
database on the same server, so it cannot collide with the session schema (the previous version ran
`upgrade head` on top of create_all() tables and failed with DuplicateTable; it also ended in `assert True`).

Requires a role allowed to CREATE DATABASE (true for the disposable verification container).
"""
import os
import uuid
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(not os.environ.get("DRISHTI_DATABASE_URL", "").startswith("postgres"),
                                reason="Requires PostgreSQL")

API_ROOT = Path(__file__).resolve().parents[2]  # apps/api


@pytest.fixture()
def fresh_db_url(monkeypatch):
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url
    from apps.api.app import config

    base = make_url(config.DATABASE_URL)
    name = f"drishti_migr_{uuid.uuid4().hex[:10]}"
    admin = create_engine(base, isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text(f'CREATE DATABASE "{name}"'))
    url = base.set(database=name).render_as_string(hide_password=False)
    # migrations/env.py reads apps.api.app.config.DATABASE_URL at load time, so point it at the fresh DB.
    monkeypatch.setattr(config, "DATABASE_URL", url)
    try:
        yield url
    finally:
        with admin.connect() as c:
            c.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()


def _alembic_cfg():
    import alembic.config
    cfg = alembic.config.Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "migrations"))
    return cfg


def test_alembic_upgrade_on_fresh_db_matches_models_and_downgrades(fresh_db_url):
    import alembic.command
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from sqlalchemy import create_engine, inspect
    from apps.api.app.db import Base

    cfg = _alembic_cfg()
    alembic.command.upgrade(cfg, "head")

    eng = create_engine(fresh_db_url)
    try:
        with eng.connect() as conn:
            insp = inspect(conn)
            tables = set(insp.get_table_names()) - {"alembic_version"}
            assert tables == set(Base.metadata.tables), (
                f"missing from migrations: {sorted(set(Base.metadata.tables) - tables)}; "
                f"extra in migrations: {sorted(tables - set(Base.metadata.tables))}")

            uniques = {u["name"]: u["column_names"] for u in insp.get_unique_constraints("evidence")}
            assert uniques.get("uix_evidence_case_sha") == ["case_id", "sha256"], uniques

            # Full model-vs-database diff (columns, nullability, indexes, constraints).
            diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
            assert diff == [], f"migration head does not match models: {diff}"
    finally:
        eng.dispose()

    # Rollback strategy: the whole chain must downgrade cleanly.
    alembic.command.downgrade(cfg, "base")
    eng = create_engine(fresh_db_url)
    try:
        with eng.connect() as conn:
            assert set(inspect(conn).get_table_names()) - {"alembic_version"} == set()
    finally:
        eng.dispose()


def test_timestamps_and_audit_signatures_survive_a_non_utc_server_time_zone():
    """DEF-088: with the database/server time zone set to Asia/Kolkata, stored timestamps shifted +05:30 and every
    audit HMAC failed verification after reload. Sessions are now pinned to UTC."""
    from sqlalchemy import text
    from apps.api.app.db import Base, SessionLocal, engine
    from apps.api.app.models import AuditEvent
    from apps.api.app.services.audit import record_audit, verify_audit_event

    dbname = engine.url.database
    with engine.connect() as c:
        c.execution_options(isolation_level="AUTOCOMMIT").execute(text(f'ALTER DATABASE "{dbname}" SET timezone TO \'Asia/Kolkata\''))
    engine.dispose()  # new connections pick up the database default -- the listener must override it
    try:
        Base.metadata.create_all(engine)
        with engine.connect() as c:
            assert c.execute(text("show timezone")).scalar() == "UTC"
        db = SessionLocal()
        ev = record_audit(db, "TR-TZ", None, "TZ_PROBE", detail={"x": 1})
        signed_at = ev.created_at.replace(tzinfo=None)
        db.commit(); aid = ev.audit_id; db.close()
        db = SessionLocal()
        row = db.get(AuditEvent, aid)
        assert row.created_at.replace(tzinfo=None) == signed_at, (row.created_at, signed_at)
        assert verify_audit_event(row)
        db.close()
    finally:
        with engine.connect() as c:
            c.execution_options(isolation_level="AUTOCOMMIT").execute(text(f'ALTER DATABASE "{dbname}" RESET timezone'))
        engine.dispose()
