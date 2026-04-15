"""
Shared fixtures for the test suite.
The Groq LLM is patched to return canned responses so tests run without
network access and without an API key.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Ensure backend root is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


# ---------------------------------------------------------------------------
# Canned LLM responses
# ---------------------------------------------------------------------------

_CANNED_LESSON_JSON = """{
  "song_title": "Test Song",
  "artist": "Test Artist",
  "key": "G major",
  "time_signature": "4/4",
  "tempo_feel": "medium",
  "overall_difficulty": "beginner",
  "chords": [{"symbol": "G", "function": "I (tonic)", "notes": ["G", "B", "D"]}],
  "progression": ["G"],
  "sections": [{"name": "Verse", "chords": ["G"]}],
  "techniques": ["strumming"],
  "theory_notes": "Simple I chord.",
  "feel_description": "upbeat"
}"""

_CANNED_SUMMARY = "A simple beginner lesson."
_CANNED_TIP = "Great effort! Keep it up."
_CANNED_REVISE = "Revised plan: practice daily."

_CANNED_QUIZ_JSON = """[
  {"id":"q1","question":"What key is this song in?",
   "options":["A. G major","B. C major","C. D major","D. A minor"],
   "correct_index":0,"explanation":"The lesson states the key is G major."},
  {"id":"q2","question":"What is the recommended technique?",
   "options":["A. Strumming","B. Fingerpicking","C. Tapping","D. Slapping"],
   "correct_index":0,"explanation":"Strumming is listed as the primary technique."},
  {"id":"q3","question":"What difficulty is this song?",
   "options":["A. Beginner","B. Intermediate","C. Advanced","D. Expert"],
   "correct_index":0,"explanation":"The lesson marks this as beginner difficulty."}
]"""


def _make_mock_choice(content: str):
    choice = MagicMock()
    choice.message.content = content
    return choice


def _make_groq_mock(content: str):
    """Return an AsyncMock Groq client that always returns `content`."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [_make_mock_choice(content)]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
    return mock_client


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def mock_groq_lesson():
    return _make_groq_mock(_CANNED_LESSON_JSON)


@pytest.fixture
def mock_groq_tip():
    return _make_groq_mock(_CANNED_TIP)


@pytest.fixture
def mock_groq_quiz():
    return _make_groq_mock(_CANNED_QUIZ_JSON)


@pytest.fixture
def mock_groq_summary():
    return _make_groq_mock(_CANNED_SUMMARY)


@pytest.fixture
def app_client():
    """TestClient with Groq patched to avoid real LLM calls."""
    from main import app
    with patch("feedback_engine.generator._get_groq_client",
               return_value=_make_groq_mock(_CANNED_SUMMARY)):
        with TestClient(app) as client:
            yield client
