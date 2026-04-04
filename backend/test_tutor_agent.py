"""Tests for the Tutor Agent — simulates a full session flow."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audio_engine import ChordEvaluator, EvaluationResult
from feedback_engine import FeedbackGenerator
from lesson_service import LessonService
from tutor_agent import TutorAgent, SessionState


def _make_agent() -> TutorAgent:
    """Create a TutorAgent with real LessonService and mocked evaluator."""
    lesson_service = LessonService()
    evaluator = ChordEvaluator()
    feedback_gen = FeedbackGenerator()
    return TutorAgent(lesson_service, evaluator, feedback_gen)


def test_initial_state() -> None:
    agent = _make_agent()
    assert agent.state == SessionState.IDLE
    print("PASS: test_initial_state")


def test_start_lesson_missing_chord() -> None:
    agent = _make_agent()
    result = agent.start_lesson("Z_diminished_99")
    assert result["status"] == "error"
    assert agent.state == SessionState.IDLE
    print("PASS: test_start_lesson_missing_chord")


def test_submit_audio_without_lesson() -> None:
    agent = _make_agent()
    result = agent.submit_audio("/tmp/fake.wav")
    assert result["status"] == "error"
    print("PASS: test_submit_audio_without_lesson")


def test_full_session_flow_mocked() -> None:
    """Simulate a full session with a mocked evaluator for deterministic results."""
    lesson_service = LessonService()

    # If no lessons available, skip this test.
    chords = lesson_service.list_available_chords()
    if not chords:
        print("SKIP: test_full_session_flow_mocked (no lessons on disk)")
        return

    chord = chords[0]

    # Mock the evaluator to return a perfect score on second attempt.
    evaluator = MagicMock(spec=ChordEvaluator)
    call_count = {"n": 0}

    def mock_evaluate(audio_path: str, expected_notes: list[str]) -> EvaluationResult:
        call_count["n"] += 1
        if call_count["n"] == 1:
            return EvaluationResult(
                score=0.67,
                detected_notes=["G", "D"],
                expected_notes=expected_notes,
                missing_notes=["B"],
                issue="muted_string",
            )
        return EvaluationResult(
            score=1.0,
            detected_notes=expected_notes,
            expected_notes=expected_notes,
            missing_notes=[],
            issue=None,
        )

    evaluator.evaluate = mock_evaluate
    feedback_gen = FeedbackGenerator()

    agent = TutorAgent(lesson_service, evaluator, feedback_gen)

    # Start lesson
    result = agent.start_lesson(chord)
    assert result["status"] == "ok"
    assert agent.state == SessionState.WAITING_FOR_PLAY
    print(f"  Started lesson for {chord}, state={agent.state.value}")

    # First attempt — partial score
    result = agent.submit_audio("/tmp/test.wav")
    assert result["status"] == "ok"
    assert agent.state == SessionState.FEEDBACK
    print(f"  Attempt 1: score={result['evaluation']['score']}, state={agent.state.value}")

    # Second attempt — perfect
    result = agent.submit_audio("/tmp/test.wav")
    assert result["status"] == "ok"
    assert agent.state == SessionState.COMPLETED
    print(f"  Attempt 2: score={result['evaluation']['score']}, state={agent.state.value}")

    print("PASS: test_full_session_flow_mocked")


def test_reset() -> None:
    agent = _make_agent()
    agent.reset()
    assert agent.state == SessionState.IDLE
    assert agent.current_chord is None
    print("PASS: test_reset")


def test_session_info() -> None:
    agent = _make_agent()
    info = agent.get_session_info()
    assert info["state"] == "IDLE"
    print("PASS: test_session_info")


if __name__ == "__main__":
    test_initial_state()
    test_start_lesson_missing_chord()
    test_submit_audio_without_lesson()
    test_full_session_flow_mocked()
    test_reset()
    test_session_info()
    print("\nAll tutor agent tests passed!")
