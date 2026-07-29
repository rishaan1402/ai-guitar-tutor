"""
Generate data/chords/fingerings.json for all 84 lesson chords.

For each chord we build candidate voicings and keep the lowest on the neck:
  * the classic open shape where one exists (C, D, G, Dm, G7, B7, Fmaj7, ...)
  * movable shapes rooted on the 6th, 5th or 4th string (E-, A- and D-shape),
    which also yield the open E, A and Am-family chords at fret 0

`positions` is the voicing to teach first; `alt_positions` is the lowest
barre voicing, for players moving up the neck.

Every voicing must sound exactly the chord's notes (from the lesson
metadata). The scorer marks missing chord tones down, so a voicing that
drops a note (e.g. the common open C7, x32310, has no G) would score a
student 75% for playing the diagram perfectly. The script refuses to write
such a voicing.

Run from the repo root:  python3 scripts/generate_fingerings.py
Then regenerate the lesson videos, which draw these diagrams:
                         python3 scripts/generate_videos.py
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]

ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Open-string notes, string 6 (low E) to string 1 (high e)
TUNING = ["E", "A", "D", "G", "B", "E"]

X = None  # muted string

Frets = Sequence[Optional[int]]   # string 6..1; None = muted
Fingers = Sequence[Optional[int]]  # string 6..1; None = open or muted


def note_index(note: str) -> int:
    return ALL_NOTES.index(note)


def note_at(string_num: int, fret: int) -> str:
    return ALL_NOTES[(note_index(TUNING[6 - string_num]) + fret) % 12]


# ---------------------------------------------------------------------------
# Movable shapes: (root string, fret offsets from the root fret, fingers)
# Fingers assume a barre with finger 1 at the root fret.
# ---------------------------------------------------------------------------

MOVABLE: Dict[str, List[Tuple[int, Frets, Fingers]]] = {
    "major": [
        (6, [0, 2, 2, 1, 0, 0], [1, 3, 4, 2, 1, 1]),
        (5, [X, 0, 2, 2, 2, 0], [X, 1, 2, 3, 4, 1]),
    ],
    "minor": [
        (6, [0, 2, 2, 0, 0, 0], [1, 3, 4, 1, 1, 1]),
        (5, [X, 0, 2, 2, 1, 0], [X, 1, 3, 4, 2, 1]),
    ],
    "dominant7": [
        (6, [0, 2, 0, 1, 0, 0], [1, 3, 1, 2, 1, 1]),
        (5, [X, 0, 2, 0, 2, 0], [X, 1, 3, 1, 4, 1]),
    ],
    "major7": [
        (6, [0, 2, 1, 1, 0, 0], [1, 4, 2, 3, 1, 1]),
        (5, [X, 0, 2, 1, 2, 0], [X, 1, 3, 2, 4, 1]),
    ],
    "minor7": [
        (6, [0, 2, 0, 0, 0, 0], [1, 3, 1, 1, 1, 1]),
        (5, [X, 0, 2, 0, 1, 0], [X, 1, 3, 1, 2, 1]),
    ],
    "half_dim7": [
        (5, [X, 0, 1, 0, 1, X], [X, 2, 3, 1, 4, X]),
        (4, [X, X, 0, 1, 1, 1], [X, X, 1, 2, 3, 4]),
    ],
    "power": [
        (6, [0, 2, X, X, X, X], [1, 3, X, X, X, X]),
        (5, [X, 0, 2, X, X, X], [X, 1, 3, X, X, X]),
        (4, [X, X, 0, 2, X, X], [X, X, 1, 3, X, X]),
    ],
}

# ---------------------------------------------------------------------------
# Classic open shapes the movable ones don't produce
# ---------------------------------------------------------------------------

OPEN: Dict[str, Tuple[Frets, Fingers]] = {
    "C_major":     ([X, 3, 2, 0, 1, 0], [X, 3, 2, X, 1, X]),
    "C_major7":    ([X, 3, 2, 0, 0, 0], [X, 3, 2, X, X, X]),
    "D_major":     ([X, X, 0, 2, 3, 2], [X, X, X, 1, 3, 2]),
    "D_minor":     ([X, X, 0, 2, 3, 1], [X, X, X, 2, 3, 1]),
    "D_dominant7": ([X, X, 0, 2, 1, 2], [X, X, X, 2, 1, 3]),
    "D_major7":    ([X, X, 0, 2, 2, 2], [X, X, X, 1, 2, 3]),
    "D_minor7":    ([X, X, 0, 2, 1, 1], [X, X, X, 2, 1, 1]),
    "D_power":     ([X, X, 0, 2, 3, X], [X, X, X, 1, 3, X]),
    "G_major":     ([3, 2, 0, 0, 0, 3], [2, 1, X, X, X, 3]),
    "G_dominant7": ([3, 2, 0, 0, 0, 1], [3, 2, X, X, X, 1]),
    "G_major7":    ([3, 2, 0, 0, 0, 2], [3, 2, X, X, X, 1]),
    "B_dominant7": ([X, 2, 1, 2, 0, 2], [X, 2, 1, 3, X, 4]),
    "F_major7":    ([X, X, 3, 2, 1, 0], [X, X, 3, 2, 1, X]),
}


def movable_voicing(root: str, shape: Tuple[int, Frets, Fingers]) -> Tuple[List[Optional[int]], List[Optional[int]]]:
    root_string, offsets, fingers = shape
    base = (note_index(root) - note_index(TUNING[6 - root_string])) % 12
    frets = [None if o is None else base + o for o in offsets]
    fing: List[Optional[int]] = [
        None if (f is None or fr is None or fr == 0) else f for f, fr in zip(fingers, frets)
    ]
    # At fret 0 the barre finger becomes open strings; renumber from 1
    used = [f for f in fing if f is not None]
    if used and min(used) > 1:
        shift = min(used) - 1
        fing = [None if f is None else f - shift for f in fing]
    return frets, fing


def to_positions(frets: Frets, fingers: Fingers) -> List[Dict[str, Any]]:
    positions: List[Dict[str, Any]] = []
    for i, (fret, finger) in enumerate(zip(frets, fingers)):
        string_num = 6 - i
        if fret is None:
            positions.append({"string": string_num, "action": "mute"})
            continue
        pos: Dict[str, Any] = {"string": string_num, "fret": fret, "note": note_at(string_num, fret)}
        if fret > 0 and finger is not None:
            pos["finger"] = finger
        positions.append(pos)
    return positions


def sounded(frets: Frets) -> set[str]:
    return {note_at(6 - i, f) for i, f in enumerate(frets) if f is not None}


def check(chord: str, frets: Frets, notes: List[str]) -> None:
    got = sounded(frets)
    if got != set(notes):
        raise ValueError(f"{chord}: voicing {frets} sounds {sorted(got)}, chord is {sorted(notes)}")


def height(frets: Frets) -> int:
    return max(f for f in frets if f is not None)


def build_entry(meta: Dict[str, Any]) -> Dict[str, Any]:
    chord = meta["chord"]
    root = meta.get("root", chord.split("_")[0])
    quality = meta.get("quality", "major")
    notes = meta.get("notes", [])

    movable = [movable_voicing(root, s) for s in MOVABLE[quality]]
    for frets, _ in movable:
        check(chord, frets, notes)

    if chord in OPEN:
        primary = OPEN[chord]
        check(chord, primary[0], notes)
    else:
        primary = min(movable, key=lambda v: height(v[0]))

    # Lowest barre (no open strings) that differs from the primary voicing
    barres = [v for v in movable if 0 not in v[0] and list(v[0]) != list(primary[0])]
    alt = min(barres, key=lambda v: height(v[0])) if barres else None

    entry: Dict[str, Any] = {
        "chord": chord,
        "display_name": meta.get("display_name", chord),
        "root": root,
        "quality": quality,
        "notes": notes,
        "positions": to_positions(*primary),
    }
    if alt is not None:
        entry["alt_positions"] = to_positions(*alt)
    return entry


def generate_all_fingerings() -> List[Dict[str, Any]]:
    lessons_dir = PROJECT_ROOT / "data" / "lessons"
    entries = []
    for chord_dir in sorted(lessons_dir.iterdir()):
        meta_path = chord_dir / "metadata.json"
        if meta_path.exists():
            entries.append(build_entry(json.loads(meta_path.read_text())))
    return entries


def main() -> None:
    fingerings = generate_all_fingerings()
    out_path = PROJECT_ROOT / "data" / "chords" / "fingerings.json"
    out_path.write_text(json.dumps(fingerings, indent=2) + "\n")
    print(f"Generated fingerings for {len(fingerings)} chords -> {out_path}")


if __name__ == "__main__":
    main()
