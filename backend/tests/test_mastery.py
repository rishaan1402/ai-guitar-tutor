"""Mastery = clean takes on 3 separate local days, with spaced re-checks; session recap."""
from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from personalization.mastery import (
    DUE, LEARNING, MASTERED, VERIFYING, _Take, reduce_chord,
)

D = date(2026, 6, 10)


def _t(day: date, clean: bool, score: float | None = None, hour: int = 12) -> _Take:
    ts = datetime(day.year, day.month, day.day, hour, tzinfo=timezone.utc)
    return _Take(day, clean, score if score is not None else (1.0 if clean else 0.5), ts)


class TestReduce:
    def test_three_clean_takes_same_day_is_only_verifying(self):
        m = reduce_chord("E_minor", [_t(D, True, hour=h) for h in (9, 10, 11)], D)
        assert m.stage == VERIFYING and m.clean_days == 1

    def test_three_days_masters_and_schedules_recheck(self):
        m = reduce_chord("E_minor", [_t(D - timedelta(2), True), _t(D - timedelta(1), True),
                                     _t(D, True)], D)
        assert m.stage == MASTERED and m.mastered_on == D and m.next_due == D + timedelta(3)

    def test_failed_takes_never_count(self):
        m = reduce_chord("E_minor", [_t(D - timedelta(i), False, 0.75) for i in range(5)], D)
        assert m.stage == LEARNING and m.clean_days == 0

    def test_recheck_on_time_advances_interval(self):
        takes = [_t(D, True), _t(D + timedelta(1), True), _t(D + timedelta(2), True),
                 _t(D + timedelta(5), True)]
        m = reduce_chord("E_minor", takes, D + timedelta(5))
        assert m.recheck_level == 1 and m.next_due == D + timedelta(5 + 7)

    def test_early_clean_day_does_not_advance(self):
        takes = [_t(D, True), _t(D + timedelta(1), True), _t(D + timedelta(2), True),
                 _t(D + timedelta(3), True)]
        m = reduce_chord("E_minor", takes, D + timedelta(3))
        assert m.recheck_level == 0 and m.next_due == D + timedelta(2 + 3)

    def test_becomes_due(self):
        takes = [_t(D, True), _t(D + timedelta(1), True), _t(D + timedelta(2), True)]
        assert reduce_chord("E_minor", takes, D + timedelta(6)).stage == DUE

    def test_lapse_then_recovery(self):
        base = [_t(D, True), _t(D + timedelta(1), True), _t(D + timedelta(2), True)]
        due_day = D + timedelta(5)
        lapsed = base + [_t(due_day, False, hour=9), _t(due_day, False, hour=10)]
        assert reduce_chord("E_minor", lapsed, due_day).stage == VERIFYING
        recovered = lapsed + [_t(due_day + timedelta(1), True)]
        m = reduce_chord("E_minor", recovered, due_day + timedelta(1))
        assert m.stage == MASTERED and m.recheck_level == 0
        assert m.next_due == due_day + timedelta(1 + 3)

    def test_timezone_splits_days(self):
        from personalization.mastery import local_date
        la = ZoneInfo("America/Los_Angeles")
        a = datetime(2026, 6, 11, 6, 30, tzinfo=timezone.utc)   # 23:30 LA on the 10th
        b = datetime(2026, 6, 11, 7, 30, tzinfo=timezone.utc)   # 00:30 LA on the 11th
        assert local_date(a, la) != local_date(b, la)
        assert local_date(a, ZoneInfo("UTC")) == local_date(b, ZoneInfo("UTC"))


# ---------------------------------------------------------------------------
# HTTP consistency
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _signup(client, role_teacher=False):
    email = f"m-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/auth/signup",
                    json={"email": email, "password": "guitar123", "display_name": "M"})
    return email, {"Authorization": f"Bearer {r.json()['access_token']}"}


