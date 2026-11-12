from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import LessonSessionDB

from council.schemas import SongObject, LessonDocument, QuizResponse, ChordRankEntry

SESSION_TTL = 7200  # 2 hours


@dataclass
class LessonSession:
    lesson_id: str
    song: SongObject
    lesson: LessonDocument
    # chord_key → list of attempt scores
    chord_scores: dict[str, list[float]] = field(default_factory=dict)
    # cached quiz so we don't re-generate on every /quiz call
    cached_quiz: Optional[QuizResponse] = field(default=None)
    created_at: float = field(default_factory=time.time)

    @property
    def all_chords_attempted(self) -> bool:
        """True once every available practice chord has been attempted at least once."""
        available = [c.chord_key for c in self.lesson.practice_chords if c.available_in_app and c.chord_key]
        if not available:
            return False
        return all(key in self.chord_scores for key in available)

    def record_attempt(self, chord_key: str, score: float) -> None:
        self.chord_scores.setdefault(chord_key, []).append(score)

    def best_score(self, chord_key: str) -> Optional[float]:
        scores = self.chord_scores.get(chord_key, [])
        return max(scores) if scores else None

    def chord_ranking(self) -> list[ChordRankEntry]:
        """Ranked list of practice chords by performance — used by revise endpoint."""
        entries: list[ChordRankEntry] = []
        for chord in self.lesson.practice_chords:
            if not chord.chord_key or not chord.available_in_app:
                continue
            scores = self.chord_scores.get(chord.chord_key, [])
            best = max(scores) if scores else -1.0
            attempts = len(scores)
            if attempts == 0:
                status = "untouched"
            elif best >= 0.70:
                status = "solid"
            else:
                status = "needs_work"
            entries.append(ChordRankEntry(
                chord_key=chord.chord_key,
                symbol=chord.symbol,
                best_score=round(best, 3),
                attempts=attempts,
                status=status,
            ))
        # Sort: needs_work first, then untouched, then solid
        order = {"needs_work": 0, "untouched": 1, "solid": 2}
        entries.sort(key=lambda e: order.get(e.status, 3))
        return entries

    def score_summary(self) -> str:
        """Human-readable summary of all chord scores for prompts."""
        if not self.chord_scores:
            return "No chords practiced yet."
        lines = []
        for chord in self.lesson.practice_chords:
            if chord.chord_key and chord.chord_key in self.chord_scores:
                scores = self.chord_scores[chord.chord_key]
                best = round(max(scores) * 100)
                attempts = len(scores)
                lines.append(f"  {chord.symbol}: best {best}% over {attempts} attempt(s)")
        return "\n".join(lines) if lines else "No chords practiced yet."


# ---------------------------------------------------------------------------
# Database-backed store
#
# Sessions live in ``lesson_sessions`` so a lesson generated on one Cloud Run
# instance can be practised against any other, and survives restarts.
# ``LessonSession`` stays the in-memory working view; call ``save_session``
# after mutating it.
# ---------------------------------------------------------------------------

MAX_SCORES_PER_CHORD = 50


def _from_row(row: LessonSessionDB) -> LessonSession:
    return LessonSession(
        lesson_id=row.lesson_id,
        song=SongObject.model_validate(row.song_data),
        lesson=LessonDocument.model_validate(row.lesson_data),
        chord_scores={k: list(v) for k, v in (row.chord_scores or {}).items()},
        cached_quiz=QuizResponse.model_validate(row.cached_quiz) if row.cached_quiz else None,
        created_at=row.created_at.timestamp() if row.created_at else time.time(),
    )


async def create_session(
    db: AsyncSession, song: SongObject, lesson: LessonDocument, user_id: Any = None
) -> LessonSession:
    now = datetime.now(timezone.utc)
    await db.execute(delete(LessonSessionDB).where(LessonSessionDB.expires_at < now))
    db.add(LessonSessionDB(
        lesson_id=lesson.lesson_id,
        user_id=user_id,
        song_data=song.model_dump(mode="json"),
        lesson_data=lesson.model_dump(mode="json"),
        chord_scores={},
        expires_at=now + timedelta(seconds=SESSION_TTL),
    ))
    await db.commit()
    return LessonSession(lesson_id=lesson.lesson_id, song=song, lesson=lesson)


async def _get_row(db: AsyncSession, lesson_id: str) -> Optional[LessonSessionDB]:
    result = await db.execute(
        select(LessonSessionDB).where(
            LessonSessionDB.lesson_id == lesson_id,
            LessonSessionDB.expires_at >= datetime.now(timezone.utc),
        )
    )
    return result.scalars().first()


async def get_session(db: AsyncSession, lesson_id: str, user_id: Any = None) -> Optional[LessonSession]:
    """Return the live session, or None if missing/expired or owned by someone else."""
    row = await _get_row(db, lesson_id)
    if row is None or (row.user_id is not None and row.user_id != user_id):
        return None
    return _from_row(row)


async def append_score(db: AsyncSession, session: LessonSession, chord_key: str, score: float) -> None:
    """Record one attempt atomically.

    Concurrent tips for the same lesson used to read-modify-write the whole
    JSON blob and lose updates. Lock the row (Postgres; SQLite serialises
    writers anyway), merge into the stored scores, then commit.
    """
    result = await db.execute(
        select(LessonSessionDB)
        .where(LessonSessionDB.lesson_id == session.lesson_id)
        .with_for_update()
    )
    row = result.scalars().first()
    if row is None:
        return
    scores = {k: list(v) for k, v in (row.chord_scores or {}).items()}
    scores.setdefault(chord_key, []).append(score)
    scores[chord_key] = scores[chord_key][-MAX_SCORES_PER_CHORD:]
    row.chord_scores = scores
    await db.commit()
    session.chord_scores = scores


async def save_session(db: AsyncSession, session: LessonSession) -> None:
    row = await _get_row(db, session.lesson_id)
    if row is None:
        return
    row.lesson_data = session.lesson.model_dump(mode="json")
    row.cached_quiz = session.cached_quiz.model_dump(mode="json") if session.cached_quiz else None
    await db.commit()
