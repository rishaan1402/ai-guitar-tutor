"""rate counters: rate limits shared by every server instance

Revision ID: a1c3e5f7b902
Revises: 9f2b4d6a8c31
Create Date: 2026-11-23 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c3e5f7b902'
down_revision: Union[str, Sequence[str], None] = '9f2b4d6a8c31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rate_counters',
        sa.Column('name', sa.String(32), primary_key=True),
        sa.Column('key', sa.String(200), primary_key=True),
        sa.Column('bucket', sa.BigInteger(), primary_key=True),
        sa.Column('count', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_index('idx_rate_counters_bucket', 'rate_counters', ['bucket'])


def downgrade() -> None:
    op.drop_index('idx_rate_counters_bucket', table_name='rate_counters')
    op.drop_table('rate_counters')
