"""add audit signature

Revision ID: 5bcde1234567
Revises: b9b204cf821f
Create Date: 2026-09-12 18:04:27.912742

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5bcde1234567'
down_revision: Union[str, Sequence[str], None] = '39486e0cbb1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table('audit_events') as batch_op:
        batch_op.add_column(sa.Column('signature', sa.String(), nullable=True))
    # Leave signature NULL for legacy events (P1-4)
    pass

def downgrade() -> None:
    with op.batch_alter_table('audit_events') as batch_op:
        batch_op.drop_column('signature')
