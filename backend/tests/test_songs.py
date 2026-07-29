"""Song sheets: library, private sheets, and class-shared sheets."""
from __future__ import annotations

import sqlite3
import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import _TEST_DB

PASSWORD = "guitar123"
SHEET = """{title: Test Song}
{artist: Me}
{key: G}
{difficulty: beginner}

{start_of_verse: Verse}
| G | C | D | G |
{end_of_verse}
"""


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _user(client, role="student"):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/auth/signup", json={"email": email, "password": PASSWORD, "display_name": role.title()})
    assert r.status_code == 201
    if role != "student":
        with sqlite3.connect(_TEST_DB) as conn:
            conn.execute("UPDATE users SET role = ? WHERE email = ?", (role, email))
        r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class TestLibrary:
    def test_library_is_public(self, client):
        r = client.get("/api/songs")
        assert r.status_code == 200
        songs = r.json()
        assert len(songs) >= 10
        assert all(s["source"] == "library" for s in songs)
        assert any(s["id"] == "lib-amazing-grace" for s in songs)

    def test_library_sheet_has_content(self, client):
        r = client.get("/api/songs/lib-amazing-grace")
        assert r.status_code == 200
        body = r.json()
        assert body["title"] == "Amazing Grace"
        assert body["key"] == "G"
        assert "{start_of_verse" in body["content"]
        assert body["can_edit"] is False

    def test_search_and_difficulty_filter(self, client):
        hits = client.get("/api/songs", params={"q": "blues"}).json()
        assert [s["id"] for s in hits] == ["lib-practice-12-bar-blues"]
        adv = client.get("/api/songs", params={"difficulty": "advanced"}).json()
        assert adv and all(s["difficulty"] == "advanced" for s in adv)

    def test_every_library_sheet_has_title_key_and_difficulty(self, client):
        from songs.router import _LIBRARY
        for sheet_id, song in _LIBRARY.items():
            assert song["title"], sheet_id
            assert song["difficulty"] in ("beginner", "intermediate", "advanced"), sheet_id

    def test_unknown_sheet_404(self, client):
        assert client.get("/api/songs/lib-nope").status_code == 404
        assert client.get("/api/songs/not-a-uuid").status_code == 404


class TestUserSheets:
    def test_create_read_update_delete(self, client):
        me = _user(client)
        r = client.post("/api/songs", json={"content": SHEET}, headers=me)
        assert r.status_code == 201, r.text
        sheet = r.json()
        assert sheet["title"] == "Test Song" and sheet["source"] == "mine" and sheet["can_edit"]

        listed = client.get("/api/songs", headers=me).json()
        assert listed[0]["id"] == sheet["id"]

        r = client.put(f"/api/songs/{sheet['id']}", json={"content": SHEET.replace("Test Song", "Renamed")}, headers=me)
        assert r.json()["title"] == "Renamed"

        assert client.delete(f"/api/songs/{sheet['id']}", headers=me).status_code == 204
        assert client.get(f"/api/songs/{sheet['id']}", headers=me).status_code == 404

    def test_title_required(self, client):
        me = _user(client)
        r = client.post("/api/songs", json={"content": "| G | C |"}, headers=me)
        assert r.status_code == 422

    def test_too_long_rejected(self, client):
        me = _user(client)
        r = client.post("/api/songs", json={"content": "{title: x}\n" + "a" * 60_000}, headers=me)
        assert r.status_code == 422

    def test_private_sheets_are_private(self, client):
        owner, other = _user(client), _user(client)
        sheet = client.post("/api/songs", json={"content": SHEET}, headers=owner).json()
        assert client.get(f"/api/songs/{sheet['id']}", headers=other).status_code == 404
        assert client.get(f"/api/songs/{sheet['id']}").status_code == 404
        assert client.put(f"/api/songs/{sheet['id']}", json={"content": SHEET}, headers=other).status_code == 404
        assert client.delete(f"/api/songs/{sheet['id']}", headers=other).status_code == 404
        assert all(s["id"] != sheet["id"] for s in client.get("/api/songs", headers=other).json())

    def test_students_cannot_share_with_class(self, client):
        me = _user(client)
        r = client.post("/api/songs", json={"content": SHEET, "visibility": "class"}, headers=me)
        assert r.status_code == 403

    def test_requires_login_to_create(self, client):
        assert client.post("/api/songs", json={"content": SHEET}).status_code == 401


class TestClassSheets:
    def test_class_sheet_visible_only_to_linked_students(self, client):
        teacher = _user(client, "teacher")
        member, outsider = _user(client), _user(client)
        code = client.get("/api/teacher/invite-code", headers=teacher).json()["code"]
        client.post("/api/class/join", json={"code": code}, headers=member)

        shared = client.post("/api/songs", json={"content": SHEET, "visibility": "class"}, headers=teacher).json()
        private = client.post("/api/songs", json={"content": SHEET.replace("Test Song", "Draft")}, headers=teacher).json()

        member_ids = {s["id"] for s in client.get("/api/songs", headers=member).json()}
        assert shared["id"] in member_ids
        assert private["id"] not in member_ids

        r = client.get(f"/api/songs/{shared['id']}", headers=member)
        assert r.status_code == 200
        assert r.json()["source"] == "class" and r.json()["can_edit"] is False
        assert client.get(f"/api/songs/{private['id']}", headers=member).status_code == 404
        assert client.get(f"/api/songs/{shared['id']}", headers=outsider).status_code == 404
