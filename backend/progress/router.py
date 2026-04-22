"""User progress endpoints — DB-backed replacement for localStorage."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.engine import get_db
from db.models import ChordAttempt, QuizResult, TransitionDrill, User

router = APIRouter(prefix="/api/progress", tags=["progress"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class ChordProgressItem(BaseModel):
    chord_name: str
    best_score: float
    total_attempts: int
    last_practiced: str | None
    status: str  # "not_attempted" | "in_progress" | "mastered"


class ProgressResponse(BaseModel):
    chords: list[ChordProgressItem]
    mastered_count: int
    total_attempted: int
    practice_streak: int


class TransitionResultIn(BaseModel):
    chord_a: str
    chord_b: str
    chord_a_symbol: str
    chord_b_symbol: str
    tpm: int
    got_count: int
    miss_count: int
    date: str


class TransitionResultOut(BaseModel):
    chord_a: str
    chord_b: str
    chord_a_symbol: str
    chord_b_symbol: str
    tpm: int
    got_count: int
    miss_count: int
    date: str


class QuizSubmitBody(BaseModel):
    answers: list[dict[str, Any]]  # [{question_id, selected_index, correct}]
    score: float


class MigrateChordBody(BaseModel):
    chord_name: str
    best_score: float
    total_attempts: int
    last_practiced_date: str | None = None


class MigrateTransitionsBody(BaseModel):
    results: list[TransitionResultIn]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _streak_from_dates(dates: list[date]) -> int:
    """Count consecutive days ending today."""
    if not dates:
        return 0
    unique = sorted(set(dates), reverse=True)
    today = date.today()
    if unique[0] != today:
        return 0
    streak = 1
    for i in range(1, len(unique)):
        if (unique[i - 1] - unique[i]).days == 1:
            streak += 1
        else:
            break
    return streak


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=ProgressResponse)
async def get_progress(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(
            ChordAttempt.chord_name,
            func.count().label("attempts"),
            func.max(ChordAttempt.score).label("best"),
            func.max(ChordAttempt.created_at).label("last_practiced"),
        )
        .where(ChordAttempt.user_id == user.id)
        .group_by(ChordAttempt.chord_name)
    )
    stats = rows.all()

    # Streak: count consecutive practice days
    date_rows = await db.execute(
        select(func.date(ChordAttempt.created_at))
        .where(ChordAttempt.user_id == user.id)
        .distinct()
    )
    practice_dates = [r[0] for r in date_rows.all()]
    # SQLite returns string; Postgres returns date
    parsed_dates = []
    for d in practice_dates:
        if isinstance(d, str):
            parsed_dates.append(date.fromisoformat(d))
        elif isinstance(d, datetime):
            parsed_dates.append(d.date())
        else:
            parsed_dates.append(d)

    streak = _streak_from_dates(parsed_dates)

    chords = []
    mastered = 0
    for row in stats:
        best = round(float(row.best), 4) if row.best is not None else 0.0
        if best >= 0.95:
            status = "mastered"
            mastered += 1
        elif best >= 0.1:
            status = "in_progress"
        else:
            status = "not_attempted"

        last = row.last_practiced
        if isinstance(last, datetime):
            last_str = last.date().isoformat()
        elif last is not None:
            last_str = str(last)[:10]
        else:
            last_str = None

        chords.append(
            ChordProgressItem(
                chord_name=row.chord_name,
                best_score=best,
                total_attempts=row.attempts,
                last_practiced=last_str,
                status=status,
            )
        )

    return ProgressResponse(
        chords=chords,
        mastered_count=mastered,
        total_attempted=len(stats),
        practice_streak=streak,
    )


@router.get("/transitions", response_model=list[TransitionResultOut])
async def get_transitions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(TransitionDrill)
        .where(TransitionDrill.user_id == user.id)
        .order_by(TransitionDrill.created_at.desc())
        .limit(100)
    )
    drills = rows.scalars().all()
    return [
        TransitionResultOut(
            chord_a=d.chord_a,
            chord_b=d.chord_b,
            chord_a_symbol=d.chord_a_symbol,
            chord_b_symbol=d.chord_b_symbol,
            tpm=d.tpm,
            got_count=d.got_count,
            miss_count=d.miss_count,
            date=d.created_at.date().isoformat() if d.created_at else "",
        )
        for d in drills
    ]


@router.post("/transitions", status_code=201)
async def save_transition(
    body: TransitionResultIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db.add(
        TransitionDrill(
            user_id=user.id,
            chord_a=body.chord_a,
            chord_b=body.chord_b,
            chord_a_symbol=body.chord_a_symbol,
            chord_b_symbol=body.chord_b_symbol,
            tpm=body.tpm,
            got_count=body.got_count,
            miss_count=body.miss_count,
        )
    )
    await db.commit()
    return {"status": "saved"}


@router.post("/quiz/{lesson_id}/submit", status_code=201)
async def submit_quiz(
    lesson_id: str,
    body: QuizSubmitBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db.add(
        QuizResult(
            user_id=user.id,
            lesson_id=lesson_id,
            answers=body.answers,
            score=body.score,
        )
    )
    await db.commit()
    return {"status": "saved"}


@router.post("/migrate", status_code=201)
async def migrate_chord_progress(
    body: MigrateChordBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """One-time import of a chord's best score from localStorage."""
    # Check if we already have data for this chord
    existing = await db.execute(
        select(func.count()).where(
            ChordAttempt.user_id == user.id,
            ChordAttempt.chord_name == body.chord_name,
        )
    )
    if existing.scalar() > 0:
        return {"status": "skipped", "reason": "already has data"}

    # Create a synthetic attempt representing the best score
    db.add(
        ChordAttempt(
            user_id=user.id,
            chord_name=body.chord_name,
            score=body.best_score,
            detected_notes=[],
            missing_notes=[],
            extra_notes=[],
            feedback_text="Imported from local storage",
        )
    )
    await db.commit()
    return {"status": "imported"}


@router.post("/migrate-transitions", status_code=201)
async def migrate_transitions(
    body: MigrateTransitionsBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import of transition drill history from localStorage."""
    for r in body.results:
        db.add(
            TransitionDrill(
                user_id=user.id,
                chord_a=r.chord_a,
                chord_b=r.chord_b,
                chord_a_symbol=r.chord_a_symbol,
                chord_b_symbol=r.chord_b_symbol,
                tpm=r.tpm,
                got_count=r.got_count,
                miss_count=r.miss_count,
            )
        )
    await db.commit()
    return {"status": "imported", "count": len(body.results)}
