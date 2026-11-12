"""
Regression tests for the round-1 critic findings: chord accuracy on the app's
own reference audio, upload limits, async LLM feedback, auth hardening, input
validation, streaks, planner order and Council guardrails.
"""
from __future__ import annotations

import asyncio
import io
import json
import math
import uuid
import wave
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

LESSONS = Path(__file__).resolve().parents[2] / "data" / "lessons"


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _signup(client, email=None, password="guitar123"):
    email = email or f"user-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/auth/signup",
                    json={"email": email, "password": password, "display_name": "T"})
    assert r.status_code == 201, r.text
    return email, {"Authorization": f"Bearer {r.json()['access_token']}"}


def _wav_bytes(samples: np.ndarray, sr: int = 22050) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes((samples * 32767).clip(-32768, 32767).astype(np.int16).tobytes())
    return buf.getvalue()


def _passed(r) -> bool:
    return r.issue is None and r.score >= 1.0


# ---------------------------------------------------------------------------
# Chord recognition on the app's own reference recordings
# ---------------------------------------------------------------------------

def _refs():
    out = []
    for d in sorted(LESSONS.glob("*/")):
        wav, meta = d / "reference.wav", d / "metadata.json"
        if wav.exists() and meta.exists():
            out.append((d.name, wav, json.loads(meta.read_text())["notes"]))
    return out


@pytest.mark.skipif(not _refs(), reason="no reference audio on disk")
class TestReferenceAudio:
    def test_references_pass_their_own_chord(self):
        from audio_engine import ChordEvaluator
        ev = ChordEvaluator()
        refs = _refs()
        passed = [name for name, wav, notes in refs if _passed(ev.evaluate(str(wav), notes))]
        # was 40/84 with the old chroma+FFT+semitone-dedup pipeline
        assert len(passed) >= 80, f"only {len(passed)}/{len(refs)} references pass"

    def test_all_major7_references_pass(self):
        # the old semitone de-duplication made every maj7 chord impossible
        from audio_engine import ChordEvaluator
        ev = ChordEvaluator()
        maj7 = [(n, w, notes) for n, w, notes in _refs() if n.endswith("_major7")]
        failing = [n for n, w, notes in maj7 if not _passed(ev.evaluate(str(w), notes))]
        assert len(failing) <= 1, failing

    def test_superset_chord_is_not_accepted_as_plain_major(self):
        # C7 / Cmaj7 played when C is asked must not PASS (old FAR: 10 %)
        from audio_engine import ChordEvaluator
        ev = ChordEvaluator()
        refs = {n: (w, notes) for n, w, notes in _refs()}
        wrongly_passed = []
        for name, (wav, _) in refs.items():
            for q in ("_major7", "_dominant7"):
                if name.endswith(q):
                    base = name[: -len(q)] + "_major"
                    if base in refs and _passed(ev.evaluate(str(wav), refs[base][1])):
                        wrongly_passed.append(f"{name} as {base}")
        assert not wrongly_passed, wrongly_passed

    def test_references_never_fail_their_own_chord(self):
        # borderline references may be "unclear" (strum again) but never graded wrong
        from audio_engine import ChordEvaluator
        ev = ChordEvaluator()
        verdicts = {n: ev.evaluate(str(w), notes) for n, w, notes in _refs()}
        failed = [n for n, r in verdicts.items() if r.issue not in (None, "unclear")]
        assert not failed, failed

    def test_a7_asked_as_a_is_unclear_not_pass(self):
        from audio_engine import ChordEvaluator
        r = ChordEvaluator().evaluate(str(LESSONS / "A_dominant7" / "reference.wav"), ["A", "C#", "E"])
        assert r.issue == "unclear"
        assert "G" in r.unclear_notes

    def test_detuned_guitar_still_graded_and_warned(self, tmp_path):
        import soundfile as sf
        from scipy.signal import resample
        from audio_engine import ChordEvaluator
        y, sr = sf.read(str(LESSONS / "G_major" / "reference.wav"), dtype="float32")
        if y.ndim > 1:
            y = y.mean(axis=1)
        # play back 40 cents flat by resampling
        factor = 2 ** (40 / 1200)
        flat = resample(y, int(len(y) * factor)).astype(np.float32)
        p = tmp_path / "flat.wav"
        sf.write(str(p), flat, sr)
        r = ChordEvaluator().evaluate(str(p), ["G", "B", "D"])
        assert r.score == 1.0
        assert r.tuning_cents < -30

    def test_48k_header_is_honoured(self, tmp_path):
        import soundfile as sf
        from scipy.signal import resample_poly
        from audio_engine import ChordEvaluator
        y, sr = sf.read(str(LESSONS / "C_major" / "reference.wav"), dtype="float32")
        if y.ndim > 1:
            y = y.mean(axis=1)
        y48 = resample_poly(y, 48000, sr).astype(np.float32)
        p = tmp_path / "c48.wav"
        sf.write(str(p), y48, 48000)
        assert ChordEvaluator().evaluate(str(p), ["C", "E", "G"]).score == 1.0


