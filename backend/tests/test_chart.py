"""Chord charts and section lessons built from the AI's song data."""
from __future__ import annotations

from council.chart import build_chart, build_section_lessons, chord_key_for, clean_chord
from council.schemas import SongObject


def _song(**over) -> SongObject:
    base = dict(
        song_title="Test Song", artist="Test Artist", key="G major", time_signature="4/4",
        tempo_feel="medium", overall_difficulty="beginner",
        chords=[{"symbol": s, "function": "", "notes": []} for s in ("G", "D", "Em", "C", "Am7")],
        progression=["G", "D", "Em", "C", "Am7"],
        sections=[
            {"name": "Verse", "chords": ["G", "D", "Em", "C"], "bars": ["G", "D", "Em", "C"], "repeat": 2},
            {"name": "Chorus", "chords": ["C", "G", "Am7", "D"], "bars": ["C G", "Am7", "D"], "repeat": 1},
        ],
        form=["Verse", "Chorus", "Verse", "Chorus"],
        techniques=[], theory_notes="", feel_description="",
        strumming="D DU UDU", capo=2, tempo_bpm=100,
    )
    base.update(over)
    return SongObject(**base)


class TestChart:
    def test_header_and_grid(self):
        chart = build_chart(_song())
        assert "{title: Test Song}" in chart and "{key: G}" in chart
        assert "{capo: 2}" in chart and "{tempo: 100}" in chart and "{strumming: D DU UDU}" in chart
        assert "| G . . . | D . . . | Em . . . | C . . . |" in chart
        assert "| C . G . | Am7 . . . | D . . . |" in chart     # two chords share a bar

    def test_full_form_in_order_with_repeat_labels(self):
        chart = build_chart(_song())
        order = [l for l in chart.splitlines() if l.startswith("{start_of_grid")]
        assert order == ["{start_of_grid: Verse}", "{start_of_grid: Chorus}",
                         "{start_of_grid: Verse 2}", "{start_of_grid: Chorus 2}"]
        assert "{comment: Play 2×}" in chart
        assert "Form: Verse → Chorus → Verse → Chorus" in chart

    def test_no_lyrics_and_sanitised(self):
        evil = _song(song_title="Hack}{start_of_tab}", sections=[
            {"name": "Verse}", "chords": [], "bars": ["G", "{title: x}", "hello", "D/F#"]}], form=[])
        chart = build_chart(evil)
        assert chart.count("{start_of_grid") == 1
        assert "hello" not in chart and "{title: x}" not in chart
        assert "| G . . . | D/F# . . . |" in chart
        assert "{title: Hack start_of_tab}" in chart

    def test_minor_key_and_fallback_to_chords(self):
        song = _song(key="E minor", form=[],
                     sections=[{"name": "Main", "chords": ["Em", "C", "G", "D"]}])
        chart = build_chart(song)
        assert "{key: Em}" in chart and "| Em . . . | C . . . | G . . . | D . . . |" in chart

    def test_three_four_time(self):
        chart = build_chart(_song(time_signature="3/4"))
        assert "| G . . | D . . |" in chart

    def test_parses_in_frontend_grammar(self):
        # every non-blank line is a directive or a bar line (what chordpro.ts understands)
        for line in build_chart(_song()).splitlines():
            assert not line or line.startswith("{") or line.startswith("|"), line


class TestSectionLessons:
    def test_one_lesson_per_distinct_section(self):
        lessons = build_section_lessons(_song())
        assert [l.name for l in lessons] == ["Verse", "Chorus"]

    def test_new_chords_only_once(self):
        verse, chorus = build_section_lessons(_song())
        assert verse.new_chords == ["G", "D", "Em", "C"]
        assert chorus.new_chords == ["Am7"]

    def test_changes_in_order_and_wrap_when_repeated(self):
        verse, chorus = build_section_lessons(_song())
        pairs = [(c.from_symbol, c.to_symbol) for c in verse.changes]
        assert pairs == [("G", "D"), ("D", "Em"), ("Em", "C"), ("C", "G")]
        assert ("D", "C") not in [(c.from_symbol, c.to_symbol) for c in chorus.changes]  # no wrap at repeat 1

    def test_tempo_plan_and_keys(self):
        verse, chorus = build_section_lessons(_song())
        assert verse.start_bpm == 60 and verse.target_bpm == 100
        assert chorus.chord_keys["Am7"] == "A_minor7" and verse.chord_keys["G"] == "G_major"
        assert any("60 bpm" in s for s in verse.steps)


class TestChordHelpers:
    def test_clean_chord(self):
        assert clean_chord("F#m7") == "F#m7" and clean_chord("Bb/D") == "Bb/D"
        assert clean_chord("hello") is None and clean_chord("{x}") is None

    def test_chord_key_for_is_strict(self):
        assert chord_key_for("Bbm") == "A#_minor"
        assert chord_key_for("Gsus4") is None          # not taught: no link, not "G major"
        assert chord_key_for("D/F#") == "D_major"


class TestPracticeChordResolver:
    def test_unknown_quality_gets_no_lesson_or_diagram(self):
        from council.chairman import _resolve_practice_chords
        song = _song(progression=["G", "Gsus4", "Cadd9", "D/F#", "Bbm", "Am7"])
        got = {p.symbol: p.chord_key for p in _resolve_practice_chords(song)}
        assert got == {"G": "G_major", "Gsus4": None, "Cadd9": None,
                       "D/F#": "D_major", "Bbm": "A#_minor", "Am7": "A_minor7"}
