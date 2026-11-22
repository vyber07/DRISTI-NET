"""add ledger_anchors table and match_candidates assignment columns

Model/migration drift found 2026-11-01 by test_migrations.py (fresh-PostgreSQL upgrade + compare_metadata):

* ``ledger_anchors`` (services/integrity.py::LedgerAnchor) had no migration. The model lives outside
  models.py, so migrations/env.py never registered it and autogenerate could not see it. On PostgreSQL
  (where migrations are the only schema path) POST /cases/{id}/integrity/anchor would fail.
* ``match_candidates.assigned_to`` / ``assigned_at`` had no migration, so every MatchCandidate SELECT
  (the HITL review queue) would fail on a migrated PostgreSQL database.

Revision ID: 5bcde1234569
Revises: 5bcde1234568
Create Date: 2026-11-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '5bcde1234569'
down_revision = '5bcde1234568'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ledger_anchors',
        sa.Column('anchor_id', sa.String(), nullable=False),
        sa.Column('case_id', sa.String(), nullable=False),
        sa.Column('leaf_hashes', sa.JSON(), nullable=False),
        sa.Column('merkle_root', sa.String(), nullable=False),
        sa.Column('tx_hash', sa.String(), nullable=True),
        sa.Column('block_number', sa.String(), nullable=True),
        sa.Column('chain_id', sa.String(), nullable=True),
        sa.Column('endpoint', sa.String(), nullable=True),
        sa.Column('anchor_status', sa.String(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('anchor_id'),
    )
    op.create_index(op.f('ix_ledger_anchors_case_id'), 'ledger_anchors', ['case_id'], unique=False)

    with op.batch_alter_table('match_candidates', schema=None) as batch_op:
        batch_op.add_column(sa.Column('assigned_to', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('assigned_at', sa.String(), nullable=True))
        batch_op.create_foreign_key('fk_match_candidates_assigned_to_users', 'users', ['assigned_to'], ['user_id'])


def downgrade():
    with op.batch_alter_table('match_candidates', schema=None) as batch_op:
        batch_op.drop_constraint('fk_match_candidates_assigned_to_users', type_='foreignkey')
        batch_op.drop_column('assigned_at')
        batch_op.drop_column('assigned_to')
    op.drop_index(op.f('ix_ledger_anchors_case_id'), table_name='ledger_anchors')
    op.drop_table('ledger_anchors')