class TestUnclearVerdict:
    def test_borderline_extra_is_unclear(self):
        import numpy as np
        from audio_engine import ChordEvaluator
        ev = ChordEvaluator()
        s = np.zeros(12); s[[0, 4, 7]] = 1.0; s[10] = 0.2   # C E G + faint A#
        r = ev._decide(s, {"window_s": (0.0, 1.0)}, ["C", "E", "G"])
        assert r.issue == "unclear" and r.unclear_notes == ["A#"]

    def test_short_window_cannot_pass(self):
        import numpy as np
        from audio_engine import ChordEvaluator
        s = np.zeros(12); s[[0, 4, 7]] = 1.0
        r = ChordEvaluator()._decide(s, {"window_s": (0.0, 0.3)}, ["C", "E", "G"])
        assert r.issue == "unclear"

    def test_unclear_is_not_saved_or_completed(self, client):
        import numpy as np
        from audio_engine import EvaluationResult
        _, headers = _signup(client)
        fake = EvaluationResult(1.0, ["C", "E", "G"], ["C", "E", "G"], [], [], issue="unclear",
                                unclear_notes=["A#"])
        wav = _wav_bytes(np.zeros(22050, dtype=np.float32))
        with patch("main.evaluator.evaluate", return_value=fake):
            r = client.post("/submit_audio", data={"chord_name": "C_major"},
                            files={"audio": ("a.wav", wav, "audio/wav")}, headers=headers)
        body = r.json()
        assert body["state"] == "FEEDBACK"
        assert "strum once more" in body["feedback"]
        assert client.get("/api/progress/chord/C_major/history", headers=headers).json() == []


class TestScoreSemantics:
    def test_one_extra_note_is_not_green(self):
        from audio_engine import ChordEvaluator
        r = ChordEvaluator()._compare_notes(["C", "E", "G", "A#"], ["C", "E", "G"])
        assert r.score < 0.8
        assert r.issue == "extra_notes"


# ---------------------------------------------------------------------------
# /submit_audio
# ---------------------------------------------------------------------------

