"""Single source of truth for chord mastery.

A chord is *mastered* after clean takes on REQUIRED_DAYS different local days
(practice spread over days, not one lucky take). Mastered chords come back for
a spaced re-check; a lapse (a due day with several graded takes and none clean)
drops the chord back to *verifying* until one more clean day.

Definitions shared by progress, planner, teacher views and the LLM profile:
* graded take: a ChordAttempt whose issue is not "imported" or "unclear"
* clean take:  graded, issue IS NULL and score >= 1.0
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ChordAttempt

REQUIRED_DAYS = 3
INTERVALS = [3, 7, 14, 30, 60]       # days until the next re-check, per level
LAPSE_MIN_TAKES = 2                  # graded takes on a due day with none clean = lapse
UNGRADED = ("imported", "unclear")

# stages
NEW, LEARNING, VERIFYING, MASTERED, DUE = "new", "learning", "verifying", "mastered", "due"
MASTERED_STAGES = (MASTERED, DUE)

GRADED = or_(ChordAttempt.issue.is_(None), ChordAttempt.issue.not_in(UNGRADED))


@dataclass
class ChordMastery:
    chord: str
    stage: str = NEW
    clean_days: int = 0
    attempts: int = 0
    best: float = 0.0
    last_practiced: Optional[datetime] = None
    mastered_on: Optional[date] = None
    next_due: Optional[date] = None
    recheck_level: int = 0
    clean_today: bool = False

    @property
    def is_mastered(self) -> bool:
        return self.stage in MASTERED_STAGES


@dataclass
class _Take:
    day: date
    clean: bool
    score: float
    ts: datetime


def local_date(ts: datetime, zone: ZoneInfo) -> date:
    if ts.tzinfo is None:  # SQLite returns naive UTC
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(zone).date()


def is_clean(issue: Optional[str], score: Optional[float]) -> bool:
    return issue is None and (score or 0.0) >= 1.0


def reduce_chord(chord: str, takes: Iterable[_Take], today: date) -> ChordMastery:
    """Pure reduction of one chord's graded takes (any order) to its mastery."""
    takes = sorted(takes, key=lambda t: t.ts)
    m = ChordMastery(chord=chord)
    if not takes:
        return m
    m.attempts = len(takes)
    m.best = max(t.score for t in takes)
    m.last_practiced = takes[-1].ts
    days = sorted({t.day for t in takes if t.clean})
    m.clean_days = len(days)
    m.clean_today = today in days
    if len(days) < REQUIRED_DAYS:
        m.stage = VERIFYING if days else LEARNING
        return m

    # graded-take counts per day, for lapse detection
    per_day: dict[date, list[_Take]] = {}
    for t in takes:
        per_day.setdefault(t.day, []).append(t)

    m.mastered_on = days[REQUIRED_DAYS - 1]
    level, anchor, lapsed = 0, m.mastered_on, False
    for d in sorted(per_day):
        if d <= m.mastered_on:
            continue
        clean_that_day = any(t.clean for t in per_day[d])
        due_on = anchor + timedelta(days=INTERVALS[level])
        if lapsed:
            if clean_that_day:  # one clean day restores mastery, schedule restarts
                lapsed, level, anchor = False, 0, d
            continue
        if d >= due_on:
            if clean_that_day:
                level, anchor = min(level + 1, len(INTERVALS) - 1), d
            elif len(per_day[d]) >= LAPSE_MIN_TAKES:
                lapsed = True
        # early clean days neither help nor hurt
    m.recheck_level = level
    if lapsed:
        m.stage = VERIFYING
        return m
    m.next_due = anchor + timedelta(days=INTERVALS[level])
    m.stage = DUE if today >= m.next_due else MASTERED
    return m


async def mastery_map(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    zone: ZoneInfo | None = None,
    today: date | None = None,
    before: datetime | None = None,
) -> dict[uuid.UUID, dict[str, ChordMastery]]:
    """Mastery for every chord of every user in ONE query (teacher pages too).

    ``before`` restricts history to takes strictly before that instant (used
    by the session recap to compute the "before" state).
    """
    zone = zone or ZoneInfo("UTC")
    today = today or datetime.now(zone).date()
    out: dict[uuid.UUID, dict[str, ChordMastery]] = {u: {} for u in user_ids}
    if not user_ids:
        return out
    q = (
        select(ChordAttempt.user_id, ChordAttempt.chord_name, ChordAttempt.created_at,
               ChordAttempt.issue, ChordAttempt.score)
        .where(ChordAttempt.user_id.in_(user_ids), GRADED)
    )
    if before is not None:
        q = q.where(ChordAttempt.created_at < before)
    rows = (await db.execute(q)).all()
    grouped: dict[tuple, list[_Take]] = {}
    for uid, chord, ts, issue, score in rows:
        if ts is None:
            continue
        grouped.setdefault((uid, chord), []).append(
            _Take(local_date(ts, zone), is_clean(issue, score), float(score or 0.0), ts)
        )
    for (uid, chord), takes in grouped.items():
        out[uid][chord] = reduce_chord(chord, takes, today)
    return out


async def user_mastery(db: AsyncSession, user_id: uuid.UUID, zone: ZoneInfo | None = None,
                       today: date | None = None) -> dict[str, ChordMastery]:
    return (await mastery_map(db, [user_id], zone, today))[user_id]


def status_of(m: ChordMastery | None) -> str:
    """Legacy 3-value status kept for existing clients."""
    if m is None or m.attempts == 0:
        return "not_attempted"
    return "mastered" if m.is_mastered else "in_progress"
