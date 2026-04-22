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

from db.models import ChordAttempt, TransitionDrill, User

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

    # ── Warmup chords (mastered = best ≥ 0.90, sorted by last practiced) ─────
    mastered = [
        (k, v) for k, v in chord_stats.items()
        if v["best"] >= 0.90
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
        if 0.10 < v["best"] < 0.90
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

    # ── New chord (never practiced, matching challenge level) ─────────────────
    practiced_keys = set(chord_stats.keys())
    challenge_levels = _CHALLENGE_LEVELS.get(skill, ["beginner"])
    new_chords = [
        k for k, diff in _chord_difficulties.items()
        if k not in practiced_keys and diff in challenge_levels
    ]
    if new_chords and len(plan) < max_items:
        # Pick the easiest new chord available
        new_chords.sort(key=lambda k: _DIFF_ORDER.get(_chord_difficulties.get(k, "beginner"), 0))
        plan.append(_make_item(
            "new", new_chords[0], _key_to_symbol(new_chords[0]),
            difficulty=_chord_difficulties.get(new_chords[0], "beginner"),
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


def _key_to_symbol(chord_key: str) -> str:
    """Convert snake_case chord key to display symbol. e.g. 'A_minor7' → 'Am7'."""
    replacements = {
        "_major":      "",
        "_minor":      "m",
        "_dominant7":  "7",
        "_minor7":     "m7",
        "_major7":     "maj7",
        "_power":      "5",
        "_suspended2": "sus2",
        "_suspended4": "sus4",
        "_augmented":  "aug",
        "_diminished": "dim",
        "_minor9":     "m9",
        "_add9":       "add9",
    }
    symbol = chord_key
    for k, v in replacements.items():
        symbol = symbol.replace(k, v)
    return symbol.replace("_", "")


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
