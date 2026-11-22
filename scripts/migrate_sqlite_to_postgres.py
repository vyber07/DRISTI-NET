"""One-time row migration: the single-host SQLite database -> the Compose stack's PostgreSQL.

    python3 scripts/migrate_sqlite_to_postgres.py --sqlite storage/drishti.db --pg-url "$PGURL" [--dry-run]

Uses the app's own declarative models (apps.api.app.models) for both sides, so every column's
existing type-level bind/result processing (JSON encode/decode, the naive-UTC DateTime handling
DEF-088 depends on) runs exactly as the app itself would run it -- nothing here reinterprets a
timestamp or re-serializes a JSON blob by hand. Primary/foreign-key string values are copied
byte-for-byte; nothing is regenerated.

One-time import into an empty target. The script refuses to write if any modeled target table already
contains rows. It never deletes target rows. Run it only against a dedicated migration target while
the application is stopped; the PostgreSQL transaction locks modeled tables during the emptiness
check and import so concurrent writes cannot race the preflight.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from sqlalchemy import create_engine, func, select, text  # noqa: E402

from apps.api.app.models import (  # noqa: E402
    AuditEvent, Case, CaseAssignment, Claim, Entity, Evidence, Job,
    MatchCandidate, Provenance, Review, Snapshot, User,
)

# FK-safe order: every table only references ones earlier in this list.
TABLES_IN_ORDER = [
    User, Case, CaseAssignment, Evidence, Job, Entity, Claim, Provenance,
    MatchCandidate, Review, AuditEvent, Snapshot,
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", required=True, type=Path, help="path to the source drishti.db")
    ap.add_argument("--pg-url", required=True, help="target postgresql+psycopg2://... URL")
    ap.add_argument("--dry-run", action="store_true", help="print row counts only, write nothing")
    args = ap.parse_args()

    sqlite_engine = create_engine(f"sqlite:///{args.sqlite.resolve()}", future=True)
    pg_engine = create_engine(args.pg_url, future=True)

    with sqlite_engine.connect() as sconn:
        counts = {model.__tablename__: sconn.execute(select(func.count()).select_from(model.__table__)).scalar_one()
                  for model in TABLES_IN_ORDER}
    print("Source row counts:", counts)
    if args.dry_run:
        with pg_engine.connect() as pconn:
            target_counts = {model.__tablename__: pconn.execute(select(func.count()).select_from(model.__table__)).scalar_one()
                             for model in TABLES_IN_ORDER}
        print("Target row counts:", target_counts)
        print("--dry-run: no changes made.")
        return 0

    with sqlite_engine.connect() as sconn, pg_engine.begin() as pconn:
        if pg_engine.dialect.name == "postgresql":
            pconn.execute(text("SET LOCAL lock_timeout = '5s'"))
            table_names = ", ".join(f'"{model.__tablename__}"' for model in TABLES_IN_ORDER)
            pconn.execute(text(f"LOCK TABLE {table_names} IN ACCESS EXCLUSIVE MODE"))
        target_counts = {model.__tablename__: pconn.execute(select(func.count()).select_from(model.__table__)).scalar_one()
                         for model in TABLES_IN_ORDER}
        nonempty = {name: count for name, count in target_counts.items() if count}
        if nonempty:
            raise SystemExit(f"refusing to migrate: target tables are not empty: {nonempty}")

        for model in TABLES_IN_ORDER:
            rows = [dict(r._mapping) for r in sconn.execute(select(model.__table__)).fetchall()]
            if rows:
                pconn.execute(model.__table__.insert(), rows)
            print(f"  {model.__tablename__}: {len(rows)} row(s) copied")

        # CaseAssignment.id is the only auto-incrementing integer PK in the schema (models.py). Explicit
        # inserts above bypassed its sequence, so the next auto-assigned id would collide.
        if pg_engine.dialect.name == "postgresql":
            max_id = pconn.execute(text("SELECT COALESCE(MAX(id), 0) FROM case_assignments")).scalar()
            if max_id:
                pconn.execute(text("SELECT setval(pg_get_serial_sequence('case_assignments', 'id'), :n, true)"), {"n": max_id})

    print("Migration complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
