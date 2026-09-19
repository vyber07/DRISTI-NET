"""Explicit database migration service.

Architecture cleanup: Decouples Alembic schema migrations from API startup.
In a production deployment, this should be executed as a separate step
(e.g., via an init container or pre-release hook) before the new API pods start.

Usage:
    python3 -m apps.api.app.migrations
"""
from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config

from . import config
from .db import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("drishti.migrations")


def run_migrations() -> None:
    if config.DATABASE_URL.startswith("sqlite"):
        logger.info("SQLite database detected; migrations are managed automatically via create_all. Skipping Alembic.")
        return

    logger.info("Applying Alembic migrations to %s", config.DATABASE_URL.split("://")[0])
    try:
        api_root = Path(__file__).resolve().parents[2]
        cfg = Config(str(api_root / "alembic.ini"))
        cfg.set_main_option("script_location", str(api_root / "migrations"))
        command.upgrade(cfg, "head")
        logger.info("Database schema is up to date.")
    except Exception as exc:
        logger.error("Database migration failed: %s", exc)
        raise SystemExit(1)


if __name__ == "__main__":
    run_migrations()
