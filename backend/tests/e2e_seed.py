"""Seed a fresh database for the browser end-to-end tests (frontend/e2e).

Writes one song lesson ("Let It Be by The Beatles") through the real generate
endpoint with the AI replaced by canned answers, so the tests can open a song
without an AI key. Run with DATABASE_URL pointing at the e2e database.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from tests.test_api import _CANNED_SONG_JSON, _CANNED_SUMMARY, _groq  # noqa: E402


def main() -> None:
    song = json.loads(_CANNED_SONG_JSON)
    song.update(song_title="Let It Be", artist="The Beatles", chord_confidence="high")
    from main import app

    with TestClient(app) as client, \
         patch("council.ingestion._get_groq_client", return_value=_groq(json.dumps(song))), \
         patch("council.agents._get_groq_client", return_value=_groq(_CANNED_SUMMARY)), \
         patch("council.chairman._get_groq_client", return_value=_groq(_CANNED_SUMMARY)):
        r = client.post("/api/council/generate", json={"song_query": "Let It Be by The Beatles"})
        r.raise_for_status()
        print("seeded:", r.json()["song_title"], r.json()["song_id"])


if __name__ == "__main__":
    main()
