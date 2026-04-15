"""Tests for Pydantic schema validation and defaults."""
from __future__ import annotations

import pytest
from council.schemas import (
    LessonDocument,
    PracticeChord,
    SongSection,
    QuizQuestion,
    QuizResponse,
    QuizRequest,
)


class TestLessonDocumentDefaults:
    def _make_lesson(self, **kwargs):
        base = dict(
            lesson_id="abc123",
            song_title="Test Song",
            artist="Test Artist",
            overall_difficulty="beginner",
            chairman_summary="Summary",
            theory_section="Theory",
            technique_section="Technique",
            ear_training_section="Ear",
            practice_plan="Plan",
            practice_chords=[],
        )
        base.update(kwargs)
        return LessonDocument(**base)

    def test_defaults_present(self):
        lesson = self._make_lesson()
        assert lesson.key == ""
        assert lesson.time_signature == ""
        assert lesson.tempo_feel == ""
        assert lesson.song_sections == []
        assert lesson.chord_functions == {}

    def test_explicit_values_stored(self):
        lesson = self._make_lesson(key="G major", time_signature="4/4", tempo_feel="slow")
        assert lesson.key == "G major"
        assert lesson.time_signature == "4/4"
        assert lesson.tempo_feel == "slow"

    def test_chord_functions_dict(self):
        lesson = self._make_lesson(chord_functions={"G": "I (tonic)", "Am": "ii"})
        assert lesson.chord_functions["G"] == "I (tonic)"


class TestPracticeChord:
    def test_unavailable_chord_has_no_key(self):
        c = PracticeChord(symbol="Fmaj13", available_in_app=False, chord_key=None)
        assert c.chord_key is None
        assert not c.available_in_app

    def test_available_chord_has_key(self):
        c = PracticeChord(symbol="G", available_in_app=True, chord_key="G_major")
        assert c.chord_key == "G_major"


class TestSongSection:
    def test_serializes(self):
        s = SongSection(name="Verse", chords=["G", "Am", "C"])
        d = s.model_dump()
        assert d["name"] == "Verse"
        assert d["chords"] == ["G", "Am", "C"]


class TestQuizSchemas:
    def test_quiz_question_valid(self):
        q = QuizQuestion(
            id="q1",
            question="What key?",
            options=["A. G", "B. C", "C. D", "D. A"],
            correct_index=0,
            explanation="It is G major.",
        )
        assert len(q.options) == 4
        assert q.correct_index == 0

    def test_quiz_response_holds_questions(self):
        questions = [
            QuizQuestion(id=f"q{i}", question=f"Q{i}?",
                         options=["A","B","C","D"], correct_index=0,
                         explanation="exp")
            for i in range(3)
        ]
        resp = QuizResponse(questions=questions)
        assert len(resp.questions) == 3

    def test_quiz_request(self):
        r = QuizRequest(lesson_id="abc")
        assert r.lesson_id == "abc"
