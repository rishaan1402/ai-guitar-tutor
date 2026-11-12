"""User progress endpoints — DB-backed replacement for localStorage."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.engine import get_db
from db.models import ChordAttempt, QuizResult, TransitionDrill, User
from lesson_service import validate_chord_name
from personalization.thresholds import MASTERY

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
    chord_a: str = Field(max_length=40)
    chord_b: str = Field(max_length=40)
    chord_a_symbol: str = Field(max_length=16)
    chord_b_symbol: str = Field(max_length=16)
    tpm: int = Field(ge=0, le=300)
    got_count: int = Field(ge=0, le=500)
    miss_count: int = Field(ge=0, le=500)
    date: str = Field(max_length=32)

    _known_chords = field_validator("chord_a", "chord_b")(validate_chord_name)


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
    answers: list[dict[str, Any]] = Field(max_length=100)  # [{question_id, selected_index, correct}]
    score: float = Field(ge=0, le=1)


class MigrateChordBody(BaseModel):
    chord_name: str
    best_score: float = Field(ge=0, le=1)
    total_attempts: int = Field(ge=0, le=10_000)
    last_practiced_date: str | None = Field(default=None, max_length=32)

    _known_chord = field_validator("chord_name")(validate_chord_name)


class MigrateTransitionsBody(BaseModel):
    results: list[TransitionResultIn] = Field(max_length=500)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _zone(tz: str | None) -> ZoneInfo:
    """The learner's IANA time zone (sent by the browser); UTC if absent/invalid."""
    if tz:
        try:
            return ZoneInfo(tz)
        except (ZoneInfoNotFoundError, ValueError):
            pass
    return ZoneInfo("UTC")


def _local_date(ts: datetime, zone: ZoneInfo) -> date:
    if ts.tzinfo is None:  # SQLite returns naive UTC
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(zone).date()


def _streak_from_dates(dates: list[date], today: date | None = None) -> int:
    """Consecutive practice days ending today — or yesterday, so a streak
    isn't shown as broken until the learner has missed a whole day."""
    if not dates:
        return 0
    today = today or date.today()
    unique = sorted(set(dates), reverse=True)
    if (today - unique[0]).days > 1:
        return 0
    streak = 1
    for i in range(1, len(unique)):
        if (unique[i - 1] - unique[i]).days == 1:
            streak += 1
        else:
            break
    return streak


async def _attempt_times(db: AsyncSession, user_id: Any, days: int) -> list[tuple[datetime, float]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days + 1)
    rows = await db.execute(
        select(ChordAttempt.created_at, ChordAttempt.score)
        .where(ChordAttempt.user_id == user_id, ChordAttempt.created_at >= cutoff)
    )
    return [(r[0], float(r[1] or 0.0)) for r in rows.all() if r[0] is not None]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=ProgressResponse)
async def get_progress(
    tz: str | None = Query(default=None, max_length=64),
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

    zone = _zone(tz)
    times = await _attempt_times(db, user.id, days=400)
    parsed_dates = [_local_date(t, zone) for t, _ in times]
    today_local = datetime.now(zone).date()
    streak = _streak_from_dates(parsed_dates, today=today_local)

    chords = []
    mastered = 0
    for row in stats:
        best = round(float(row.best), 4) if row.best is not None else 0.0
        if best >= MASTERY:
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


# ---------------------------------------------------------------------------
# Calendar heatmap — last 365 days of practice activity
# ---------------------------------------------------------------------------

class CalendarDay(BaseModel):
    date: str          # ISO date string "2024-04-22"
    attempts: int
    avg_score: float


@router.get("/calendar", response_model=list[CalendarDay])
async def get_calendar(
    tz: str | None = Query(default=None, max_length=64),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """365-day activity feed for the GitHub-style heatmap, bucketed by the
    learner's local date (``tz``), oldest first."""
    zone = _zone(tz)
    buckets: dict[date, list[float]] = {}
    for ts, score in await _attempt_times(db, user.id, days=365):
        buckets.setdefault(_local_date(ts, zone), []).append(score)
    return [
        CalendarDay(date=d.isoformat(), attempts=len(v), avg_score=round(sum(v) / len(v), 3))
        for d, v in sorted(buckets.items())
    ]


# ---------------------------------------------------------------------------
# Chord history drill-down — full attempt timeline for one chord
# ---------------------------------------------------------------------------

class ChordAttemptItem(BaseModel):
    id: str
    score: float
    missing_notes: list[str]
    extra_notes: list[str]
    issue: str | None
    feedback_text: str
    created_at: str


@router.get("/chord/{chord_name}/history", response_model=list[ChordAttemptItem])
async def get_chord_history(
    chord_name: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full attempt timeline for a single chord — used by the drill-down page."""
    rows = await db.execute(
        select(ChordAttempt)
        .where(ChordAttempt.user_id == user.id, ChordAttempt.chord_name == chord_name)
        .order_by(ChordAttempt.created_at.asc())
        .limit(200)
    )
    attempts = rows.scalars().all()
    return [
        ChordAttemptItem(
            id=str(a.id),
            score=round(float(a.score), 3),
            missing_notes=a.missing_notes or [],
            extra_notes=a.extra_notes or [],
            issue=a.issue,
            feedback_text=a.feedback_text or "",
            created_at=a.created_at.isoformat() if a.created_at else "",
        )
        for a in attempts
    ]
