from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from council.schemas import (
    GenerateRequest, TipRequest, ReviseRequest, QuizRequest,
    QuizResponse, LessonDocument, FingeringPosition,
)
from council.ingestion import ingest_song
from council.agents import run_council
from council.chairman import synthesize
from council import session_store
from council.advisor import get_tip, revise_lesson
from council.quiz import generate_quiz
from auth.dependencies import get_current_user_optional
from auth.rate_limit import RateLimiter, client_ip
from auth.profile_context import build_user_context
from db.engine import get_db
from feedback_engine.generator import FeedbackGenerator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/council", tags=["council"])

# ---------------------------------------------------------------------------
# Load fingerings once at module start
# ---------------------------------------------------------------------------
_FINGERINGS_PATH = Path(__file__).resolve().parents[2] / "data" / "chords" / "fingerings.json"
_fingerings_by_chord: dict[str, dict[str, Any]] = {}

if _FINGERINGS_PATH.exists():
    with open(_FINGERINGS_PATH) as _f:
        for _entry in json.load(_f):
            _fingerings_by_chord[_entry["chord"]] = _entry
    logger.info("Council: loaded fingerings for %d chords", len(_fingerings_by_chord))


def _embed_fingerings_and_functions(lesson: LessonDocument, song_chords: list) -> LessonDocument:
    """
    Enrich each PracticeChord with:
    - positions: full fingering data from fingerings.json
    - chord_function: theory role from SongObject.chords
    """
    # Build symbol → function lookup from song's chord list
    func_map: dict[str, str] = {c.symbol: c.function for c in song_chords}

    enriched = []
    for pc in lesson.practice_chords:
        positions: list[FingeringPosition] = []
        if pc.chord_key and pc.chord_key in _fingerings_by_chord:
            for raw in _fingerings_by_chord[pc.chord_key].get("positions", []):
                positions.append(FingeringPosition(
                    string=raw.get("string", 0),
                    fret=raw.get("fret", 0),
                    note=raw.get("note", ""),
                    finger=raw.get("finger"),
                    action=raw.get("action"),
                ))

        enriched.append(pc.model_copy(update={
            "positions": positions,
            "chord_function": func_map.get(pc.symbol, ""),
        }))

    return lesson.model_copy(update={"practice_chords": enriched})


# Each generation fans out to several LLM calls, so it is the costliest endpoint.
_anon_generate_limiter = RateLimiter(max_hits=5, window_seconds=60 * 60)
_user_generate_limiter = RateLimiter(max_hits=30, window_seconds=60 * 60)
# Follow-up LLM calls (tips, revisions, quizzes) per user / per anonymous IP.
_anon_llm_limiter = RateLimiter(max_hits=60, window_seconds=60 * 60)
_user_llm_limiter = RateLimiter(max_hits=300, window_seconds=60 * 60)


def _limit_llm(request: Request, user) -> None:
    limiter, key = (
        (_user_llm_limiter, f"user:{user.id}") if user is not None
        else (_anon_llm_limiter, f"ip:{client_ip(request)}")
    )
    limiter.check(key)
    limiter.hit(key)


_UNAVAILABLE = "Song lessons are temporarily unavailable. Please try again later."


