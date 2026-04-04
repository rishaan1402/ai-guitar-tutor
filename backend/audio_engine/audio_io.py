"""Audio I/O utilities with format validation."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Tuple

import librosa
import numpy as np

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".wav", ".flac", ".ogg", ".mp3"}


class AudioFormatError(ValueError):
    """Raised when an unsupported audio format is encountered."""


def load_audio(path: Path, sr: int = 22050) -> Tuple[np.ndarray, int]:
    """
    Load an audio file with format validation.

    Raises AudioFormatError for unsupported formats (e.g. .webm, .mp4).
    """
    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise AudioFormatError(
            f"Unsupported audio format '{ext}'. "
            f"Expected one of: {', '.join(sorted(SUPPORTED_EXTENSIONS))}. "
            f"Browser must send WAV."
        )

    y, loaded_sr = librosa.load(str(path), sr=sr, mono=True)
    logger.info("Loaded audio: %s (%d samples, %d Hz)", path.name, len(y), loaded_sr)
    return y, loaded_sr
