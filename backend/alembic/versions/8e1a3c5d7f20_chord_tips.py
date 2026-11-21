"""chord tips: shared coaching tips for built chord shapes

Revision ID: 8e1a3c5d7f20
Revises: 7d4b2e9f1a60
Create Date: 2026-11-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = '8e1a3c5d7f20'
down_revision: Union[str, Sequence[str], None] = '7d4b2e9f1a60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'chord_tips',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        sa.Column('symbol', sa.String(24), nullable=False),
        sa.Column('frets', sa.String(40), nullable=False),
        sa.Column('tips', sa.JSON(), nullable=True),
        sa.Column('source', sa.String(12), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('symbol', 'frets', name='uq_chord_tip_shape'),
    )


def downgrade() -> None:
    op.drop_table('chord_tips')
