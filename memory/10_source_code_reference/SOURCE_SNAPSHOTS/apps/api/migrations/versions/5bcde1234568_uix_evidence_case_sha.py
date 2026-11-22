"""uix_evidence_case_sha

Revision ID: 5bcde1234568
Revises: 5bcde1234567
Create Date: 2026-09-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '5bcde1234568'
down_revision = '5bcde1234567'
branch_labels = None
depends_on = None

def upgrade():
    # Because SQLite doesn't support adding constraints natively, we use batch_alter_table
    with op.batch_alter_table('evidence', schema=None) as batch_op:
        batch_op.create_unique_constraint('uix_evidence_case_sha', ['case_id', 'sha256'])

def downgrade():
    with op.batch_alter_table('evidence', schema=None) as batch_op:
        batch_op.drop_constraint('uix_evidence_case_sha', type_='unique')
