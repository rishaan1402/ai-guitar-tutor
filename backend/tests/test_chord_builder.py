"""Chord builder: shared tips for built shapes, and grading chords outside the library."""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from practice import chordtips

LESSONS = Path(__file__).resolve().parents[2] / "data" / "lessons"

CADD9 = {"symbol": "Cadd9", "frets": [-1, 3, 2, 0, 3, 3], "fingers": [0, 2, 1, 0, 3, 4], "notes": ["C", "E", "G", "D"]}


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _signup(client) -> dict:
    r = client.post("/api/auth/signup", json={"email": f"{uuid.uuid4().hex[:10]}@example.com",
                                              "password": "guitar123", "display_name": "Jo"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def fake_ai(monkeypatch, payload: str, calls: list):
    async def create(**kw):
        calls.append(kw)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=payload))])
    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(chordtips, "_get_groq_client", lambda: fake)


class TestTips:
    def test_template_tips_without_ai(self, client, monkeypatch):
        monkeypatch.setattr(chordtips, "_get_groq_client", lambda: None)
        body = dict(CADD9, symbol="Cadd9")
        r = client.post("/api/chords/tips", json=body)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["source"] == "template" and 1 <= len(j["tips"]) <= 3
        assert any("low E" in t for t in j["tips"])  # tells you to skip the muted string

    def test_ai_tips_are_checked_and_shared(self, client, monkeypatch):
        calls: list = []
        good = "Keep finger 3 planted on fret 3 when you move here from G."
        wrong_fret = "Press fret 7 with your thumb."
        fake_ai(monkeypatch, json.dumps({"tips": [good, wrong_fret, "Let the open G and high e ring between your fingers."]}), calls)
        # its own shape, so nothing is stored for it yet
        body = dict(CADD9, symbol="Cadd9", frets=[-1, 3, 2, 0, 3, 0], fingers=[0, 2, 1, 0, 3, 0])
        r1 = client.post("/api/chords/tips", json=body).json()
        assert r1["source"] == "ai" and good in r1["tips"] and wrong_fret not in r1["tips"]
        r2 = client.post("/api/chords/tips", json=body).json()
        assert r2["shared"] is True and r2["tips"] == r1["tips"]
        assert len(calls) == 1  # the second request didn't cost an AI call

    def test_rejects_bad_shapes(self, client):
        assert client.post("/api/chords/tips", json=dict(CADD9, frets=[0, 0, 0])).status_code == 422
        assert client.post("/api/chords/tips", json=dict(CADD9, fingers=[0, 5, 0, 0, 0, 0])).status_code == 422
        assert client.post("/api/chords/tips", json=dict(CADD9, notes=["H"])).status_code == 422
        assert client.post("/api/chords/tips", json=dict(CADD9, symbol="<script>")).status_code == 422


class TestGradingBuiltChords:
    def test_built_chord_is_graded_from_its_notes_and_not_saved(self, client):
        headers = _signup(client)
        wav = (LESSONS / "C_major" / "reference.wav").read_bytes()
        positions = [{"string": 6, "action": "mute"}, {"string": 5, "fret": 3, "finger": 3, "note": "C"},
                     {"string": 4, "fret": 2, "finger": 2, "note": "E"}, {"string": 3, "fret": 0, "note": "G"},
                     {"string": 2, "fret": 1, "finger": 1, "note": "C"}, {"string": 1, "fret": 0, "note": "E"}]
        r = client.post("/submit_audio",
                        data={"chord_name": "C", "chord_notes": "C,E,G", "chord_positions": json.dumps(positions)},
                        files={"audio": ("c.wav", wav, "audio/wav")}, headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["evaluation"]["score"] == 1.0
        hist = client.get("/api/progress/chord/C/history", headers=headers)
        assert hist.status_code in (200, 404, 422) and (hist.status_code != 200 or hist.json() == [])

    def test_missing_notes_are_reported_for_a_built_chord(self, client):
        wav = (LESSONS / "C_major" / "reference.wav").read_bytes()
        r = client.post("/submit_audio", data={"chord_name": "Cadd9", "chord_notes": "C,E,G,D"},
                        files={"audio": ("c.wav", wav, "audio/wav")})
        assert r.status_code == 200, r.text
        assert "D" in r.json()["evaluation"]["missing_notes"]

    def test_bad_built_chord_input(self, client):
        wav = (LESSONS / "C_major" / "reference.wav").read_bytes()
        for data in ({"chord_name": "Cadd9", "chord_notes": "C,E,Q"},
                     {"chord_name": "<x>", "chord_notes": "C,E,G"},
                     {"chord_name": "C", "chord_notes": "C,E,G", "chord_positions": "[{\"string\": 9}]"}):
            r = client.post("/submit_audio", data=data, files={"audio": ("c.wav", wav, "audio/wav")})
            assert r.status_code == 422, data
        # an unknown chord with no notes is still a 404
        assert client.post("/submit_audio", data={"chord_name": "Cadd9"},
                           files={"audio": ("c.wav", wav, "audio/wav")}).status_code == 404
