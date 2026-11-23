"""Practice reminders: settings, browser subscriptions, and the hourly run."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from reminders import router as rr
from reminders.router import reminder_message
from tests.test_teacher_scoping import _user

LONDON_HOUR = lambda: datetime.now(timezone.utc).astimezone(__import__("zoneinfo").ZoneInfo("Europe/London")).hour  # noqa: E731


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("REMINDER_CRON_SECRET", "cron-secret")
    monkeypatch.setattr(rr.webpush, "vapid_public_key", lambda: "test-public-key")
    from main import app
    with TestClient(app) as c:
        yield c


def _sub(n=None):
    return {"endpoint": f"https://push.example/{n or uuid.uuid4().hex}", "p256dh": "B" * 87, "auth": "a" * 22}


def test_settings_and_subscriptions(client):
    h, _ = _user(client)
    assert client.get("/api/reminders", headers=h).json()["hour"] is None
    assert client.put("/api/reminders", json={"hour": 19, "tz": "Europe/London"}, headers=h).json() == {"hour": 19, "tz": "Europe/London"}
    assert client.put("/api/reminders", json={"hour": 25, "tz": "UTC"}, headers=h).status_code == 422
    s = _sub()
    assert client.post("/api/reminders/subscriptions", json=s, headers=h).status_code == 204
    assert client.post("/api/reminders/subscriptions", json=s, headers=h).status_code == 204  # same browser again
    assert client.get("/api/reminders", headers=h).json()["browsers"] == 1
    assert client.post("/api/reminders/subscriptions", json={**s, "endpoint": "http://insecure.example/x"}, headers=h).status_code == 422
    assert client.request("DELETE", "/api/reminders/subscriptions", json=s, headers=h).status_code == 204
    assert client.get("/api/reminders", headers=h).json()["browsers"] == 0


def test_run_needs_the_secret(client):
    assert client.post("/api/reminders/run").status_code == 404
    assert client.post("/api/reminders/run", headers={"X-Reminder-Secret": "wrong"}).status_code == 404


def test_run_notifies_only_who_is_due_and_once_a_day(client, monkeypatch):
    sent = []

    async def fake_send(endpoint, p256dh, auth, message, **kw):
        sent.append((endpoint, message))
        return 410 if "gone" in endpoint else 201

    monkeypatch.setattr(rr.webpush, "send", fake_send)
    hour = LONDON_HOUR()
    due, _ = _user(client)
    client.put("/api/reminders", json={"hour": hour, "tz": "Europe/London"}, headers=due)
    client.post("/api/reminders/subscriptions", json=_sub("due-" + uuid.uuid4().hex), headers=due)
    client.post("/api/reminders/subscriptions", json=_sub("gone-" + uuid.uuid4().hex), headers=due)
    later, _ = _user(client)  # reminder at another hour
    client.put("/api/reminders", json={"hour": (hour + 3) % 24, "tz": "Europe/London"}, headers=later)
    client.post("/api/reminders/subscriptions", json=_sub("later-" + uuid.uuid4().hex), headers=later)
    played, _ = _user(client)  # due, but already practised today
    client.put("/api/reminders", json={"hour": hour, "tz": "Europe/London"}, headers=played)
    client.post("/api/reminders/subscriptions", json=_sub("played-" + uuid.uuid4().hex), headers=played)
    wav = open("../data/lessons/G_major/reference.wav", "rb").read()
    assert client.post("/submit_audio", data={"chord_name": "G_major"}, files={"audio": ("g.wav", wav, "audio/wav")}, headers=played).status_code == 200

    r = client.post("/api/reminders/run", headers={"X-Reminder-Secret": "cron-secret"}).json()
    endpoints = [e for e, _ in sent]
    assert any("due-" in e for e in endpoints)
    assert not any("later-" in e or "played-" in e for e in endpoints)
    assert r["removed"] >= 1  # the unsubscribed browser is forgotten
    assert all(m["title"] and m["url"] == "/studio" for _, m in sent)
    before = len(sent)
    client.post("/api/reminders/run", headers={"X-Reminder-Secret": "cron-secret"})
    assert not any("due-" in e for e, _ in sent[before:])  # once a day


def test_message_follows_the_streak():
    assert reminder_message(0, 0, False)["title"] == "Time to play"
    assert "6-day streak" in reminder_message(6, 0, False)["title"]
    assert "rest day" in reminder_message(9, 1, True)["title"].lower()
