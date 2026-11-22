"""ledger_anchors.merkle_scheme

DEF-085: new anchors use RFC 6962 Merkle hashing (domain-separated leaves/nodes, no last-node duplication). Rows
created before this revision were computed with the legacy construction; the server default records that so their
proofs keep verifying.

Revision ID: 5bcde1234570
Revises: 5bcde1234569
Create Date: 2026-11-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "5bcde1234570"
down_revision = "5bcde1234569"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ledger_anchors", sa.Column("merkle_scheme", sa.String(), nullable=True, server_default="dup-last-v0"))


def downgrade():
    op.drop_column("ledger_anchors", "merkle_scheme")
