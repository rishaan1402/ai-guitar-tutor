"""AI-generated student progress reports for teachers."""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.profile_context import build_user_context
from db.models import ChordAttempt
from feedback_engine.generator import GROQ_MODEL, _get_groq_client

logger = logging.getLogger(__name__)

_REPORT_SYSTEM = (
    "You are an assistant for a guitar teacher. "
    "Write a concise 150-200 word progress report about the student described below. "
    "Cover: strengths, areas needing work, recommended next focus areas, and overall trajectory. "
    "Be honest but encouraging. Do not use markdown headers — write in plain paragraphs."
)


async def generate_student_report(db: AsyncSession, student_id: uuid.UUID) -> str:
    """Generate an AI progress report about a student for their teacher."""
    user_context = await build_user_context(db, student_id)
    if not user_context:
        return "No profile data available for this student."

    # Fetch last 20 chord attempts
    rows = await db.execute(
        select(ChordAttempt)
        .where(ChordAttempt.user_id == student_id)
        .order_by(ChordAttempt.created_at.desc())
        .limit(20)
    )
    recent = rows.scalars().all()

    if not recent:
        return f"{user_context}\n\nThis student has not recorded any practice attempts yet."

    attempts_text = "\n".join(
        f"  {a.chord_name.replace('_', ' ')}: {round(a.score * 100)}%"
        + (f" [{a.issue}]" if a.issue else "")
        for a in recent
    )

    prompt = (
        f"{user_context}\n\n"
        f"Recent practice (newest first):\n{attempts_text}\n\n"
        f"Write the student progress report now."
    )

    client = _get_groq_client()
    if client is None:
        return (
            f"Student: {user_context.split(chr(10))[1].replace('- Name: ', '')}\n"
            "AI report unavailable — no Groq API key configured."
        )

    try:
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _REPORT_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
            max_tokens=400,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.warning("Student report generation failed: %s", exc)
        return "Report generation failed. Please try again later."
