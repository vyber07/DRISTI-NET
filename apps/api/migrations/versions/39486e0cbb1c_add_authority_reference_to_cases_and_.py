"""add authority_reference to cases and evidence

Revision ID: 39486e0cbb1c
Revises: b9b204cf821f
Create Date: 2026-09-12 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39486e0cbb1c'
down_revision: Union[str, Sequence[str], None] = 'b9b204cf821f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add `authority_reference` (docs/context.md §10.3 required graph-edge property) to cases, mirrored
    onto evidence the same way classification/jurisdiction/purpose/access_class already are (see the prior
    migration, b9b204cf821f).

    Added nullable first (same reason as before: NOT NULL with no default fails against a database that
    already has rows), then backfilled. `cases` has no parent to mirror from, so an existing case with no
    recorded legal authority gets an explicitly synthetic placeholder derived from its own case_id
    (`AUTHORITY-PLACEHOLDER-<case_id>`) -- never invented as if it were a real reference -- rather than
    silently defaulting to empty string. `evidence` then mirrors its own case's (now-backfilled) value,
    same as the existing governance-field mirror.
    """
    op.add_column('cases', sa.Column('authority_reference', sa.String(), nullable=True))
    op.execute("UPDATE cases SET authority_reference = 'AUTHORITY-PLACEHOLDER-' || case_id WHERE authority_reference IS NULL")
    op.alter_column('cases', 'authority_reference', nullable=False)

    op.add_column('evidence', sa.Column('authority_reference', sa.String(), nullable=True))
    op.execute(
        """
        UPDATE evidence SET authority_reference = cases.authority_reference
        FROM cases WHERE evidence.case_id = cases.case_id
        """
    )
    op.alter_column('evidence', 'authority_reference', nullable=False, server_default='')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('evidence', 'authority_reference')
    op.drop_column('cases', 'authority_reference')