class TestSubmitAudio:
    def test_oversized_upload_rejected(self, client):
        big = b"RIFF" + b"\0" * (3 * 1024 * 1024)
        r = client.post("/submit_audio", data={"chord_name": "C_major"},
                        files={"audio": ("big.wav", big, "audio/wav")})
        assert r.status_code == 413

    def test_nan_previous_scores_rejected(self, client):
        wav = _wav_bytes(np.zeros(22050, dtype=np.float32))
        r = client.post("/submit_audio",
                        data={"chord_name": "C_major", "previous_scores": "[NaN]"},
                        files={"audio": ("a.wav", wav, "audio/wav")})
        assert r.status_code == 422

    def test_unsupported_format_is_422_and_not_saved(self, client):
        _, headers = _signup(client)
        r = client.post("/submit_audio", data={"chord_name": "A_major"},
                        files={"audio": ("a.webm", b"\x1aE\xdf\xa3junk", "audio/webm")},
                        headers=headers)
        assert r.status_code == 422
        hist = client.get("/api/progress/chord/A_major/history", headers=headers)
        assert hist.status_code == 200 and hist.json() == []

    def test_silence_is_not_saved_as_zero_percent(self, client):
        _, headers = _signup(client)
        wav = _wav_bytes(np.zeros(22050, dtype=np.float32))
        r = client.post("/submit_audio", data={"chord_name": "A_major"},
                        files={"audio": ("a.wav", wav, "audio/wav")}, headers=headers)
        assert r.status_code == 200
        assert r.json()["evaluation"]["issue"] == "no_sound"
        hist = client.get("/api/progress/chord/A_major/history", headers=headers)
        assert hist.json() == []

    def test_reference_audio_scores_100_and_completes(self, client):
        wav = (LESSONS / "C_major" / "reference.wav").read_bytes()
        r = client.post("/submit_audio", data={"chord_name": "C_major"},
                        files={"audio": ("c.wav", wav, "audio/wav")})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["evaluation"]["score"] == 1.0
        assert body["evaluation"]["issue"] is None
        assert body["state"] == "COMPLETED"
        assert "tuning_warning" in body

    def test_no_attempt_cap(self, client):
        wav = _wav_bytes(np.zeros(22050, dtype=np.float32))
        r = client.post("/submit_audio",
                        data={"chord_name": "C_major", "previous_scores": "[0.3,0.4,0.5,0.6]"},
                        files={"audio": ("a.wav", wav, "audio/wav")})
        assert r.json()["state"] == "FEEDBACK"


# ---------------------------------------------------------------------------
# Feedback generator
# ---------------------------------------------------------------------------

class TestFeedback:
    def test_llm_path_is_awaited(self):
        from feedback_engine import FeedbackGenerator
        client = MagicMock()
        resp = MagicMock()
        resp.choices = [MagicMock()]
        resp.choices[0].message.content = "Press finger 2 harder."
        client.chat.completions.create = AsyncMock(return_value=resp)
        ev = {"score": 0.67, "issue": "muted_string", "missing_notes": ["E"],
              "expected_notes": ["C", "E", "G"], "detected_notes": ["C", "G"], "extra_notes": []}
        with patch("feedback_engine.generator._get_groq_client", return_value=client):
            text = asyncio.run(FeedbackGenerator().agenerate(ev, chord_name="C"))
        assert text == "Press finger 2 harder."
        client.chat.completions.create.assert_awaited_once()

    def test_llm_failure_falls_back_to_template(self):
        from feedback_engine import FeedbackGenerator
        client = MagicMock()
        client.chat.completions.create = AsyncMock(side_effect=RuntimeError("boom"))
        ev = {"score": 0.67, "issue": "muted_string", "missing_notes": ["E"],
              "expected_notes": ["C", "E", "G"], "detected_notes": ["C", "G"], "extra_notes": []}
        with patch("feedback_engine.generator._get_groq_client", return_value=client):
            text = asyncio.run(FeedbackGenerator().agenerate(ev))
        assert "E" in text

    def test_leads_with_fingering_fix(self):
        from feedback_engine import FeedbackGenerator
        ev = {"score": 0.67, "issue": "muted_string", "missing_notes": ["E"],
              "expected_notes": ["C", "E", "G"], "detected_notes": ["C", "G"], "extra_notes": []}
        pos = [{"note": "E", "string": 4, "fret": 2, "finger": 2}]
        text = FeedbackGenerator().generate(ev, fingering_positions=pos)
        assert text.startswith("Check finger 2 on string 4, fret 2")
        assert "Almost there" in text

    def test_partial_match_wording(self):
        from feedback_engine import FeedbackGenerator
        ev = {"score": 0.33, "issue": "missing_note", "missing_notes": ["E", "G"],
              "expected_notes": ["C", "E", "G"], "detected_notes": ["C", "A"], "extra_notes": ["A"]}
        assert "only heard 1 of 3" in FeedbackGenerator().generate(ev)

    def test_sounds_like_other_chord(self):
        from feedback_engine import FeedbackGenerator
        ev = {"score": 0.0, "issue": "wrong_chord", "missing_notes": ["C", "E", "G"],
              "expected_notes": ["C", "E", "G"], "detected_notes": ["A", "C", "E"],
              "extra_notes": ["A"], "sounds_like": "Amin"}
        assert "sounded like Amin" in FeedbackGenerator().generate(ev)

    def test_tuning_warning_prefix(self):
        from feedback_engine import FeedbackGenerator
        ev = {"score": 1.0, "issue": None, "missing_notes": [], "extra_notes": [],
              "expected_notes": ["C"], "detected_notes": ["C"],
              "tuning_warning": True, "tuning_cents": -42.0}
        assert FeedbackGenerator().generate(ev).startswith("Your guitar sounds about 42 cents flat")

    def test_find_chord_by_notes(self):
        from lesson_service import LessonService
        ls = LessonService()
        if not ls.list_available_chords():
            pytest.skip("no lessons")
        assert ls.find_chord_by_notes(["A", "C", "E"], exclude="C_major") is not None
        assert ls.find_chord_by_notes(["C", "E", "G"], exclude="C_major") is None


