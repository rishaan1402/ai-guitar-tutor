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

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ChordAttempt, TeacherAssignment, TransitionDrill, User
from personalization.thresholds import MASTERY

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
    "transition": "Transition drill (chord pair with highest miss rate)",
    "assignment": "Assigned by your teacher",
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

async def build_daily_plan(db: AsyncSession, user: User) -> list[dict]:
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

    # ── All chord stats ───────────────────────────────────────────────────────
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
    chord_stats: dict[str, dict] = {}
    for row in rows.all():
        chord_stats[row.chord_name] = {
            "attempts": row.attempts,
            "best": float(row.best or 0),
            "last_practiced": row.last_practiced,
        }

    # ── Teacher assignments come first ────────────────────────────────────────
    assigned_rows = await db.execute(
        select(TeacherAssignment.chord_name, TeacherAssignment.note)
        .where(TeacherAssignment.student_id == user.id, TeacherAssignment.chord_name.is_not(None))
        .order_by(TeacherAssignment.created_at.desc())
    )
    for chord_key, note in assigned_rows.all():
        if chord_stats.get(chord_key, {}).get("best", 0.0) >= MASTERY:
            continue
        if any(i.get("chord_key") == chord_key for i in plan) or len(plan) >= max_items:
            continue
        plan.append(_make_item("assignment", chord_key, _key_to_symbol(chord_key), note=note))
    planned = {i.get("chord_key") for i in plan}

    # ── Warmup chords (mastered, least recently practised first) ─────────────
    mastered = [
        (k, v) for k, v in chord_stats.items()
        if v["best"] >= MASTERY and k not in planned
    ]
    mastered.sort(key=lambda x: x[1]["last_practiced"] or datetime.min)
    num_warmups = 1 if skill == "beginner" else (2 if skill == "intermediate" else 3)
    for chord_key, stat in mastered[:num_warmups]:
        if len(plan) >= max_items:
            break
        plan.append(_make_item(
            "warmup", chord_key, _key_to_symbol(chord_key),
            best_score=round(stat["best"], 2),
        ))

    # ── Focus chord (lowest best_score among in-progress, matching skill) ─────
    in_progress = [
        (k, v) for k, v in chord_stats.items()
        if v["best"] < MASTERY and k not in planned
        and _chord_difficulties.get(k, "beginner") in _CHALLENGE_LEVELS.get(skill, ["beginner"])
    ]
    in_progress.sort(key=lambda x: x[1]["best"])
    if in_progress and len(plan) < max_items:
        chord_key, stat = in_progress[0]
        plan.append(_make_item(
            "focus", chord_key, _key_to_symbol(chord_key),
            best_score=round(stat["best"], 2),
            attempts=stat["attempts"],
        ))

    # ── New chords (never practised), following the learning path ────────────
    practiced_keys = set(chord_stats.keys())
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

    # ── Transition drill (pair with highest miss rate) ────────────────────────
    if len(plan) < max_items:
        trans_rows = await db.execute(
            select(
                TransitionDrill.chord_a,
                TransitionDrill.chord_b,
                TransitionDrill.chord_a_symbol,
                TransitionDrill.chord_b_symbol,
                func.sum(TransitionDrill.miss_count).label("total_misses"),
                func.sum(TransitionDrill.got_count).label("total_got"),
            )
            .where(TransitionDrill.user_id == user.id)
            .group_by(
                TransitionDrill.chord_a, TransitionDrill.chord_b,
                TransitionDrill.chord_a_symbol, TransitionDrill.chord_b_symbol,
            )
            .order_by(func.sum(TransitionDrill.miss_count).desc())
            .limit(1)
        )
        trans = trans_rows.first()
        if trans and trans.total_misses and trans.total_misses > 0:
            total = (trans.total_misses or 0) + (trans.total_got or 0)
            miss_rate = round(trans.total_misses / total, 2) if total else 0
            plan.append({
                "type": "transition",
                "chord_a": trans.chord_a,
                "chord_b": trans.chord_b,
                "chord_a_symbol": trans.chord_a_symbol,
                "chord_b_symbol": trans.chord_b_symbol,
                "description": ITEM_TYPES["transition"],
                "miss_rate": miss_rate,
            })

    return plan[:max_items]


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
