"""teacher_classes

Revision ID: 3c9d2f5e8b21
Revises: 2b7c1e4d9a10
Create Date: 2026-11-13 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c9d2f5e8b21'
down_revision: Union[str, Sequence[str], None] = '2b7c1e4d9a10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('teacher_invite_codes',
    sa.Column('teacher_id', sa.UUID(), nullable=False),
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['teacher_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('teacher_id'),
    sa.UniqueConstraint('code')
    )
    op.create_table('teacher_students',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('teacher_id', sa.UUID(), nullable=False),
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['teacher_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('teacher_id', 'student_id', name='uq_teacher_student')
    )
    op.create_index('idx_teacher_students_student', 'teacher_students', ['student_id'], unique=False)
    op.create_index('idx_teacher_students_teacher', 'teacher_students', ['teacher_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_teacher_students_teacher', table_name='teacher_students')
    op.drop_index('idx_teacher_students_student', table_name='teacher_students')
    op.drop_table('teacher_students')
    op.drop_table('teacher_invite_codes')
