"""Audit logging: richer audit records, append-only enforcement, server-side sessions, verified office.

- audit_events: actor username/role, office, resource office, session, IP, user agent, correlation ID and failure
  reason. All nullable, so existing rows stay valid; their v1 signatures still verify.
- users.office_id: the verified organisational office, assigned by an administrator (never from requests or IP).
- user_sessions: one row per login; logout revokes it and auth.current_user rejects revoked sessions.
- audit_events is append-only: UPDATE, DELETE and TRUNCATE raise an error (PostgreSQL triggers).

Downgrade removes the columns and table, then the append-only triggers, which returns the schema to the state before
this revision. It never deletes audit rows. Store the digests for the affected period off-host before downgrading, and
re-run `upgrade head` to restore the protection.

Revision ID: 5bcde1234572
Revises: 5bcde1234571
Create Date: 2026-11-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "5bcde1234572"
down_revision = "5bcde1234571"
branch_labels = None
depends_on = None

_AUDIT_COLUMNS = [
    ("actor_username", sa.String()),
    ("actor_role", sa.String()),
    ("office_id", sa.String()),
    ("resource_office", sa.String()),
    ("session_id", sa.String()),
    ("ip_address", sa.String()),
    ("user_agent", sa.String()),
    ("correlation_id", sa.String()),
    ("failure_reason", sa.String()),
]


def upgrade():
    for name, col_type in _AUDIT_COLUMNS:
        op.add_column("audit_events", sa.Column(name, col_type, nullable=True))
    op.create_index("ix_audit_events_actor_username", "audit_events", ["actor_username"])
    op.create_index("ix_audit_events_office_id", "audit_events", ["office_id"])
    op.create_index("ix_audit_events_session_id", "audit_events", ["session_id"])
    op.create_index("ix_audit_events_correlation_id", "audit_events", ["correlation_id"])

    op.add_column("users", sa.Column("office_id", sa.String(), nullable=True))
    op.create_index("ix_users_office_id", "users", ["office_id"])

    op.create_table(
        "user_sessions",
        sa.Column("sid", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])

    # Append-only enforcement. PostgreSQL only: SQLite gets equivalent triggers from db.py.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger AS $$ "
            "BEGIN RAISE EXCEPTION 'audit_events is append-only'; END; $$ LANGUAGE plpgsql"
        )
        op.execute(
            "CREATE TRIGGER audit_events_no_update_delete BEFORE UPDATE OR DELETE ON audit_events "
            "FOR EACH ROW EXECUTE FUNCTION audit_events_append_only()"
        )
        op.execute(
            "CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events "
            "FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only()"
        )


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events")
        op.execute("DROP TRIGGER IF EXISTS audit_events_no_update_delete ON audit_events")
        op.execute("DROP FUNCTION IF EXISTS audit_events_append_only()")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_index("ix_users_office_id", table_name="users")
    op.drop_column("users", "office_id")
    for idx in ("ix_audit_events_correlation_id", "ix_audit_events_session_id", "ix_audit_events_office_id",
                "ix_audit_events_actor_username"):
        op.drop_index(idx, table_name="audit_events")
    for name, _ in reversed(_AUDIT_COLUMNS):
        op.drop_column("audit_events", name)
