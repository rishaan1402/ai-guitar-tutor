"""
/submit_audio must work without server-side session state, so requests
can land on any Cloud Run instance (roadmap 1.1).
"""
from __future__ import annotations

import io
import json
import uuid
import wave

import numpy as np
import pytest
from fastapi.testclient import TestClient

SR = 22050
G_MAJOR_HZ = (196.00, 246.94, 293.66)  # G3, B3, D4


def _chord_wav(freqs=G_MAJOR_HZ, duration: float = 1.0) -> bytes:
    t = np.linspace(0, duration, int(SR * duration), endpoint=False)
    signal = sum(np.sin(2 * np.pi * f * t) for f in freqs)
    signal = (signal / np.max(np.abs(signal)) * 0.6 * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(signal.tobytes())
    return buf.getvalue()


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _submit(client, data=None, session_id=None):
    headers = {"X-Session-Id": session_id or str(uuid.uuid4())}
    files = {"audio": ("recording.wav", _chord_wav(), "audio/wav")}
    return client.post("/submit_audio", files=files, data=data or {}, headers=headers)


class TestStatelessSubmit:
    def test_scores_without_learn_chord(self, client):
        # A brand-new session id, as if the request hit a different instance
        resp = _submit(client, data={"chord_name": "G_major"})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["attempt"] == 1
        assert 0.0 <= body["evaluation"]["score"] <= 1.0
        assert body["state"] in ("FEEDBACK", "COMPLETED")
        assert "feedback" in body
        assert "_evaluation" not in body

    def test_attempt_number_comes_from_previous_scores(self, client):
        resp = _submit(client, data={"chord_name": "G_major", "previous_scores": json.dumps([0.3])})
        assert resp.status_code == 200, resp.text
        assert resp.json()["attempt"] == 2

    def test_third_attempt_completes(self, client):
        resp = _submit(
            client, data={"chord_name": "G_major", "previous_scores": json.dumps([0.1, 0.2])}
        )
        assert resp.json()["state"] == "COMPLETED"

    def test_alternating_instances_never_not_ready(self, client):
        # Every request uses a fresh session id; none may fail with "Not ready"
        for _ in range(10):
            resp = _submit(client, data={"chord_name": "G_major"})
            assert resp.status_code == 200, resp.text

    def test_unknown_chord_404(self, client):
        resp = _submit(client, data={"chord_name": "Z_major"})
        assert resp.status_code == 404

    def test_bad_previous_scores_422(self, client):
        resp = _submit(client, data={"chord_name": "G_major", "previous_scores": "nope"})
        assert resp.status_code == 422


class TestLegacySessionPathRemoved:
    def test_without_chord_name_is_422(self, client):
        resp = _submit(client)
        assert resp.status_code == 422

    def test_learn_chord_endpoint_is_gone(self, client):
        assert client.post("/learn_chord", json={"chord_name": "G_major"}).status_code in (404, 405)
        assert client.get("/session").status_code in (404, 405)
        assert client.post("/reset").status_code in (404, 405)
