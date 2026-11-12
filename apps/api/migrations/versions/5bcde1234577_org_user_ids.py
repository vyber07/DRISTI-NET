"""users.org_user_id and the org_user_ids allocation registry (organisational user IDs, ADR-019).

users.user_id stays the immutable internal key; nothing that references it changes. Existing users get
org_user_id = NULL ("not allocated") and no registry rows: administrators allocate IDs afterwards through
PUT /users/{id}/org-user-id. The registry may only change by ending an ACTIVE allocation (trigger below).

Revision ID: 5bcde1234577
Revises: 5bcde1234576
Create Date: 2026-11-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "5bcde1234577"
down_revision = "5bcde1234576"
branch_labels = None
depends_on = None

_TAKEN = "status IN ('ACTIVE', 'RETIRED')"
_ACTIVE = "status = 'ACTIVE'"
_UPDATE_OK = ("OLD.status = 'ACTIVE' AND NEW.status IN ('RETIRED', 'VOIDED') "
              "AND NEW.assignment_id = OLD.assignment_id AND NEW.org_user_id = OLD.org_user_id "
              "AND NEW.user_id = OLD.user_id AND NEW.assigned_by = OLD.assigned_by "
              "AND NEW.assigned_at = OLD.assigned_at AND NEW.assign_reason = OLD.assign_reason "
              "AND NEW.ended_by IS NOT NULL AND NEW.ended_at IS NOT NULL AND NEW.end_reason IS NOT NULL")
_MSG = "org_user_ids: only ending an ACTIVE allocation is permitted; rows are never deleted"


def upgrade():
    op.add_column("users", sa.Column("org_user_id", sa.String(), nullable=True))
    op.create_unique_constraint("uq_users_org_user_id", "users", ["org_user_id"])

    op.create_table(
        "org_user_ids",
        sa.Column("assignment_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("org_user_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("assigned_by", sa.String(), nullable=False),
        sa.Column("assigned_at", sa.DateTime(), nullable=False),
        sa.Column("assign_reason", sa.Text(), nullable=False),
        sa.Column("ended_by", sa.String(), nullable=True),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("end_reason", sa.Text(), nullable=True),
    )
    op.create_index("ix_org_user_ids_org_user_id", "org_user_ids", ["org_user_id"])
    op.create_index("ix_org_user_ids_user_id", "org_user_ids", ["user_id"])
    # An ID that is held (ACTIVE) or was held (RETIRED) is taken for good; one ACTIVE allocation per user.
    op.create_index("uix_org_user_ids_taken", "org_user_ids", ["org_user_id"], unique=True,
                    postgresql_where=sa.text(_TAKEN), sqlite_where=sa.text(_TAKEN))
    op.create_index("uix_org_user_ids_active_user", "org_user_ids", ["user_id"], unique=True,
                    postgresql_where=sa.text(_ACTIVE), sqlite_where=sa.text(_ACTIVE))

    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE OR REPLACE FUNCTION org_user_ids_guard() RETURNS trigger AS $$ BEGIN "
                   f"IF TG_OP IN ('DELETE', 'TRUNCATE') THEN RAISE EXCEPTION '{_MSG}'; END IF; "
                   f"IF {_UPDATE_OK} THEN RETURN NEW; END IF; "
                   f"RAISE EXCEPTION '{_MSG}'; END; $$ LANGUAGE plpgsql")
        op.execute("CREATE TRIGGER org_user_ids_guard BEFORE UPDATE OR DELETE ON org_user_ids "
                   "FOR EACH ROW EXECUTE FUNCTION org_user_ids_guard()")
        op.execute("CREATE TRIGGER org_user_ids_no_truncate BEFORE TRUNCATE ON org_user_ids "
                   "FOR EACH STATEMENT EXECUTE FUNCTION org_user_ids_guard()")


def downgrade():
    # Destroys the allocation history. Export org_user_ids first if it must be kept (see docs/USER_ID_ALLOCATION.md).
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS org_user_ids_no_truncate ON org_user_ids")
        op.execute("DROP TRIGGER IF EXISTS org_user_ids_guard ON org_user_ids")
        op.execute("DROP FUNCTION IF EXISTS org_user_ids_guard()")
    op.drop_index("uix_org_user_ids_active_user", table_name="org_user_ids")
    op.drop_index("uix_org_user_ids_taken", table_name="org_user_ids")
    op.drop_index("ix_org_user_ids_user_id", table_name="org_user_ids")
    op.drop_index("ix_org_user_ids_org_user_id", table_name="org_user_ids")
    op.drop_table("org_user_ids")
    op.drop_constraint("uq_users_org_user_id", "users", type_="unique")
    op.drop_column("users", "org_user_id")
