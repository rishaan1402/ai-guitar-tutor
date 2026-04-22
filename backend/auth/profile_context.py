"""Build a user-profile text block for injecting into LLM prompts."""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ChordAttempt, User


async def build_user_context(
    db: AsyncSession, user_id: Optional[uuid.UUID]
) -> str:
    """
    Return a text block summarising the user's profile + history.
    Injected as a system-message prefix in all LLM calls.
    Returns empty string for anonymous (user_id is None).
    """
    if user_id is None:
        return ""

    user = await db.get(User, user_id)
    if user is None:
        return ""

    # Aggregate chord stats for this user
    rows = await db.execute(
        select(
            ChordAttempt.chord_name,
            func.count().label("attempts"),
            func.max(ChordAttempt.score).label("best"),
            func.avg(ChordAttempt.score).label("avg"),
        )
        .where(ChordAttempt.user_id == user_id)
        .group_by(ChordAttempt.chord_name)
    )
    chord_stats = rows.all()

    mastered = [r for r in chord_stats if r.best >= 0.95]
    struggling = [r for r in chord_stats if r.best is not None and r.best < 0.5]
    total_attempts = sum(r.attempts for r in chord_stats)

    if total_attempts > 50:
        pace = "experienced (50+ recorded attempts)"
    elif total_attempts > 20:
        pace = "regular (20-50 recorded attempts)"
    else:
        pace = "early learner (under 20 recorded attempts)"

    mastered_names = ", ".join(r.chord_name.replace("_", " ") for r in mastered[:10]) or "none yet"
    struggling_names = ", ".join(r.chord_name.replace("_", " ") for r in struggling[:5]) or "none"

    context = (
        f"Student profile:\n"
        f"- Name: {user.display_name}\n"
        f"- Skill level: {user.skill_level}\n"
        f"- Learning pace: {pace}\n"
        f"- Chords mastered ({len(mastered)}): {mastered_names}\n"
        f"- Chords still struggling ({len(struggling)}): {struggling_names}\n"
        f"- Total recorded practice attempts: {total_attempts}"
    )

    # Tone instruction — tells the LLM how to calibrate language
    if user.skill_level == "beginner":
        context += (
            "\n\nTone: Use simple, encouraging language. Avoid jargon. "
            "Celebrate small wins. Explain any musical terms you use."
        )
    elif user.skill_level == "intermediate":
        context += (
            "\n\nTone: Be direct and specific. Reference technique names. "
            "Suggest concrete practice patterns and drills."
        )
    else:
        context += (
            "\n\nTone: Be concise and technical. Reference music theory freely. "
            "Suggest advanced exercises and refinements."
        )

    return context
