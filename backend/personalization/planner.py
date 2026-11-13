"""
Daily & weekly practice plan generator.

Reads the user's chord_attempts and transition_drills history, their skill_level,
and produces a structured, personalised practice session.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ChordAttempt, TeacherAssignment, TeacherStudent, TransitionDrill, User
from personalization.changes import ranked_pairs
from personalization.mastery import DUE, MASTERED, REQUIRED_DAYS, VERIFYING, user_mastery

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Chord difficulty catalogue (built from metadata.json files at import time)
# ---------------------------------------------------------------------------

_LESSONS_DIR = Path(__file__).resolve().parents[2] / "data" / "lessons"
_chord_difficulties: dict[str, str] = {}  # chord_key → "beginner"|"intermediate"|"advanced"

if _LESSONS_DIR.exists():
    for _lesson_dir in _LESSONS_DIR.iterdir():
        _meta = _lesson_dir / "metadata.json"
        if _meta.exists():
            try:
                _data = json.loads(_meta.read_text())
                _chord_difficulties[_lesson_dir.name] = _data.get("difficulty", "beginner")
            except Exception:
                pass

# The order a new guitarist usually learns open chords in. Anything not listed
# follows, easiest difficulty first, then alphabetically (deterministic).
BEGINNER_PATH = [
    "E_minor", "A_minor", "E_major", "A_major", "D_major", "G_major", "C_major",
    "D_minor", "E_dominant7", "A_dominant7", "D_dominant7", "G_dominant7",
    "C_major7", "A_minor7", "E_minor7", "B_dominant7",
]

# Difficulty ordering
_DIFF_ORDER = {"beginner": 0, "intermediate": 1, "advanced": 2}

# Skill level → allowed difficulty levels for "new challenge"
_CHALLENGE_LEVELS: dict[str, list[str]] = {
    "beginner":     ["beginner"],
    "intermediate": ["beginner", "intermediate"],
    "advanced":     ["intermediate", "advanced"],
}

# Max items per skill level
_MAX_ITEMS = {"beginner": 5, "intermediate": 7, "advanced": 7}


# ---------------------------------------------------------------------------
# Plan item types
# ---------------------------------------------------------------------------

ITEM_TYPES = {
    "warmup":     "Warm-up (mastered chord — keep it fluent)",
    "focus":      "Focus chord (needs the most work)",
    "new":        "New challenge (just above your current level)",
    "transition": "One-minute changes (the pair furthest from its next target)",
    "assignment": "Assigned by your teacher",
    "review":     "Re-check: keep it solid",
}


def _make_item(item_type: str, chord_key: str, chord_symbol: str, **extras: Any) -> dict:
    return {
        "type": item_type,
        "chord_key": chord_key,
        "chord_symbol": chord_symbol,
        "description": ITEM_TYPES.get(item_type, ""),
        **extras,
    }


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------

async def build_daily_plan(db: AsyncSession, user: User, tz: str | None = None) -> list[dict]:
    """
    Build today's practice plan for `user`.

    Structure (varies by skill_level):
    - 1–3 warmup chords (best-mastered, not practiced today)
    - 1 focus chord (lowest best_score, not mastered)
    - 1 new chord (matching challenge level, never practiced)
    - 1 transition drill (pair with highest miss rate)
    """
    skill = user.skill_level  # "beginner" | "intermediate" | "advanced"
    max_items = _MAX_ITEMS.get(skill, 5)
    plan: list[dict] = []

    # ── Mastery per chord (clean takes on 3 separate days + spaced re-checks) ──
    zone = _zone_of(tz)
    mastery = await user_mastery(db, user.id, zone)
    # chords with any attempt (imports included) count as "practised" for the new list
    practiced_rows = await db.execute(
        select(ChordAttempt.chord_name).where(ChordAttempt.user_id == user.id).distinct()
    )
    practiced_keys = {r[0] for r in practiced_rows.all()}

    # ── Teacher assignments come first ────────────────────────────────────────
    assigned_rows = await db.execute(
        select(TeacherAssignment.chord_name, TeacherAssignment.note)
        # only teachers the student is still linked to (leaving a class drops its work)
        .join(TeacherStudent, (TeacherStudent.teacher_id == TeacherAssignment.teacher_id)
              & (TeacherStudent.student_id == TeacherAssignment.student_id))
        .join(User, User.id == TeacherAssignment.teacher_id)
        .where(TeacherAssignment.student_id == user.id, TeacherAssignment.chord_name.is_not(None),
               User.role.in_(("teacher", "admin")))
        .order_by(TeacherAssignment.created_at.desc())
    )
    for chord_key, note in assigned_rows.all():
        m = mastery.get(chord_key)
        if m is not None and m.is_mastered:
            continue
        if any(i.get("chord_key") == chord_key for i in plan) or len(plan) >= max_items:
            continue
        plan.append(_make_item("assignment", chord_key, _key_to_symbol(chord_key), note=note))
    planned = {i.get("chord_key") for i in plan}

    # ── Warm-ups: re-checks that are due (most overdue first), then mastered ──
    num_warmups = 1 if skill == "beginner" else (2 if skill == "intermediate" else 3)
    due = sorted((m for m in mastery.values() if m.stage == DUE and m.chord not in planned),
                 key=lambda m: m.next_due)
    solid = sorted((m for m in mastery.values() if m.stage == MASTERED and m.chord not in planned),
                   key=lambda m: m.last_practiced or datetime.min.replace(tzinfo=timezone.utc))
    for m in (due + solid)[:num_warmups]:
        if len(plan) >= max_items:
            break
        if m.stage == DUE:
            plan.append(_make_item("review", m.chord, _key_to_symbol(m.chord),
                                   best_score=round(m.best, 2), next_due=m.next_due.isoformat()))
        else:
            plan.append(_make_item("warmup", m.chord, _key_to_symbol(m.chord),
                                   best_score=round(m.best, 2)))
    planned = {i.get("chord_key") for i in plan}

    # ── Focus: a chord one more clean day from mastery, else the weakest ─────
    allowed = _CHALLENGE_LEVELS.get(skill, ["beginner"])
    candidates = [m for m in mastery.values()
                  if not m.is_mastered and m.chord not in planned
                  and _chord_difficulties.get(m.chord, "beginner") in allowed]
    verifying = sorted((m for m in candidates if m.stage == VERIFYING and not m.clean_today),
                       key=lambda m: -m.clean_days)
    learning = sorted((m for m in candidates if m.stage != VERIFYING), key=lambda m: m.best)
    focus = (verifying + learning)[:1]
    if focus and len(plan) < max_items:
        m = focus[0]
        extras = {"best_score": round(m.best, 2), "attempts": m.attempts}
        if m.stage == VERIFYING:
            extras.update(clean_days=m.clean_days, needs="one more clean day"
                          if m.clean_days == REQUIRED_DAYS - 1 else "another clean day")
        plan.append(_make_item("focus", m.chord, _key_to_symbol(m.chord), **extras))

    # ── New chords (never practised), following the learning path ────────────
    challenge_levels = _CHALLENGE_LEVELS.get(skill, ["beginner"])
    new_chords = [
        k for k in _learning_order()
        if k not in practiced_keys and k not in planned
        and _chord_difficulties.get(k) in challenge_levels
    ]
    # Leave one slot for a transition drill; fill the rest with new chords.
    room = max(1, max_items - len(plan) - 1)
    for key in new_chords[:room]:
        plan.append(_make_item(
            "new", key, _key_to_symbol(key),
            difficulty=_chord_difficulties.get(key, "beginner"),
        ))

    # ── Transition drill: the pair most below its next clean-changes target ──
    if len(plan) < max_items:
        pairs = await ranked_pairs(db, user.id, zone, mastery, _learning_order())
        if pairs:
            p = pairs[0]
            a, b = p.pair
            plan.append({
                "type": "transition",
                "chord_a": a,
                "chord_b": b,
                "chord_a_symbol": _key_to_symbol(a),
                "chord_b_symbol": _key_to_symbol(b),
                "description": ITEM_TYPES["transition"],
                "target": p.target,
                "last": p.last,
                "best": p.best,
                "reason": (f"{_key_to_symbol(a)} → {_key_to_symbol(b)}: {p.last} clean changes "
                           f"last time, aiming for {p.target}") if p.last is not None
                          else f"New pair: aim for {p.target} clean changes in a minute",
            })

    return plan[:max_items]


def _zone_of(tz: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz) if tz else ZoneInfo("UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _learning_order() -> list[str]:
    path = [k for k in BEGINNER_PATH if k in _chord_difficulties]
    rest = sorted(
        (k for k in _chord_difficulties if k not in path),
        key=lambda k: (_DIFF_ORDER.get(_chord_difficulties[k], 0), k),
    )
    return path + rest


# Longest suffix first, so "_major7" isn't eaten by "_major".
_SUFFIX_SYMBOLS = [
    ("_half_dim7", "m7b5"), ("_dominant7", "7"), ("_suspended2", "sus2"),
    ("_suspended4", "sus4"), ("_diminished", "dim"), ("_augmented", "aug"),
    ("_major7", "maj7"), ("_minor7", "m7"), ("_minor9", "m9"), ("_power", "5"),
    ("_major", ""), ("_minor", "m"), ("_add9", "add9"),
]


def _key_to_symbol(chord_key: str) -> str:
    """Convert a chord key to its symbol, e.g. 'A_minor7' → 'Am7', 'A_major7' → 'Amaj7'."""
    for suffix, symbol in _SUFFIX_SYMBOLS:
        if chord_key.endswith(suffix):
            return chord_key[: -len(suffix)] + symbol
    return chord_key.replace("_", "")


async def build_weekly_plan(db: AsyncSession, user: User) -> list[dict]:
    """
    7-day plan: each day gets a focus chord, warmup set, and one transition.
    Returns list of {day: 0-6, date: ISO, items: [...]} dicts.
    """
    base = await build_daily_plan(db, user)
    today = date.today()
    week = []
    for i in range(7):
        day_date = today + timedelta(days=i)
        week.append({
            "day": i,
            "date": day_date.isoformat(),
            "label": day_date.strftime("%A"),
            "items": base,  # simplified: same plan each day for now
        })
    return week
