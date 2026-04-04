"""Tests for the Feedback Engine."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from feedback_engine import FeedbackGenerator


def test_perfect_score() -> None:
    gen = FeedbackGenerator()
    result = gen.generate({
        "score": 1.0,
        "detected_notes": ["G", "B", "D"],
        "expected_notes": ["G", "B", "D"],
        "missing_notes": [],
        "issue": None,
    })
    assert isinstance(result, str) and len(result) > 0
    print(f"  Feedback: {result}")
    print("PASS: test_perfect_score")


def test_muted_string() -> None:
    gen = FeedbackGenerator()
    result = gen.generate({
        "score": 0.67,
        "detected_notes": ["G", "D"],
        "expected_notes": ["G", "B", "D"],
        "missing_notes": ["B"],
        "issue": "muted_string",
    })
    assert "B" in result
    print(f"  Feedback: {result}")
    print("PASS: test_muted_string")


def test_wrong_chord() -> None:
    gen = FeedbackGenerator()
    result = gen.generate({
        "score": 0.0,
        "detected_notes": ["A", "C#", "E"],
        "expected_notes": ["G", "B", "D"],
        "missing_notes": ["G", "B", "D"],
        "issue": "wrong_chord",
    })
    assert isinstance(result, str)
    print(f"  Feedback: {result}")
    print("PASS: test_wrong_chord")


def test_no_sound() -> None:
    gen = FeedbackGenerator()
    result = gen.generate({
        "score": 0.0,
        "detected_notes": [],
        "expected_notes": ["G", "B", "D"],
        "missing_notes": ["G", "B", "D"],
        "issue": "no_sound",
    })
    assert "microphone" in result.lower() or "sound" in result.lower()
    print(f"  Feedback: {result}")
    print("PASS: test_no_sound")


def test_processing_error() -> None:
    gen = FeedbackGenerator()
    result = gen.generate({
        "score": 0.0,
        "detected_notes": [],
        "expected_notes": [],
        "missing_notes": [],
        "issue": "processing_error",
    })
    assert isinstance(result, str)
    print(f"  Feedback: {result}")
    print("PASS: test_processing_error")


if __name__ == "__main__":
    test_perfect_score()
    test_muted_string()
    test_wrong_chord()
    test_no_sound()
    test_processing_error()
    print("\nAll feedback engine tests passed!")
