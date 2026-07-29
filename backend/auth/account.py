"""Account removal shared by self-service deletion and the admin panel."""
from __future__ import annotations

from sqlalchemy import delete, or_
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import SongSheet, TeacherAssignment, TeacherInviteCode, TeacherStudent, User


async def delete_user_and_data(db: AsyncSession, user: User) -> None:
    """Delete a user and everything tied to them, then commit."""
    # These have no ORM relationship; delete explicitly so SQLite matches Postgres's FK cascade
    await db.execute(
        delete(TeacherAssignment).where(
            or_(TeacherAssignment.teacher_id == user.id, TeacherAssignment.student_id == user.id)
        )
    )
    await db.execute(
        delete(TeacherStudent).where(
            or_(TeacherStudent.teacher_id == user.id, TeacherStudent.student_id == user.id)
        )
    )
    await db.execute(delete(TeacherInviteCode).where(TeacherInviteCode.teacher_id == user.id))
    await db.execute(delete(SongSheet).where(SongSheet.owner_id == user.id))
    # Tokens, attempts, drills and quiz results go via ORM cascade
    await db.delete(user)
    await db.commit()