@router.post("/generate", response_model=LessonDocument)
async def generate_lesson(
    body: GenerateRequest,
    request: Request,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> LessonDocument:
    """
    Full pipeline: ingest → council (4 parallel agents) → chairman synthesis.
    Returns a LessonDocument with lesson_id for subsequent practice calls.
    Fingering positions and chord functions are embedded per practice chord.
    """
    if not body.song_query.strip():
        raise HTTPException(status_code=400, detail="song_query must not be empty.")

    limiter, key = (
        (_user_generate_limiter, f"user:{user.id}") if user is not None
        else (_anon_generate_limiter, f"ip:{client_ip(request)}")
    )
    limiter.check(key)
    limiter.hit(key)

    try:
        song = await ingest_song(body.song_query)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError:
        # Missing/invalid LLM configuration: log it, don't leak it.
        logger.exception("Council ingestion unavailable")
        raise HTTPException(status_code=503, detail=_UNAVAILABLE)

    try:
        agent_outputs = await run_council(song)
        lesson = await synthesize(song, agent_outputs)
    except RuntimeError:
        logger.exception("Council synthesis unavailable")
        raise HTTPException(status_code=503, detail=_UNAVAILABLE)

    # Embed rich structured data before storing and returning
    lesson = _embed_fingerings_and_functions(lesson, song.chords)

    await session_store.create_session(db, song, lesson, user.id if user else None)
    return lesson


@router.post("/practice/tip")
async def practice_tip(
    body: TipRequest,
    request: Request,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Called after each chord attempt in song-learning mode.
    Returns adaptive tip + structured analysis + fingering tips + score history.
    """
    _limit_llm(request, user)
    session = await session_store.get_session(db, body.lesson_id, user.id if user else None)
    if session is None:
        raise HTTPException(status_code=404, detail="Lesson session not found or expired.")

    valid_keys = {c.chord_key for c in session.lesson.practice_chords if c.chord_key}
    if body.chord_key not in valid_keys:
        raise HTTPException(status_code=422, detail="chord_key is not part of this lesson.")
    user_id = user.id if user else None
    await session_store.append_score(db, session, body.chord_key, body.score)
    user_context = await build_user_context(db, user_id)
    await db.rollback()  # release the connection during the LLM call
    tip = await get_tip(body, session, user_context=user_context)

    # Build evaluation dict from tip request for structured analysis
    evaluation = {
        "score": body.score,
        "detected_notes": body.detected_notes,
        "expected_notes": [],   # not sent in tip request; analysis still works without it
        "missing_notes": body.missing_notes,
        "extra_notes": body.extra_notes,
        "issue": None,
    }
    analysis = FeedbackGenerator.generate_analysis_summary(evaluation)

    # Get fingering positions for this chord from session's lesson
    positions: list[dict] = []
    for pc in session.lesson.practice_chords:
        if pc.chord_key == body.chord_key:
            positions = [p.model_dump() for p in pc.positions]
            break
    fingering_tips = FeedbackGenerator.generate_fingering_tips(body.missing_notes, positions)

    return {
        "tip": tip,
        "analysis": analysis,
        "fingering_tips": fingering_tips,
        "all_chords_attempted": session.all_chords_attempted,
        "chord_scores": {k: [round(s, 3) for s in v] for k, v in session.chord_scores.items()},
    }


@router.post("/practice/revise", response_model=LessonDocument)
async def practice_revise(
    body: ReviseRequest,
    request: Request,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> LessonDocument:
    """
    Called after all chords have been attempted at least once.
    Returns a revised LessonDocument with updated practice_plan + chord_ranking.
    """
    _limit_llm(request, user)
    session = await session_store.get_session(db, body.lesson_id, user.id if user else None)
    if session is None:
        raise HTTPException(status_code=404, detail="Lesson session not found or expired.")

    if not session.all_chords_attempted:
        raise HTTPException(
            status_code=400,
            detail="Not all chords have been attempted yet. Practice each chord at least once before revising.",
        )

    user_context = await build_user_context(db, user.id if user else None)
    await db.rollback()  # release the connection during the LLM call
    updated_lesson = await revise_lesson(session, user_context=user_context)
    await session_store.save_session(db, session)
    return updated_lesson


@router.post("/quiz", response_model=QuizResponse)
async def get_quiz(
    body: QuizRequest,
    request: Request,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> QuizResponse:
    """
    Generate (or return cached) 3 MCQ questions from the lesson content.
    Questions are cached on the session after first generation.
    """
    _limit_llm(request, user)
    session = await session_store.get_session(db, body.lesson_id, user.id if user else None)
    if session is None:
        raise HTTPException(status_code=404, detail="Lesson session not found or expired.")
    user_context = await build_user_context(db, user.id if user else None)
    await db.rollback()  # release the connection during the LLM call
    quiz = await generate_quiz(session, user_context=user_context)
    await session_store.save_session(db, session)
    return quiz
