"""Grooves, learning path, coach and game layer."""
from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from practice import coach, grooves, theory
from practice.profile import PairStat, Profile


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _signup(client) -> dict:
    r = client.post("/api/auth/signup", json={"email": f"{uuid.uuid4().hex[:10]}@example.com",
                                              "password": "guitar123", "display_name": "Jo"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def fake_ai(monkeypatch, module, payload: str):
    async def create(**_kw):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=payload))])
    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(module, "_get_groq_client", lambda: fake)


class TestTheory:
    def test_keys_and_substitutes(self):
        assert theory.keys_for(["G", "C", "Em", "D"]) == ["G"]
        assert "C" in theory.keys_for(["Am", "F"])
        assert theory.substitute("Gmaj7", {"G", "C"}) == "G"
        assert theory.substitute("F", {"C", "Am", "Dm"}) in ("Dm", "Am")
        assert theory.normalise("Bbm") == "A#m" and theory.normalise("Hm") is None


class TestGrooveGeneration:
    def prof(self, **kw) -> Profile:
        p = Profile(mastered=["G", "C", "Em", "D"], learning=["Am"], comfort_bpm=72)
        for k, v in kw.items():
            setattr(p, k, v)
        return p

    def test_template_is_valid_and_repeats_focus(self):
        for seed in range(30):
            g = grooves.template_groove(self.prof(), ("G", "C"), seed=seed)
            chords = {c for bar in g.bars for c in bar}
            assert chords <= {"G", "C", "Em", "D", "Am"}
            assert theory.keys_for(sorted(chords))
            assert grooves._count_change(g.bars, "G", "C") >= 1
            assert len(g.strum) == 8 and g.focus == ["G", "C"]

    def test_weakest_pair_becomes_focus(self):
        p = self.prof(pairs=[PairStat("G", "C", 6, 1, 5, 0, 0.9), PairStat("Em", "D", 6, 6, 0, 0, 0.0)])
        assert grooves.pick_focus(p) == ("G", "C")
        assert grooves.pick_focus(p, ["D", "Em"]) == ("D", "Em")

    def test_ai_groove_accepted_when_theory_agrees(self, monkeypatch):
        fake_ai(monkeypatch, grooves, json.dumps({"title": "Neon Rain", "style": "pop", "bpm": 74,
                                                  "bars": [["G"], ["C"], ["G"], ["C"]], "strum": "D.DU.UDU", "tip": "Ring finger leads."}))
        g = asyncio.run(grooves.generate(self.prof(), ["G", "C"]))
        assert g.source == "ai" and g.title == "Neon Rain" and g.key == "G"

    @pytest.mark.parametrize("bad", [
        {"bars": [["G"], ["F#m7b5"], ["G"], ["C"]]},          # a chord they don't know
        {"bars": [["G"], ["D"], ["Em"], ["D"]]},              # focus change never happens
        {"bars": [["G"], ["C"], ["A#"], ["C"]]},              # not one key (and unknown)
        {"bars": "G C G C"},                                   # malformed
    ])
    def test_bad_ai_groove_falls_back_to_template(self, monkeypatch, bad):
        fake_ai(monkeypatch, grooves, json.dumps({"title": "x", "style": "pop", "bpm": 72, "strum": "D.D.D.D.", **bad}))
        g = asyncio.run(grooves.generate(self.prof(), ["G", "C"]))
        assert g.source == "template"

    def test_tempo_adapts(self):
        p = self.prof(last_stars={"G|C": 3})
        assert asyncio.run(grooves.generate(p, ["G", "C"])).bpm == 76
        p = self.prof(last_stars={"G|C": 0})
        assert asyncio.run(grooves.generate(p, ["G", "C"])).bpm == 68


