"""user token_version + lower(email) index

Revision ID: 5a8d3e2f1c07
Revises: 4e1a7b3c6d52
Create Date: 2026-11-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a8d3e2f1c07'
down_revision: Union[str, Sequence[str], None] = '4e1a7b3c6d52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add users.token_version (access-token revocation)."""
    op.add_column(
        'users',
        sa.Column('token_version', sa.Integer(), nullable=False, server_default='0'),
    )
    # case-insensitive login lookups
    op.create_index('ix_users_email_lower', 'users', [sa.text('lower(email)')])


def downgrade() -> None:
    op.drop_index('ix_users_email_lower', table_name='users')
    op.drop_column('users', 'token_version')
