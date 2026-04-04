from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import librosa
import numpy as np
from scipy.signal import butter, find_peaks, sosfilt

from .audio_io import AudioFormatError, load_audio

logger = logging.getLogger(__name__)

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@dataclass
class EvaluationResult:
    score: float
    detected_notes: List[str]
    expected_notes: List[str]
    missing_notes: List[str]
    extra_notes: List[str] = field(default_factory=list)
    issue: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _hz_to_note_name(freq: float) -> str:
    if freq <= 0:
        return ""
    midi = librosa.hz_to_midi(freq)
    return NOTE_NAMES[int(round(midi)) % 12]


def _are_adjacent(a: str, b: str) -> bool:
    diff = abs(NOTE_NAMES.index(a) - NOTE_NAMES.index(b)) % 12
    return diff == 1 or diff == 11


class ChordEvaluator:
    """
    Dual detection (chromagram + FFT) with gap-based thresholding,
    semitone dedup, and extra-note penalty.
    """

    def __init__(
        self,
        sr: int = 22050,
        n_fft: int = 4096,
        hop_length: int = 512,
        min_frequency: float = 75.0,
        max_frequency: float = 1200.0,
        amplitude_threshold: float = 0.15,
        peak_prominence: float = 0.08,
        top_n_peaks: int = 6,
    ) -> None:
        self._sr = sr
        self._n_fft = n_fft
        self._hop_length = hop_length
        self._min_frequency = min_frequency
        self._max_frequency = max_frequency
        self._amplitude_threshold = amplitude_threshold
        self._peak_prominence = peak_prominence
        self._top_n_peaks = top_n_peaks

    def evaluate(self, audio_path: str, expected_notes: List[str]) -> EvaluationResult:
        path = Path(audio_path)
        if not path.is_file():
            return EvaluationResult(
                score=0.0, detected_notes=[], expected_notes=expected_notes,
                missing_notes=expected_notes, issue="missing_audio",
            )
        try:
            detected = self._detect_notes(path)
        except AudioFormatError as e:
            logger.error("Audio format error: %s", e)
            return EvaluationResult(
                score=0.0, detected_notes=[], expected_notes=expected_notes,
                missing_notes=expected_notes, issue="unsupported_format",
            )
        except Exception:
            logger.exception("Failed to process audio: %s", audio_path)
            return EvaluationResult(
                score=0.0, detected_notes=[], expected_notes=expected_notes,
                missing_notes=expected_notes, issue="processing_error",
            )
        return self._compare_notes(detected, expected_notes)

    # ------------------------------------------------------------------
    # Detection
    # ------------------------------------------------------------------

    def _detect_notes(self, audio_path: Path) -> List[str]:
        y, sr = load_audio(audio_path, sr=self._sr)

        y, _ = librosa.effects.trim(y, top_db=25)
        if len(y) == 0:
            return []

        rms = float(np.sqrt(np.mean(y ** 2)))
        peak = float(np.max(np.abs(y)))
        logger.info("Signal: rms=%.5f peak=%.5f", rms, peak)
        if rms < 0.003 or peak < 0.01:
            return []

        if not self._has_onset(y, sr):
            logger.info("No onset — rejecting")
            return []

        flatness = float(np.mean(librosa.feature.spectral_flatness(y=y, n_fft=self._n_fft)))
        logger.info("Flatness: %.5f", flatness)
        if flatness > 0.20:
            logger.info("Too flat — rejecting")
            return []

        # Normalize for chromagram (raw signal).
        y_norm = y / peak if peak > 1e-8 else y

        # Preprocess for FFT.
        y_clean = self._preprocess_audio(y, sr)
        if len(y_clean) == 0:
            return []
        pc = float(np.max(np.abs(y_clean)))
        if pc < 1e-8:
            return []
        y_fft = y_clean / pc

        # Chromagram with gap-based threshold.
        chroma = self._detect_chromagram(y_norm, sr)
        logger.info("Chroma: %s", chroma)

        # FFT peaks.
        fft = self._detect_fft(y_fft, sr)
        logger.info("FFT: %s", fft)

        # Merge.
        merged = self._merge(chroma, fft)
        logger.info("Merged: %s", merged)

        # Semitone dedup.
        detected = self._dedup_semitones(list(merged.keys()), merged)
        logger.info("Final: %s", detected)

        # Voice rejection.
        if len(detected) >= 3:
            freqs = [float(librosa.midi_to_hz(40 + NOTE_NAMES.index(n))) for n in detected]
            if self._is_harmonic_series(freqs):
                logger.info("Harmonic series — rejecting")
                return []

        return detected

    def _detect_chromagram(self, y: np.ndarray, sr: int) -> Dict[str, float]:
        """CQT chromagram with gap-based adaptive thresholding.

        Instead of using a fixed threshold relative to noise floor,
        finds the natural gap in the sorted energy distribution
        to separate signal notes from noise/bleed.
        """
        chromagram = librosa.feature.chroma_cqt(
            y=y, sr=sr, hop_length=self._hop_length,
            fmin=self._min_frequency, n_octaves=4,
        )
        chroma_energy = np.mean(chromagram, axis=1)

        mx = np.max(chroma_energy)
        if mx < 1e-8:
            return {}
        chroma_energy = chroma_energy / mx

        # Gap-based threshold: find biggest energy gap in sorted values.
        sorted_e = np.sort(chroma_energy)
        best_gap = 0.0
        best_idx = 6
        for i in range(3, 11):
            gap = sorted_e[i] - sorted_e[i - 1]
            if gap > best_gap:
                best_gap = gap
                best_idx = i

        threshold = (sorted_e[best_idx] + sorted_e[best_idx - 1]) / 2
        # Clamp to reasonable range.
        threshold = max(0.20, min(threshold, 0.50))

        logger.info("Chroma gap-threshold: %.3f (gap=%.3f at idx %d)", threshold, best_gap, best_idx)

        result = {}
        for i, e in enumerate(chroma_energy):
            if e >= threshold:
                result[NOTE_NAMES[i]] = float(e)
        return result

    def _detect_fft(self, y: np.ndarray, sr: int) -> Dict[str, float]:
        S = np.abs(librosa.stft(y, n_fft=self._n_fft, hop_length=self._hop_length))
        avg = np.mean(S, axis=1)

        freqs = librosa.fft_frequencies(sr=sr, n_fft=self._n_fft)
        mask = (freqs >= self._min_frequency) & (freqs <= self._max_frequency)
        freqs, avg = freqs[mask], avg[mask]

        if len(avg) == 0:
            return {}
        mx = np.max(avg)
        if mx < 1e-8:
            return {}
        avg = avg / mx

        nf = float(np.median(avg) + 2.0 * np.std(avg))
        threshold = max(self._amplitude_threshold, min(nf, 0.30))

        fr = self._sr / self._n_fft
        md = max(int(20.0 / fr), 1)

        peaks, _ = find_peaks(avg, height=threshold, distance=md, prominence=self._peak_prominence)
        if len(peaks) == 0:
            return {}

        note_amps: Dict[str, float] = {}
        for idx in peaks:
            n = _hz_to_note_name(freqs[idx])
            if n and (n not in note_amps or avg[idx] > note_amps[n]):
                note_amps[n] = float(avg[idx])

        top = sorted(note_amps, key=lambda x: note_amps[x], reverse=True)[:self._top_n_peaks]
        return {n: note_amps[n] for n in top}

    def _merge(
        self,
        chroma: Dict[str, float],
        fft: Dict[str, float],
    ) -> Dict[str, float]:
        """Merge: both agree → include. Single method → need strong evidence."""
        all_notes = set(chroma) | set(fft)
        result: Dict[str, float] = {}

        for note in all_notes:
            in_c = note in chroma
            in_f = note in fft
            cv = chroma.get(note, 0.0)
            fv = fft.get(note, 0.0)

            if in_c and in_f:
                result[note] = (cv + fv) / 2
            elif in_c and cv > 0.35:
                result[note] = cv
            elif in_f and fv > 0.28:
                result[note] = fv

        return result

    def _dedup_semitones(self, detected: List[str], strengths: Dict[str, float]) -> List[str]:
        if len(detected) <= 1:
            return sorted(detected)
        to_remove: Set[str] = set()
        for i, a in enumerate(detected):
            for b in detected[i + 1:]:
                if _are_adjacent(a, b):
                    weaker = a if strengths.get(a, 0) < strengths.get(b, 0) else b
                    to_remove.add(weaker)
        result = sorted(n for n in detected if n not in to_remove)
        if to_remove:
            logger.info("Dedup removed: %s", sorted(to_remove))
        return result

    def _has_onset(self, y: np.ndarray, sr: int) -> bool:
        env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=self._hop_length)
        if len(env) == 0:
            return False
        mx = float(np.max(env))
        mn = float(np.mean(env))
        ratio = mx / (mn + 1e-8)
        logger.info("Onset: max=%.3f mean=%.3f ratio=%.2f", mx, mn, ratio)
        return ratio > 2.0

    def _is_harmonic_series(self, peak_freqs: List[float]) -> bool:
        if len(peak_freqs) < 3:
            return False
        freqs = sorted(peak_freqs)
        f0 = freqs[0]
        if f0 < 50:
            return False
        hc = sum(
            1 for f in freqs[1:]
            if abs(f / f0 - round(f / f0)) / max(round(f / f0), 1) < 0.10
            and round(f / f0) >= 2
        )
        frac = hc / (len(freqs) - 1)
        logger.info("Harmonic: %d/%d (%.0f%%)", hc, len(freqs) - 1, frac * 100)
        return frac >= 0.70

    def _preprocess_audio(self, y: np.ndarray, sr: int) -> np.ndarray:
        nyquist = sr / 2.0
        low = self._min_frequency / nyquist
        high = min(self._max_frequency / nyquist, 0.99)
        if low < high:
            sos = butter(4, [low, high], btype="band", output="sos")
            y = sosfilt(sos, y).astype(np.float32)
        y_h, _ = librosa.effects.hpss(y)
        return y_h

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def _compare_notes(self, detected: List[str], expected: List[str]) -> EvaluationResult:
        d, e = set(detected), set(expected)
        missing = sorted(e - d)
        extra = sorted(d - e)
        matched = e & d

        raw = len(matched) / len(e) if e else 0.0
        score = round(max(0.0, raw - len(extra) * 0.08), 2)

        issue = self._determine_issue(missing, extra, expected, detected)
        return EvaluationResult(
            score=score, detected_notes=sorted(d),
            expected_notes=expected, missing_notes=missing,
            extra_notes=extra, issue=issue,
        )

    @staticmethod
    def _determine_issue(missing, extra, expected, detected):
        if not missing and not extra:
            return None
        if not detected:
            return "no_sound"
        if len(missing) == len(expected):
            return "wrong_chord"
        if extra and not missing:
            return "extra_notes"
        if missing and not extra:
            return "muted_string"
        if missing:
            return "missing_note"
        return None
