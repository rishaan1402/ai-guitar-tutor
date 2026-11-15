"""XP, levels, the daily goal and room upgrades, computed from what the learner actually did."""
from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ChordAttempt, GrooveRun, PathProgress, TransitionDrill, User

LEVELS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500]
TITLES = ["Bedroom player", "Bedroom player", "Porch picker", "Garage band", "Open-mic regular", "Busker",
          "Pub gig", "Club headliner", "Session player", "Stage ready", "Studio legend"]
# Room upgrades unlocked by level (cosmetic only: nothing in the app is locked)
UPGRADES = [(2, "lights", "String lights"), (3, "poster", "Gig poster"), (4, "plant", "Studio plant"),
            (5, "rug", "Gold-trim rug"), (6, "guitar2", "A second guitar"), (8, "neon", "Neon sign glow-up")]

XP_CLEAN_TAKE, XP_TAKE, XP_GROOVE_STAR, XP_PATH_STAR, XP_DRILL = 10, 2, 10, 20, 5


def level_for(xp: int) -> int:
    lvl = 1
    for i, need in enumerate(LEVELS):
        if xp >= need:
            lvl = i + 1 if i > 0 else 1
    return min(lvl, len(LEVELS))


async def game_state(db: AsyncSession, user: User, tz: Optional[str] = None) -> dict[str, Any]:
    uid = user.id
    try:
        zone = ZoneInfo(tz) if tz else timezone.utc
    except Exception:
        zone = timezone.utc
    takes = (await db.execute(select(ChordAttempt.issue, ChordAttempt.score, ChordAttempt.created_at)
                              .where(ChordAttempt.user_id == uid))).all()
    graded = [t for t in takes if t.issue not in ("imported", "unclear")]
    clean = sum(1 for t in graded if t.issue is None and (t.score or 0) >= 1.0)
    groove = (await db.execute(select(func.coalesce(func.sum(GrooveRun.stars), 0)).where(GrooveRun.user_id == uid))).scalar() or 0
    path = (await db.execute(select(func.coalesce(func.sum(PathProgress.stars), 0)).where(PathProgress.user_id == uid))).scalar() or 0
    drills = (await db.execute(select(func.count()).select_from(TransitionDrill).where(TransitionDrill.user_id == uid))).scalar() or 0
    xp = clean * XP_CLEAN_TAKE + (len(graded) - clean) * XP_TAKE + int(groove) * XP_GROOVE_STAR + int(path) * XP_PATH_STAR + int(drills) * XP_DRILL
    lvl = level_for(xp)
    cur = LEVELS[lvl - 1]
    nxt = LEVELS[lvl] if lvl < len(LEVELS) else None

    # today's goal: three small things
    today = datetime.now(zone).date()
    start = datetime.combine(today, time.min, tzinfo=zone).astimezone(timezone.utc)

    def _today(ts: datetime) -> bool:
        ts = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        return ts >= start

    played_chord = any(_today(t.created_at) for t in graded)
    groove_today = (await db.execute(select(func.count()).select_from(GrooveRun)
                                     .where(GrooveRun.user_id == uid, GrooveRun.created_at >= start))).scalar() or 0
    lesson_today = (await db.execute(select(func.count()).select_from(PathProgress)
                                     .where(PathProgress.user_id == uid, PathProgress.completed_at >= start))).scalar() or 0
    drill_today = (await db.execute(select(func.count()).select_from(TransitionDrill)
                                    .where(TransitionDrill.user_id == uid, TransitionDrill.created_at >= start))).scalar() or 0
    tasks = [
        {"id": "chord", "label": "Play a clean chord", "done": played_chord},
        {"id": "groove", "label": "Play a Groove", "done": groove_today > 0},
        {"id": "lesson", "label": "Do a lesson or a chord-change drill", "done": (lesson_today + drill_today) > 0},
    ]
    return {
        "xp": xp, "level": lvl, "title": TITLES[min(lvl, len(TITLES) - 1)],
        "level_xp": cur, "next_level_xp": nxt,
        "daily": {"date": today.isoformat(), "tasks": tasks, "done": sum(t["done"] for t in tasks), "total": len(tasks)},
        "upgrades": [{"id": i, "label": label, "level": need, "unlocked": lvl >= need} for need, i, label in UPGRADES],
    }
