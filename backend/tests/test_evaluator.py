"""
Tests for ChordEvaluator scoring accuracy.
Uses synthetic WAV files — no real guitar audio required.
"""
from __future__ import annotations

import struct
import tempfile
import wave
from pathlib import Path

import numpy as np
import pytest

from audio_engine.evaluator import ChordEvaluator


def _write_wav(path: str, samples: np.ndarray, sr: int = 22050) -> None:
    """Write float32 samples to a WAV file."""
    s16 = (samples * 32767).clip(-32768, 32767).astype(np.int16)
    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(s16.tobytes())


def _silence(duration: float = 0.5, sr: int = 22050) -> np.ndarray:
    return np.zeros(int(duration * sr), dtype=np.float32)


def _tone(freq: float, duration: float = 0.5, sr: int = 22050,
          amplitude: float = 0.6) -> np.ndarray:
    t = np.linspace(0, duration, int(duration * sr), endpoint=False)
    return (amplitude * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def _chord(*freqs: float, duration: float = 0.5, sr: int = 22050) -> np.ndarray:
    """Additive mix of multiple sine tones."""
    mix = np.zeros(int(duration * sr), dtype=np.float32)
    for f in freqs:
        mix += _tone(f, duration, sr, amplitude=0.3)
    peak = np.max(np.abs(mix))
    if peak > 1e-8:
        mix /= peak
    return (mix * 0.8).astype(np.float32)


evaluator = ChordEvaluator()


class TestSilenceReturnsZero:
    def test_silence_gives_zero_score(self, tmp_path):
        path = str(tmp_path / "silence.wav")
        _write_wav(path, _silence())
        result = evaluator.evaluate(path, ["G", "B", "D"])
        assert result.score == 0.0

    def test_missing_file_gives_zero(self, tmp_path):
        result = evaluator.evaluate(str(tmp_path / "nonexistent.wav"), ["G", "B", "D"])
        assert result.score == 0.0
        assert result.issue == "missing_audio"


class TestScoreIsInRange:
    """Score must always be in [0.0, 1.0]."""

    def test_score_range_silence(self, tmp_path):
        path = str(tmp_path / "s.wav")
        _write_wav(path, _silence())
        r = evaluator.evaluate(path, ["G", "B", "D"])
        assert 0.0 <= r.score <= 1.0

    def test_score_range_noise(self, tmp_path):
        path = str(tmp_path / "noise.wav")
        noise = (np.random.randn(22050) * 0.1).astype(np.float32)
        _write_wav(path, noise)
        r = evaluator.evaluate(path, ["G", "B", "D"])
        assert 0.0 <= r.score <= 1.0


class TestScoringFormula:
    """
    Verify _compare_notes directly — isolated from audio processing.
    Formula: score = max(0, matched/expected - extra*0.08)
    """

    def test_perfect_match(self):
        r = evaluator._compare_notes(["G", "B", "D"], ["G", "B", "D"])
        assert r.score == 1.0
        assert r.missing_notes == []
        assert r.extra_notes == []
        assert r.issue is None

    def test_all_missing(self):
        r = evaluator._compare_notes([], ["G", "B", "D"])
        assert r.score == 0.0
        assert set(r.missing_notes) == {"G", "B", "D"}

    def test_one_note_missing_from_three(self):
        # matched=2, expected=3 → raw=0.667, no extras
        r = evaluator._compare_notes(["G", "B"], ["G", "B", "D"])
        assert 0.5 <= r.score <= 0.85
        assert "D" in r.missing_notes

    def test_one_note_missing_from_four(self):
        # matched=3, expected=4 → raw=0.75, no extras
        r = evaluator._compare_notes(["A", "C", "E"], ["A", "C", "E", "G"])
        assert 0.5 <= r.score <= 0.85

    def test_extra_notes_reduce_score(self):
        # All notes matched + 2 extras
        r_clean = evaluator._compare_notes(["G", "B", "D"], ["G", "B", "D"])
        r_extra = evaluator._compare_notes(["G", "B", "D", "F", "A"], ["G", "B", "D"])
        assert r_extra.score < r_clean.score

    def test_extra_notes_cannot_go_below_zero(self):
        # 10 extras on a 2-note chord
        r = evaluator._compare_notes(
            ["C", "D", "E", "F", "G", "A", "B", "C#", "D#", "F#", "G#"],
            ["C", "E"],
        )
        assert r.score >= 0.0

    def test_wrong_chord_issue(self):
        r = evaluator._compare_notes(["F", "A", "C"], ["G", "B", "D"])
        assert r.issue == "wrong_chord"

    def test_muted_string_issue(self):
        r = evaluator._compare_notes(["G", "B"], ["G", "B", "D"])
        assert r.issue == "muted_string"

    def test_extra_notes_issue(self):
        r = evaluator._compare_notes(["G", "B", "D", "F#"], ["G", "B", "D"])
        assert r.issue == "extra_notes"
