"""song library: shared generated song lessons, query aliases, saved songs

Revision ID: 9f2b4d6a8c31
Revises: 8e1a3c5d7f20
Create Date: 2026-11-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = '9f2b4d6a8c31'
down_revision: Union[str, Sequence[str], None] = '8e1a3c5d7f20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'song_lessons',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        sa.Column('song_key', sa.String(240), nullable=False, unique=True),
        sa.Column('song_title', sa.String(200), nullable=False),
        sa.Column('artist', sa.String(200), nullable=False, server_default=''),
        sa.Column('song_data', sa.JSON(), nullable=False),
        sa.Column('lesson_data', sa.JSON(), nullable=False),
        sa.Column('reports', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('hits', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        'song_query_aliases',
        sa.Column('query', sa.String(160), primary_key=True),
        sa.Column('song_id', PG_UUID(as_uuid=True), sa.ForeignKey('song_lessons.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_table(
        'user_songs',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', PG_UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('song_id', PG_UUID(as_uuid=True), sa.ForeignKey('song_lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('saved_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('user_id', 'song_id', name='uq_user_song'),
    )
    op.create_index('idx_user_songs_user', 'user_songs', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_user_songs_user', table_name='user_songs')
    op.drop_table('user_songs')
    op.drop_table('song_query_aliases')
    op.drop_table('song_lessons')
