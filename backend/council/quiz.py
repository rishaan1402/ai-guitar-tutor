from __future__ import annotations

import json
import logging
import uuid

from council.schemas import QuizQuestion, QuizResponse
from council.session_store import LessonSession
from feedback_engine.generator import _get_groq_client, GROQ_MODEL

logger = logging.getLogger(__name__)

_QUIZ_SYSTEM = """You are a guitar teacher generating a short quiz to check student understanding.
Based on the lesson details provided, write exactly 3 multiple-choice questions.
Mix one theory question, one technique question, and one practical/song question.

Respond with ONLY a valid JSON array — no markdown, no explanation, no code fences.
Use this exact format:
[
  {
    "id": "q1",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct_index": 0,
    "explanation": "One sentence explanation of the correct answer."
  },
  ...
]

Rules:
- correct_index is 0-based (0 = first option)
- Each question must have exactly 4 options
- Keep questions short and beginner-friendly
- Options should be plausible, not obviously wrong"""


def _fallback_quiz(lesson_title: str) -> QuizResponse:
    """Rule-based fallback when Groq is unavailable."""
    return QuizResponse(questions=[
        QuizQuestion(
            id="q1",
            question=f"What is the best way to improve at the chords in {lesson_title}?",
            options=[
                "A. Practice each chord slowly until clean, then speed up",
                "B. Only play at full speed from the start",
                "C. Skip difficult chords and focus on easy ones",
                "D. Watch videos without practising",
            ],
            correct_index=0,
            explanation="Slow, clean practice builds muscle memory before increasing tempo.",
        ),
        QuizQuestion(
            id="q2",
            question="What should you do if a note sounds muted or buzzing?",
            options=[
                "A. Press harder with your fingertip, closer to the fret",
                "B. Use less finger pressure",
                "C. Move your finger away from the fret",
                "D. Ignore it and keep playing",
            ],
            correct_index=0,
            explanation="Pressing close to the fret with your fingertip minimises muting and buzzing.",
        ),
        QuizQuestion(
            id="q3",
            question="When learning a chord transition, what is the most effective approach?",
            options=[
                "A. Alternate between the two chords slowly, gradually increasing speed",
                "B. Master each chord separately before ever switching",
                "C. Only practise transitions at song tempo",
                "D. Use your picking hand to guide your fretting hand",
            ],
            correct_index=0,
            explanation="Slowly alternating between chords builds the muscle memory for the transition.",
        ),
    ])


async def generate_quiz(session: LessonSession, user_context: str = "") -> QuizResponse:
    """
    Generate 3 MCQ questions from the lesson content.
    Result is cached on the session to avoid re-generation.
    """
    if session.cached_quiz is not None:
        return session.cached_quiz

    lesson = session.lesson
    chord_list = ", ".join(
        f"{c.symbol} ({session.lesson.chord_functions.get(c.symbol, 'chord')})"
        for c in lesson.practice_chords
    )

    lesson_text = (
        f"Song: {lesson.song_title} by {lesson.artist}\n"
        f"Key: {lesson.key}   Time signature: {lesson.time_signature}   Feel: {lesson.tempo_feel}\n"
        f"Difficulty: {lesson.overall_difficulty}\n"
        f"Chords to learn: {chord_list}\n\n"
        f"Theory notes (first 500 chars):\n{lesson.theory_section[:500]}\n\n"
        f"Technique guide (first 500 chars):\n{lesson.technique_section[:500]}"
    )

    client = _get_groq_client()
    if client is None:
        quiz = _fallback_quiz(lesson.song_title)
        session.cached_quiz = quiz
        return quiz

    quiz_system = (
        f"{user_context}\n\nAdapt question difficulty to this student's level.\n\n{_QUIZ_SYSTEM}"
        if user_context else _QUIZ_SYSTEM
    )

    try:
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": quiz_system},
                {"role": "user", "content": lesson_text},
            ],
            temperature=0.6,
            max_tokens=800,
        )
        raw = response.choices[0].message.content.strip()

        # Strip accidental markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        data = json.loads(raw)
        questions = []
        for i, q in enumerate(data[:3]):
            questions.append(QuizQuestion(
                id=q.get("id", f"q{i+1}"),
                question=q["question"],
                options=q["options"][:4],
                correct_index=int(q["correct_index"]),
                explanation=q.get("explanation", ""),
            ))
        quiz = QuizResponse(questions=questions)

    except Exception as exc:
        logger.warning("Quiz generation failed (%s) — using fallback", exc)
        quiz = _fallback_quiz(lesson.song_title)

    session.cached_quiz = quiz
    return quiz
