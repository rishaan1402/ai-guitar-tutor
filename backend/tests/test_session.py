"""Tests for LessonSession logic — scoring, completion tracking, caching."""
from __future__ import annotations

from council.schemas import LessonDocument, PracticeChord, SongSection, SongObject
from council.session_store import LessonSession


def _make_session(chord_keys: list[str] = None) -> LessonSession:
    chord_keys = chord_keys or ["G_major", "C_major"]
    practice_chords = [
        PracticeChord(symbol=k.split("_")[0], available_in_app=True, chord_key=k)
        for k in chord_keys
    ]
    lesson = LessonDocument(
        lesson_id="test-id",
        song_title="Test Song",
        artist="Test Artist",
        overall_difficulty="beginner",
        chairman_summary="Summary",
        theory_section="Theory",
        technique_section="Technique",
        ear_training_section="Ear",
        practice_plan="Plan",
        practice_chords=practice_chords,
    )
    song = SongObject(
        song_title="Test Song",
        artist="Test Artist",
        key="G major",
        time_signature="4/4",
        tempo_feel="medium",
        overall_difficulty="beginner",
        chords=[],
        progression=[],
        sections=[],
        techniques=[],
        theory_notes="",
        feel_description="",
    )
    return LessonSession(lesson_id="test-id", song=song, lesson=lesson)


class TestRecordAttempt:
    def test_appends_scores(self):
        session = _make_session()
        session.record_attempt("G_major", 0.8)
        session.record_attempt("G_major", 0.9)
        assert session.chord_scores["G_major"] == [0.8, 0.9]

    def test_separate_chords_tracked_independently(self):
        session = _make_session()
        session.record_attempt("G_major", 0.7)
        session.record_attempt("C_major", 0.5)
        assert len(session.chord_scores) == 2


class TestAllChordsAttempted:
    def test_false_when_no_attempts(self):
        session = _make_session(["G_major", "C_major"])
        assert not session.all_chords_attempted

    def test_false_when_only_one_attempted(self):
        session = _make_session(["G_major", "C_major"])
        session.record_attempt("G_major", 0.6)
        assert not session.all_chords_attempted

    def test_true_when_all_attempted(self):
        session = _make_session(["G_major", "C_major"])
        session.record_attempt("G_major", 0.6)
        session.record_attempt("C_major", 0.8)
        assert session.all_chords_attempted

    def test_single_chord_lesson(self):
        session = _make_session(["G_major"])
        assert not session.all_chords_attempted
        session.record_attempt("G_major", 0.5)
        assert session.all_chords_attempted


class TestBestScore:
    def test_returns_max(self):
        session = _make_session()
        session.record_attempt("G_major", 0.5)
        session.record_attempt("G_major", 0.9)
        session.record_attempt("G_major", 0.7)
        assert session.best_score("G_major") == 0.9

    def test_none_when_no_attempts(self):
        session = _make_session()
        assert session.best_score("G_major") is None


class TestScoreSummary:
    def test_empty_when_no_attempts(self):
        session = _make_session()
        assert "No chords" in session.score_summary()

    def test_contains_chord_info_after_attempt(self):
        session = _make_session()
        session.record_attempt("G_major", 0.8)
        summary = session.score_summary()
        assert "G" in summary
        assert "80%" in summary


class TestCachedQuiz:
    def test_cached_quiz_starts_none(self):
        session = _make_session()
        assert session.cached_quiz is None

    def test_cached_quiz_can_be_set(self):
        from council.schemas import QuizResponse, QuizQuestion
        session = _make_session()
        q = QuizQuestion(id="q1", question="Q?", options=["A","B","C","D"],
                         correct_index=0, explanation="exp")
        quiz = QuizResponse(questions=[q])
        session.cached_quiz = quiz
        assert session.cached_quiz is quiz