class TestEndpoints:
    def test_generate_signed_out_gives_a_starter_groove(self, client):
        r = client.post("/api/grooves/generate", json={})
        assert r.status_code == 200
        g = r.json()
        assert g["focus"] == ["Em", "Am"] and g["bars"]

    def test_runs_shape_the_next_groove(self, client):
        h = _signup(client)
        changes = [{"from": "Em", "to": "Am", "status": "late", "offset": 1.2}] * 3 + [{"from": "Am", "to": "Em", "status": "on_time", "offset": 0.1}] * 3
        r = client.post("/api/grooves/runs", headers=h, json={"title": "t", "source": "ai", "mode": "play", "bpm": 70, "stars": 1,
                                                             "groove": {"focus": ["Em", "Am"]}, "changes": changes})
        assert r.status_code == 201
        assert client.get("/api/grooves/runs", headers=h).json()[0]["stars"] == 1
        g = client.post("/api/grooves/generate", headers=h, json={"daily": True}).json()
        assert g["focus"] == ["Em", "Am"] and g["title"].startswith("Today's Groove")

    def test_run_validation(self, client):
        h = _signup(client)
        assert client.post("/api/grooves/runs", headers=h, json={"title": "t", "mode": "play", "bpm": 70, "stars": 9}).status_code == 422
        assert client.post("/api/grooves/runs", json={"title": "t", "mode": "play", "bpm": 70, "stars": 1}).status_code == 401

    def test_path_keeps_best_stars(self, client):
        h = _signup(client)
        for s in (2, 1, 3, 2):
            assert client.post("/api/path/progress", headers=h, json={"session_id": "b1-em", "stars": s}).status_code == 200
        assert client.get("/api/path/progress", headers=h).json()["sessions"] == {"b1-em": 3}
        assert client.post("/api/path/progress", headers=h, json={"session_id": "Bad Id!", "stars": 1}).status_code == 422

    def test_goal_plan(self, client):
        h = _signup(client)
        r = client.post("/api/coach/goal", headers=h, json={"title": "Wedding song", "chords": ["G", "D", "Em", "C"], "days": 14})
        assert r.status_code == 200
        g = r.json()
        assert len(g["plan"]["days"]) == 14 and set(g["plan"]["new_chords"]) == {"G", "D", "Em", "C"}
        assert client.get("/api/coach/goal", headers=h).json()["title"] == "Wedding song"
        assert client.delete("/api/coach/goal", headers=h).status_code == 204
        assert client.get("/api/coach/goal", headers=h).json() is None

    def test_coach_falls_back_without_ai(self, client):
        r = client.post("/api/coach/chat", json={"messages": [{"role": "user", "content": "how do I tune?"}]})
        assert r.status_code == 200 and r.json()["actions"][0]["type"] == "tuner"

    def test_weekly_and_game(self, client):
        h = _signup(client)
        client.post("/api/grooves/runs", headers=h, json={"title": "t", "mode": "wait", "bpm": 70, "stars": 3,
                                                          "changes": [{"from": "G", "to": "C", "status": "on_time", "offset": 0}]})
        w = client.get("/api/coach/weekly", headers=h).json()
        assert w["stats"]["grooves"] == 1 and w["summary"]
        g = client.get("/api/game", headers=h).json()
        assert g["xp"] == 30 and g["level"] == 1
        assert {t["id"]: t["done"] for t in g["daily"]["tasks"]} == {"chord": False, "groove": True, "lesson": False}
        assert g["upgrades"][0] == {"id": "lights", "label": "String lights", "level": 2, "unlocked": False}


class TestCoachParsing:
    def test_actions_are_sanitised(self):
        p = Profile(mastered=["G", "C"])
        r = coach._parse_reply(json.dumps({"reply": "Try this.", "actions": [
            {"type": "groove", "label": "Go", "focus": ["G", "C"]}, {"type": "hack", "label": "x"},
            {"type": "practice", "chord": "Zm9"}]}), p)
        assert r and [a.type for a in r.actions] == ["groove"]

    def test_goal_plan_learns_new_chords_first(self):
        p = Profile(mastered=["G", "C"])
        plan = coach.build_goal_plan(["G", "D", "Em", "C"], 10, p)
        assert plan["new_chords"] == ["Em", "D"]
        assert plan["days"][0]["tasks"][0]["type"] == "learn"
        assert any(t["type"] == "song" for t in plan["days"][-1]["tasks"])
