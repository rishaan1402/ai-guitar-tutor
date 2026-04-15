from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Song Object — produced by ingestion, consumed by council agents
# ---------------------------------------------------------------------------

class ChordEntry(BaseModel):
    symbol: str          # e.g. "Am7"
    function: str        # e.g. "ii chord in G major"
    notes: list[str]     # e.g. ["A", "C", "E", "G"]


class SectionEntry(BaseModel):
    name: str            # e.g. "Verse", "Chorus"
    chords: list[str]    # chord symbols used in that section


class SongObject(BaseModel):
    song_title: str
    artist: str
    key: str                          # e.g. "G major"
    time_signature: str               # e.g. "4/4"
    tempo_feel: str                   # e.g. "slow, fingerpicked, rubato"
    overall_difficulty: Literal["beginner", "intermediate", "advanced"]
    chords: list[ChordEntry]          # all unique chords with theory context
    progression: list[str]            # chord symbols in order of first appearance
    sections: list[SectionEntry]      # song structure
    techniques: list[str]             # e.g. ["fingerpicking", "barre chord"]
    theory_notes: str                 # free-text interesting harmonic observations
    feel_description: str             # e.g. "melancholic, gentle, introspective"


# ---------------------------------------------------------------------------
# Council agent outputs
# ---------------------------------------------------------------------------

class AgentOutput(BaseModel):
    agent_name: str   # "theory_teacher" | "technique_coach" | "ear_training" | "practice_planner"
    content: str      # markdown prose


# ---------------------------------------------------------------------------
# Lesson Document — produced by chairman, returned to frontend
# ---------------------------------------------------------------------------

class PracticeChord(BaseModel):
    symbol: str               # chord symbol as it appears in the song (e.g. "Am7")
    available_in_app: bool    # True if a matching chord lesson exists in the app
    chord_key: Optional[str]  # snake_case key into existing lesson system (e.g. "A_minor7")


class LessonDocument(BaseModel):
    lesson_id: str
    song_title: str
    artist: str
    overall_difficulty: str
    chairman_summary: str
    theory_section: str
    technique_section: str
    ear_training_section: str
    practice_plan: str
    practice_chords: list[PracticeChord]


# ---------------------------------------------------------------------------
# Practice session — tracks chord evaluation results within a song lesson
# ---------------------------------------------------------------------------

class TipRequest(BaseModel):
    lesson_id: str
    chord_key: str        # e.g. "G_major"
    chord_symbol: str     # e.g. "G" (for display in prompts)
    score: float          # 0.0–1.0
    detected_notes: list[str]
    missing_notes: list[str]
    extra_notes: list[str]
    attempt: int


class ReviseRequest(BaseModel):
    lesson_id: str


class GenerateRequest(BaseModel):
    song_query: str       # e.g. "Blackbird by The Beatles"
