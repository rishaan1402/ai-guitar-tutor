"""
Extract individual chord audio segments from the guitar dataset.

Reads the annotation .lab file, slices the WAV files by time range,
and creates lesson directories under data/lessons/ with reference.wav
and metadata.json for each chord.

Uses the cleanest acoustic guitar tone as the primary reference.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple

import librosa
import numpy as np
import soundfile as sf

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GUITAR_DIR = PROJECT_ROOT / "guitar"
LESSONS_DIR = PROJECT_ROOT / "data" / "lessons"
ANNOTATION_FILE = GUITAR_DIR / "guitar_annotation.lab"

# Use acoustic guitar as reference (cleanest tone for chord detection).
REFERENCE_WAV = GUITAR_DIR / "garageband_guitar_Acoustic_Guitar.wav"

# Standard note names for building chord note lists.
ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Interval definitions (semitones from root) for each chord quality.
QUALITY_INTERVALS: Dict[str, List[int]] = {
    "maj": [0, 4, 7],           # major
    "min": [0, 3, 7],           # minor
    "7": [0, 4, 7, 10],         # dominant 7th
    "maj7": [0, 4, 7, 11],      # major 7th
    "min7": [0, 3, 7, 10],      # minor 7th
    "5": [0, 7],                # power chord
    "hdim7": [0, 3, 6, 10],     # half-diminished 7th
}

QUALITY_DISPLAY: Dict[str, str] = {
    "maj": "major",
    "min": "minor",
    "7": "dominant7",
    "maj7": "major7",
    "min7": "minor7",
    "5": "power",
    "hdim7": "half_dim7",
}

DIFFICULTY_MAP: Dict[str, str] = {
    "maj": "beginner",
    "min": "beginner",
    "7": "intermediate",
    "maj7": "intermediate",
    "min7": "intermediate",
    "5": "beginner",
    "hdim7": "advanced",
}


def get_notes_for_chord(root: str, quality: str) -> List[str]:
    """Compute the note names for a chord given root and quality."""
    root_idx = ALL_NOTES.index(root)
    intervals = QUALITY_INTERVALS.get(quality, [0, 4, 7])
    return [ALL_NOTES[(root_idx + i) % 12] for i in intervals]


def chord_dir_name(root: str, quality: str) -> str:
    """Convert annotation chord name to directory name. E.g. E:maj -> E_major."""
    display = QUALITY_DISPLAY.get(quality, quality)
    return f"{root}_{display}"


def parse_annotations(annotation_path: Path) -> List[Tuple[float, float, str, str]]:
    """
    Parse the .lab annotation file.

    Returns list of (start_time, end_time, root_note, quality).
    """
    entries: List[Tuple[float, float, str, str]] = []
    with open(annotation_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 3:
                continue
            start = float(parts[0])
            end = float(parts[1])
            chord_label = parts[2]

            if ":" not in chord_label:
                continue

            root, quality = chord_label.split(":", 1)
            entries.append((start, end, root, quality))

    return entries


def extract_and_save(
    wav_path: Path,
    annotations: List[Tuple[float, float, str, str]],
    output_dir: Path,
    sr: int = 22050,
) -> Dict[str, str]:
    """
    Extract chord segments from WAV and save as individual lesson directories.

    For each unique chord, picks the first occurrence (longest clean segment).
    Returns a mapping of chord_dir_name -> status.
    """
    print(f"Loading audio: {wav_path.name} ...")
    y, loaded_sr = librosa.load(str(wav_path), sr=sr, mono=True)
    print(f"  Loaded {len(y)} samples at {loaded_sr} Hz ({len(y)/loaded_sr:.1f}s)")

    # Group annotations by chord, take first occurrence for each unique chord.
    seen: Dict[str, Tuple[float, float, str, str]] = {}
    for start, end, root, quality in annotations:
        dir_name = chord_dir_name(root, quality)
        if dir_name not in seen:
            seen[dir_name] = (start, end, root, quality)

    results: Dict[str, str] = {}

    for dir_name, (start, end, root, quality) in sorted(seen.items()):
        lesson_dir = output_dir / dir_name
        lesson_dir.mkdir(parents=True, exist_ok=True)

        # Extract audio segment.
        start_sample = int(start * sr)
        end_sample = int(end * sr)
        segment = y[start_sample:end_sample]

        if len(segment) == 0:
            results[dir_name] = "skipped (empty segment)"
            continue

        # Save reference audio.
        ref_path = lesson_dir / "reference.wav"
        sf.write(str(ref_path), segment, sr)

        # Create metadata.
        notes = get_notes_for_chord(root, quality)
        metadata: Dict[str, Any] = {
            "chord": dir_name,
            "display_name": f"{root}{'' if quality == 'maj' else quality}",
            "root": root,
            "quality": QUALITY_DISPLAY.get(quality, quality),
            "notes": notes,
            "difficulty": DIFFICULTY_MAP.get(quality, "intermediate"),
            "source": wav_path.name,
            "time_range": [start, end],
        }

        meta_path = lesson_dir / "metadata.json"
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

        # Create a placeholder lesson.mp4 if it doesn't exist.
        mp4_path = lesson_dir / "lesson.mp4"
        if not mp4_path.exists():
            mp4_path.touch()

        results[dir_name] = "ok"

    return results


def main() -> None:
    if not ANNOTATION_FILE.exists():
        print(f"ERROR: Annotation file not found: {ANNOTATION_FILE}")
        return

    if not REFERENCE_WAV.exists():
        print(f"ERROR: Reference WAV not found: {REFERENCE_WAV}")
        # Try any available WAV.
        wavs = list(GUITAR_DIR.glob("*.wav"))
        if not wavs:
            print("No WAV files found in guitar/")
            return
        print(f"  Using fallback: {wavs[0].name}")
        ref_wav = wavs[0]
    else:
        ref_wav = REFERENCE_WAV

    annotations = parse_annotations(ANNOTATION_FILE)
    print(f"Parsed {len(annotations)} annotation entries")

    unique_chords = set(chord_dir_name(r, q) for _, _, r, q in annotations)
    print(f"Unique chords: {len(unique_chords)}")

    results = extract_and_save(ref_wav, annotations, LESSONS_DIR)

    ok_count = sum(1 for v in results.values() if v == "ok")
    print(f"\nExtracted {ok_count}/{len(results)} chord lessons to {LESSONS_DIR}")
    for name, status in sorted(results.items()):
        print(f"  {name}: {status}")


if __name__ == "__main__":
    main()
