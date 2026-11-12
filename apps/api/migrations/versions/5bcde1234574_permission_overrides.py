"""permission_overrides and permission_override_events (append-only history).

Administrator-controlled, time-boxed ALLOW/DENY exceptions to role-based access (services/overrides.py,
docs/AUTHORIZATION_OVERRIDES.md). Empty after upgrade: no access changes until an administrator creates one.

Revision ID: 5bcde1234574
Revises: 5bcde1234573
Create Date: 2026-11-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "5bcde1234574"
down_revision = "5bcde1234573"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "permission_overrides",
        sa.Column("override_id", sa.String(), primary_key=True),
        sa.Column("effect", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("subject_type", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("case_id", sa.String(), nullable=True),
        sa.Column("resource_type", sa.String(), nullable=True),
        sa.Column("resource_id", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("approved_by", sa.String(), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("decided_reason", sa.String(), nullable=True),
        sa.Column("revoked_by", sa.String(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("revoke_reason", sa.String(), nullable=True),
    )
    for col in ("action", "subject", "case_id", "status"):
        op.create_index(f"ix_permission_overrides_{col}", "permission_overrides", [col])

    op.create_table(
        "permission_override_events",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("override_id", sa.String(), nullable=False),
        sa.Column("event", sa.String(), nullable=False),
        sa.Column("actor_id", sa.String(), nullable=False),
        sa.Column("at", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("snapshot", sa.JSON(), nullable=False),
    )
    op.create_index("ix_permission_override_events_override_id", "permission_override_events", ["override_id"])

    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE OR REPLACE FUNCTION override_history_append_only() RETURNS trigger AS $$ "
                   "BEGIN RAISE EXCEPTION 'permission_override_events is append-only'; END; $$ LANGUAGE plpgsql")
        op.execute("CREATE TRIGGER permission_override_events_no_update_delete BEFORE UPDATE OR DELETE ON "
                   "permission_override_events FOR EACH ROW EXECUTE FUNCTION override_history_append_only()")
        op.execute("CREATE TRIGGER permission_override_events_no_truncate BEFORE TRUNCATE ON "
                   "permission_override_events FOR EACH STATEMENT EXECUTE FUNCTION override_history_append_only()")


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS permission_override_events_no_truncate ON permission_override_events")
        op.execute("DROP TRIGGER IF EXISTS permission_override_events_no_update_delete ON permission_override_events")
        op.execute("DROP FUNCTION IF EXISTS override_history_append_only()")
    op.drop_index("ix_permission_override_events_override_id", table_name="permission_override_events")
    op.drop_table("permission_override_events")
    for col in ("status", "case_id", "subject", "action"):
        op.drop_index(f"ix_permission_overrides_{col}", table_name="permission_overrides")
    op.drop_table("permission_overrides")
