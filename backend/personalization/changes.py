"""One-minute changes v2: pick the chord pair a learner most needs to drill.

Metric is ``got_count`` (clean changes in 60 s); ``tpm`` counts attempts, not
skill. Pairs are unordered (Em->Am and Am->Em are the same skill).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import TransitionDrill
from personalization.mastery import LEARNING, NEW, ChordMastery, local_date

RUNGS = [20, 30, 40, 60]        # clean changes per minute targets (Justin's 30 is rung 2)
EWMA_ALPHA = 0.5


@dataclass
class PairScore:
    pair: tuple[str, str]
    recent: float = 0.0
    best: int = 0
    last: Optional[int] = None
    drills: int = 0
    target: int = RUNGS[0]
    need: float = 0.0
    drilled_today: bool = False
    path_index: int = 10_000
    gots: list[int] = field(default_factory=list)


def _target(gots: list[int]) -> int:
    for rung in RUNGS:
        if sum(1 for g in gots if g >= rung) < 2:
            return rung
    return RUNGS[-1]


def score_pairs(
    drills: list[tuple[str, str, int, datetime]],
    path: list[str],
    mastery: dict[str, ChordMastery],
    today: date,
    zone: ZoneInfo,
) -> list[PairScore]:
    """Rank candidate pairs, most needed first (pure; unit-testable)."""
    by_pair: dict[tuple[str, str], PairScore] = {}
    for a, b, got, ts in sorted(drills, key=lambda d: d[3]):
        key = tuple(sorted((a, b)))
        ps = by_pair.setdefault(key, PairScore(key))
        ps.gots.append(int(got or 0))
        ps.recent = got if ps.drills == 0 else EWMA_ALPHA * got + (1 - EWMA_ALPHA) * ps.recent
        ps.best = max(ps.best, int(got or 0))
        ps.last = int(got or 0)
        ps.drills += 1
        if local_date(ts, zone) == today:
            ps.drilled_today = True

    # undrilled neighbours on the learning path once both chords are under way
    ready = lambda k: k in mastery and mastery[k].stage not in (NEW, LEARNING)  # noqa: E731
    for i in range(len(path) - 1):
        a, b = path[i], path[i + 1]
        key = tuple(sorted((a, b)))
        if key not in by_pair and ready(a) and ready(b):
            by_pair[key] = PairScore(key)

    pos = {k: i for i, k in enumerate(path)}
    for ps in by_pair.values():
        ps.target = _target(ps.gots)
        ps.need = ps.target - ps.recent
        if ps.drilled_today:
            ps.need -= 15
        ps.path_index = min(pos.get(ps.pair[0], 10_000), pos.get(ps.pair[1], 10_000))
    return sorted(by_pair.values(), key=lambda p: (-p.need, p.path_index))


async def ranked_pairs(db: AsyncSession, user_id: uuid.UUID, zone: ZoneInfo,
                       mastery: dict[str, ChordMastery], path: list[str]) -> list[PairScore]:
    rows = (await db.execute(
        select(TransitionDrill.chord_a, TransitionDrill.chord_b, TransitionDrill.got_count,
               TransitionDrill.created_at)
        .where(TransitionDrill.user_id == user_id)
        .order_by(TransitionDrill.created_at.desc())
        .limit(500)
    )).all()
    drills = [(a, b, g, ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc))
              for a, b, g, ts in rows if ts is not None]
    return score_pairs(drills, path, mastery, datetime.now(zone).date(), zone)
