from __future__ import annotations

import logging

from council.schemas import LessonDocument, TipRequest
from council.session_store import LessonSession
from feedback_engine.generator import _get_gemini_model

logger = logging.getLogger(__name__)

_TIP_SYSTEM = """You are a guitar lesson advisor.
A student is learning a song using a structured lesson plan.
After each chord attempt, give a short, specific, encouraging tip.

Write exactly 1-2 sentences. Be concrete — reference the specific chord, the song,
and the score. If improving across attempts, acknowledge it.
Do not use markdown or bullet points."""

_REVISE_SYSTEM = """You are the Song Learning Council advisor.
A student has now practiced all the chords in their song lesson.
Write a revised practice plan (200-250 words) that:
1. Names which chords are solid (best score ≥ 70%) and which need more work
2. Reorders practice priority based on actual performance — weakest chords first
3. Suggests one specific drill for the weakest chord
4. Gives a realistic updated timeline

Be honest but encouraging. Name the actual chord symbols."""


async def get_tip(request: TipRequest, session: LessonSession) -> str:
    """
    Generate a 1-2 sentence adaptive tip after a single chord attempt.
    Falls back to a plain string if Gemini is unavailable.
    """
    model = _get_gemini_model()
    if model is None:
        score_pct = round(request.score * 100)
        if score_pct >= 80:
            return f"Nice work on {request.chord_symbol}! Keep that up."
        if request.missing_notes:
            return f"Almost there on {request.chord_symbol} — {', '.join(request.missing_notes)} still needs work."
        return f"Keep practising {request.chord_symbol} — you're at {score_pct}%."

    score_pct = round(request.score * 100)
    score_history = session.chord_scores.get(request.chord_key, [])
    history_str = ", ".join(f"{round(s*100)}%" for s in score_history)

    prompt = f"""{_TIP_SYSTEM}

Song: {session.song.song_title} by {session.song.artist}
Chord being practised: {request.chord_symbol}
Score this attempt: {score_pct}%
Missing notes: {', '.join(request.missing_notes) or 'none'}
Extra notes detected: {', '.join(request.extra_notes) or 'none'}
Attempt number: {request.attempt}
Score history for this chord: [{history_str}]
All chord progress so far:
{session.score_summary()}"""

    try:
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as exc:
        logger.warning("Advisor tip failed: %s", exc)
        return f"Score: {score_pct}% on {request.chord_symbol}. Keep practising!"


async def revise_lesson(session: LessonSession) -> LessonDocument:
    """
    After all chords attempted at least once, generate a revised practice plan.
    Returns an updated LessonDocument with the new practice_plan field.
    """
    model = _get_gemini_model()

    prompt = f"""{_REVISE_SYSTEM}

Song: {session.song.song_title} by {session.song.artist}
Difficulty: {session.song.overall_difficulty}

Chord results:
{session.score_summary()}

Original practice plan:
{session.lesson.practice_plan}"""

    revised_plan = session.lesson.practice_plan  # fallback

    if model is not None:
        try:
            response = await model.generate_content_async(prompt)
            revised_plan = response.text.strip()
        except Exception as exc:
            logger.warning("Lesson revision failed: %s", exc)

    # Return a copy of the lesson with updated practice plan
    updated = session.lesson.model_copy(update={"practice_plan": revised_plan})
    session.lesson = updated
    return updated
