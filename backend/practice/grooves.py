"""Grooves made for one learner: a short chord loop with a backing band, built
around the change they most need, in chords they know, at a tempo that fits.

The AI proposes; music theory decides. Every AI Groove is checked (allowed
chords only, in one key, the focus change really repeated, sane tempo and
strum) and anything that fails falls back to a template that always works,
so a Groove is produced even with no AI available.
"""
from __future__ import annotations

import json
import logging
import random
import re
from typing import Any, Optional

from pydantic import BaseModel, Field

from feedback_engine.generator import GROQ_FAST_MODEL, _get_groq_client, llm_params
from practice import theory
from practice.profile import Profile

logger = logging.getLogger(__name__)

STYLES = ("pop", "ballad", "rock", "folk")
STRUMS = {
    "beginner": ["D...D...", "D.D.D.D."],
    "intermediate": ["D.D.D.DU", "D.DU.UDU"],
    "advanced": ["D.DU.UDU", "D.DUDUDU"],
}
MOODS = {"pop": ["Late Night", "Neon", "Sunday", "Daydream"], "ballad": ["Slow Sunrise", "Candlelight", "Rain"],
         "rock": ["Garage", "Overdrive", "Backstreet"], "folk": ["Campfire", "Open Road", "Porch"]}


class GrooveSpec(BaseModel):
    id: str
    title: str = Field(max_length=60)
    style: str
    bpm: int
    bars: list[list[str]]
    strum: str
    focus: Optional[list[str]] = None
    tip: Optional[str] = None
    loops: int = 2
    key: Optional[str] = None
    source: str = "ai"


def _level(prof: Profile) -> str:
    return prof.skill if prof.skill in STRUMS else "beginner"


def _count_change(bars: list[list[str]], a: str, b: str) -> int:
    flat = [c for bar in bars for c in bar]
    seq = flat + flat[:1]  # the loop wraps around
    return sum(1 for x, y in zip(seq, seq[1:]) if x == a and y == b)


def pick_focus(prof: Profile, requested: Optional[list[str]] = None) -> tuple[str, str]:
    known = prof.known
    if requested and len(requested) == 2:
        a, b = (theory.normalise(x) or x for x in requested)
        return a, b
    weak = prof.weakest_pair()
    if weak:
        return weak
    if prof.goal and len(prof.goal.get("chords", [])) >= 2:
        g = [theory.normalise(c) for c in prof.goal["chords"]]
        g = [c for c in g if c]
        for x, y in zip(g, g[1:]):
            if x != y:
                return x, y
    if len(known) >= 2:
        # the newest chord against an older one it shares a key with
        newest = (prof.learning or known)[-1]
        for k in known:
            if k != newest and theory.keys_for([k, newest]):
                return k, newest
        return known[0], known[1]
    return "Em", "Am"


def template_groove(prof: Profile, focus: tuple[str, str], style: Optional[str] = None,
                    bpm: Optional[int] = None, seed: Optional[int] = None) -> GrooveSpec:
    """A musical loop from theory alone: always valid, always available."""
    rng = random.Random(seed)
    a, b = focus
    style = style if style in STYLES else rng.choice(["pop", "folk", "ballad"] if _level(prof) == "beginner" else list(STYLES))
    known = set(prof.known) | {a, b}
    keys = theory.keys_for([a, b])
    key = keys[0] if keys else None
    pool = [c for c in (theory.chords_in_key(key) if key else []) if c in known and c not in (a, b)]
    if pool:
        x = rng.choice(pool)
        y = rng.choice([c for c in pool if c != x] or [x])
        shapes = [[[a], [b], [a], [b]], [[a], [b], [x], [b]], [[a], [b], [x], [y]], [[x], [a], [b], [a]]]
        weights = [1, 3, 3, 2]
        bars = rng.choices(shapes, weights)[0]
        if _count_change(bars, a, b) < 2:
            bars = [[a], [b], [x], [b]] if _count_change([[a], [b], [x], [b]], a, b) >= 1 else bars
    else:
        bars = [[a], [a], [b], [b]] if _level(prof) == "beginner" else [[a], [b], [a], [b]]
    tempo = max(56, min(120, bpm or prof.comfort_bpm))
    title = f"{rng.choice(MOODS[style])} in {key or a}"
    return GrooveSpec(
        id=f"tpl-{rng.randrange(1 << 30):x}", title=title, style=style, bpm=tempo, bars=bars,
        strum=rng.choice(STRUMS[_level(prof)]), focus=[a, b], key=key, source="template",
        tip=f"{a} to {b}: look at which fingers can stay put or slide, and move those first.",
        loops=2 if tempo >= 70 else 2,
    )


