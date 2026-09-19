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

