from __future__ import annotations

import asyncio
import json
import logging

from council.schemas import SongObject
from feedback_engine.generator import _get_groq_client, GROQ_MODEL, llm_params

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a music theory expert and experienced guitar teacher.
Given a song name and optional artist, extract structured musical information
about how the song is commonly played on guitar.

Output ONLY valid JSON — no markdown fences, no extra text.

Rules:
- Use standard chord symbols (Am, Am7, G, C/B, D7, etc.)
- overall_difficulty must be exactly one of: "beginner", "intermediate", "advanced"
- chords: every unique chord in the song with its tonal function and constituent notes
- progression: chord symbols in order of first appearance
- sections: name each distinct section (Intro, Verse, Chorus, Bridge, Outro) and list its chords
- techniques: only guitar-relevant techniques (e.g. fingerpicking, barre chord, hammer-on)
- sections[].bars: the chords bar by bar for ONE pass of that section, in order. One
  chord per bar is written "G"; two chords sharing a bar are written "C D". Use the
  same chord symbols as in chords. sections[].repeat: how many times those bars repeat.
- form: the section names in the order they are played through the whole song
  (names must match sections[].name), e.g. ["Intro","Verse","Chorus","Verse","Chorus","Outro"]
- strumming: a common strumming pattern written with D and U, e.g. "D DU UDU"
- capo: the capo fret of the widely taught version (0 if none)
- tempo_bpm: approximate tempo in beats per minute
- NEVER include song lyrics or any words of the song
- For songs with multiple versions, use the most widely-taught beginner arrangement
- If uncertain about any field, provide your best estimate — do not refuse or leave fields empty
"""


async def ingest_song(song_query: str) -> SongObject:
    """
    Call Groq/Llama to extract a SongObject from a song name / query string.
    Returns a validated SongObject.
    Raises ValueError if the model returns unparseable JSON.
    """
    client = _get_groq_client()
    if client is None:
        raise RuntimeError("GROQ_API_KEY is not set — cannot run Song Learning Council.")

    schema_json = json.dumps(SongObject.model_json_schema(), indent=2)

    user_prompt = f"""Output schema:
{schema_json}

Song to analyse: {song_query}"""

    for attempt in range(2):  # 1 retry max
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    **llm_params(2500),
                ),
                timeout=35.0,
            )
            raw = response.choices[0].message.content.strip()
            logger.info("Ingestion raw response length: %d chars", len(raw))
            return SongObject.model_validate_json(raw)
        except Exception as exc:
            if "429" in str(exc) and attempt == 0:
                logger.info("Ingestion: 429, retrying in 5s")
                await asyncio.sleep(5)
                continue
            logger.error("Ingestion failed: %s", exc)
            raise ValueError(f"Failed to parse song data: {exc}") from exc

    raise ValueError("Failed to parse song data: quota exceeded after retries")
