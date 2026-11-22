from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import config

config.STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
connect_args = {"check_same_thread": False} if config.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(config.DATABASE_URL, connect_args=connect_args, future=True)

if config.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):  # foreign keys are off by default in SQLite
        dbapi_conn.execute("PRAGMA foreign_keys=ON")
        dbapi_conn.execute("PRAGMA journal_mode=WAL")

if config.DATABASE_URL.startswith("postgres"):
    @event.listens_for(engine, "connect")
    def _pg_session_utc(dbapi_conn, _):
        # DEF-088: timestamps are naive UTC columns written from aware UTC datetimes. PostgreSQL converts an aware value
        # into a naive column using the *session* time zone, so on a server configured for e.g. Asia/Kolkata every
        # stored time shifted by +05:30 and every audit HMAC failed to verify after a round-trip. Pin UTC per session.
        cur = dbapi_conn.cursor()
        cur.execute("SET TIME ZONE 'UTC'")
        cur.close()
        dbapi_conn.commit()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """SQLite (tests, quick local runs): create tables directly — fast, throwaway, no history needed.
    Any other backend (PostgreSQL in the target architecture): migrations must be run explicitly
    via `python3 -m apps.api.app.migrations` rather than on API startup.
    """
    if config.DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(engine)
        _sqlite_add_missing_columns()


def _sqlite_add_missing_columns() -> None:
    """DEF-086: create_all() creates missing tables but never adds columns to existing ones, so an existing SQLite
    database (the single-host demo) silently diverged from the models after any column was added. Add missing
    columns that are nullable or have a server default -- purely additive, no data rewritten. Anything else is a
    real migration and is reported, not attempted."""
    import logging
    from sqlalchemy import inspect, text

    log = logging.getLogger("drishti.db")
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in have:
                    continue
                if not col.nullable and col.server_default is None:
                    log.error("SQLite table %s lacks NOT NULL column %s without a default; run a real migration", table.name, col.name)
                    continue
                ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col.type.compile(dialect=engine.dialect)}'
                if col.server_default is not None:
                    ddl += f" DEFAULT '{col.server_default.arg}'"
                conn.execute(text(ddl))
                log.warning("SQLite schema upgrade: added %s.%s", table.name, col.name)

