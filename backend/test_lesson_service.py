from __future__ import annotations

from lesson_service import LessonService


def main() -> None:
    """
    Simple manual test script.

    It instantiates LessonService (which scans data/lessons by default)
    and prints the available chord names to stdout.
    """
    service = LessonService()

    chords = service.list_available_chords()
    if not chords:
        print("No lessons found in:", service.lessons_root)
        return

    print("Lessons root:", service.lessons_root)
    print("Available chords:")
    for chord in chords:
        print(f"- {chord}")


if __name__ == "__main__":
    main()

