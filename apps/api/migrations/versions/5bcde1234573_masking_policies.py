"""masking_policies: who may request an audited reveal of each kind of masked value.

Defaults: INVESTIGATOR and REVIEWER for every kind. ADMIN is deliberately absent (separation of duties: administrators
configure the policy but may not use it to read raw values). This changes behaviour: before this revision ADMIN could
reveal entity labels and evidence context, and download raw files.

Revision ID: 5bcde1234573
Revises: 5bcde1234572
Create Date: 2026-11-12 00:00:00.000000
"""
import datetime

from alembic import op
import sqlalchemy as sa

revision = "5bcde1234573"
down_revision = "5bcde1234572"
branch_labels = None
depends_on = None

_KINDS = ("PHONE", "ACCOUNT", "PII_ATTRIBUTE", "EVIDENCE_CONTEXT", "RAW_FILE")


def upgrade():
    table = op.create_table(
        "masking_policies",
        sa.Column("kind", sa.String(), primary_key=True),
        sa.Column("reveal_roles", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
    )
    now = datetime.datetime.utcnow()
    op.bulk_insert(table, [{"kind": k, "reveal_roles": ["INVESTIGATOR", "REVIEWER"], "updated_at": now,
                            "updated_by": None, "reason": "default policy"} for k in _KINDS])


def downgrade():
    op.drop_table("masking_policies")
