"""Case assignment management: who/when/why on case_assignments, append-only case_assignment_events (ADR-020).

Adds three nullable columns (existing rows keep NULL = "before history was kept") and the history table. It also
inserts the missing case_assignments row for any case whose owner (primary investigator) has none, so the rule
"the primary investigator always has a row" holds for existing data. Access does not change: owners already had
access through cases.owner_id.

Revision ID: 5bcde1234578
Revises: 5bcde1234577
Create Date: 2026-11-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "5bcde1234578"
down_revision = "5bcde1234577"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("case_assignments", sa.Column("assigned_by", sa.String(), nullable=True))
    op.add_column("case_assignments", sa.Column("assigned_at", sa.DateTime(), nullable=True))
    op.add_column("case_assignments", sa.Column("reason", sa.Text(), nullable=True))
    op.execute("INSERT INTO case_assignments (case_id, user_id, purpose) "
               "SELECT c.case_id, c.owner_id, 'owner' FROM cases c WHERE NOT EXISTS "
               "(SELECT 1 FROM case_assignments a WHERE a.case_id = c.case_id AND a.user_id = c.owner_id)")

    op.create_table(
        "case_assignment_events",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("event", sa.String(), nullable=False),
        sa.Column("purpose", sa.String(), nullable=True),
        sa.Column("actor_id", sa.String(), nullable=False),
        sa.Column("actor_role", sa.String(), nullable=False),
        sa.Column("at", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=False),
    )
    op.create_index("ix_case_assignment_events_case_id", "case_assignment_events", ["case_id"])
    op.create_index("ix_case_assignment_events_user_id", "case_assignment_events", ["user_id"])
    op.create_index("ix_case_assignment_events_at", "case_assignment_events", ["at"])

    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE OR REPLACE FUNCTION case_assignment_history_append_only() RETURNS trigger AS $$ "
                   "BEGIN RAISE EXCEPTION 'case_assignment_events is append-only'; END; $$ LANGUAGE plpgsql")
        op.execute("CREATE TRIGGER case_assignment_events_no_update_delete BEFORE UPDATE OR DELETE ON "
                   "case_assignment_events FOR EACH ROW EXECUTE FUNCTION case_assignment_history_append_only()")
        op.execute("CREATE TRIGGER case_assignment_events_no_truncate BEFORE TRUNCATE ON case_assignment_events "
                   "FOR EACH STATEMENT EXECUTE FUNCTION case_assignment_history_append_only()")


def downgrade():
    # Destroys the assignment history. Export case_assignment_events first if it must be kept. The owner rows
    # inserted by upgrade() are left in place (they only restate access the owner already had).
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS case_assignment_events_no_truncate ON case_assignment_events")
        op.execute("DROP TRIGGER IF EXISTS case_assignment_events_no_update_delete ON case_assignment_events")
        op.execute("DROP FUNCTION IF EXISTS case_assignment_history_append_only()")
    op.drop_index("ix_case_assignment_events_at", table_name="case_assignment_events")
    op.drop_index("ix_case_assignment_events_user_id", table_name="case_assignment_events")
    op.drop_index("ix_case_assignment_events_case_id", table_name="case_assignment_events")
    op.drop_table("case_assignment_events")
    op.drop_column("case_assignments", "reason")
    op.drop_column("case_assignments", "assigned_at")
    op.drop_column("case_assignments", "assigned_by")
