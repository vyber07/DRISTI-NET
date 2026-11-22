"""users.token_version

SEC-02: a per-user counter bumped on every password change, embedded in newly-issued JWTs and
checked on every request (auth.current_user), so a password reset immediately invalidates tokens
issued before it instead of leaving them valid until their natural 8-hour expiry.

Revision ID: 5bcde1234571
Revises: 5bcde1234570
Create Date: 2026-11-11 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "5bcde1234571"
down_revision = "5bcde1234570"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    op.drop_column("users", "token_version")
