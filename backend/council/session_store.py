from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

from council.schemas import SongObject, LessonDocument, QuizResponse

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
# In-memory store (mirrors _sessions pattern in main.py)
# ---------------------------------------------------------------------------

_store: dict[str, LessonSession] = {}


def create_session(song: SongObject, lesson: LessonDocument) -> LessonSession:
    # Use the lesson_id already set in the LessonDocument so the frontend
    # can look up the session with the same ID it received.
    session = LessonSession(lesson_id=lesson.lesson_id, song=song, lesson=lesson)
    _store[lesson.lesson_id] = session
    _cleanup()
    return session


def get_session(lesson_id: str) -> Optional[LessonSession]:
    return _store.get(lesson_id)


def _cleanup() -> None:
    now = time.time()
    stale = [k for k, v in _store.items() if now - v.created_at > SESSION_TTL]
    for k in stale:
        del _store[k]
