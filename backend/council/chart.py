"""Chord charts and section lessons built from a song's structured data.

The AI ingestion step returns the song's form and each section's chords bar
by bar. This module turns that into:

* a ChordPro chord chart (chords only, never lyrics), rendered by the app's
  song-sheet player with transpose, capo, simplify and autoscroll;
* one practice lesson per section: new chords, the changes to drill, and a
  slow-then-full tempo plan.

Everything here is deterministic; LLM output is sanitised token by token so a
malformed or malicious value can't inject ChordPro directives.
"""
from __future__ import annotations

import re
from typing import Iterable, Optional

from council.schemas import SectionChange, SectionLesson, SongObject
from lesson_service import known_chords

# A chord token: root, optional accidental, short quality, optional slash bass.
_CHORD = re.compile(r"^([A-G])([#b]?)([a-zA-Z0-9+#°ø()]{0,8})(?:/([A-G][#b]?))?$")
_FLAT_TO_SHARP = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#", "Cb": "B", "Fb": "E"}
_QUALITY_KEYS = [
    (re.compile(r"^(maj7|M7|major7)$"), "major7"),
    (re.compile(r"^(m7|min7|-7)$"), "minor7"),
    (re.compile(r"^(7|dom7)$"), "dominant7"),
    (re.compile(r"^(m7b5|ø|ø7|half_dim7)$"), "half_dim7"),
    (re.compile(r"^(m|min|-)$"), "minor"),
    (re.compile(r"^5$"), "power"),
    (re.compile(r"^(|maj|M)$"), "major"),
]
MAX_SECTIONS = 24
MAX_BARS = 64
BARS_PER_LINE = 4


def clean_chord(token: str) -> Optional[str]:
    """Return a valid chord symbol, or None for anything that isn't one."""
    t = token.strip()
    return t if _CHORD.match(t) else None


def chord_key_for(symbol: str) -> Optional[str]:
    """App lesson key for a chord symbol ("F#m" -> "F#_minor"), or None if we don't teach it."""
    m = _CHORD.match(symbol.strip())
    if not m:
        return None
    root = m.group(1) + m.group(2)
    root = _FLAT_TO_SHARP.get(root, root)
    quality = m.group(3)
    for pattern, key in _QUALITY_KEYS:
        if pattern.match(quality):
            candidate = f"{root}_{key}"
            return candidate if candidate in known_chords() else None
    return None


def _text(value: str, limit: int = 120) -> str:
    """Single-line metadata value safe inside a ChordPro directive."""
    return re.sub(r"[{}\[\]\r\n]+", " ", value or "").strip()[:limit]


def _key_symbol(key: str) -> str:
    """'G major' -> 'G', 'E minor' -> 'Em', 'Bb' -> 'Bb'."""
    k = _text(key, 20)
    m = re.match(r"^([A-G][#b]?)\s*(major|maj|minor|min|m)?\b", k, re.IGNORECASE)
    if not m:
        return ""
    minor = (m.group(2) or "").lower() in ("minor", "min", "m")
    return m.group(1) + ("m" if minor else "")


def _beats(time_signature: str) -> int:
    m = re.match(r"^\s*(\d{1,2})\s*/\s*\d{1,2}", time_signature or "")
    beats = int(m.group(1)) if m else 4
    return beats if 2 <= beats <= 12 else 4


def section_bars(section) -> list[list[str]]:
    """Clean bars for one pass of a section: each bar is 1+ chord symbols.

    Falls back to one bar per listed chord when the model gave no bars.
    """
    raw = section.bars or section.chords
    bars: list[list[str]] = []
    for bar in raw[:MAX_BARS]:
        chords = [c for c in (clean_chord(t) for t in str(bar).replace("|", " ").split()) if c]
        if chords:
            bars.append(chords[:4])
    return bars


def _bar_cells(chords: list[str], beats: int) -> str:
    """One bar as grid cells: ['G'] in 4/4 -> 'G . . .'; ['C','D'] -> 'C . D .'."""
    if len(chords) == 1:
        return " ".join([chords[0]] + ["."] * (beats - 1))
    if len(chords) == 2 and beats % 2 == 0:
        half = beats // 2
        return " ".join([chords[0]] + ["."] * (half - 1) + [chords[1]] + ["."] * (half - 1))
    return " ".join(chords)


def _form(song: SongObject) -> list:
    by_name = {s.name.strip().lower(): s for s in song.sections}
    order = [by_name[n.strip().lower()] for n in song.form if n.strip().lower() in by_name]
    return (order or list(song.sections))[:MAX_SECTIONS]


