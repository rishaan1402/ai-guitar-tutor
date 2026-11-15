"""practice: groove runs, path progress, goals, weekly coach reports

Revision ID: 7d4b2e9f1a60
Revises: 6c2f9a1d4e83
Create Date: 2026-11-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = '7d4b2e9f1a60'
down_revision: Union[str, Sequence[str], None] = '6c2f9a1d4e83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _user_fk():
    return sa.Column('user_id', PG_UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)


def upgrade() -> None:
    op.create_table(
        'groove_runs',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        _user_fk(),
        sa.Column('title', sa.String(80), nullable=False),
        sa.Column('source', sa.String(20), nullable=False, server_default='preset'),
        sa.Column('mode', sa.String(10), nullable=False),
        sa.Column('bpm', sa.Integer(), nullable=False),
        sa.Column('stars', sa.Integer(), nullable=False),
        sa.Column('groove', sa.JSON(), nullable=True),
        sa.Column('changes', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_groove_runs_user_time', 'groove_runs', ['user_id', 'created_at'])
    op.create_table(
        'path_progress',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        _user_fk(),
        sa.Column('session_id', sa.String(40), nullable=False),
        sa.Column('stars', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('user_id', 'session_id', name='uq_path_user_session'),
    )
    op.create_table(
        'user_goals',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        _user_fk(),
        sa.Column('title', sa.String(120), nullable=False),
        sa.Column('chords', sa.JSON(), nullable=True),
        sa.Column('target_date', sa.Date(), nullable=False),
        sa.Column('plan', sa.JSON(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_user_goals_user', 'user_goals', ['user_id'])
    op.create_table(
        'coach_reports',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        _user_fk(),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('stats', sa.JSON(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('user_id', 'week_start', name='uq_report_user_week'),
    )


def downgrade() -> None:
    op.drop_table('coach_reports')
    op.drop_index('idx_user_goals_user', table_name='user_goals')
    op.drop_table('user_goals')
    op.drop_table('path_progress')
    op.drop_index('idx_groove_runs_user_time', table_name='groove_runs')
    op.drop_table('groove_runs')
