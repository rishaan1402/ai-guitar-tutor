from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
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
    lesson_video_path: Path
    reference_audio_path: Path
    metadata: Mapping[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the lesson into a JSON-serializable dict.

        This is useful for returning lesson data from an API layer.
        """
        data = asdict(self)
        # Convert Path objects to strings for JSON serialization.
        data["lesson_video_path"] = str(self.lesson_video_path)
        data["reference_audio_path"] = str(self.reference_audio_path)
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

            if not lesson_video_path.is_file() or not reference_audio_path.is_file():
                # Incomplete lesson directory; skip indexing it.
                continue

            lesson = Lesson(
                chord_name=chord_name,
                lesson_video_path=lesson_video_path.resolve(),
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

