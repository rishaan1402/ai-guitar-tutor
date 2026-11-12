"""Chord evaluator.

Pipeline: onset-gated analysis window -> high-resolution spectrum -> global tuning
estimate -> tuning-aligned log-frequency spectrum -> NNLS against harmonic note
templates -> harmonic explain-away -> pitch-class strengths -> target-aware decision.

Design notes (measured on ~500 real recordings + ~1100 stress variants):
* No semitone de-duplication: it made every maj7 chord impossible to pass and let
  superset chords (C7 played for C) pass as correct.
* Tuning is estimated from spectral peaks, so a guitar up to ~±40 cents out still
  maps to the right pitch classes; ``tuning_cents`` is reported to the caller.
* The input is peak-normalised, so quiet but clean recordings are graded.
* Borderline evidence yields issue="unclear" ("strum again") instead of a
  pass/fail guess; unclear takes are not recorded as attempts.
* Only <= MAX_SECONDS after the first loud, tonal onset is analysed, so cost is
  roughly constant regardless of how long the user recorded.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.optimize import nnls
from scipy.signal import get_window

from .audio_io import ANALYSIS_SR, AudioFormatError, load_audio

logger = logging.getLogger(__name__)

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_ALIASES = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#",
            "Cb": "B", "Fb": "E", "E#": "F", "B#": "C"}


@dataclass
class EvaluationResult:
    score: float
    detected_notes: List[str]
    expected_notes: List[str]
    missing_notes: List[str]
    extra_notes: List[str] = field(default_factory=list)
    issue: Optional[str] = None
    # Borderline notes behind an "unclear" verdict (quiet chord tones / faint extras).
    unclear_notes: List[str] = field(default_factory=list)
    # Diagnostics. confidence = weakest chord tone's relative strength (0-1);
    # tuning_cents = estimated global detune of the instrument.
    confidence: float = 0.0
    tuning_cents: float = 0.0
    pc_strength: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _pc(name: str) -> int:
    return NOTE_NAMES.index(_ALIASES.get(name, name))


class ChordEvaluator:
    # analysis range
    FMIN, FMAX = 55.0, 2500.0          # spectrum range used for peak picking
    MIDI_LO, MIDI_HI = 35, 88          # B1..E6: guitar fundamentals incl. drop tunings
    MAX_SECONDS = 2.0                  # analyse at most this much audio after the strum
    FLAT_MAX = 0.8                     # spectral flatness above this = noise, not a chord
    ONSET_FLAT_MAX = 0.7
    # onset must be followed by sustained sound: a click / key press / tap has big flux, no sustain
    SUS_THR = 0.1                      # flux peaks >= SUS_THR * max are scored for sustain
    SUS_REL = 0.5                      # sustained = 20th-pct RMS over SUS_S >= SUS_REL * best peak's
    SUS_S = 0.25
    TUNE_WRAP_CENTS = 35.0             # |tuning| beyond this may be the next semitone's -/+ (100-|t|)
    BPS = 3                            # log-frequency bins per semitone
    HARM_DECAY = 0.6                   # partial amplitude ratio in the note templates
    NNLS_HARM = 10
    PURE_HI = 52                       # pure-tone atoms (body/room resonances) up to E3
    # decision (gray zone tuned on held-out real recordings, critic round 2)
    P_LO, P_HI = 0.04, 0.12            # chord tone: < P_LO absent, >= P_HI present
    X_LO, X_HI = 0.12, 0.30            # non-chord pc: < X_LO clean, >= X_HI definite extra
    MIN_WIN_S = 0.5                    # shorter analysis windows can't PASS (only unclear)
    EXTRA_PENALTY = 0.25               # per extra note; a wrong chord can't look "green"

    _dict_cache: Dict[Tuple, np.ndarray] = {}

    def __init__(self, sr: int = ANALYSIS_SR, **_ignored: Any) -> None:
        self._sr = sr

    # ------------------------------------------------------------------ public API
    def evaluate(self, audio_path: str, expected_notes: List[str]) -> EvaluationResult:
        path = Path(audio_path)
        exp = list(expected_notes)
        if not path.is_file():
            return EvaluationResult(0.0, [], exp, exp, issue="missing_audio")
        try:
            strengths, info = self.analyse(path)
        except AudioFormatError as e:
            logger.error("Audio format error: %s", e)
            return EvaluationResult(0.0, [], exp, exp, issue="unsupported_format")
        except Exception:
            logger.exception("Failed to process audio: %s", audio_path)
            return EvaluationResult(0.0, [], exp, exp, issue="processing_error")
        res = self._decide(strengths, info, exp)
        t = float(info.get("tuning", 0.0))
        if strengths is not None and res.issue is not None and abs(t) > self.TUNE_WRAP_CENTS:
            # The tuning estimate is only known modulo a semitone: a guitar 60 c sharp reads as
            # 40 c flat of the chord a semitone up. If the target passes one semitone over, the
            # learner played the right shape on an out-of-tune guitar.
            k = -1 if t < 0 else 1
            alt = self._decide(np.roll(strengths, k), info, exp)
            if alt.issue is None:
                res.issue = "out_of_tune"
                res.score = min(res.score, 0.99)
                res.tuning_cents = round(t + 100.0 if t < 0 else t - 100.0, 1)
        return res

    # ------------------------------------------------------------------ analysis
    def analyse(self, path: Path) -> Tuple[Optional[np.ndarray], Dict[str, Any]]:
        y, sr = load_audio(path, sr=self._sr)
        info: Dict[str, Any] = {"sr": sr, "tuning": 0.0, "reason": None}
        if len(y) < sr * 0.15:
            info["reason"] = "too_short"
            return None, info
        y = y - np.mean(y)
        peak = float(np.max(np.abs(y)))
        if peak < 0.003:  # ~ -50 dBFS: nothing usable
            info["reason"] = "silent"
            return None, info
        y = y / peak

        seg = self._strum_window(y, sr, info)

        # long-window spectrum (~2.7 Hz bins) averaged over the analysis window
        nfft = 1 << int(np.ceil(np.log2(sr / 2.7)))
        if len(seg) < nfft:
            seg = np.pad(seg, (0, nfft - len(seg)))
        S = self._stft_mag(seg, nfft, nfft // 4)
        spec = np.sqrt(np.mean(S ** 2, axis=1))
        freqs = np.arange(len(spec)) * sr / nfft

        # tonalness gate (white/pink noise, hum-only)
        band = (freqs >= 80) & (freqs <= 2000)
        sb = spec[band] + 1e-12
        flat = float(np.exp(np.mean(np.log(sb))) / np.mean(sb))
        info["flatness"] = flat
        if flat > self.FLAT_MAX:
            info["reason"] = "noise"
            return None, info

        pf, pa = self._peaks(spec, freqs)
        if len(pf) < 2:
            info["reason"] = "no_peaks"
            return None, info

        # tuning: magnitude-weighted circular mean of peak deviations from 12-TET
        midi = 69 + 12 * np.log2(pf / 440.0)
        dev = midi - np.round(midi)
        ang = np.angle(np.sum((pa ** 2) * np.exp(2j * np.pi * dev)))
        tuning = float(ang / (2 * np.pi))  # semitones, [-0.5, 0.5)
        info["tuning"] = tuning * 100

        strengths = self._nnls(spec, freqs, tuning)
        if strengths.max() <= 0:
            info["reason"] = "no_pitch"
            return None, info
        return strengths / strengths.max(), info

    def _strum_window(self, y: np.ndarray, sr: int, info: Dict[str, Any]) -> np.ndarray:
        """Return <= MAX_SECONDS of audio starting just after the first loud, tonal onset."""
        hop = int(round(sr * 0.0116))
        nfs = 1 << int(np.ceil(np.log2(sr * 0.046)))
        S_short = self._stft_mag(y, nfs, hop)
        rms = np.sqrt(np.mean(S_short ** 2, axis=0)) + 1e-12
        logS = np.log1p(100 * S_short)
        flux = np.concatenate([[0.0], np.maximum(0, np.diff(logS, axis=1)).sum(axis=0)])

        on = 0
        if flux.max() > 0:
            lag = max(1, int(np.ceil(nfs / hop)))  # first frame lying wholly after the peak
            nsus = max(2, int(self.SUS_S * sr / hop))

            def sus(i: int) -> float:
                return float(np.percentile(rms[i + lag: i + lag + nsus], 20)) if i + lag < len(rms) else 0.0

            peaks = [i for i in range(len(flux)) if flux[i] >= self.SUS_THR * flux.max()
                     and flux[i] == flux[max(0, i - 2): i + 3].max()]
            best = max((sus(i) for i in peaks), default=0.0)
            sustained = [i for i in peaks if sus(i) >= self.SUS_REL * best]
            # flux threshold relative to the strongest SUSTAINED peak, not to a click
            thr = 0.35 * (max(flux[i] for i in sustained) if sustained else flux.max())
            cand = [i for i in range(len(flux))
                    if flux[i] >= thr and flux[i] == flux[max(0, i - 2): i + 3].max()]
            if sustained:
                cand = [i for i in cand if sus(i) >= self.SUS_REL * best]
            picked: List[int] = []
            for i in cand:
                if not picked or i - picked[-1] > int(0.1 * sr / hop):
                    picked.append(i)
            fs_ = np.arange(S_short.shape[0]) * sr / nfs
            bmask = (fs_ >= 80) & (fs_ <= 2000)
            chosen = None
            for i in picked:
                if rms[min(len(rms) - 1, i + 3)] < 0.1 * rms.max():
                    continue  # click / noise start, tiny relative to the loudest event
                seg_f = S_short[bmask, i + 2: i + 2 + int(0.5 * sr / hop)]
                if seg_f.shape[1] == 0:
                    continue
                m = seg_f.mean(axis=1) + 1e-12
                if float(np.exp(np.mean(np.log(m))) / np.mean(m)) < self.ONSET_FLAT_MAX:
                    chosen = i
                    while chosen > 0 and flux[chosen - 1] >= thr:
                        chosen -= 1  # back up to the rising edge
                    break
            if chosen is None and sustained:
                chosen = max(sustained, key=lambda i: flux[i])
            on = chosen if chosen is not None else int(np.argmax(flux))

        start = on + max(1, int(0.04 * sr / hop))  # skip ~40 ms pick transient
        loud = rms >= rms.max() * 10 ** (-35 / 20)
        end = start
        lim = start + int(self.MAX_SECONDS * sr / hop)
        while end < min(len(rms), lim) and loud[end]:
            end += 1
        if (end - start) * hop < 0.12 * sr:
            end = min(len(rms), start + int(0.12 * sr / hop) + 1)
        s0, s1 = start * hop, min(len(y), end * hop + nfs)
        info["window_s"] = (s0 / sr, s1 / sr)
        return y[s0:s1]

    @staticmethod
    def _stft_mag(y: np.ndarray, n_fft: int, hop: int) -> np.ndarray:
        if len(y) < n_fft:
            y = np.pad(y, (0, n_fft - len(y)))
        win = get_window("hann", n_fft).astype(np.float32)
        n = 1 + (len(y) - n_fft) // hop
        idx = np.arange(n_fft)[None, :] + hop * np.arange(n)[:, None]
        return np.abs(np.fft.rfft(y[idx] * win, axis=1)).T

    def _peaks(self, spec: np.ndarray, freqs: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        lo, hi = np.searchsorted(freqs, self.FMIN), np.searchsorted(freqs, self.FMAX)
        s = spec[lo:hi]
        k = max(3, int(40 / (freqs[1] - freqs[0])))
        floor = uniform_filter1d(minimum_filter1d(s, 2 * k + 1), 2 * k + 1) + 1e-9
        is_max = (s == maximum_filter1d(s, 3)) & (s > 3.0 * floor) & (s > s.max() * 10 ** (-50 / 20))
        idx = np.where(is_max)[0]
        idx = idx[(idx > 0) & (idx < len(s) - 1)]
        if len(idx) == 0:
            return np.array([]), np.array([])
        a, b, c = (np.log(s[idx - 1] + 1e-12), np.log(s[idx] + 1e-12), np.log(s[idx + 1] + 1e-12))
        den = a - 2 * b + c
        p = np.clip(np.where(np.abs(den) > 1e-12, 0.5 * (a - c) / den, 0.0), -0.5, 0.5)
        f = freqs[lo + idx] + p * (freqs[1] - freqs[0])
        amp = np.exp(b - 0.25 * (a - c) * p) - floor[idx]
        keep = amp > 0
        return f[keep], amp[keep]

    def _logspec(self, spec: np.ndarray, freqs: np.ndarray, tuning: float):
        """Linear magnitude spectrum -> tuning-aligned log-frequency spectrum."""
        lo_m = self.MIDI_LO - 1
        hi_m = min(self.MIDI_HI + 12 * np.log2(self.NNLS_HARM) + 1,
                   69 + 12 * np.log2((freqs[-1] * 0.95) / 440.0) - tuning)
        nb = int((hi_m - lo_m) * self.BPS)
        centers = lo_m + np.arange(nb) / self.BPS
        fm = np.full_like(freqs, -1e9)
        fm[1:] = 69 + 12 * np.log2(freqs[1:] / 440.0) - tuning
        pos = (fm - lo_m) * self.BPS
        ok = (pos >= 0) & (pos < nb - 1)
        i0 = np.floor(pos[ok]).astype(int)
        fr = pos[ok] - i0
        mag = spec[ok]
        L = np.zeros(nb)
        np.add.at(L, i0, mag * (1 - fr))
        np.add.at(L, i0 + 1, mag * fr)
        dens = np.zeros(nb)
        np.add.at(dens, i0, 1 - fr)
        np.add.at(dens, i0 + 1, fr)
        L = np.where(dens > 0, L / np.maximum(dens, 1e-9), 0)
        empty = dens == 0
        if empty.any() and (~empty).sum() > 2:
            L[empty] = np.interp(np.where(empty)[0], np.where(~empty)[0], L[~empty])
        return L, centers

    def _note_dict(self, centers: np.ndarray) -> np.ndarray:
        key = (len(centers), float(centers[0]), self.HARM_DECAY, self.NNLS_HARM, self.PURE_HI)
        D = self._dict_cache.get(key)
        if D is None:
            tri = lambda p: np.maximum(0, 1 - np.abs(centers - p) * self.BPS / 1.5)  # noqa: E731
            notes = np.arange(self.MIDI_LO, self.MIDI_HI + 1)
            D = np.zeros((len(centers), len(notes)))
            for j, m in enumerate(notes):
                for h in range(1, self.NNLS_HARM + 1):
                    p = m + 12 * np.log2(h)
                    if p > centers[-1]:
                        break
                    D[:, j] += self.HARM_DECAY ** (h - 1) * tri(p)
            # pure-tone atoms absorb isolated body/room resonances (no harmonics), so a
            # guitar's ~100 Hz air resonance is not reported as a G#2/A2 note
            pure = [tri(m) for m in np.arange(self.MIDI_LO - 4, self.PURE_HI + 1, 1.0 / self.BPS)]
            D = np.hstack([D, np.array(pure).T])
            self._dict_cache[key] = D
        return D

    def _nnls(self, spec: np.ndarray, freqs: np.ndarray, tuning: float) -> np.ndarray:
        L, centers = self._logspec(spec, freqs, tuning)
        mu = uniform_filter1d(L, 12 * self.BPS + 1, mode="nearest")  # local-mean whitening
        X = np.maximum(0.0, L - mu)
        if X.max() <= 0:
            return np.zeros(12)
        act, _ = nnls(self._note_dict(centers), X, maxiter=400)
        notes = np.arange(self.MIDI_LO, self.MIDI_HI + 1)
        act = act[: len(notes)].copy()
        # explain-away: a weaker note exactly on a non-octave harmonic (h3,h5,h6,h7,h9)
        # of a lower note is that note's partial, not a played string
        for j in range(len(act)):
            if act[j] <= 0:
                continue
            for iv in (19, 28, 31, 34, 38):
                k = j + iv
                if k < len(act) and 0 < act[k] < act[j]:
                    act[k] = 0.0
        strengths = np.zeros(12)
        np.add.at(strengths, notes % 12, act)
        return strengths

    # ------------------------------------------------------------------ decision
    def passes(self, pc_strength: Dict[str, float], notes: List[str]) -> bool:
        """Would these pitch-class strengths pass as ``notes``? (Used to name the
        chord a learner actually played.)"""
        if not pc_strength:
            return False
        strengths = np.array([pc_strength.get(n, 0.0) for n in NOTE_NAMES], dtype=float)
        return self._decide(strengths, {}, list(notes)).issue is None

    def _compare_notes(self, detected: List[str], expected: List[str]) -> EvaluationResult:
        """Score a detected pitch-class set against the expected chord (no audio)."""
        if not detected:
            exp = list(expected)
            return EvaluationResult(0.0, [], exp, exp, issue="no_sound")
        strengths = np.zeros(12)
        for n in detected:
            strengths[_pc(n)] = 1.0
        return self._decide(strengths, {}, list(expected))

    def _decide(self, strengths: Optional[np.ndarray], info: Dict[str, Any],
                exp: List[str]) -> EvaluationResult:
        """Three-way verdict: pass, unclear ("strum again"), or fail with an issue.

        Chord tone strength t and strongest non-chord strength x (relative to the
        loudest pitch class):
          fail     if any t < P_LO          or  x >= X_HI
          pass     if all t >= P_HI         and x <  X_LO  (and window >= MIN_WIN_S)
          unclear  otherwise — borderline evidence is never graded as right or wrong.
        """
        tuning = round(float(info.get("tuning", 0.0)), 1)
        if strengths is None:
            return EvaluationResult(0.0, [], exp, exp, issue="no_sound", tuning_cents=tuning)
        target = {_pc(n) for n in exp}
        non_target = [p for p in range(12) if p not in target]
        tmin = float(min(strengths[p] for p in target)) if target else 0.0
        xmax = float(max((strengths[p] for p in non_target), default=0.0))

        present = {p for p in target if strengths[p] >= self.P_HI}
        extra = {p for p in non_target if strengths[p] >= self.X_HI}
        missing = target - present
        raw = len(present) / len(target) if target else 0.0
        score = round(max(0.0, raw - self.EXTRA_PENALTY * len(extra)), 2)
        unclear_pcs: set = set()

        window = info.get("window_s")
        window_len = (window[1] - window[0]) if window else None
        short = window_len is not None and window_len < self.MIN_WIN_S

        if tmin < self.P_LO or xmax >= self.X_HI:
            if not present:
                issue = "wrong_chord"
            elif extra and not missing:
                issue = "extra_notes"
            elif missing and not extra:
                issue = "muted_string"
            else:
                issue = "missing_note"
            # wrong chord: most chord tones missing AND most energy outside the chord
            tgt_energy = strengths[list(target)].sum() / (strengths.sum() + 1e-9) if target else 0.0
            if issue != "wrong_chord" and tgt_energy < 0.4 and len(missing) >= len(target) / 2:
                issue = "wrong_chord"
        elif tmin >= self.P_HI and xmax < self.X_LO and not short:
            issue, score = None, 1.0
        else:
            issue = "unclear"
            score = min(score, 0.99)  # never reads as a pass
            unclear_pcs = {p for p in target if self.P_LO <= strengths[p] < self.P_HI}
            unclear_pcs |= {p for p in non_target if self.X_LO <= strengths[p] < self.X_HI}

        return EvaluationResult(
            score=score,
            detected_notes=[NOTE_NAMES[p] for p in sorted(present | extra)],
            expected_notes=exp,
            missing_notes=[n for n in exp if _pc(n) in missing],
            extra_notes=[NOTE_NAMES[p] for p in sorted(extra)],
            issue=issue,
            unclear_notes=[NOTE_NAMES[p] for p in sorted(unclear_pcs)],
            confidence=round(tmin, 3),
            tuning_cents=tuning,
            pc_strength={NOTE_NAMES[p]: round(float(strengths[p]), 3) for p in range(12)},
        )
