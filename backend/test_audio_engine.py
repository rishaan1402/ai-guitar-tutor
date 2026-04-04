"""Tests for the Audio Evaluation Engine."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audio_engine import ChordEvaluator


def _generate_chord_wav(
    frequencies: list[float], duration: float = 1.0, sr: int = 22050,
    noise_level: float = 0.0,
) -> str:
    """Generate a synthetic WAV file with the given frequencies and optional noise."""
    import soundfile as sf

    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    signal = np.zeros_like(t)
    for freq in frequencies:
        signal += 0.3 * np.sin(2 * np.pi * freq * t)

    if noise_level > 0:
        noise = noise_level * np.random.randn(len(t))
        signal = signal + noise

    signal = signal / (np.max(np.abs(signal)) + 1e-8)

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(tmp.name, signal.astype(np.float32), sr)
    return tmp.name


def test_evaluate_missing_file() -> None:
    evaluator = ChordEvaluator()
    result = evaluator.evaluate("/nonexistent/audio.wav", ["G", "B", "D"])
    assert result.score == 0.0
    assert result.issue == "missing_audio"
    print("PASS: test_evaluate_missing_file")


def test_evaluate_unsupported_format() -> None:
    """A .webm file should return unsupported_format issue."""
    tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
    tmp.write(b"fake webm data")
    tmp.close()

    evaluator = ChordEvaluator()
    result = evaluator.evaluate(tmp.name, ["G", "B", "D"])
    assert result.issue == "unsupported_format"
    Path(tmp.name).unlink(missing_ok=True)
    print("PASS: test_evaluate_unsupported_format")


def test_evaluate_silent_audio() -> None:
    """An empty/silent file should return low score."""
    import soundfile as sf
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(tmp.name, np.zeros(22050, dtype=np.float32), 22050)

    evaluator = ChordEvaluator()
    result = evaluator.evaluate(tmp.name, ["G", "B", "D"])
    assert result.score <= 0.5
    Path(tmp.name).unlink(missing_ok=True)
    print("PASS: test_evaluate_silent_audio")


def test_evaluate_synthetic_chord() -> None:
    """A clean synthetic G chord should detect the right notes."""
    wav_path = _generate_chord_wav([196.0, 246.94, 293.66])
    evaluator = ChordEvaluator()
    result = evaluator.evaluate(wav_path, ["G", "B", "D"])

    print(f"  Score: {result.score}")
    print(f"  Detected: {result.detected_notes}")
    print(f"  Missing: {result.missing_notes}")
    print(f"  Extra: {result.extra_notes}")

    assert result.score >= 0.67, f"Expected score >= 0.67, got {result.score}"
    Path(wav_path).unlink(missing_ok=True)
    print("PASS: test_evaluate_synthetic_chord")


def test_evaluate_noisy_chord_mild() -> None:
    """G chord with mild noise (SNR ~10dB) should still detect most notes."""
    wav_path = _generate_chord_wav([196.0, 246.94, 293.66], noise_level=0.1)
    evaluator = ChordEvaluator()
    result = evaluator.evaluate(wav_path, ["G", "B", "D"])

    print(f"  Score (mild noise): {result.score}")
    print(f"  Detected: {result.detected_notes}")

    assert result.score >= 0.33, f"Expected score >= 0.33 with mild noise, got {result.score}"
    Path(wav_path).unlink(missing_ok=True)
    print("PASS: test_evaluate_noisy_chord_mild")


def test_evaluate_noisy_chord_heavy() -> None:
    """G chord with heavy noise — evaluator should handle gracefully."""
    wav_path = _generate_chord_wav([196.0, 246.94, 293.66], noise_level=0.5)
    evaluator = ChordEvaluator()
    result = evaluator.evaluate(wav_path, ["G", "B", "D"])

    print(f"  Score (heavy noise): {result.score}")
    print(f"  Detected: {result.detected_notes}")

    # Should not crash; score may be low but that's expected.
    assert isinstance(result.score, float)
    Path(wav_path).unlink(missing_ok=True)
    print("PASS: test_evaluate_noisy_chord_heavy")


def test_evaluate_with_hum() -> None:
    """Chord + 60Hz electrical hum — bandpass should filter it out."""
    # G chord frequencies + 60Hz hum
    wav_path = _generate_chord_wav([60.0, 196.0, 246.94, 293.66])
    evaluator = ChordEvaluator()
    result = evaluator.evaluate(wav_path, ["G", "B", "D"])

    print(f"  Score (with hum): {result.score}")
    print(f"  Detected: {result.detected_notes}")

    # 60Hz should be filtered by the 75Hz bandpass
    assert result.score >= 0.33
    Path(wav_path).unlink(missing_ok=True)
    print("PASS: test_evaluate_with_hum")


def test_result_to_dict() -> None:
    evaluator = ChordEvaluator()
    result = evaluator.evaluate("/nonexistent.wav", ["C", "E", "G"])
    d = result.to_dict()
    assert isinstance(d, dict)
    assert "score" in d and "detected_notes" in d and "missing_notes" in d
    print("PASS: test_result_to_dict")


def test_real_reference_audio() -> None:
    """Test against actual extracted reference audio if available."""
    ref_path = Path(__file__).resolve().parents[1] / "data" / "lessons" / "G_major" / "reference.wav"
    if not ref_path.exists():
        print("SKIP: test_real_reference_audio (no reference file)")
        return

    evaluator = ChordEvaluator()
    result = evaluator.evaluate(str(ref_path), ["G", "B", "D"])

    print(f"  Score (real audio): {result.score}")
    print(f"  Detected: {result.detected_notes}")
    print(f"  Missing: {result.missing_notes}")

    assert result.score >= 0.67, f"Expected >= 0.67 on real audio, got {result.score}"
    print("PASS: test_real_reference_audio")


if __name__ == "__main__":
    test_evaluate_missing_file()
    test_evaluate_unsupported_format()
    test_evaluate_silent_audio()
    test_evaluate_synthetic_chord()
    test_evaluate_noisy_chord_mild()
    test_evaluate_noisy_chord_heavy()
    test_evaluate_with_hum()
    test_result_to_dict()
    test_real_reference_audio()
    print("\nAll audio engine tests passed!")
