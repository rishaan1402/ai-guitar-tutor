"""Audio I/O utilities with format validation."""
from __future__ import annotations

import logging
from math import gcd
from pathlib import Path
from typing import Tuple

import numpy as np
from scipy.signal import resample_poly

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".wav", ".flac", ".ogg", ".mp3"}
ANALYSIS_SR = 22050
MAX_SECONDS = 15.0          # never decode more than this from any upload
MIN_SR, MAX_SR = 8000, 192000


class AudioFormatError(ValueError):
    """Raised when an unsupported audio format is encountered."""


def load_audio(path: Path, sr: int = ANALYSIS_SR) -> Tuple[np.ndarray, int]:
    """
    Load an audio file as mono float32, resampled to ``sr``.

    The file's *own* header sample rate is honoured (a 48 kHz browser capture is
    resampled, not misread), so every input is analysed at the same resolution.
    Raises AudioFormatError for unsupported formats (e.g. .webm, .mp4).
    """
    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise AudioFormatError(
            f"Unsupported audio format '{ext}'. "
            f"Expected one of: {', '.join(sorted(SUPPORTED_EXTENSIONS))}. "
            f"Browser must send WAV."
        )
    import soundfile as sf

    try:
        info = sf.info(str(path))
    except Exception:
        info = None  # mp3 on older libsndfile builds: fall through to librosa
    if info is not None:
        if not MIN_SR <= info.samplerate <= MAX_SR:
            raise AudioFormatError(f"Unsupported sample rate {info.samplerate} Hz.")
        # Decode at most MAX_SECONDS: compressed formats (FLAC/OGG) can pack
        # hours of audio into a small upload, so never decode the whole file.
        frames = min(info.frames, int(MAX_SECONDS * info.samplerate))
        y, native_sr = sf.read(str(path), frames=frames, dtype="float32", always_2d=True)
        y = y.mean(axis=1)
    else:
        import librosa

        y, native_sr = librosa.load(str(path), sr=None, mono=True, duration=MAX_SECONDS)
        if not MIN_SR <= native_sr <= MAX_SR:
            raise AudioFormatError(f"Unsupported sample rate {native_sr} Hz.")
    y = np.ascontiguousarray(y, dtype=np.float32)
    native_sr = int(native_sr)
    if native_sr != sr:
        g = gcd(native_sr, sr)
        y = resample_poly(y, sr // g, native_sr // g).astype(np.float32)
    logger.info("Loaded audio: %s (%d samples, %d Hz native)", path.name, len(y), native_sr)
    return y, sr
