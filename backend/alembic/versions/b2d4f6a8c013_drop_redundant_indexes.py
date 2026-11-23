"""drop redundant indexes

Three duplicated a unique constraint (which already has an index), two were
the leading column of a composite index on the same table. Each one only
slowed writes.

Revision ID: b2d4f6a8c013
Revises: a1c3e5f7b902
Create Date: 2026-11-23 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b2d4f6a8c013'
down_revision: Union[str, Sequence[str], None] = 'a1c3e5f7b902'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DROPPED = [
    ('idx_users_email', 'users', ['email']),
    ('idx_lesson_sessions_lesson_id', 'lesson_sessions', ['lesson_id']),
    ('idx_tutor_sessions_sid', 'tutor_sessions', ['session_id']),
    ('idx_chord_attempts_user', 'chord_attempts', ['user_id']),
    ('idx_transition_drills_user', 'transition_drills', ['user_id']),
]


def upgrade() -> None:
    for name, table, _ in _DROPPED:
        op.drop_index(name, table_name=table)


def downgrade() -> None:
    for name, table, cols in _DROPPED:
        op.create_index(name, table, cols, unique=False)