# ---------------------------------------------------------------------------
# Auth hardening
# ---------------------------------------------------------------------------

class TestAuthHardening:
    def test_huge_password_is_422_not_500(self, client):
        r = client.post("/api/auth/signup", json={
            "email": "big@example.com", "password": "x" * 5000, "display_name": "B"})
        assert r.status_code == 422
        r = client.post("/api/auth/login", json={"email": "big@example.com", "password": "x" * 5000})
        assert r.status_code == 422

    def test_password_over_72_bytes_rejected_on_signup(self, client):
        r = client.post("/api/auth/signup", json={
            "email": "long@example.com", "password": "é" * 37, "display_name": "L"})
        assert r.status_code == 422

    def test_email_is_case_insensitive(self, client):
        tag = uuid.uuid4().hex[:6]
        _signup(client, email=f"Alice{tag}@Example.com")
        r = client.post("/api/auth/signup", json={
            "email": f"alice{tag}@example.com", "password": "guitar123", "display_name": "A"})
        assert r.status_code == 409
        r = client.post("/api/auth/login", json={"email": f"ALICE{tag}@example.com", "password": "guitar123"})
        assert r.status_code == 200

    def test_spoofed_forwarded_for_does_not_dodge_lockout(self, client):
        email, _ = _signup(client)
        codes = []
        for i in range(7):
            r = client.post("/api/auth/login", json={"email": email, "password": "wrong-pass"},
                            headers={"X-Forwarded-For": f"10.0.0.{i}, 203.0.113.9"})
            codes.append(r.status_code)
        assert 429 in codes


# ---------------------------------------------------------------------------
# Progress validation + streak
# ---------------------------------------------------------------------------

class TestProgressValidation:
    def test_forged_best_score_rejected(self, client):
        _, headers = _signup(client)
        r = client.post("/api/progress/migrate", headers=headers,
                        json={"chord_name": "A_major", "best_score": 999, "total_attempts": 1})
        assert r.status_code == 422

    def test_unknown_chord_rejected(self, client):
        _, headers = _signup(client)
        r = client.post("/api/progress/migrate", headers=headers,
                        json={"chord_name": "Z" * 500, "best_score": 0.5, "total_attempts": 1})
        assert r.status_code == 422

    def test_quiz_score_bounded(self, client):
        _, headers = _signup(client)
        r = client.post("/api/progress/quiz/x/submit", headers=headers,
                        json={"answers": [], "score": 50})
        assert r.status_code == 422

    def test_calendar_accepts_tz(self, client):
        _, headers = _signup(client)
        r = client.get("/api/progress/calendar?tz=America/Los_Angeles", headers=headers)
        assert r.status_code == 200
        r = client.get("/api/progress/?tz=Not/AZone", headers=headers)
        assert r.status_code == 200


