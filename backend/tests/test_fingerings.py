"""
data/chords/fingerings.json drives chord diagrams, lesson videos and fingering
tips, so every voicing must be playable and sound exactly the chord's notes
(the scorer marks missing chord tones down).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FINGERINGS = json.loads((ROOT / "data" / "chords" / "fingerings.json").read_text())
NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
OPEN_STRINGS = {6: "E", 5: "A", 4: "D", 3: "G", 2: "B", 1: "E"}


def _note(string: int, fret: int) -> str:
    return NOTES[(NOTES.index(OPEN_STRINGS[string]) + fret) % 12]


def _voicings(entry):
    yield "positions", entry["positions"]
    if "alt_positions" in entry:
        yield "alt_positions", entry["alt_positions"]


def test_covers_every_lesson_chord():
    lesson_chords = {p.name for p in (ROOT / "data" / "lessons").iterdir() if (p / "metadata.json").exists()}
    assert {e["chord"] for e in FINGERINGS} == lesson_chords


@pytest.mark.parametrize("entry", FINGERINGS, ids=lambda e: e["chord"])
def test_voicings_are_correct_and_playable(entry):
    for field, positions in _voicings(entry):
        where = f"{entry['chord']}.{field}"
        assert sorted(p["string"] for p in positions) == [1, 2, 3, 4, 5, 6], where

        played = [p for p in positions if p.get("action") != "mute"]
        for p in played:
            assert p["note"] == _note(p["string"], p["fret"]), f"{where}: string {p['string']} label"
            if p["fret"] == 0:
                assert "finger" not in p, f"{where}: open string has a finger"
            else:
                assert p.get("finger") in (1, 2, 3, 4), f"{where}: string {p['string']} finger"

        # Exactly the chord's notes: nothing missing, nothing extra
        assert {p["note"] for p in played} == set(entry["notes"]), where

        fretted = [p["fret"] for p in played if p["fret"] > 0]
        if fretted:
            assert max(fretted) - min(fretted) <= 3, f"{where}: stretch wider than 4 frets"


@pytest.mark.parametrize("entry", FINGERINGS, ids=lambda e: e["chord"])
def test_lesson_metadata_agrees(entry):
    meta = json.loads((ROOT / "data" / "lessons" / entry["chord"] / "metadata.json").read_text())
    assert entry["notes"] == meta["notes"]


def test_primary_voicings_sit_low_on_the_neck():
    for e in FINGERINGS:
        frets = [p["fret"] for p in e["positions"] if p.get("action") != "mute"]
        assert max(frets) <= 8, e["chord"]


@pytest.mark.parametrize("chord,shape", [
    ("C_major", "x32010"), ("D_major", "xx0232"), ("E_major", "022100"), ("G_major", "320003"),
    ("A_major", "x02220"), ("A_minor", "x02210"), ("E_minor", "022000"), ("D_minor", "xx0231"),
    ("E_dominant7", "020100"), ("A_dominant7", "x02020"), ("B_dominant7", "x21202"),
    ("F_major", "133211"), ("B_minor", "x24432"),
])
def test_beginner_chords_use_standard_shapes(chord, shape):
    entry = next(e for e in FINGERINGS if e["chord"] == chord)
    got = "".join(
        "x" if p.get("action") == "mute" else str(p["fret"])
        for p in sorted(entry["positions"], key=lambda p: -p["string"])
    )
    assert got == shape
