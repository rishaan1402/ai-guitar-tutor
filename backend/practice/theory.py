"""Music theory for generated practice: chord symbols, keys, and what sounds good together."""
from __future__ import annotations

import re
from typing import Optional

NOTE_PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
           "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
QUALITY = {"": [0, 4, 7], "m": [0, 3, 7], "7": [0, 4, 7, 10], "maj7": [0, 4, 7, 11],
           "m7": [0, 3, 7, 10], "m7b5": [0, 3, 6, 10], "5": [0, 7]}
SYMBOL_RE = re.compile(r"^([A-G])([#b]?)(maj7|m7b5|m7|m|7|5)?$")

# Keys a beginner meets first, with their diatonic chords (no diminished).
KEYS: dict[str, list[str]] = {
    "G": ["G", "Am", "Bm", "C", "D", "Em"],
    "C": ["C", "Dm", "Em", "F", "G", "Am"],
    "D": ["D", "Em", "F#m", "G", "A", "Bm"],
    "A": ["A", "Bm", "C#m", "D", "E", "F#m"],
    "E": ["E", "F#m", "G#m", "A", "B", "C#m"],
    "F": ["F", "Gm", "Am", "A#", "C", "Dm"],
}
# Each key's chords also admit their dominant 7th and the usual 7th colours.
SEVENTHS = {"G": ["D7", "G7", "Em7", "Am7", "Cmaj7", "Gmaj7"], "C": ["G7", "C7", "Am7", "Dm7", "Fmaj7", "Cmaj7", "Em7"],
            "D": ["A7", "D7", "Em7", "Bm7", "Gmaj7", "Dmaj7"], "A": ["E7", "A7", "Bm7", "F#m7", "Dmaj7", "Amaj7"],
            "E": ["B7", "E7", "F#m7", "C#m7", "Amaj7", "Emaj7"], "F": ["C7", "F7", "Dm7", "Gm7", "Fmaj7"]}


def parse(symbol: str) -> Optional[tuple[str, str]]:
    m = SYMBOL_RE.match(symbol.strip())
    if not m:
        return None
    root = m.group(1) + (m.group(2) or "")
    if root not in NOTE_PC:
        return None
    return root, m.group(3) or ""


def normalise(symbol: str) -> Optional[str]:
    """'Bb' -> 'A#', 'Am' stays; anything we can't voice -> None."""
    p = parse(symbol)
    if not p:
        return None
    root, q = p
    return SHARP[NOTE_PC[root]] + q


def pcs(symbol: str) -> set[int]:
    p = parse(symbol)
    if not p:
        return set()
    r = NOTE_PC[p[0]]
    return {(r + i) % 12 for i in QUALITY[p[1]]}


def keys_for(chords: list[str]) -> list[str]:
    """Keys containing every chord (triads or their usual 7ths), best fit first."""
    out = []
    for k, triads in KEYS.items():
        pool = set(triads) | set(SEVENTHS.get(k, []))
        if all(c in pool for c in chords):
            out.append(k)
    return out


def chords_in_key(key: str) -> list[str]:
    return KEYS.get(key, []) + SEVENTHS.get(key, [])


def base(symbol: str) -> str:
    """Triad family: 'Am7' -> 'Am', 'Gmaj7' -> 'G', 'D7' -> 'D'."""
    p = parse(symbol)
    if not p:
        return symbol
    root, q = p
    return root + ("m" if q in ("m", "m7", "m7b5") else "")


def substitute(symbol: str, known: set[str]) -> str:
    """The closest chord the learner knows for `symbol` (itself if known or no good stand-in)."""
    if symbol in known:
        return symbol
    b = base(symbol)
    if b in known:
        return b
    target = pcs(symbol)
    best, overlap = symbol, 1
    for k in known:
        n = len(target & pcs(k))
        if n > overlap or (n == overlap and n >= 2 and best == symbol):
            best, overlap = k, n
    return best if overlap >= 2 else symbol
