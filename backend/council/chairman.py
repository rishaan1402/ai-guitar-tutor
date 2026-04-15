from __future__ import annotations

import json
import logging
import re
import uuid
from pathlib import Path
from typing import Optional

from council.schemas import SongObject, AgentOutput, LessonDocument, PracticeChord
from council.agents import _CHAIRMAN_PROMPT
from feedback_engine.generator import _get_gemini_model

logger = logging.getLogger(__name__)

# Path to chord definitions — loaded once at module level
_CHORD_DEFS_PATH = Path(__file__).resolve().parents[2] / "data" / "chords" / "chord_definations.json"
_chord_defs: Optional[list[dict]] = None


def _load_chord_defs() -> list[dict]:
    global _chord_defs
    if _chord_defs is None:
        with open(_CHORD_DEFS_PATH, "r", encoding="utf-8") as f:
            _chord_defs = json.load(f)
    return _chord_defs


# ---------------------------------------------------------------------------
# Chord symbol → chord_key resolution
# ---------------------------------------------------------------------------

def _normalize_symbol(symbol: str) -> str:
    """Lowercase, strip whitespace, remove accidentals for loose matching."""
    return symbol.strip().lower().replace(" ", "")


# Map of quality suffixes in chord symbols to quality keys in chord_definations
_QUALITY_MAP = [
    ("maj7",       "major7"),
    ("major7",     "major7"),
    ("m7",         "minor7"),
    ("min7",       "minor7"),
    ("minor7",     "minor7"),
    ("dom7",       "dominant7"),
    ("7",          "dominant7"),
    ("hdim7",      "half_dim7"),
    ("halfdim7",   "half_dim7"),
    ("m",          "minor"),
    ("min",        "minor"),
    ("minor",      "minor"),
    ("maj",        "major"),
    ("major",      "major"),
    ("5",          "power"),
    ("power",      "power"),
    ("",           "major"),  # bare root = major
]

_NOTE_ALIASES = {
    "bb": "a#", "db": "c#", "eb": "d#", "gb": "f#", "ab": "g#",
    "a#": "a#", "c#": "c#", "d#": "d#", "f#": "f#", "g#": "g#",
}


def _parse_symbol(symbol: str) -> tuple[str, str]:
    """Return (root_upper, quality_key) for a chord symbol like 'Am7', 'G', 'F#maj7'."""
    s = symbol.strip()
    # Extract root (1-2 chars)
    if len(s) >= 2 and s[1] in ("#", "b"):
        root_raw = s[:2]
        rest = s[2:]
    else:
        root_raw = s[:1]
        rest = s[1:]

    root_norm = _NOTE_ALIASES.get(root_raw.lower(), root_raw.lower())
    root_upper = root_norm.upper()
    # Map A# back to proper casing
    if len(root_upper) == 2:
        root_upper = root_upper[0] + root_upper[1]

    # Strip slash-bass (e.g. C/B → C)
    rest = rest.split("/")[0]
    rest_lower = rest.lower().strip()

    for suffix, quality_key in _QUALITY_MAP:
        if rest_lower == suffix:
            return root_upper, quality_key

    # Fallback: major
    return root_upper, "major"


def _resolve_practice_chords(song: SongObject) -> list[PracticeChord]:
    """
    For each chord in the song's progression, find the matching chord_key
    in chord_definations.json. Sets available_in_app accordingly.
    """
    defs = _load_chord_defs()
    # Build lookup: (root_upper, quality) → chord key
    lookup: dict[tuple[str, str], str] = {}
    for entry in defs:
        chord_key = entry.get("chord", "")
        parts = chord_key.rsplit("_", 1)
        if len(parts) == 2:
            root_part, quality_part = parts
        else:
            continue
        # Normalise root (A# stays A#)
        lookup[(root_part, quality_part)] = chord_key

    results: list[PracticeChord] = []
    seen: set[str] = set()

    for symbol in song.progression:
        if symbol in seen:
            continue
        seen.add(symbol)

        try:
            root, quality = _parse_symbol(symbol)
            chord_key = lookup.get((root, quality))
            if chord_key:
                results.append(PracticeChord(symbol=symbol, available_in_app=True, chord_key=chord_key))
            else:
                results.append(PracticeChord(symbol=symbol, available_in_app=False, chord_key=None))
        except Exception:
            results.append(PracticeChord(symbol=symbol, available_in_app=False, chord_key=None))

    return results


# ---------------------------------------------------------------------------
# Chairman synthesis
# ---------------------------------------------------------------------------

async def synthesize(song: SongObject, agent_outputs: list[AgentOutput]) -> LessonDocument:
    """
    Call Gemini once with all agent outputs to produce the chairman summary.
    Assembles and returns the final LessonDocument.
    """
    model = _get_gemini_model()
    if model is None:
        raise RuntimeError("GOOGLE_API_KEY not set.")

    # Build the chairman prompt
    agents_text = "\n\n".join(
        f"=== {ao.agent_name.replace('_', ' ').title()} ===\n{ao.content}"
        for ao in agent_outputs
    )
    chairman_user = (
        f"Song: {song.song_title} by {song.artist}\n\n"
        f"{agents_text}"
    )
    full_prompt = f"{_CHAIRMAN_PROMPT}\n\n{chairman_user}"

    try:
        response = await model.generate_content_async(full_prompt)
        summary = response.text.strip()
    except Exception as exc:
        logger.error("Chairman synthesis failed: %s", exc)
        summary = "Lesson summary unavailable."

    # Map agent outputs to named sections
    agent_map = {ao.agent_name: ao.content for ao in agent_outputs}

    practice_chords = _resolve_practice_chords(song)

    return LessonDocument(
        lesson_id=str(uuid.uuid4()),
        song_title=song.song_title,
        artist=song.artist,
        overall_difficulty=song.overall_difficulty,
        chairman_summary=summary,
        theory_section=agent_map.get("theory_teacher", ""),
        technique_section=agent_map.get("technique_coach", ""),
        ear_training_section=agent_map.get("ear_training", ""),
        practice_plan=agent_map.get("practice_planner", ""),
        practice_chords=practice_chords,
    )
