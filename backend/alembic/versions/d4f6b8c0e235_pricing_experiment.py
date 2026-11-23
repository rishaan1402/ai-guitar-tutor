"""pricing experiment: visits and Pro interest per price variant

Revision ID: d4f6b8c0e235
Revises: c3e5a7b9d124
Create Date: 2026-11-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = 'd4f6b8c0e235'
down_revision: Union[str, Sequence[str], None] = 'c3e5a7b9d124'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pricing_events',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        sa.Column('kind', sa.String(12), nullable=False),
        sa.Column('variant', sa.String(8), nullable=False),
        sa.Column('plan', sa.String(12), nullable=True),
        sa.Column('user_id', PG_UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_pricing_variant', 'pricing_events', ['variant', 'kind'])


def downgrade() -> None:
    op.drop_index('idx_pricing_variant', table_name='pricing_events')
    op.drop_table('pricing_events')
