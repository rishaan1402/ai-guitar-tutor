from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from urllib.parse import quote
from typing import Any, Dict, Mapping, Optional
import json


@dataclass(frozen=True)
class Lesson:
    """
    Represents a single chord lesson and its associated assets.

    The paths are stored as absolute paths to make it easy for callers
    (e.g. API layer or frontend adapters) to work with the files.
    """

    chord_name: str
    lesson_video_path: Optional[Path]
    reference_audio_path: Path
    metadata: Mapping[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the lesson into a JSON-serializable dict.

        This is useful for returning lesson data from an API layer.
        """
        data = asdict(self)
        # Never expose server filesystem paths; clients fetch media by URL.
        data.pop("lesson_video_path", None)
        data.pop("reference_audio_path", None)
        chord = quote(self.chord_name, safe="")
        data["video_url"] = f"/video/{chord}" if self.lesson_video_path else None
        data["audio_url"] = f"/audio/{chord}"
        return data


class LessonService:
    """
    Service responsible for discovering and providing chord lessons.

    By default, lessons are loaded from the `data/lessons/` directory at the
    project root, but an alternative root can be injected for testing or
    different deployment layouts.
    """

    def __init__(self, lessons_root: Optional[Path | str] = None) -> None:
        if lessons_root is None:
            # Resolve project root from this file location:
            # <project_root>/backend/lesson_service/service.py
            project_root = Path(__file__).resolve().parents[2]
            lessons_root = project_root / "data" / "lessons"

        self._lessons_root: Path = Path(lessons_root).expanduser().resolve()
        self._lessons_by_chord: Dict[str, Lesson] = {}

        self._load_lessons()

    @property
    def lessons_root(self) -> Path:
        """Return the resolved root directory where lessons are stored."""
        return self._lessons_root

    def _load_lessons(self) -> None:
        """
        Discover and load all available lessons from disk.

        Expected directory structure:

            data/lessons/<chord_name>/
                lesson.mp4
                reference.wav
                metadata.json
        """
        if not self._lessons_root.exists():
            # No lessons available yet; callers should handle empty results.
            return

        for entry in self._lessons_root.iterdir():
            if not entry.is_dir():
                continue

            metadata_path = entry / "metadata.json"
            if not metadata_path.is_file():
                continue

            try:
                with metadata_path.open("r", encoding="utf-8") as f:
                    metadata: Dict[str, Any] = json.load(f)
            except (OSError, json.JSONDecodeError):
                # Skip malformed or unreadable metadata files.
                continue

            chord_name = str(metadata.get("chord") or entry.name)

            # Default asset filenames follow the documented convention.
            lesson_video_path = entry / "lesson.mp4"
            reference_audio_path = entry / "reference.wav"

            if not reference_audio_path.is_file() or reference_audio_path.stat().st_size == 0:
                # No reference audio; skip this lesson.
                continue

            # Video is optional; only set if file exists with content.
            video_path: Optional[Path] = None
            if lesson_video_path.is_file() and lesson_video_path.stat().st_size > 0:
                video_path = lesson_video_path.resolve()

            lesson = Lesson(
                chord_name=chord_name,
                lesson_video_path=video_path,
                reference_audio_path=reference_audio_path.resolve(),
                metadata=metadata,
            )

            self._lessons_by_chord[chord_name] = lesson

    def get_lesson(self, chord_name: str) -> Optional[Lesson]:
        """
        Retrieve a lesson for the given chord name.

        Returns None if no lesson exists for the requested chord.
        """
        return self._lessons_by_chord.get(chord_name)

    def list_available_chords(self) -> list[str]:
        """
        Return a sorted list of chord names for which lessons are available.
        """
        return sorted(self._lessons_by_chord.keys())

    def find_chord_by_strengths(self, passes, exclude: Optional[str] = None) -> Optional[str]:
        """Name the one library chord that ``passes(notes)`` accepts, if exactly one does.

        ``passes`` is a predicate over a chord's note list (the evaluator's own
        decision rule on the take's pitch-class strengths), so a quiet 3rd that
        was below the "detected" threshold still counts.
        """
        hits = [name for name, lesson in sorted(self._lessons_by_chord.items())
                if name != exclude and passes(lesson.metadata.get("notes", []))]
        if len(hits) != 1:
            return None
        return friendly_chord_name(hits[0])

    def find_chord_by_notes(self, notes: list[str], exclude: Optional[str] = None) -> Optional[str]:
        """Return the display name of a library chord whose note set equals ``notes``.

        Used to tell a learner "that sounded like Em" when they played a
        different real chord. Returns None when nothing matches exactly.
        """
        target = {n for n in notes}
        if len(target) < 2:
            return None
        for name in sorted(self._lessons_by_chord):
            if name == exclude:
                continue
            meta = self._lessons_by_chord[name].metadata
            if set(meta.get("notes", [])) == target:
                return friendly_chord_name(name)
        return None


_QUALITY_WORDS = {
    "major": "major", "minor": "minor", "dominant7": "7", "major7": "maj7",
    "minor7": "minor 7", "half_dim7": "half-diminished 7", "power": "5 (power chord)",
}


def friendly_chord_name(chord_key: str) -> str:
    """'G_major' -> 'G major', 'A_dominant7' -> 'A7', 'F#_minor7' -> 'F# minor 7'."""
    root, _, quality = chord_key.partition("_")
    word = _QUALITY_WORDS.get(quality, quality.replace("_", " "))
    if word in ("7", "maj7") or word.startswith("5"):
        return f"{root}{word}"  # symbols attach directly: A7, Cmaj7, E5
    return f"{root} {word}".strip()

