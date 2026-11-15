"""What we know about a learner's playing, gathered for generating practice and for the coach."""
from __future__ import annotations

import statistics
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ChordAttempt, GrooveRun, User, UserGoal
from personalization.mastery import LEARNING, MASTERED_STAGES, VERIFYING, user_mastery
from personalization.planner import _key_to_symbol
from practice import theory

STARTER = ["Em", "Am"]


@dataclass
class PairStat:
    a: str
    b: str
    runs: int = 0
    on_time: int = 0
    late: int = 0
    missed: int = 0
    avg_late: float = 0.0

    @property
    def rate(self) -> float:
        return self.on_time / self.runs if self.runs else 0.0


@dataclass
class Profile:
    skill: str = "beginner"
    mastered: list[str] = field(default_factory=list)
    learning: list[str] = field(default_factory=list)
    pairs: list[PairStat] = field(default_factory=list)
    comfort_bpm: int = 66
    last_stars: dict[str, int] = field(default_factory=dict)
    # chord -> counts of recent issues ("muted_string": 3, ...)
    issues: dict[str, dict[str, int]] = field(default_factory=dict)
    goal: Optional[dict] = None
    groove_runs_7d: int = 0

    @property
    def known(self) -> list[str]:
        k = list(dict.fromkeys(self.mastered + self.learning))
        return k or list(STARTER)

    def weakest_pair(self) -> Optional[tuple[str, str]]:
        cands = [p for p in self.pairs if p.runs >= 2 and p.a in self.known and p.b in self.known]
        if not cands:
            return None
        p = min(cands, key=lambda s: (s.rate, -s.avg_late))
        return (p.a, p.b) if p.rate < 0.9 else None

    def summary(self) -> str:
        """Plain-text profile for the AI (no names or emails)."""
        lines = [f"Skill level: {self.skill}",
                 f"Mastered chords: {', '.join(self.mastered) or 'none yet'}",
                 f"Learning: {', '.join(self.learning) or 'none'}",
                 f"Comfortable tempo: {self.comfort_bpm} bpm"]
        if self.pairs:
            ps = sorted(self.pairs, key=lambda s: s.rate)[:5]
            lines.append("Chord changes (on-time rate in play-along): " + "; ".join(
                f"{p.a}->{p.b} {round(p.rate * 100)}% of {p.runs}, avg {p.avg_late:.1f}s late" for p in ps))
        if self.issues:
            lines.append("Recent problems per chord: " + "; ".join(
                f"{c}: " + ", ".join(f"{k} x{v}" for k, v in sorted(d.items(), key=lambda kv: -kv[1])[:3])
                for c, d in list(self.issues.items())[:6]))
        if self.goal:
            lines.append(f"Goal: {self.goal['title']} by {self.goal['target_date']} (chords: {', '.join(self.goal['chords'])})")
        return "\n".join(lines)


async def build_profile(db: AsyncSession, user: Optional[User]) -> Profile:
    if user is None:
        return Profile()
    uid: uuid.UUID = user.id
    prof = Profile(skill=user.skill_level or "beginner")
    mastery = await user_mastery(db, uid)
    for key, m in mastery.items():
        sym = theory.normalise(_key_to_symbol(key))
        if not sym:
            continue
        if m.stage in MASTERED_STAGES:
            prof.mastered.append(sym)
        elif m.stage in (LEARNING, VERIFYING) or m.best >= 0.75:
            prof.learning.append(sym)

    since = datetime.now(timezone.utc) - timedelta(days=30)
    runs = (await db.execute(
        select(GrooveRun).where(GrooveRun.user_id == uid, GrooveRun.created_at >= since).order_by(GrooveRun.created_at)
    )).scalars().all()
    agg: dict[tuple[str, str], dict] = defaultdict(lambda: {"runs": 0, "on_time": 0, "late": 0, "missed": 0, "lates": []})
    good_bpms: list[int] = []
    week = datetime.now(timezone.utc) - timedelta(days=7)
    for r in runs:
        created = r.created_at if r.created_at.tzinfo else r.created_at.replace(tzinfo=timezone.utc)
        if created >= week:
            prof.groove_runs_7d += 1
        if r.stars >= 2 and r.mode in ("play", "wait"):
            good_bpms.append(r.bpm)
        key = "|".join((r.groove or {}).get("focus") or [])
        if key:
            prof.last_stars[key] = r.stars
        for c in r.changes or []:
            a, b = theory.normalise(str(c.get("from", ""))), theory.normalise(str(c.get("to", "")))
            if not a or not b:
                continue
            s = agg[(a, b)]
            s["runs"] += 1
            st = c.get("status")
            if st == "on_time":
                s["on_time"] += 1
            elif st == "missed":
                s["missed"] += 1
            else:
                s["late"] += 1
                s["lates"].append(max(0.0, float(c.get("offset") or 0)))
    for (a, b), s in agg.items():
        prof.pairs.append(PairStat(a, b, s["runs"], s["on_time"], s["late"], s["missed"],
                                   statistics.mean(s["lates"]) if s["lates"] else 0.0))
    if good_bpms:
        prof.comfort_bpm = int(statistics.median(good_bpms[-10:]))
    elif prof.skill != "beginner":
        prof.comfort_bpm = 76

    attempts = (await db.execute(
        select(ChordAttempt.chord_name, ChordAttempt.issue).where(
            ChordAttempt.user_id == uid, ChordAttempt.created_at >= since, ChordAttempt.issue.isnot(None))
        .order_by(ChordAttempt.created_at.desc()).limit(200)
    )).all()
    for chord, issue in attempts:
        if issue in ("imported",):
            continue
        sym = theory.normalise(_key_to_symbol(chord)) or chord
        prof.issues.setdefault(sym, {}).setdefault(issue, 0)
        prof.issues[sym][issue] += 1

    goal = (await db.execute(
        select(UserGoal).where(UserGoal.user_id == uid, UserGoal.active.is_(True)).order_by(UserGoal.created_at.desc())
    )).scalars().first()
    if goal and goal.target_date >= date.today() - timedelta(days=7):
        prof.goal = {"title": goal.title, "chords": goal.chords or [], "target_date": goal.target_date.isoformat()}
    return prof
