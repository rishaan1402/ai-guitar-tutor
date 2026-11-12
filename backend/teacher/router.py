"""Teacher-only endpoints.

Teachers only see students who joined their class with an invite code
(see teacher/classes.py). Admins see everyone.
"""
from __future__ import annotations

import secrets
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from lesson_service import validate_chord_name
from personalization.mastery import GRADED, mastery_map
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import require_role
from db.engine import get_db
from db.models import (
    ChordAttempt,
    TeacherAssignment,
    TeacherInviteCode,
    TeacherStudent,
    TransitionDrill,
    User,
)
from teacher.reports import generate_student_report

# One instance so FastAPI resolves it once per request (router + endpoint share it)
_teacher = require_role("teacher", "admin")

router = APIRouter(
    prefix="/api/teacher",
    tags=["teacher"],
    dependencies=[Depends(_teacher)],
)

# No 0/O/1/I so codes read cleanly off a whiteboard
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _new_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


def _student_scope(teacher: User):
    """Subquery of student ids this teacher may see, or None for admins (all)."""
    if teacher.role == "admin":
        return None
    return select(TeacherStudent.student_id).where(TeacherStudent.teacher_id == teacher.id)


async def _visible_student(db: AsyncSession, teacher: User, student_id: uuid.UUID) -> User:
    """Load a student the teacher is linked to. 404 (not 403) so ids can't be probed."""
    student = await db.get(User, student_id)
    if student is None or student.role != "student":
        raise HTTPException(404, "Student not found")
    if teacher.role != "admin":
        link = await db.execute(
            select(TeacherStudent.id).where(
                TeacherStudent.teacher_id == teacher.id,
                TeacherStudent.student_id == student_id,
            )
        )
        if link.first() is None:
            raise HTTPException(404, "Student not found")
    return student


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class StudentSummary(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str
    skill_level: str
    chords_practiced: int
    mastered_count: int
    avg_score: float | None
    last_active: str | None


class AssignRequest(BaseModel):
    student_id: uuid.UUID
    chord_name: str | None = None
    note: str | None = Field(default=None, max_length=500)

    @field_validator("chord_name")
    @classmethod
    def _known_chord(cls, v: str | None) -> str | None:
        return None if v is None else validate_chord_name(v)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/students", response_model=list[StudentSummary])
async def list_students(
    page: int = Query(1, ge=1, le=10_000),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(_teacher),
):
    offset = (max(page, 1) - 1) * per_page
    query = select(User).where(User.role == "student")
    scope = _student_scope(teacher)
    if scope is not None:
        query = query.where(User.id.in_(scope))
    result = await db.execute(
        query.order_by(User.display_name).offset(offset).limit(min(per_page, 100))
    )
    students = result.scalars().all()

    ids = [st.id for st in students]
    # 2 queries for the whole page (was 1 + 3 per student)
    stats_rows = await db.execute(
        select(
            ChordAttempt.user_id,
            func.avg(ChordAttempt.score).label("avg"),
            func.max(ChordAttempt.created_at).label("last_active"),
            func.count(ChordAttempt.chord_name.distinct()).label("chords"),
        )
        .where(ChordAttempt.user_id.in_(ids), GRADED)
        .group_by(ChordAttempt.user_id)
    ) if ids else None
    stats = {r.user_id: r for r in (stats_rows.all() if stats_rows is not None else [])}
    mastery = await mastery_map(db, ids)

    summaries = []
    for student in students:
        row = stats.get(student.id)
        summaries.append(
            StudentSummary(
                id=student.id,
                display_name=student.display_name,
                email=student.email,
                skill_level=student.skill_level,
                chords_practiced=row.chords if row else 0,
                mastered_count=sum(1 for m in mastery[student.id].values() if m.is_mastered),
                avg_score=round(float(row.avg), 3) if row and row.avg is not None else None,
                last_active=row.last_active.isoformat() if row and row.last_active else None,
            )
        )

    return summaries


@router.get("/students/{student_id}/progress")
async def get_student_progress(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(_teacher),
):
    student = await _visible_student(db, teacher, student_id)

    rows = await db.execute(
        select(
            ChordAttempt.chord_name,
            func.count().label("attempts"),
            func.max(ChordAttempt.score).label("best"),
            func.avg(ChordAttempt.score).label("avg"),
        )
        .where(ChordAttempt.user_id == student_id)
        .group_by(ChordAttempt.chord_name)
    )
    mastery = (await mastery_map(db, [student_id]))[student_id]
    chord_stats = []
    for r in rows.all():
        m = mastery.get(r.chord_name)
        chord_stats.append({
            "chord_name": r.chord_name,
            "total_attempts": r.attempts,
            "best_score": round(float(r.best), 3) if r.best else 0.0,
            "avg_score": round(float(r.avg), 3) if r.avg else 0.0,
            "status": "mastered" if m and m.is_mastered else "in_progress",
            "stage": m.stage if m else "learning",
            "clean_days": m.clean_days if m else 0,
        })

    drills = await db.execute(
        select(TransitionDrill)
        .where(TransitionDrill.user_id == student_id)
        .order_by(TransitionDrill.created_at.desc())
        .limit(20)
    )
    transition_history = [
        {
            "chord_a_symbol": d.chord_a_symbol,
            "chord_b_symbol": d.chord_b_symbol,
            "tpm": d.tpm,
            "date": d.created_at.date().isoformat() if d.created_at else "",
        }
        for d in drills.scalars().all()
    ]

    return {
        "student": {
            "id": str(student.id),
            "display_name": student.display_name,
            "email": student.email,
            "skill_level": student.skill_level,
        },
        "chord_stats": chord_stats,
        "transition_history": transition_history,
    }


@router.get("/students/{student_id}/report")
async def get_student_report(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(_teacher),
):
    student = await _visible_student(db, teacher, student_id)

    report = await generate_student_report(db, student_id)
    return {"student_id": str(student_id), "report": report}


@router.get("/analytics")
async def class_analytics(
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(_teacher),
):
    scope = _student_scope(teacher)
    attempts = select(ChordAttempt)
    if scope is not None:
        attempts = attempts.where(ChordAttempt.user_id.in_(scope))
    attempts = attempts.subquery()

    # Most practiced chords across the teacher's students
    top_chords = await db.execute(
        select(attempts.c.chord_name, func.count().label("total"))
        .group_by(attempts.c.chord_name)
        .order_by(func.count().desc())
        .limit(10)
    )

    # Average score per chord
    avg_scores = await db.execute(
        select(attempts.c.chord_name, func.avg(attempts.c.score).label("avg"))
        .group_by(attempts.c.chord_name)
        .order_by(func.avg(attempts.c.score))
        .limit(10)
    )

    students = select(func.count()).select_from(User).where(User.role == "student")
    if scope is not None:
        students = students.where(User.id.in_(scope))
    total_students = await db.execute(students)

    return {
        "total_students": total_students.scalar(),
        "most_practiced_chords": [
            {"chord": r.chord_name, "total_attempts": r.total}
            for r in top_chords.all()
        ],
        "lowest_avg_score_chords": [
            {"chord": r.chord_name, "avg_score": round(float(r.avg), 3)}
            for r in avg_scores.all()
        ],
    }


@router.post("/assign", status_code=201)
async def assign_work(
    body: AssignRequest,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(_teacher),
):
    await _visible_student(db, teacher, body.student_id)

    if body.chord_name is not None:
        dup = await db.execute(
            select(TeacherAssignment.id).where(
                TeacherAssignment.teacher_id == teacher.id,
                TeacherAssignment.student_id == body.student_id,
                TeacherAssignment.chord_name == body.chord_name,
            ).limit(1)
        )
        if dup.first() is not None:
            raise HTTPException(status_code=409, detail="That chord is already assigned to this student.")

    db.add(
        TeacherAssignment(
            teacher_id=teacher.id,
            student_id=body.student_id,
            chord_name=body.chord_name,
            note=body.note,
        )
    )
    await db.commit()
    return {"status": "assigned"}


# ---------------------------------------------------------------------------
# Invite code
# ---------------------------------------------------------------------------


async def _code_for(db: AsyncSession, teacher: User, rotate: bool = False) -> str:
    # Plain id captured up front: the rollback below expires `teacher`, and
    # reading teacher.id afterwards would lazy-load outside the async context.
    teacher_id = teacher.id
    row = await db.get(TeacherInviteCode, teacher_id)
    if row is not None and not rotate:
        return row.code
    if row is None:
        row = TeacherInviteCode(teacher_id=teacher_id, code=_new_code())
        db.add(row)
    else:
        row.code = _new_code()
    try:
        await db.commit()
    except IntegrityError:
        # A concurrent first request created the code already; use that one
        await db.rollback()
        row = await db.get(TeacherInviteCode, teacher_id, populate_existing=True)
        if row is None:
            raise
    return row.code


@router.get("/invite-code")
async def get_invite_code(
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(_teacher),
):
    """The code students enter to join this teacher's class (created on first request)."""
    return {"code": await _code_for(db, teacher)}


@router.post("/invite-code/rotate")
async def rotate_invite_code(
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(_teacher),
):
    """Replace the code (e.g. if it leaked). Students already in the class stay linked."""
    return {"code": await _code_for(db, teacher, rotate=True)}


@router.delete("/students/{student_id}", status_code=204)
async def remove_student(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(_teacher),
):
    """Remove a student from this teacher's class."""
    await db.execute(
        delete(TeacherStudent).where(
            TeacherStudent.teacher_id == teacher.id,
            TeacherStudent.student_id == student_id,
        )
    )
    await db.commit()
