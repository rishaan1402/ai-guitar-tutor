"""user_identities (Google / Facebook sign-in) + content_reports

Revision ID: 6c2f9a1d4e83
Revises: 5a8d3e2f1c07
Create Date: 2026-11-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = '6c2f9a1d4e83'
down_revision: Union[str, Sequence[str], None] = '5a8d3e2f1c07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_identities',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', PG_UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(20), nullable=False),
        sa.Column('subject', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('provider', 'subject', name='uq_identity_provider_subject'),
        sa.CheckConstraint("provider IN ('google','facebook')", name='ck_identity_provider'),
    )
    op.create_index('idx_identities_user', 'user_identities', ['user_id'])
    op.create_table(
        'content_reports',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', PG_UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('reason', sa.String(40), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('context', sa.String(200), nullable=True),
        sa.Column('note', sa.String(500), nullable=True),
        sa.Column('resolved', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("kind IN ('feedback','song_chart','song_lesson','tip','other')", name='ck_report_kind'),
    )
    op.create_index('idx_reports_created', 'content_reports', ['created_at'])


def downgrade() -> None:
    op.drop_index('idx_reports_created', table_name='content_reports')
    op.drop_table('content_reports')
    op.drop_index('idx_identities_user', table_name='user_identities')
    op.drop_table('user_identities')
