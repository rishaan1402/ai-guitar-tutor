"""song_sheets

Revision ID: 4e1a7b3c6d52
Revises: 3c9d2f5e8b21
Create Date: 2026-11-13 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e1a7b3c6d52'
down_revision: Union[str, Sequence[str], None] = '3c9d2f5e8b21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('song_sheets',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('owner_id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('artist', sa.String(length=200), nullable=True),
    sa.Column('song_key', sa.String(length=20), nullable=True),
    sa.Column('difficulty', sa.String(length=20), nullable=True),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('visibility', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("visibility IN ('private','class')", name='ck_song_sheets_visibility'),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_song_sheets_owner', 'song_sheets', ['owner_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_song_sheets_owner', table_name='song_sheets')
    op.drop_table('song_sheets')
