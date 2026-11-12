"""upload_policies: administrator-set per-category upload limits.

Created empty. A missing row falls back to the environment default for that category (config.UPLOAD_DEFAULT_LIMITS_MB),
so behaviour is unchanged until an administrator sets a limit (services/upload_policy.py, docs/UPLOAD_POLICY.md).

Revision ID: 5bcde1234575
Revises: 5bcde1234574
Create Date: 2026-11-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "5bcde1234575"
down_revision = "5bcde1234574"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "upload_policies",
        sa.Column("category", sa.String(), primary_key=True),
        sa.Column("max_mb", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_table("upload_policies")
