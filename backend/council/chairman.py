from __future__ import annotations

import logging
import uuid

from council.chart import build_chart, build_section_lessons, chord_key_for
from council.schemas import SongObject, AgentOutput, LessonDocument, PracticeChord, SongSection
from council.agents import _CHAIRMAN_PROMPT
from feedback_engine.generator import _get_groq_client, GROQ_MODEL, llm_params, GROQ_FAST_MODEL

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Chord symbol → chord_key resolution (strict; see council/chart.chord_key_for)
# ---------------------------------------------------------------------------

def _resolve_practice_chords(song: SongObject) -> list[PracticeChord]:
    """
    Map each chord in the song to the app's chord lesson, if there is one.

    Strict: a quality the app doesn't teach (sus4, add9, 6, dim...) gets no
    lesson and no diagram. The old resolver fell back to the major chord, so a
    "Gsus4" card showed a G major diagram under the Gsus4 caption.
    Slash chords (D/F#) map to their base chord's lesson.
    """
    results: list[PracticeChord] = []
    seen: set[str] = set()
    for symbol in song.progression:
        if symbol in seen:
            continue
        seen.add(symbol)
        key = chord_key_for(symbol)
        results.append(PracticeChord(symbol=symbol, available_in_app=key is not None, chord_key=key))
    return results


# ---------------------------------------------------------------------------
# Chairman synthesis
# ---------------------------------------------------------------------------

async def synthesize(song: SongObject, agent_outputs: list[AgentOutput]) -> LessonDocument:
    """
    Call Gemini once with all agent outputs to produce the chairman summary.
    Assembles and returns the final LessonDocument.
    """
    client = _get_groq_client()
    if client is None:
        raise RuntimeError("GROQ_API_KEY not set.")

    agents_text = "\n\n".join(
        f"=== {ao.agent_name.replace('_', ' ').title()} ===\n{ao.content}"
        for ao in agent_outputs
    )
    chairman_user = (
        f"Song: {song.song_title} by {song.artist}\n\n"
        f"{agents_text}"
    )

    try:
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": _CHAIRMAN_PROMPT},
                {"role": "user", "content": chairman_user},
            ],
            temperature=0.7,
            **llm_params(400, GROQ_FAST_MODEL),
        )
        summary = response.choices[0].message.content.strip()
    except Exception as exc:
        logger.error("Chairman synthesis failed: %s", exc)
        summary = "Lesson summary unavailable."

    # Map agent outputs to named sections
    agent_map = {ao.agent_name: ao.content for ao in agent_outputs}

    practice_chords = _resolve_practice_chords(song)

    # Surface SongObject metadata to the frontend
    chord_functions = {c.symbol: c.function for c in song.chords}
    song_sections = [SongSection(name=s.name, chords=s.chords) for s in song.sections]

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
        key=song.key,
        time_signature=song.time_signature,
        tempo_feel=song.tempo_feel,
        song_sections=song_sections,
        chord_functions=chord_functions,
        chart=build_chart(song),
        strumming=song.strumming,
        capo=song.capo if 0 <= song.capo <= 11 else 0,
        tempo_bpm=song.tempo_bpm,
        section_lessons=build_section_lessons(song),
    )
