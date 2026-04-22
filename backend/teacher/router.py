"""Teacher-only endpoints."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import require_role
from db.engine import get_db
from db.models import ChordAttempt, TeacherAssignment, TransitionDrill, User
from teacher.reports import generate_student_report

router = APIRouter(
    prefix="/api/teacher",
    tags=["teacher"],
    dependencies=[Depends(require_role("teacher", "admin"))],
)


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
    note: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/students", response_model=list[StudentSummary])
async def list_students(
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * per_page
    result = await db.execute(
        select(User).where(User.role == "student").offset(offset).limit(per_page)
    )
    students = result.scalars().all()

    summaries = []
    for student in students:
        stats = await db.execute(
            select(
                func.count().label("attempts"),
                func.max(ChordAttempt.score).label("best"),
                func.avg(ChordAttempt.score).label("avg"),
                func.max(ChordAttempt.created_at).label("last_active"),
            ).where(ChordAttempt.user_id == student.id)
        )
        row = stats.one()

        # Count mastered chords
        mastered_q = await db.execute(
            select(ChordAttempt.chord_name, func.max(ChordAttempt.score).label("best"))
            .where(ChordAttempt.user_id == student.id)
            .group_by(ChordAttempt.chord_name)
            .having(func.max(ChordAttempt.score) >= 0.95)
        )
        mastered_count = len(mastered_q.all())

        # Count unique chords practiced
        practiced_q = await db.execute(
            select(func.count(ChordAttempt.chord_name.distinct())).where(
                ChordAttempt.user_id == student.id
            )
        )
        chords_practiced = practiced_q.scalar() or 0

        last_active = row.last_active
        last_str = last_active.isoformat() if last_active else None

        summaries.append(
            StudentSummary(
                id=student.id,
                display_name=student.display_name,
                email=student.email,
                skill_level=student.skill_level,
                chords_practiced=chords_practiced,
                mastered_count=mastered_count,
                avg_score=round(float(row.avg), 3) if row.avg else None,
                last_active=last_str,
            )
        )

    return summaries


@router.get("/students/{student_id}/progress")
async def get_student_progress(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(User, student_id)
    if student is None or student.role != "student":
        raise HTTPException(404, "Student not found")

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
    chord_stats = [
        {
            "chord_name": r.chord_name,
            "total_attempts": r.attempts,
            "best_score": round(float(r.best), 3) if r.best else 0.0,
            "avg_score": round(float(r.avg), 3) if r.avg else 0.0,
            "status": "mastered" if (r.best or 0) >= 0.95 else "in_progress",
        }
        for r in rows.all()
    ]

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
):
    student = await db.get(User, student_id)
    if student is None or student.role != "student":
        raise HTTPException(404, "Student not found")

    report = await generate_student_report(db, student_id)
    return {"student_id": str(student_id), "report": report}


@router.get("/analytics")
async def class_analytics(db: AsyncSession = Depends(get_db)):
    # Most practiced chords across all students
    top_chords = await db.execute(
        select(ChordAttempt.chord_name, func.count().label("total"))
        .group_by(ChordAttempt.chord_name)
        .order_by(func.count().desc())
        .limit(10)
    )

    # Average score per chord
    avg_scores = await db.execute(
        select(ChordAttempt.chord_name, func.avg(ChordAttempt.score).label("avg"))
        .group_by(ChordAttempt.chord_name)
        .order_by(func.avg(ChordAttempt.score))
        .limit(10)
    )

    total_students = await db.execute(
        select(func.count()).where(User.role == "student")
    )

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
    teacher: User = Depends(require_role("teacher", "admin")),
):
    student = await db.get(User, body.student_id)
    if student is None or student.role != "student":
        raise HTTPException(404, "Student not found")

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
