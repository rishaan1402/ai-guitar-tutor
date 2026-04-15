from __future__ import annotations

import json
import logging

from council.schemas import SongObject
from feedback_engine.generator import _get_gemini_model

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
- For songs with multiple versions, use the most widely-taught beginner arrangement
- If uncertain about any field, provide your best estimate — do not refuse or leave fields empty
"""


async def ingest_song(song_query: str) -> SongObject:
    """
    Call Gemini to extract a SongObject from a song name / query string.
    Returns a validated SongObject.
    Raises ValueError if the model returns unparseable JSON.
    """
    model = _get_gemini_model()
    if model is None:
        raise RuntimeError("GOOGLE_API_KEY is not set — cannot run Song Learning Council.")

    schema_json = json.dumps(SongObject.model_json_schema(), indent=2)

    prompt = f"""{_SYSTEM_PROMPT}

Output schema:
{schema_json}

Song to analyse: {song_query}"""

    import asyncio
    import google.generativeai as genai
    gen_config = genai.GenerationConfig(response_mime_type="application/json", temperature=0.2)

    for attempt in range(2):  # 1 retry max
        try:
            response = await model.generate_content_async(prompt, generation_config=gen_config)
            raw = response.text.strip()
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
