from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional
from typing import Annotated

from pydantic import BaseModel, Field


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
    # Bar-by-bar chords for one pass of the section, e.g. ["G", "D", "Am7", "C D"]
    # ("C D" = two chords sharing the bar). Optional: older lessons lack it.
    bars: list[str] = []
    repeat: int = 1      # how many times the bars are played in a row


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
    # Chart data (optional so older stored lessons still validate)
    form: list[str] = []              # section names in playing order, e.g. ["Intro","Verse","Chorus"]
    strumming: str = ""               # e.g. "D DU UDU"
    capo: int = 0                     # fret of the commonly taught arrangement
    tempo_bpm: Optional[int] = None   # approximate tempo


# ---------------------------------------------------------------------------
# Council agent outputs
# ---------------------------------------------------------------------------

class AgentOutput(BaseModel):
    agent_name: str   # "theory_teacher" | "technique_coach" | "ear_training" | "practice_planner"
    content: str      # markdown prose


# ---------------------------------------------------------------------------
# Lesson Document — produced by chairman, returned to frontend
# ---------------------------------------------------------------------------

class FingeringPosition(BaseModel):
    """A single finger placement on the fretboard."""
    string: int                     # 1 (high e) – 6 (low E)
    fret: int = 0                   # 0 = open string
    note: str = ""                  # note name, e.g. "A"
    finger: Optional[int] = None    # 1–4, None for open/mute
    action: Optional[str] = None    # "mute" if string is muted


class ChordRankEntry(BaseModel):
    """Per-chord progress rank returned after lesson revision."""
    chord_key: str
    symbol: str
    best_score: float   # 0.0–1.0, -1.0 if untouched
    attempts: int
    status: str         # "solid" | "needs_work" | "untouched"


class PracticeChord(BaseModel):
    symbol: str               # chord symbol as it appears in the song (e.g. "Am7")
    available_in_app: bool    # True if a matching chord lesson exists in the app
    chord_key: Optional[str]  # snake_case key into existing lesson system (e.g. "A_minor7")
    chord_function: str = ""  # e.g. "ii chord in G major" (from SongObject.chords)
    positions: list[FingeringPosition] = []  # fretboard positions, embedded at generate time


class SongSection(BaseModel):
    name: str            # e.g. "Verse", "Chorus", "Bridge"
    chords: list[str]    # chord symbols used in that section


class SectionChange(BaseModel):
    """A chord change to drill, e.g. G -> Em."""
    from_symbol: str
    to_symbol: str
    from_key: Optional[str] = None    # app chord keys when the chord has a lesson
    to_key: Optional[str] = None


class SectionLesson(BaseModel):
    """A practice lesson for one section of the song, built from its chart."""
    name: str
    bars: list[str] = []
    repeat: int = 1
    chords: list[str] = []            # distinct chords in the section
    new_chords: list[str] = []        # not seen in an earlier section
    chord_keys: dict[str, Optional[str]] = {}   # symbol -> app lesson key (None if none)
    changes: list[SectionChange] = []
    start_bpm: Optional[int] = None   # slow practice tempo
    target_bpm: Optional[int] = None  # song tempo
    steps: list[str] = []             # what to do, in order


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
    # Song metadata surfaced from SongObject
    key: str = ""
    time_signature: str = ""
    tempo_feel: str = ""
    song_sections: list[SongSection] = []
    chord_functions: dict[str, str] = {}
    chord_ranking: list[ChordRankEntry] = []  # populated after /practice/revise
    # ChordPro chord chart (chords only — no lyrics) and per-section lessons
    chart: str = ""
    strumming: str = ""
    capo: int = 0
    tempo_bpm: Optional[int] = None
    section_lessons: list[SectionLesson] = []


# ---------------------------------------------------------------------------
# Practice session — tracks chord evaluation results within a song lesson
# ---------------------------------------------------------------------------

_Note = Annotated[str, Field(max_length=4)]


class TipRequest(BaseModel):
    lesson_id: str = Field(max_length=100)
    chord_key: str = Field(max_length=40)        # e.g. "G_major"
    chord_symbol: str = Field(max_length=16)     # e.g. "G" (for display in prompts)
    score: float = Field(ge=0, le=1, allow_inf_nan=False)  # 0.0–1.0
    detected_notes: list[_Note] = Field(max_length=12)
    missing_notes: list[_Note] = Field(max_length=12)
    extra_notes: list[_Note] = Field(max_length=12)
    attempt: int = Field(ge=1, le=10_000)


class ReviseRequest(BaseModel):
    lesson_id: str = Field(max_length=100)


class GenerateRequest(BaseModel):
    song_query: str = Field(max_length=120)       # e.g. "Blackbird by The Beatles"


# ---------------------------------------------------------------------------
# Quiz — generated from lesson content, cached per session
# ---------------------------------------------------------------------------

class QuizQuestion(BaseModel):
    id: str                  # e.g. "q1"
    question: str
    options: list[str]       # always 4 options
    correct_index: int       # 0–3
    explanation: str         # shown after answering


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


class QuizRequest(BaseModel):
    lesson_id: str = Field(max_length=100)
