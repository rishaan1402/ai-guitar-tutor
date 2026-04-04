from __future__ import annotations

import logging
from enum import Enum
from typing import Any, Dict, Optional

from lesson_service import Lesson, LessonService
from audio_engine import ChordEvaluator, EvaluationResult
from feedback_engine import FeedbackGenerator

logger = logging.getLogger(__name__)


class SessionState(str, Enum):
    """States for the tutoring session state machine."""

    IDLE = "IDLE"
    TEACHING = "TEACHING"
    WAITING_FOR_PLAY = "WAITING_FOR_PLAY"
    ANALYZING = "ANALYZING"
    FEEDBACK = "FEEDBACK"
    COMPLETED = "COMPLETED"


class TutorAgent:
    """
    Orchestrates a guitar tutoring session.

    Manages session state and delegates to LessonService,
    ChordEvaluator, and FeedbackGenerator. Contains no audio
    processing logic itself.
    """

    MAX_ATTEMPTS = 3

    def __init__(
        self,
        lesson_service: LessonService,
        evaluator: ChordEvaluator,
        feedback_generator: FeedbackGenerator,
    ) -> None:
        self._lesson_service = lesson_service
        self._evaluator = evaluator
        self._feedback_generator = feedback_generator

        self._state: SessionState = SessionState.IDLE
        self._current_lesson: Optional[Lesson] = None
        self._attempt_count: int = 0
        self._last_evaluation: Optional[EvaluationResult] = None

    @property
    def state(self) -> SessionState:
        return self._state

    @property
    def current_chord(self) -> Optional[str]:
        if self._current_lesson:
            return self._current_lesson.chord_name
        return None

    def start_lesson(self, chord_name: str) -> Dict[str, Any]:
        """
        Begin a tutoring session for the given chord.

        Transitions: IDLE/COMPLETED/FEEDBACK -> TEACHING -> WAITING_FOR_PLAY
        """
        lesson = self._lesson_service.get_lesson(chord_name)
        if lesson is None:
            logger.warning("Lesson not found for chord: %s", chord_name)
            available = self._lesson_service.list_available_chords()
            return {
                "status": "error",
                "message": f"No lesson found for '{chord_name}'.",
                "available_chords": available,
            }

        self._current_lesson = lesson
        self._attempt_count = 0
        self._last_evaluation = None
        self._state = SessionState.TEACHING

        logger.info("Started lesson for chord: %s", chord_name)

        # Immediately transition to waiting for play.
        self._state = SessionState.WAITING_FOR_PLAY

        return {
            "status": "ok",
            "state": self._state.value,
            "chord": chord_name,
            "lesson": lesson.to_dict(),
            "message": f"Watch the lesson video, then play the {chord_name} chord.",
        }

    def submit_audio(self, audio_path: str) -> Dict[str, Any]:
        """
        Accept a user's audio recording for evaluation.

        Transitions: WAITING_FOR_PLAY -> ANALYZING -> FEEDBACK (or COMPLETED)
        """
        if self._state not in (SessionState.WAITING_FOR_PLAY, SessionState.FEEDBACK):
            return {
                "status": "error",
                "state": self._state.value,
                "message": "Not ready for audio submission. Start a lesson first.",
            }

        if self._current_lesson is None:
            return {
                "status": "error",
                "message": "No active lesson. Start a lesson first.",
            }

        self._state = SessionState.ANALYZING
        self._attempt_count += 1

        expected_notes = list(self._current_lesson.metadata.get("notes", []))
        evaluation = self._evaluator.evaluate(audio_path, expected_notes)
        self._last_evaluation = evaluation

        feedback_text = self._feedback_generator.generate(evaluation.to_dict())

        if evaluation.score >= 1.0:
            self._state = SessionState.COMPLETED
            return {
                "status": "ok",
                "state": self._state.value,
                "evaluation": evaluation.to_dict(),
                "feedback": feedback_text,
                "attempt": self._attempt_count,
                "message": "Congratulations! You've completed this lesson.",
            }

        if self._attempt_count >= self.MAX_ATTEMPTS:
            self._state = SessionState.COMPLETED
            return {
                "status": "ok",
                "state": self._state.value,
                "evaluation": evaluation.to_dict(),
                "feedback": feedback_text,
                "attempt": self._attempt_count,
                "message": "You've used all attempts. Review the lesson and try again later.",
            }

        self._state = SessionState.FEEDBACK
        return {
            "status": "ok",
            "state": self._state.value,
            "evaluation": evaluation.to_dict(),
            "feedback": feedback_text,
            "attempt": self._attempt_count,
            "attempts_remaining": self.MAX_ATTEMPTS - self._attempt_count,
            "message": "Try again! You can do it.",
        }

    def get_session_info(self) -> Dict[str, Any]:
        """Return current session state and details."""
        info: Dict[str, Any] = {
            "state": self._state.value,
            "attempt": self._attempt_count,
        }
        if self._current_lesson:
            info["chord"] = self._current_lesson.chord_name
        if self._last_evaluation:
            info["last_evaluation"] = self._last_evaluation.to_dict()
        return info

    def reset(self) -> None:
        """Reset the session back to IDLE."""
        self._state = SessionState.IDLE
        self._current_lesson = None
        self._attempt_count = 0
        self._last_evaluation = None
        logger.info("Session reset to IDLE")
