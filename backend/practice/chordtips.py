"""Coaching tips for any chord shape.

The app's shape finder decides the notes, frets and fingers; this module only
writes the words. Tips come from the LLM when it's available and are checked
against the shape (a tip that names a fret or finger the shape doesn't use is
dropped); otherwise they're written from the shape itself. Each shape's tips
are stored once and shared by everyone.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from feedback_engine.generator import GROQ_FAST_MODEL, _get_groq_client, llm_params

logger = logging.getLogger(__name__)

STRING_NAMES = {6: "low E", 5: "A", 4: "D", 3: "G", 2: "B", 1: "high e"}
NOTE_RE = re.compile(r"^[A-G][#b]?$")
SYMBOL_RE = re.compile(r"^[A-G][#b]?[A-Za-z0-9#b+°ø()/\-]{0,14}$")


class ChordShapeIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=24)
    # strings 6..1: -1 muted, 0 open, 1..24 fretted
    frets: list[int] = Field(min_length=6, max_length=6)
    # strings 6..1: 0 none, 1..4 finger
    fingers: list[int] = Field(min_length=6, max_length=6)
    notes: list[str] = Field(min_length=1, max_length=7)

    @field_validator("symbol")
    @classmethod
    def _symbol(cls, v: str) -> str:
        v = v.strip()
        if not SYMBOL_RE.match(v):
            raise ValueError("not a chord symbol")
        return v

    @field_validator("frets")
    @classmethod
    def _frets(cls, v: list[int]) -> list[int]:
        if any(f < -1 or f > 24 for f in v) or all(f < 0 for f in v):
            raise ValueError("bad frets")
        return v

    @field_validator("fingers")
    @classmethod
    def _fingers(cls, v: list[int]) -> list[int]:
        if any(f < 0 or f > 4 for f in v):
            raise ValueError("bad fingers")
        return v

    @field_validator("notes")
    @classmethod
    def _notes(cls, v: list[str]) -> list[str]:
        if not all(NOTE_RE.match(n) for n in v):
            raise ValueError("bad note names")
        return v

    def frets_key(self) -> str:
        return ",".join("x" if f < 0 else str(f) for f in self.frets)

    def describe(self) -> str:
        lines = []
        for i, (f, fg) in enumerate(zip(self.frets, self.fingers)):
            s = 6 - i
            if f < 0:
                lines.append(f"{STRING_NAMES[s]} string: not played")
            elif f == 0:
                lines.append(f"{STRING_NAMES[s]} string: open")
            else:
                lines.append(f"{STRING_NAMES[s]} string: fret {f}, finger {fg or '?'}")
        return "\n".join(lines)


def _barre(shape: ChordShapeIn) -> Optional[tuple[int, int, int]]:
    """(finger, fret, number of strings) of a finger laid across strings, if any."""
    by: dict[tuple[int, int], int] = {}
    for f, fg in zip(shape.frets, shape.fingers):
        if f > 0 and fg:
            by[(fg, f)] = by.get((fg, f), 0) + 1
    for (fg, f), n in by.items():
        if n >= 2:
            return fg, f, n
    return None


def template_tips(shape: ChordShapeIn) -> list[str]:
    """Tips written straight from the shape (no AI)."""
    tips: list[str] = []
    played = [i for i, f in enumerate(shape.frets) if f >= 0]
    lowest = 6 - played[0]
    b = _barre(shape)
    if b:
        fg, fret, n = b
        tips.append(f"Lay finger {fg} flat across {n} strings at fret {fret}; roll it slightly onto its bony edge so every string rings.")
    fretted = [f for f in shape.frets if f > 0]
    if fretted and max(fretted) - min(fretted) >= 3:
        tips.append("This shape stretches across four frets: keep your thumb low behind the neck to open up your hand.")
    muted = [6 - i for i, f in enumerate(shape.frets) if f < 0]
    if muted:
        parts = [STRING_NAMES[s] for s in sorted(muted, reverse=True)]
        names = parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
        tips.append(f"Start your strum on the {STRING_NAMES[lowest]} string and skip the {names} string{'s' if len(muted) > 1 else ''}.")
    opens = [6 - i for i, f in enumerate(shape.frets) if f == 0]
    if opens and fretted:
        tips.append("Arch your fingers and press on the tips so the open strings ring clearly.")
    tips.append(f"Strum once slowly, string by string, and listen for each note: {', '.join(shape.notes)}.")
    return tips[:3]


_SYSTEM = (
    "You are a warm, precise guitar teacher. You get one chord shape (fixed: never change it). "
    "Write 3 short, practical tips (each under 160 characters) for playing THIS shape cleanly: "
    "hand position, the hard part, how to get there from common chords, and what it sounds like. "
    "Only mention frets, strings and fingers exactly as given. No markdown. "
    'Reply with JSON only: {"tips": ["...", "...", "..."]}'
)


def _valid(tip: str, shape: ChordShapeIn) -> bool:
    used_frets = {f for f in shape.frets if f > 0}
    for m in re.finditer(r"\bfret\s+(\d+)", tip, re.I):
        if int(m.group(1)) not in used_frets:
            return False
    for m in re.finditer(r"\bfinger\s+(\d+)", tip, re.I):
        if int(m.group(1)) not in set(shape.fingers) - {0}:
            return False
    return 10 <= len(tip) <= 220


async def ai_tips(shape: ChordShapeIn) -> Optional[list[str]]:
    client = _get_groq_client()
    if client is None:
        return None
    prompt = f"Chord: {shape.symbol}\nNotes: {', '.join(shape.notes)}\nShape (string by string):\n{shape.describe()}"
    try:
        resp = await client.chat.completions.create(
            messages=[{"role": "system", "content": _SYSTEM}, {"role": "user", "content": prompt}],
            temperature=0.5,
            **llm_params(300, GROQ_FAST_MODEL),
        )
        text = resp.choices[0].message.content or ""
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return None
        raw = json.loads(m.group(0))
        tips = [re.sub(r"\s+", " ", str(t)).strip() for t in (raw.get("tips") or [])]
        tips = [t for t in tips if _valid(t, shape)][:3]
        return tips if len(tips) >= 2 else None
    except Exception as exc:  # network, quota, bad JSON: fall back to the shape's own tips
        logger.warning("chord tips: LLM failed: %s", exc)
        return None
