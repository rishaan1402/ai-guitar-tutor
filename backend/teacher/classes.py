"""Student-side class membership: join a teacher's class with an invite code."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.engine import get_db
from db.models import TeacherAssignment, TeacherInviteCode, TeacherStudent, User

router = APIRouter(prefix="/api/class", tags=["class"])


class JoinRequest(BaseModel):
    code: str


class TeacherInfo(BaseModel):
    id: uuid.UUID
    display_name: str


class AssignmentInfo(BaseModel):
    id: uuid.UUID
    teacher_name: str
    chord_name: str | None
    note: str | None
    created_at: str


@router.post("/join", response_model=TeacherInfo)
async def join_class(
    body: JoinRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "student":
        raise HTTPException(status_code=400, detail="Only student accounts can join a class")
    code = body.code.strip().upper()
    row = (
        await db.execute(select(TeacherInviteCode).where(TeacherInviteCode.code == code))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No class found for that code")
    teacher = await db.get(User, row.teacher_id)
    if teacher is None:
        raise HTTPException(status_code=404, detail="No class found for that code")

    existing = await db.execute(
        select(TeacherStudent.id).where(
            TeacherStudent.teacher_id == teacher.id,
            TeacherStudent.student_id == user.id,
        )
    )
    if existing.first() is None:
        db.add(TeacherStudent(teacher_id=teacher.id, student_id=user.id))
        await db.commit()
    return TeacherInfo(id=teacher.id, display_name=teacher.display_name)


@router.get("/teachers", response_model=list[TeacherInfo])
async def my_teachers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(User)
        .join(TeacherStudent, TeacherStudent.teacher_id == User.id)
        .where(TeacherStudent.student_id == user.id)
        .order_by(User.display_name)
    )
    return [TeacherInfo(id=t.id, display_name=t.display_name) for t in rows.scalars().all()]


@router.delete("/teachers/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
async def leave_class(
    teacher_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave a class. The teacher immediately loses access to this student's data."""
    await db.execute(
        delete(TeacherStudent).where(
            TeacherStudent.teacher_id == teacher_id,
            TeacherStudent.student_id == user.id,
        )
    )
    await db.commit()


@router.get("/assignments", response_model=list[AssignmentInfo])
async def my_assignments(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Practice work assigned to me by teachers whose class I'm still in."""
    rows = await db.execute(
        select(TeacherAssignment, User.display_name)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .join(
            TeacherStudent,
            (TeacherStudent.teacher_id == TeacherAssignment.teacher_id)
            & (TeacherStudent.student_id == TeacherAssignment.student_id),
        )
        .where(TeacherAssignment.student_id == user.id)
        .order_by(TeacherAssignment.created_at.desc())
        .limit(50)
    )
    return [
        AssignmentInfo(
            id=a.id,
            teacher_name=name,
            chord_name=a.chord_name,
            note=a.note,
            created_at=a.created_at.isoformat() if a.created_at else "",
        )
        for a, name in rows.all()
    ]