def build_chart(song: SongObject) -> str:
    """ChordPro chord chart for the whole song, in playing order."""
    beats = _beats(song.time_signature)
    out = [f"{{title: {_text(song.song_title)}}}"]
    if song.artist:
        out.append(f"{{artist: {_text(song.artist)}}}")
    key = _key_symbol(song.key)
    if key:
        out.append(f"{{key: {key}}}")
    if 0 < song.capo <= 11:
        out.append(f"{{capo: {song.capo}}}")
    if song.tempo_bpm and 30 <= song.tempo_bpm <= 260:
        out.append(f"{{tempo: {song.tempo_bpm}}}")
    if song.time_signature:
        out.append(f"{{time: {_text(song.time_signature, 8)}}}")
    out.append(f"{{difficulty: {_text(song.overall_difficulty, 20)}}}")
    strum = re.sub(r"[^DUdux\-\s]", "", song.strumming or "").strip()[:40]
    if strum:
        out.append(f"{{strumming: {strum}}}")

    form = _form(song)
    if len(form) > 1:
        out.append("{comment: Form: " + " → ".join(_text(s.name, 30) for s in form) + "}")

    seen: dict[str, int] = {}
    for section in form:
        bars = section_bars(section)
        if not bars:
            continue
        name = _text(section.name, 30) or "Section"
        seen[name] = seen.get(name, 0) + 1
        label = name if seen[name] == 1 else f"{name} {seen[name]}"
        out.append("")
        out.append(f"{{start_of_grid: {label}}}")
        for i in range(0, len(bars), BARS_PER_LINE):
            row = bars[i:i + BARS_PER_LINE]
            out.append("| " + " | ".join(_bar_cells(b, beats) for b in row) + " |")
        if section.repeat and 1 < section.repeat <= 8:
            out.append(f"{{comment: Play {section.repeat}×}}")
        out.append("{end_of_grid}")
    return "\n".join(out) + "\n"


def _distinct(items: Iterable[str]) -> list[str]:
    seen: list[str] = []
    for i in items:
        if i not in seen:
            seen.append(i)
    return seen


def build_section_lessons(song: SongObject) -> list[SectionLesson]:
    """One lesson per distinct section, in order of first appearance."""
    lessons: list[SectionLesson] = []
    learned: set[str] = set()
    done: set[str] = set()
    tempo = song.tempo_bpm if song.tempo_bpm and 30 <= song.tempo_bpm <= 260 else None
    start = max(50, round(tempo * 0.6 / 5) * 5) if tempo else None
    strum = re.sub(r"[^DUdux\-\s]", "", song.strumming or "").strip()[:40]

    for section in _form(song):
        key = section.name.strip().lower()
        if key in done:
            continue
        done.add(key)
        bars = section_bars(section)
        if not bars:
            continue
        flat = [c for bar in bars for c in bar]
        chords = _distinct(flat)
        new = [c for c in chords if c not in learned]
        learned.update(chords)

        # changes in playing order, wrapping round when the section repeats
        sequence = flat + ([flat[0]] if (section.repeat or 1) > 1 and len(flat) > 1 else [])
        pairs: list[tuple[str, str]] = []
        for a, b in zip(sequence, sequence[1:]):
            if a != b and (a, b) not in pairs and (b, a) not in pairs:
                pairs.append((a, b))
        changes = [SectionChange(from_symbol=a, to_symbol=b,
                                 from_key=chord_key_for(a), to_key=chord_key_for(b))
                   for a, b in pairs[:6]]

        steps: list[str] = []
        if new:
            steps.append(f"Learn the new chord{'s' if len(new) > 1 else ''}: {', '.join(new)}.")
        if changes:
            steps.append("Drill the changes for a minute each: "
                         + ", ".join(f"{c.from_symbol} → {c.to_symbol}" for c in changes) + ".")
        if strum:
            steps.append(f"Strum each chord with the pattern {strum}.")
        if start and tempo:
            steps.append(f"Play the section from the chart at {start} bpm, then build up to {tempo} bpm.")
        else:
            steps.append("Play the section from the chart slowly, then build up to the song's tempo.")

        lessons.append(SectionLesson(
            name=_text(section.name, 30) or "Section",
            bars=[" ".join(b) for b in bars],
            repeat=section.repeat if section.repeat and 1 <= section.repeat <= 8 else 1,
            chords=chords,
            new_chords=new,
            chord_keys={c: chord_key_for(c) for c in chords},
            changes=changes,
            start_bpm=start,
            target_bpm=tempo,
            steps=steps,
        ))
    return lessons
