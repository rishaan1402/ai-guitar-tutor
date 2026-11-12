from functools import lru_cache

from .service import Lesson, LessonService


@lru_cache(maxsize=1)
def known_chords() -> frozenset[str]:
    """Chord keys present in the lesson library (e.g. 'A_major', 'F#_minor7')."""
    return frozenset(LessonService().list_available_chords())


def validate_chord_name(v: str) -> str:
    """Pydantic-style validator: reject chord names that aren't in the library."""
    if v not in known_chords():
        raise ValueError("Unknown chord")
    return v


__all__ = ["Lesson", "LessonService", "known_chords", "validate_chord_name"]