def _seed(email: str, rows: list[tuple[str, float, str | None, datetime]]) -> None:
    async def go():
        from sqlalchemy import select
        from db.engine import async_session
        from db.models import ChordAttempt, User
        async with async_session() as s:
            uid = (await s.execute(select(User.id).where(User.email == email))).scalar_one()
            for chord, score, issue, ts in rows:
                s.add(ChordAttempt(user_id=uid, chord_name=chord, score=score, issue=issue,
                                   detected_notes=[], missing_notes=[], extra_notes=[],
                                   feedback_text="", created_at=ts))
            await s.commit()
    asyncio.run(go())


def _days_ago(n: int, hour: int = 12) -> datetime:
    now = datetime.now(timezone.utc).replace(hour=hour, minute=0, second=0, microsecond=0)
    return now - timedelta(days=n)


class TestHttpMastery:
    def test_one_great_take_is_not_mastered_anymore(self, client):
        email, h = _signup(client)
        _seed(email, [("E_minor", 1.0, None, _days_ago(0, 1))])
        body = client.get("/api/progress/", headers=h).json()
        em = next(c for c in body["chords"] if c["chord_name"] == "E_minor")
        assert em["status"] == "in_progress" and em["stage"] == "verifying"
        assert em["clean_days"] == 1 and body["mastered_count"] == 0

    def test_three_days_mastered_everywhere(self, client):
        email, h = _signup(client)
        _seed(email, [("E_minor", 1.0, None, _days_ago(n, 1)) for n in (2, 1, 0)])
        body = client.get("/api/progress/", headers=h).json()
        assert body["mastered_count"] == 1
        plan = client.get("/api/plan/next", headers=h).json()["items"]
        assert all(i.get("chord_key") != "E_minor" or i["type"] in ("warmup", "review")
                   for i in plan)

    def test_verifying_chord_is_focus(self, client):
        email, h = _signup(client)
        _seed(email, [("A_minor", 1.0, None, _days_ago(n, 1)) for n in (2, 1)])
        plan = client.get("/api/plan/next", headers=h).json()["items"]
        focus = [i for i in plan if i["type"] == "focus"]
        assert focus and focus[0]["chord_key"] == "A_minor"
        assert focus[0]["needs"] == "one more clean day"

    def test_imported_scores_never_master(self, client):
        email, h = _signup(client)
        _seed(email, [("E_minor", 0.89, "imported", _days_ago(n)) for n in (3, 2, 1)])
        assert client.get("/api/progress/", headers=h).json()["mastered_count"] == 0


class TestRecap:
    def test_no_activity_is_204(self, client):
        _, h = _signup(client)
        assert client.get("/api/progress/recap", headers=h).status_code == 204

    def test_recap_reports_clean_day_and_next(self, client):
        email, h = _signup(client)
        now = datetime.now(timezone.utc)
        _seed(email, [("E_minor", 1.0, None, _days_ago(2)), ("E_minor", 1.0, None, _days_ago(1)),
                      ("E_minor", 0.5, None, now - timedelta(minutes=6)),
                      ("E_minor", 1.0, None, now - timedelta(minutes=4))])
        r = client.get("/api/progress/recap?tz=UTC", headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["takes"] == 2
        assert body["newly_mastered"] == ["E_minor"]
        assert "mastered" in body["headline"]
        assert body["chords"][0]["first_score"] == 0.5 and body["chords"][0]["best_score"] == 1.0
        assert body["next"] is None or body["next"].get("chord_key") != "E_minor"

    def test_old_burst_excluded(self, client):
        email, h = _signup(client)
        now = datetime.now(timezone.utc)
        _seed(email, [("A_minor", 0.5, None, now - timedelta(minutes=90)),
                      ("C_major", 0.5, None, now - timedelta(minutes=5))])
        body = client.get("/api/progress/recap", headers=h).json()
        assert [c["chord_key"] for c in body["chords"]] == ["C_major"]

    def test_anonymous_401(self, client):
        assert client.get("/api/progress/recap").status_code == 401
