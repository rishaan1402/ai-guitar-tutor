from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from council.schemas import GenerateRequest, TipRequest, ReviseRequest, QuizRequest, QuizResponse, LessonDocument
from council.ingestion import ingest_song
from council.agents import run_council
from council.chairman import synthesize
from council import session_store
from council.advisor import get_tip, revise_lesson
from council.quiz import generate_quiz
from auth.dependencies import get_current_user_optional
from auth.profile_context import build_user_context
from db.engine import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/council", tags=["council"])


@router.post("/generate", response_model=LessonDocument)
async def generate_lesson(body: GenerateRequest) -> LessonDocument:
    """
    Full pipeline: ingest → council (4 parallel agents) → chairman synthesis.
    Returns a LessonDocument with lesson_id for subsequent practice calls.
    """
    if not body.song_query.strip():
        raise HTTPException(status_code=400, detail="song_query must not be empty.")

    try:
        song = await ingest_song(body.song_query)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    agent_outputs = await run_council(song)
    lesson = await synthesize(song, agent_outputs)

    # Store session for adaptive feedback
    session = session_store.create_session(song, lesson)
    # lesson_id is already set inside the LessonDocument by synthesize()
    return lesson


@router.post("/practice/tip")
async def practice_tip(
    body: TipRequest,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Called after each chord attempt while in song-learning mode.
    Returns a 1-2 sentence adaptive tip from the Lesson Advisor.
    """
    session = session_store.get_session(body.lesson_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Lesson session not found or expired.")

    session.record_attempt(body.chord_key, body.score)
    user_context = await build_user_context(db, user.id if user else None)
    tip = await get_tip(body, session, user_context=user_context)
    return {
        "tip": tip,
        "all_chords_attempted": session.all_chords_attempted,
        "chord_scores": {k: [round(s, 3) for s in v] for k, v in session.chord_scores.items()},
    }


@router.post("/practice/revise", response_model=LessonDocument)
async def practice_revise(
    body: ReviseRequest,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> LessonDocument:
    """
    Called after all chords have been attempted at least once.
    Returns a revised LessonDocument with an updated practice plan.
    """
    session = session_store.get_session(body.lesson_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Lesson session not found or expired.")

    if not session.all_chords_attempted:
        raise HTTPException(
            status_code=400,
            detail="Not all chords have been attempted yet. Practice each chord at least once before revising.",
        )

    user_context = await build_user_context(db, user.id if user else None)
    updated_lesson = await revise_lesson(session, user_context=user_context)
    return updated_lesson


@router.post("/quiz", response_model=QuizResponse)
async def get_quiz(
    body: QuizRequest,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> QuizResponse:
    """
    Generate (or return cached) 3 MCQ questions from the lesson content.
    Questions are cached on the session after first generation.
    """
    session = session_store.get_session(body.lesson_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Lesson session not found or expired.")
    user_context = await build_user_context(db, user.id if user else None)
    return await generate_quiz(session, user_context=user_context)
