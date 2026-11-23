"""Song library: generated lessons are stored once, found again, resumed and saved per account."""
from __future__ import annotations

import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from council import library
from tests.test_api import _CANNED_SONG_JSON, _CANNED_SUMMARY, _groq


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _song_json(title: str, artist: str = "Test Artist") -> str:
    d = json.loads(_CANNED_SONG_JSON)
    d["song_title"], d["artist"] = title, artist
    return json.dumps(d)


@contextmanager
def _llm(song_json: str | None, council: bool = True):
    """Patch the LLM: ``None`` means that stage must not be called (it would 503)."""
    with patch("council.ingestion._get_groq_client", return_value=_groq(song_json) if song_json else None), \
         patch("council.agents._get_groq_client", return_value=_groq(_CANNED_SUMMARY) if council else None), \
         patch("council.chairman._get_groq_client", return_value=_groq(_CANNED_SUMMARY) if council else None), \
         patch("feedback_engine.generator._get_groq_client", return_value=_groq(_CANNED_SUMMARY)):
        yield


def _generate(client, query, **kw):
    return client.post("/api/council/generate", json={"song_query": query}, **kw)


def _signup(client):
    r = client.post("/api/auth/signup", json={
        "email": f"lib-{uuid.uuid4().hex[:8]}@example.com", "password": "guitar123", "display_name": "L"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class TestKeys:
    def test_query_key_ignores_case_punctuation_spacing_accents(self):
        assert library.query_key("  Let It  Be!! ") == library.query_key("let it be")
        assert library.query_key("Café del Mar") == library.query_key("cafe del mar")

    def test_song_key_drops_leading_the_on_artist(self):
        assert library.song_key("Let It Be", "The Beatles") == library.song_key("let it be", "Beatles")
        assert library.song_key("Help", "Beatles") != library.song_key("Help!", "Oasis")


class TestCache:
    def test_same_query_is_served_without_any_llm_call(self, client):
        title = f"Cache Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title)):
            first = _generate(client, title)
        assert first.status_code == 200, first.text
        with _llm(None, council=False):  # any LLM call would now fail with 503
            again = _generate(client, f"  {title.upper()}!  ")
        assert again.status_code == 200, again.text
        a, b = first.json(), again.json()
        assert a["song_id"] and a["song_id"] == b["song_id"]
        assert a["lesson_id"] != b["lesson_id"]  # each learner gets their own session
        assert b["chairman_summary"] == a["chairman_summary"]

    def test_different_wording_same_song_skips_the_council(self, client):
        title = f"Wording Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title)):
            first = _generate(client, f"{title} by Test Artist")
        with _llm(_song_json(title), council=False):  # ingestion only; the council must not run
            second = _generate(client, f"play {title} please")
        assert second.status_code == 200, second.text
        assert second.json()["song_id"] == first.json()["song_id"]

    def test_cached_songs_do_not_use_up_the_hourly_limit(self, client):
        title = f"Limit Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title)):
            assert _generate(client, title).status_code == 200
        with _llm(None, council=False):
            codes = [_generate(client, title).status_code for _ in range(7)]
        assert codes == [200] * 7


class TestResume:
    def _lesson(self, client, headers=None):
        title = f"Resume Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title)):
            r = _generate(client, title, headers=headers or {})
        assert r.status_code == 200, r.text
        return r.json()

    def test_live_session_comes_back_with_its_scores(self, client):
        lesson = self._lesson(client)
        key = lesson["practice_chords"][0]["chord_key"]
        with _llm(_song_json("x")):
            tip = client.post("/api/council/practice/tip", json={
                "lesson_id": lesson["lesson_id"], "chord_key": key, "chord_symbol": "G", "score": 0.7,
                "detected_notes": ["G"], "missing_notes": [], "extra_notes": [], "attempt": 1})
        assert tip.status_code == 200, tip.text
        r = client.post("/api/council/session/resume", json={"lesson_id": lesson["lesson_id"], "song_id": lesson["song_id"]})
        assert r.status_code == 200
        body = r.json()
        assert body["resumed"] is True and body["lesson"]["lesson_id"] == lesson["lesson_id"]
        assert body["chord_scores"][key] == [0.7]

    def test_expired_session_starts_fresh_from_the_song(self, client):
        lesson = self._lesson(client)
        r = client.post("/api/council/session/resume", json={"lesson_id": "gone", "song_id": lesson["song_id"]})
        assert r.status_code == 200
        fresh = r.json()["lesson"]
        assert r.json()["resumed"] is False and fresh["lesson_id"] != lesson["lesson_id"]
        assert fresh["song_id"] == lesson["song_id"]
        # and the new session works for practice
        with _llm(_song_json("x")):
            tip = client.post("/api/council/practice/tip", json={
                "lesson_id": fresh["lesson_id"], "chord_key": fresh["practice_chords"][0]["chord_key"],
                "chord_symbol": "G", "score": 0.5, "detected_notes": [], "missing_notes": [], "extra_notes": [],
                "attempt": 1})
        assert tip.status_code == 200, tip.text

    def test_unknown_song_is_404(self, client):
        assert client.post("/api/council/session/resume", json={"song_id": str(uuid.uuid4())}).status_code == 404
        assert client.post("/api/council/session/resume", json={"song_id": "not-a-uuid"}).status_code == 404

    def test_someone_elses_session_is_not_returned(self, client):
        owner = _signup(client)
        lesson = self._lesson(client, headers=owner)
        r = client.post("/api/council/session/resume", json={"lesson_id": lesson["lesson_id"], "song_id": lesson["song_id"]})
        assert r.status_code == 200
        assert r.json()["lesson"]["lesson_id"] != lesson["lesson_id"]  # a fresh one, not the owner's

    def test_using_a_session_pushes_its_expiry_back(self, client):
        import asyncio
        from sqlalchemy import update
        from council import session_store
        from db.engine import async_session
        from db.models import LessonSessionDB

        lesson = self._lesson(client)
        soon = datetime.now(timezone.utc) + timedelta(hours=1)

        async def _check():
            async with async_session() as db:
                await db.execute(update(LessonSessionDB).where(LessonSessionDB.lesson_id == lesson["lesson_id"]).values(expires_at=soon))
                await db.commit()
                assert await session_store.get_session(db, lesson["lesson_id"]) is not None
                row = (await db.execute(
                    LessonSessionDB.__table__.select().where(LessonSessionDB.lesson_id == lesson["lesson_id"]))).first()
                exp = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
                assert exp > datetime.now(timezone.utc) + timedelta(days=29)

        asyncio.run(_check())


class TestAccountLibrary:
    def test_requires_sign_in(self, client):
        assert client.get("/api/council/library").status_code == 401

    def test_save_list_remove(self, client):
        h = _signup(client)
        title = f"Library Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title, "The Band")):
            song_id = _generate(client, title, headers=h).json()["song_id"]
        assert client.put(f"/api/council/library/{song_id}", headers=h).status_code == 204
        assert client.put(f"/api/council/library/{song_id}", headers=h).status_code == 204  # idempotent
        songs = client.get("/api/council/library", headers=h).json()["songs"]
        assert [(s["song_id"], s["title"], s["artist"]) for s in songs] == [(song_id, title, "The Band")]
        # another account doesn't see it
        assert client.get("/api/council/library", headers=_signup(client)).json()["songs"] == []
        assert client.delete(f"/api/council/library/{song_id}", headers=h).status_code == 204
        assert client.get("/api/council/library", headers=h).json()["songs"] == []

    def test_unknown_song_cannot_be_saved(self, client):
        h = _signup(client)
        assert client.put(f"/api/council/library/{uuid.uuid4()}", headers=h).status_code == 404
        assert client.put("/api/council/library/nope", headers=h).status_code == 404

    def test_deleting_the_account_removes_saved_songs(self, client):
        h = _signup(client)
        title = f"Delete Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title)):
            song_id = _generate(client, title, headers=h).json()["song_id"]
        client.put(f"/api/council/library/{song_id}", headers=h)
        r = client.request("DELETE", "/api/auth/me", headers=h, json={"password": "guitar123"})
        assert r.status_code == 204, r.text

        import asyncio
        from sqlalchemy import func, select
        from db.engine import async_session
        from db.models import UserSong

        async def _count():
            async with async_session() as db:
                return (await db.execute(select(func.count()).select_from(UserSong).where(
                    UserSong.song_id == uuid.UUID(song_id)))).scalar_one()

        assert asyncio.run(_count()) == 0


# ---------------------------------------------------------------------------
# Wrong chords: confidence, reports, suggested fixes, review
# ---------------------------------------------------------------------------

from tests.test_teacher_scoping import _user  # noqa: E402  (signup + role helper)

CHART = "{title: Fixed}\n{start_of_verse: Verse}\n| G | D | Em | C |\n{end_of_verse}\n"


def _report(client, song_id, reason="wrong"):
    return client.post("/api/reports", json={
        "kind": "song_chart", "reason": reason, "content": "| G | D |", "song_id": song_id})


class TestWrongChords:
    def test_confidence_comes_from_the_ai(self, client):
        title = f"Confidence Song {uuid.uuid4().hex[:6]}"
        d = json.loads(_song_json(title)); d["chord_confidence"] = "low"
        with _llm(json.dumps(d)):
            lesson = _generate(client, title).json()
        assert lesson["chord_confidence"] == "low"
        assert lesson["chords_reported"] == 0 and lesson["chords_corrected"] is False

    def test_reports_count_and_three_reports_rewrite_the_lesson(self, client):
        title = f"Reported Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title)):
            first = _generate(client, title).json()
        sid = first["song_id"]
        assert _report(client, sid, reason="offensive").status_code == 201  # not about the chords
        for _ in range(2):
            assert _report(client, sid).status_code == 201
        with _llm(None, council=False):
            still_cached = _generate(client, title).json()
        assert still_cached["chords_reported"] == 2
        assert _report(client, sid).status_code == 201
        # third report: the next search writes it again (the LLM is called) and reports start over
        with patch("council.ingestion._get_groq_client", return_value=_groq(_song_json(title))), \
             patch("council.agents._get_groq_client", return_value=_groq("Rewritten lesson.")), \
             patch("council.chairman._get_groq_client", return_value=_groq("Rewritten lesson.")), \
             patch("feedback_engine.generator._get_groq_client", return_value=_groq("x")):
            rewritten = _generate(client, title).json()
        assert rewritten["song_id"] == sid and rewritten["chords_reported"] == 0
        assert "Rewritten" in rewritten["chairman_summary"]

    def test_suggest_review_and_publish_a_fix(self, client):
        title = f"Fix Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title)):
            sid = _generate(client, title).json()["song_id"]
        assert client.post(f"/api/council/songs/{sid}/suggest-chart", json={"chart": CHART}).status_code == 401
        learner, _ = _user(client)
        r = client.post(f"/api/council/songs/{sid}/suggest-chart", json={"chart": CHART, "note": "verse is Em"}, headers=learner)
        assert r.status_code == 201, r.text
        # learners can't review
        assert client.get("/api/admin/songs/reported", headers=learner).status_code == 403
        admin, _ = _user(client, role="admin")
        reported = {s["song_id"]: s for s in client.get("/api/admin/songs/reported", headers=admin).json()}
        assert reported[sid]["reports"] == 1
        (sugg,) = reported[sid]["suggestions"]
        assert sugg["chart"] == CHART and "verse is Em" in sugg["note"]
        assert client.post(f"/api/admin/songs/{sid}/chart", json={"chart": sugg["chart"]}, headers=admin).status_code == 204
        # everyone now gets the corrected chart, marked as corrected
        with _llm(None, council=False):
            fixed = _generate(client, title).json()
        assert fixed["chart"] == CHART and fixed["chords_corrected"] is True and fixed["chord_confidence"] == "high"
        assert sid not in {s["song_id"] for s in client.get("/api/admin/songs/reported", headers=admin).json()}
        # a corrected song is not rewritten by later reports
        for _ in range(3):
            _report(client, sid)
        with _llm(None, council=False):
            assert _generate(client, title).json()["chart"] == CHART

    def test_dismiss_clears_reports(self, client):
        title = f"Dismiss Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title)):
            sid = _generate(client, title).json()["song_id"]
        _report(client, sid)
        admin, _ = _user(client, role="admin")
        assert client.post(f"/api/admin/songs/{sid}/dismiss", headers=admin).status_code == 204
        assert sid not in {s["song_id"] for s in client.get("/api/admin/songs/reported", headers=admin).json()}

    def test_unknown_song_suggestion_is_404(self, client):
        learner, _ = _user(client)
        r = client.post(f"/api/council/songs/{uuid.uuid4()}/suggest-chart", json={"chart": CHART}, headers=learner)
        assert r.status_code == 404


class TestPublicSongPages:
    def test_only_trusted_songs_are_listed_and_only_facts(self, client):
        sure, unsure = f"Sure Song {uuid.uuid4().hex[:6]}", f"Unsure Song {uuid.uuid4().hex[:6]}"
        d = json.loads(_song_json(sure)); d["chord_confidence"] = "high"
        with _llm(json.dumps(d)):
            sure_id = _generate(client, sure).json()["song_id"]
        with _llm(_song_json(unsure)):  # medium confidence
            _generate(client, unsure)
        songs = {s["title"]: s for s in client.get("/api/council/songs/public").json()["songs"]}
        assert sure in songs and unsure not in songs
        page = songs[sure]
        assert page["slug"].startswith("sure-song-") and page["song_id"] == sure_id
        assert page["chords"] and "chart" not in page and "lyrics" not in page
        # a learner report takes it off the public pages until it's checked
        client.post("/api/reports", json={"kind": "song_chart", "reason": "wrong", "content": "x", "song_id": sure_id})
        assert sure not in {s["title"] for s in client.get("/api/council/songs/public").json()["songs"]}
