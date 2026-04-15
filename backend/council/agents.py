from __future__ import annotations

import asyncio
import json
import logging

from council.schemas import SongObject, AgentOutput
from feedback_engine.generator import _get_gemini_model

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Agent system prompts
# ---------------------------------------------------------------------------

_THEORY_PROMPT = """You are a music theory teacher specialising in guitar.
You have been given the harmonic structure of a song.

Write a focused theory lesson (200-250 words) for a beginner/intermediate guitarist covering:
1. What key the song is in and why that matters on guitar (open strings, positions)
2. How the main chords relate to the key (use Roman numerals: I, IV, V, ii, etc.)
3. Any interesting harmonic moves (borrowed chords, chromatic movement, unexpected changes)
4. One practical insight the student can apply to other songs in the same key

Write in plain, encouraging language. Explain any jargon in plain English."""

_TECHNIQUE_PROMPT = """You are a guitar technique coach.
You have been given a song's required techniques, difficulty, and feel.

Write a focused technique guide (200-250 words) covering:
1. The primary technique(s) needed and how to develop them from scratch
2. The most common beginner mistake with these techniques and how to avoid it
3. A specific physical tip (hand position, thumb placement, wrist angle, etc.)
4. A realistic honest assessment of how long it takes to get comfortable

Be concrete and physical — say "place your thumb here" not "improve your technique"."""

_EAR_PROMPT = """You are an ear training coach for guitarists.
You have been given a song's key, feel, tempo, and chord progression.

Write an ear training guide (200-250 words) covering:
1. What this song sounds like and what makes it feel the way it does
2. A simple exercise to internalise the chord changes before touching the guitar
   (e.g. clapping, counting, singing the bass notes)
3. What to listen for in the original recording (specific moments, transitions)
4. How training your ear on this song helps with other songs that have a similar feel

Write intuitively — use physical metaphors and sensory language, not music theory jargon."""

_PLANNER_PROMPT = """You are a guitar practice planner.
You have been given a song's difficulty, chord progression, techniques, and sections.

Write a structured practice plan (200-250 words) covering:
1. The recommended order to learn the song's sections (easiest first, build up)
2. How to isolate and drill the hardest chord transition in the song
3. A simple weekly schedule (e.g. "Days 1-2: chords only, Days 3-4: transitions")
4. A clear milestone: exactly what "ready to play the full song" looks and sounds like

Be specific — name the actual chords. Make the plan feel achievable for a beginner."""

_CHAIRMAN_PROMPT = """You are the Chairman of a Song Learning Council.
Four specialist agents have each written a section of a lesson plan.

Write a 150-200 word executive summary that:
1. Ties together the single most important insight from each of the four agents
2. Gives the student one concrete first step they can take TODAY
3. Ends with an encouraging, realistic statement about how long this song takes to learn

Synthesise — do not repeat each agent's full content.
Write as a single cohesive paragraph or two short paragraphs."""


# ---------------------------------------------------------------------------
# Slice helpers — each agent only sees the fields it needs
# ---------------------------------------------------------------------------

def _theory_slice(song: SongObject) -> str:
    data = {
        "song_title": song.song_title,
        "artist": song.artist,
        "key": song.key,
        "chords": [c.model_dump() for c in song.chords],
        "progression": song.progression,
        "sections": [s.model_dump() for s in song.sections],
        "theory_notes": song.theory_notes,
    }
    return json.dumps(data, indent=2)


def _technique_slice(song: SongObject) -> str:
    data = {
        "song_title": song.song_title,
        "artist": song.artist,
        "overall_difficulty": song.overall_difficulty,
        "techniques": song.techniques,
        "tempo_feel": song.tempo_feel,
        "sections": [s.model_dump() for s in song.sections],
    }
    return json.dumps(data, indent=2)


def _ear_slice(song: SongObject) -> str:
    data = {
        "song_title": song.song_title,
        "artist": song.artist,
        "key": song.key,
        "time_signature": song.time_signature,
        "tempo_feel": song.tempo_feel,
        "feel_description": song.feel_description,
        "progression": song.progression,
    }
    return json.dumps(data, indent=2)


def _planner_slice(song: SongObject) -> str:
    return json.dumps(song.model_dump(), indent=2)


# ---------------------------------------------------------------------------
# Individual agent runner (single retry on 429)
# ---------------------------------------------------------------------------

async def _run_agent(agent_name: str, system_prompt: str, content: str) -> AgentOutput:
    model = _get_gemini_model()
    if model is None:
        raise RuntimeError("GOOGLE_API_KEY not set.")

    prompt = f"{system_prompt}\n\nSong data:\n{content}"

    for attempt in range(2):  # 1 retry max
        try:
            response = await model.generate_content_async(prompt)
            return AgentOutput(agent_name=agent_name, content=response.text.strip())
        except Exception as exc:
            if "429" in str(exc) and attempt == 0:
                logger.info("Agent %s: 429, retrying in 5s", agent_name)
                await asyncio.sleep(5)
                continue
            logger.error("Agent %s failed: %s", agent_name, exc)
            return AgentOutput(agent_name=agent_name, content=f"[Agent unavailable — {exc}]")

    return AgentOutput(agent_name=agent_name, content="[Agent unavailable — quota exceeded]")


# ---------------------------------------------------------------------------
# Public: run agents in two sequential pairs with a gap between them
# Pair 1 (theory + technique) → 4s gap → Pair 2 (ear + planner)
# Stays within 15 RPM and well under Render's 30s request timeout.
# ---------------------------------------------------------------------------

async def run_council(song: SongObject) -> list[AgentOutput]:
    """Run agents as two pairs with a 4s gap — safe for 15 RPM free tier."""
    pair1 = await asyncio.gather(
        _run_agent("theory_teacher",  _THEORY_PROMPT,  _theory_slice(song)),
        _run_agent("technique_coach", _TECHNIQUE_PROMPT, _technique_slice(song)),
    )
    await asyncio.sleep(4)
    pair2 = await asyncio.gather(
        _run_agent("ear_training",     _EAR_PROMPT,    _ear_slice(song)),
        _run_agent("practice_planner", _PLANNER_PROMPT, _planner_slice(song)),
    )
    return list(pair1) + list(pair2)
