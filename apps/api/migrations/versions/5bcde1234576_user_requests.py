"""user_requests, user_request_events (append-only) and notifications.

User request management (services/user_requests.py, docs/USER_REQUESTS.md, ADR-018). All three tables are created
empty: nothing changes for existing users until someone raises a request.

Revision ID: 5bcde1234576
Revises: 5bcde1234575
Create Date: 2026-11-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "5bcde1234576"
down_revision = "5bcde1234575"
branch_labels = None
depends_on = None

_OPEN = "status IN ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED')"


def upgrade():
    op.create_table(
        "user_requests",
        sa.Column("request_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("priority", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("dedupe_key", sa.String(), nullable=False),
        sa.Column("requester_id", sa.String(), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("case_id", sa.String(), nullable=True),
        sa.Column("reviewer_id", sa.String(), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.Column("completed_by", sa.String(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("completion_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
    )
    for col in ("category", "status", "requester_id", "case_id", "reviewer_id"):
        op.create_index(f"ix_user_requests_{col}", "user_requests", [col])
    # At most one open request per requester and duplicate key, even for concurrent creates.
    op.create_index("uix_user_requests_open_dedupe", "user_requests", ["requester_id", "dedupe_key"], unique=True,
                    postgresql_where=sa.text(_OPEN), sqlite_where=sa.text(_OPEN))

    op.create_table(
        "user_request_events",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("request_id", sa.Integer(), nullable=False),
        sa.Column("event", sa.String(), nullable=False),
        sa.Column("from_status", sa.String(), nullable=True),
        sa.Column("to_status", sa.String(), nullable=True),
        sa.Column("actor_id", sa.String(), nullable=False),
        sa.Column("actor_role", sa.String(), nullable=False),
        sa.Column("at", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("detail", sa.JSON(), nullable=False),
    )
    op.create_index("ix_user_request_events_request_id", "user_request_events", ["request_id"])

    op.create_table(
        "notifications",
        sa.Column("notification_id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("link", sa.String(), nullable=True),
        sa.Column("request_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])

    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE OR REPLACE FUNCTION user_request_history_append_only() RETURNS trigger AS $$ "
                   "BEGIN RAISE EXCEPTION 'user_request_events is append-only'; END; $$ LANGUAGE plpgsql")
        op.execute("CREATE TRIGGER user_request_events_no_update_delete BEFORE UPDATE OR DELETE ON user_request_events "
                   "FOR EACH ROW EXECUTE FUNCTION user_request_history_append_only()")
        op.execute("CREATE TRIGGER user_request_events_no_truncate BEFORE TRUNCATE ON user_request_events "
                   "FOR EACH STATEMENT EXECUTE FUNCTION user_request_history_append_only()")


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS user_request_events_no_truncate ON user_request_events")
        op.execute("DROP TRIGGER IF EXISTS user_request_events_no_update_delete ON user_request_events")
        op.execute("DROP FUNCTION IF EXISTS user_request_history_append_only()")
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_user_request_events_request_id", table_name="user_request_events")
    op.drop_table("user_request_events")
    op.drop_index("uix_user_requests_open_dedupe", table_name="user_requests")
    for col in ("reviewer_id", "case_id", "requester_id", "status", "category"):
        op.drop_index(f"ix_user_requests_{col}", table_name="user_requests")
    op.drop_table("user_requests")
