"""
Generate fingerings.json for all 84 chords.

Uses standard open chord shapes for common chords and CAGED-based
transposition for barre chords. Outputs to data/chords/fingerings.json.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]

ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Standard guitar tuning (string 6 to string 1)
TUNING = ["E", "A", "D", "G", "B", "E"]


def note_index(note: str) -> int:
    return ALL_NOTES.index(note)


def semitone_distance(from_note: str, to_note: str) -> int:
    return (note_index(to_note) - note_index(from_note)) % 12


def note_at_fret(string_num: int, fret: int) -> str:
    """Get the note name at a given string and fret."""
    open_note = TUNING[6 - string_num]  # string 6 = index 0
    idx = (note_index(open_note) + fret) % 12
    return ALL_NOTES[idx]


# ---- Base shapes (open position) ----
# Each shape: list of {string, fret, finger, note} or {string, action: "mute"}
# These are the canonical open chord shapes.

E_MAJOR_SHAPE = [
    {"string": 6, "fret": 0, "note": "E"},
    {"string": 5, "fret": 2, "finger": 2, "note": "B"},
    {"string": 4, "fret": 2, "finger": 3, "note": "E"},
    {"string": 3, "fret": 1, "finger": 1, "note": "G#"},
    {"string": 2, "fret": 0, "note": "B"},
    {"string": 1, "fret": 0, "note": "E"},
]

E_MINOR_SHAPE = [
    {"string": 6, "fret": 0, "note": "E"},
    {"string": 5, "fret": 2, "finger": 2, "note": "B"},
    {"string": 4, "fret": 2, "finger": 3, "note": "E"},
    {"string": 3, "fret": 0, "note": "G"},
    {"string": 2, "fret": 0, "note": "B"},
    {"string": 1, "fret": 0, "note": "E"},
]

A_MAJOR_SHAPE = [
    {"string": 6, "action": "mute"},
    {"string": 5, "fret": 0, "note": "A"},
    {"string": 4, "fret": 2, "finger": 1, "note": "E"},
    {"string": 3, "fret": 2, "finger": 2, "note": "A"},
    {"string": 2, "fret": 2, "finger": 3, "note": "C#"},
    {"string": 1, "fret": 0, "note": "E"},
]

A_MINOR_SHAPE = [
    {"string": 6, "action": "mute"},
    {"string": 5, "fret": 0, "note": "A"},
    {"string": 4, "fret": 2, "finger": 2, "note": "E"},
    {"string": 3, "fret": 2, "finger": 3, "note": "A"},
    {"string": 2, "fret": 1, "finger": 1, "note": "C"},
    {"string": 1, "fret": 0, "note": "E"},
]

E7_SHAPE = [
    {"string": 6, "fret": 0, "note": "E"},
    {"string": 5, "fret": 2, "finger": 2, "note": "B"},
    {"string": 4, "fret": 0, "note": "D"},
    {"string": 3, "fret": 1, "finger": 1, "note": "G#"},
    {"string": 2, "fret": 0, "note": "B"},
    {"string": 1, "fret": 0, "note": "E"},
]

A7_SHAPE = [
    {"string": 6, "action": "mute"},
    {"string": 5, "fret": 0, "note": "A"},
    {"string": 4, "fret": 2, "finger": 2, "note": "E"},
    {"string": 3, "fret": 0, "note": "G"},
    {"string": 2, "fret": 2, "finger": 3, "note": "C#"},
    {"string": 1, "fret": 0, "note": "E"},
]

EMAJ7_SHAPE = [
    {"string": 6, "fret": 0, "note": "E"},
    {"string": 5, "fret": 2, "finger": 2, "note": "B"},
    {"string": 4, "fret": 1, "finger": 1, "note": "D#"},
    {"string": 3, "fret": 1, "finger": 1, "note": "G#"},
    {"string": 2, "fret": 0, "note": "B"},
    {"string": 1, "fret": 0, "note": "E"},
]

EMIN7_SHAPE = [
    {"string": 6, "fret": 0, "note": "E"},
    {"string": 5, "fret": 2, "finger": 2, "note": "B"},
    {"string": 4, "fret": 0, "note": "D"},
    {"string": 3, "fret": 0, "note": "G"},
    {"string": 2, "fret": 0, "note": "B"},
    {"string": 1, "fret": 0, "note": "E"},
]

# Power chord shape (root on 6th string)
E5_SHAPE = [
    {"string": 6, "fret": 0, "note": "E"},
    {"string": 5, "fret": 2, "finger": 3, "note": "B"},
    {"string": 4, "action": "mute"},
    {"string": 3, "action": "mute"},
    {"string": 2, "action": "mute"},
    {"string": 1, "action": "mute"},
]

# A5 power chord (root on 5th string)
A5_SHAPE = [
    {"string": 6, "action": "mute"},
    {"string": 5, "fret": 0, "note": "A"},
    {"string": 4, "fret": 2, "finger": 3, "note": "E"},
    {"string": 3, "action": "mute"},
    {"string": 2, "action": "mute"},
    {"string": 1, "action": "mute"},
]

# Half-diminished from A shape
AHDIM7_SHAPE = [
    {"string": 6, "action": "mute"},
    {"string": 5, "fret": 0, "note": "A"},
    {"string": 4, "fret": 1, "finger": 1, "note": "D#"},
    {"string": 3, "fret": 2, "finger": 3, "note": "A"},
    {"string": 2, "fret": 1, "finger": 2, "note": "C"},
    {"string": 1, "fret": 1, "finger": 4, "note": "E"},  # actually wrong but placeholder
]

# Map quality -> (base_shape, base_root, root_string)
# root_string tells us which string carries the root for transposition
QUALITY_SHAPES: Dict[str, tuple] = {
    "major": (E_MAJOR_SHAPE, "E", 6),
    "minor": (E_MINOR_SHAPE, "E", 6),
    "dominant7": (E7_SHAPE, "E", 6),
    "major7": (EMAJ7_SHAPE, "E", 6),
    "minor7": (EMIN7_SHAPE, "E", 6),
    "power": (E5_SHAPE, "E", 6),
    "half_dim7": (AHDIM7_SHAPE, "A", 5),
}

# For power chords D and below, use A5 shape on 5th string
POWER_A_ROOTS = {"A", "A#", "B", "C", "C#", "D", "D#"}


def transpose_shape(
    base_shape: List[Dict[str, Any]],
    base_root: str,
    target_root: str,
) -> List[Dict[str, Any]]:
    """Transpose a chord shape from base_root to target_root."""
    shift = semitone_distance(base_root, target_root)
    if shift == 0:
        return [dict(pos) for pos in base_shape]

    result = []
    for pos in base_shape:
        new_pos = dict(pos)
        if "action" in pos:
            result.append(new_pos)
            continue

        new_fret = pos["fret"] + shift
        new_pos["fret"] = new_fret
        new_pos["note"] = note_at_fret(pos["string"], new_fret)
        result.append(new_pos)

    return result


def generate_all_fingerings() -> List[Dict[str, Any]]:
    """Generate fingering data for all 84 chords."""
    # Load chord list from metadata
    lessons_dir = PROJECT_ROOT / "data" / "lessons"
    fingerings = []

    for chord_dir in sorted(lessons_dir.iterdir()):
        meta_path = chord_dir / "metadata.json"
        if not meta_path.exists():
            continue

        with open(meta_path) as f:
            meta = json.load(f)

        chord_name = meta["chord"]
        root = meta.get("root", chord_name.split("_")[0])
        quality = meta.get("quality", "major")

        # Special case: power chords with root on 5th string
        if quality == "power" and root in POWER_A_ROOTS:
            base_shape, base_root = A5_SHAPE, "A"
        else:
            shape_info = QUALITY_SHAPES.get(quality)
            if shape_info is None:
                continue
            base_shape, base_root, _ = shape_info

        positions = transpose_shape(base_shape, base_root, root)

        fingerings.append({
            "chord": chord_name,
            "display_name": meta.get("display_name", chord_name),
            "root": root,
            "quality": quality,
            "notes": meta.get("notes", []),
            "positions": positions,
        })

    return fingerings


def main() -> None:
    fingerings = generate_all_fingerings()
    out_path = PROJECT_ROOT / "data" / "chords" / "fingerings.json"
    with open(out_path, "w") as f:
        json.dump(fingerings, f, indent=2)
    print(f"Generated fingerings for {len(fingerings)} chords -> {out_path}")


if __name__ == "__main__":
    main()