_SYSTEM = """You design short guitar practice loops ("Grooves") that sound like real music.
Return ONLY a JSON object:
{"title": str (2-4 words, evocative, no quotes), "style": "pop"|"ballad"|"rock"|"folk",
 "bpm": int, "bars": [[chord], ...] (exactly 4 bars, 1 or 2 chords per bar),
 "strum": 8 chars of D/U/. (eighth notes), "tip": one short sentence of finger advice for the focus change}
Rules: use ONLY the allowed chords; the progression must sound good in one key;
the focus change (A then B) must happen at least twice per loop, counting the wrap from the last bar to the first;
keep the strum simple for beginners."""


def _clean_strum(s: str) -> Optional[str]:
    s = re.sub(r"[^DUdu.]", "", s or "").upper()
    return s if len(s) == 8 and "D" in s else None


def validate(raw: dict[str, Any], prof: Profile, focus: tuple[str, str], bpm_hint: int) -> Optional[GrooveSpec]:
    """Accept an AI Groove only if music theory agrees; None if not."""
    try:
        bars_in = raw.get("bars")
        if not isinstance(bars_in, list) or len(bars_in) not in (4, 8):
            return None
        allowed = set(prof.known) | set(focus)
        bars: list[list[str]] = []
        for bar in bars_in:
            bar = bar if isinstance(bar, list) else [bar]
            if not 1 <= len(bar) <= 2:
                return None
            norm = [theory.normalise(str(c)) for c in bar]
            if any(c is None or c not in allowed for c in norm):
                return None
            bars.append(norm)  # type: ignore[arg-type]
        chords = list(dict.fromkeys(c for bar in bars for c in bar))
        keys = theory.keys_for(chords)
        if not keys:
            return None
        if _count_change(bars, *focus) < (2 if len(bars) == 4 else 3):
            return None
        strum = _clean_strum(str(raw.get("strum", ""))) or STRUMS[_level(prof)][0]
        style = raw.get("style") if raw.get("style") in STYLES else "pop"
        bpm = int(raw.get("bpm") or bpm_hint)
        bpm = max(bpm_hint - 6, min(bpm_hint + 6, bpm))
        title = re.sub(r"[^\w\s'&-]", "", str(raw.get("title") or "")).strip()[:40] or f"{style.title()} loop"
        tip = re.sub(r"\s+", " ", str(raw.get("tip") or "")).strip()[:180] or None
        return GrooveSpec(id=f"ai-{random.randrange(1 << 30):x}", title=title, style=style, bpm=bpm, bars=bars,
                          strum=strum, focus=list(focus), tip=tip, key=keys[0], source="ai")
    except Exception:
        return None


def _extract_json(text: str) -> Optional[dict]:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


async def generate(prof: Profile, requested_focus: Optional[list[str]] = None, style: Optional[str] = None,
                   request: Optional[str] = None, faster: bool = False) -> GrooveSpec:
    focus = pick_focus(prof, requested_focus)
    key = "|".join(focus)
    bump = 4 if faster or prof.last_stars.get(key) == 3 else (-4 if prof.last_stars.get(key) == 0 else 0)
    bpm = max(56, min(120, prof.comfort_bpm + bump))
    client = _get_groq_client()
    if client is not None:
        allowed = sorted(set(prof.known) | set(focus))
        user = (f"Allowed chords: {', '.join(allowed)}\nFocus change: {focus[0]} -> {focus[1]}\n"
                f"Learner level: {prof.skill}; comfortable tempo {bpm} bpm\n"
                f"Style: {style or 'your choice'}\n"
                + (f"Learner asked: {request[:200]}\n" if request else "")
                + f"Learner profile:\n{prof.summary()}")
        try:
            resp = await client.chat.completions.create(
                messages=[{"role": "system", "content": _SYSTEM}, {"role": "user", "content": user}],
                temperature=0.9, **llm_params(300, GROQ_FAST_MODEL),
            )
            raw = _extract_json(resp.choices[0].message.content or "")
            spec = validate(raw or {}, prof, focus, bpm) if raw else None
            if spec:
                if style in STYLES:
                    spec.style = style
                return spec
            logger.info("AI groove rejected by theory check; using a template")
        except Exception as exc:  # network, quota, timeout
            logger.warning("Groove generation failed: %s", exc)
    return template_groove(prof, focus, style, bpm)