class TestStreak:
    def test_streak_survives_until_end_of_next_day(self):
        from progress.router import _streak_from_dates
        today = date(2026, 11, 12)
        days = [today - timedelta(days=1), today - timedelta(days=2)]
        assert _streak_from_dates(days, today=today) == 2

    def test_streak_broken_after_missed_day(self):
        from progress.router import _streak_from_dates
        today = date(2026, 11, 12)
        assert _streak_from_dates([today - timedelta(days=2)], today=today) == 0


# ---------------------------------------------------------------------------
# Planner
# ---------------------------------------------------------------------------

class TestPlanner:
    @pytest.mark.parametrize("key,symbol", [
        ("A_major7", "Amaj7"), ("A_major", "A"), ("A_minor7", "Am7"),
        ("F#_half_dim7", "F#m7b5"), ("C_dominant7", "C7"), ("E_power", "E5"),
    ])
    def test_key_to_symbol(self, key, symbol):
        from personalization.planner import _key_to_symbol
        assert _key_to_symbol(key) == symbol

    def test_fresh_beginner_starts_with_e_minor_and_gets_a_full_plan(self, client):
        _, headers = _signup(client)
        r = client.get("/api/plan/next", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        items = body["items"] if isinstance(body, dict) and "items" in body else body
        new = [i for i in items if i.get("type") == "new"]
        assert new and new[0]["chord_key"] == "E_minor"
        assert len(items) >= 3


# ---------------------------------------------------------------------------
# Council guardrails
# ---------------------------------------------------------------------------

class TestCouncilGuardrails:
    def test_overlong_query_rejected(self, client):
        r = client.post("/api/council/generate", json={"song_query": "x" * 121})
        assert r.status_code == 422

    def test_missing_key_is_generic_503(self, client):
        with patch("council.ingestion._get_groq_client", return_value=None):
            r = client.post("/api/council/generate", json={"song_query": "Some Song"})
        assert r.status_code == 503
        assert "GROQ" not in r.text

    def test_anonymous_generation_rate_limited(self, client):
        codes = []
        with patch("council.ingestion._get_groq_client", return_value=None):
            for _ in range(6):
                codes.append(client.post("/api/council/generate",
                                         json={"song_query": "Some Song"}).status_code)
        assert codes[:5] == [503] * 5 and codes[5] == 429


class TestRound2Verdicts:
    def test_verdict_field_on_pass(self, client):
        wav = (LESSONS / "C_major" / "reference.wav").read_bytes()
        r = client.post("/submit_audio", data={"chord_name": "C_major"},
                        files={"audio": ("c.wav", wav, "audio/wav")})
        assert r.json()["verdict"] == "pass"

    def test_unclear_reference_take(self, client):
        wav = (LESSONS / "A_dominant7" / "reference.wav").read_bytes()
        r = client.post("/submit_audio", data={"chord_name": "A_major"},
                        files={"audio": ("a7.wav", wav, "audio/wav")})
        body = r.json()
        assert body["verdict"] == "unclear"
        assert body["evaluation"]["score"] < 1.0
        assert body["state"] == "FEEDBACK"

    def test_other_real_chord_named(self, client):
        # Em reference while asked for G major: a clean, different library chord
        wav = (LESSONS / "E_minor" / "reference.wav").read_bytes()
        r = client.post("/submit_audio", data={"chord_name": "C_major"},
                        files={"audio": ("em.wav", wav, "audio/wav")})
        body = r.json()
        assert body["verdict"] in ("fail", "unclear")
        if body["evaluation"].get("sounds_like"):
            assert body["evaluation"]["issue"] == "wrong_chord"
            assert "not C" in body["feedback"]

    def test_silence_verdict(self, client):
        wav = _wav_bytes(np.zeros(22050, dtype=np.float32))
        r = client.post("/submit_audio", data={"chord_name": "C_major"},
                        files={"audio": ("s.wav", wav, "audio/wav")})
        assert r.json()["verdict"] == "no_sound"


class TestTokenRevocation:
    def _tokens(self, client):
        email = f"tok-{uuid.uuid4().hex[:8]}@example.com"
        r = client.post("/api/auth/signup",
                        json={"email": email, "password": "guitar123", "display_name": "T"})
        return email, r.json()

    def test_logout_revokes_access_token(self, client):
        _, t = self._tokens(client)
        h = {"Authorization": f"Bearer {t['access_token']}"}
        assert client.get("/api/auth/me", headers=h).status_code == 200
        client.post("/api/auth/logout", json={"refresh_token": t["refresh_token"]}, headers=h)
        assert client.get("/api/auth/me", headers=h).status_code == 401

    def test_refresh_token_cannot_be_reused(self, client):
        _, t = self._tokens(client)
        first = client.post("/api/auth/refresh", json={"refresh_token": t["refresh_token"]})
        second = client.post("/api/auth/refresh", json={"refresh_token": t["refresh_token"]})
        assert first.status_code == 200 and second.status_code == 401

    def test_refresh_tokens_are_pruned(self, client):
        import asyncio as _a
        email, _ = self._tokens(client)
        for _ in range(14):
            assert client.post("/api/auth/login",
                               json={"email": email, "password": "guitar123"}).status_code == 200

        async def count():
            from sqlalchemy import func, select
            from db.engine import async_session
            from db.models import RefreshToken, User
            async with async_session() as s:
                uid = (await s.execute(select(User.id).where(User.email == email))).scalar_one()
                return (await s.execute(select(func.count()).where(RefreshToken.user_id == uid))).scalar()
        try:
            n = _a.run(count())
        except ImportError:
            pytest.skip("no async_session factory")
        assert n <= 10


class TestSignedInSubmit:
    def test_graded_take_is_saved_for_signed_in_user(self, client):
        # regression: releasing the DB connection mid-request expired `user`,
        # so persisting the attempt raised MissingGreenlet (500)
        _, headers = _signup(client)
        wav = (LESSONS / "C_major" / "reference.wav").read_bytes()
        r = client.post("/submit_audio", data={"chord_name": "C_major"},
                        files={"audio": ("c.wav", wav, "audio/wav")}, headers=headers)
        assert r.status_code == 200, r.text
        hist = client.get("/api/progress/chord/C_major/history", headers=headers).json()
        assert len(hist) == 1 and hist[0]["score"] == 1.0

    def test_stray_note_wording(self):
        from feedback_engine import FeedbackGenerator
        ev = {"score": 0.99, "issue": "unclear", "unclear_notes": ["G"],
              "expected_notes": ["A", "C#", "E"], "missing_notes": [], "extra_notes": [],
              "detected_notes": ["A", "C#", "E"]}
        text = FeedbackGenerator().generate(ev)
        assert "stray G" in text and "Listen for" not in text


class TestRound3Auth:
    def test_revoked_token_on_optional_endpoint_is_401_not_anonymous(self, client):
        # a signed-in learner whose token expired must be told, not silently
        # downgraded to anonymous (their takes would stop being saved)
        email = f"r3-{uuid.uuid4().hex[:8]}@example.com"
        t = client.post("/api/auth/signup", json={
            "email": email, "password": "guitar123", "display_name": "R"}).json()
        h = {"Authorization": f"Bearer {t['access_token']}"}
        client.post("/api/auth/logout", json={"refresh_token": t["refresh_token"]}, headers=h)
        wav = (LESSONS / "C_major" / "reference.wav").read_bytes()
        r = client.post("/submit_audio", data={"chord_name": "C_major"},
                        files={"audio": ("c.wav", wav, "audio/wav")}, headers=h)
        assert r.status_code == 401

    def test_garbage_token_is_401(self, client):
        r = client.get("/api/songs/", headers={"Authorization": "Bearer not-a-jwt"})
        assert r.status_code == 401

    def test_no_token_is_still_anonymous(self, client):
        wav = (LESSONS / "C_major" / "reference.wav").read_bytes()
        r = client.post("/submit_audio", data={"chord_name": "C_major"},
                        files={"audio": ("c.wav", wav, "audio/wav")})
        assert r.status_code == 200


class TestRound3Requests:
    def test_json_nan_is_422(self, client):
        r = client.post("/api/auth/login", content=b'{"email":"a@b.co","password":NaN}',
                        headers={"content-type": "application/json"})
        assert r.status_code == 422

    def test_chunked_oversize_is_413_with_cors(self, client):
        def gen():
            for _ in range(40):
                yield b"x" * 65536
        r = client.post("/submit_audio", content=gen(),
                        headers={"content-type": "multipart/form-data; boundary=zz",
                                 "Origin": "https://example.org"})
        assert r.status_code == 413
        assert r.headers.get("access-control-allow-origin")


class TestRound3Chord:
    @staticmethod
    def _ref(chord):
        import soundfile as sf
        y, sr = sf.read(str(LESSONS / chord / "reference.wav"), dtype="float32")
        return (y.mean(axis=1) if y.ndim > 1 else y), sr

    def test_sixty_cents_sharp_is_out_of_tune_not_wrong(self, tmp_path):
        import soundfile as sf
        from scipy.signal import resample
        from audio_engine import ChordEvaluator
        y, sr = self._ref("G_major")
        sharp = resample(y, int(len(y) / 2 ** (60 / 1200))).astype(np.float32)
        p = tmp_path / "sharp.wav"
        sf.write(str(p), sharp, sr)
        r = ChordEvaluator().evaluate(str(p), ["G", "B", "D"])
        assert r.issue in ("out_of_tune", None)
        if r.issue == "out_of_tune":
            assert r.tuning_cents > 30 and r.score < 1.0

    def test_tap_before_strum_still_grades(self, tmp_path):
        import soundfile as sf
        from audio_engine import ChordEvaluator
        y, sr = self._ref("C_major")
        lead = np.zeros(int(0.6 * sr), dtype=np.float32)
        click = np.zeros(int(0.15 * sr), dtype=np.float32)
        click[:40] = 0.9 * np.hanning(40)               # sharp key tap
        take = np.concatenate([lead[: int(0.3 * sr)], click, lead[: int(0.0 * sr)], y])
        p = tmp_path / "tap.wav"
        sf.write(str(p), take, sr)
        r = ChordEvaluator().evaluate(str(p), ["C", "E", "G"])
        assert r.issue in (None, "unclear"), (r.issue, r.detected_notes)

    def test_out_of_tune_is_not_saved(self, client):
        from audio_engine import EvaluationResult
        _, headers = _signup(client)
        fake = EvaluationResult(0.99, ["C", "E", "G"], ["C", "E", "G"], [], [],
                                issue="out_of_tune", tuning_cents=58.0)
        wav = _wav_bytes(np.zeros(22050, dtype=np.float32))
        with patch("main.evaluator.evaluate", return_value=fake):
            r = client.post("/submit_audio", data={"chord_name": "C_major"},
                            files={"audio": ("a.wav", wav, "audio/wav")}, headers=headers)
        body = r.json()
        assert body["verdict"] == "out_of_tune" and body["state"] == "FEEDBACK"
        assert "58 cents sharp" in body["feedback"]
        assert client.get("/api/progress/chord/C_major/history", headers=headers).json() == []

    def test_played_chord_is_named_from_strengths(self, client):
        wav = (LESSONS / "G_major" / "reference.wav").read_bytes()
        r = client.post("/submit_audio", data={"chord_name": "C_major"},
                        files={"audio": ("g.wav", wav, "audio/wav")})
        body = r.json()
        assert body["verdict"] == "fail"
        assert body["evaluation"].get("sounds_like") == "G major"
        assert "G major, not C major" in body["feedback"]
