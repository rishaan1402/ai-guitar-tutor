"""practice reminders: reminder time per user, web push subscriptions

Revision ID: c3e5a7b9d124
Revises: b2d4f6a8c013
Create Date: 2026-11-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = 'c3e5a7b9d124'
down_revision: Union[str, Sequence[str], None] = 'b2d4f6a8c013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # plain ALTERs (no table rebuild on SQLite, which would drop the lower(email) index)
    op.add_column('users', sa.Column('reminder_hour', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('reminder_tz', sa.String(64), nullable=True))
    op.add_column('users', sa.Column('reminder_sent_on', sa.Date(), nullable=True))
    op.create_table(
        'push_subscriptions',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', PG_UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('endpoint', sa.String(1000), nullable=False, unique=True),
        sa.Column('p256dh', sa.String(200), nullable=False),
        sa.Column('auth', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_push_user', 'push_subscriptions', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_push_user', table_name='push_subscriptions')
    op.drop_table('push_subscriptions')
    for col in ('reminder_sent_on', 'reminder_tz', 'reminder_hour'):
        if op.get_bind().dialect.name == 'sqlite':
            op.execute(f'ALTER TABLE users DROP COLUMN {col}')  # SQLite 3.35+, no table rebuild
        else:
            op.drop_column('users', col)
