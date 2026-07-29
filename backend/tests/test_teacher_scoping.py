"""
Teachers may only see students linked to their class (roadmap 1.5),
and students see the work assigned to them (roadmap 1.6).
"""
from __future__ import annotations

import sqlite3
import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import _TEST_DB

PASSWORD = "guitar123"


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _set_role(email: str, role: str) -> None:
    with sqlite3.connect(_TEST_DB) as conn:
        conn.execute("UPDATE users SET role = ? WHERE email = ?", (role, email))


def _user(client, role="student", name="User"):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(
        "/api/auth/signup", json={"email": email, "password": PASSWORD, "display_name": name}
    )
    assert r.status_code == 201, r.text
    if role != "student":
        _set_role(email, role)
        # Re-login so the access token carries the new role
        r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    me = client.get("/api/auth/me", headers=headers).json()
    return headers, me["id"]


def _join(client, student_headers, teacher_headers):
    code = client.get("/api/teacher/invite-code", headers=teacher_headers).json()["code"]
    r = client.post("/api/class/join", json={"code": code.lower()}, headers=student_headers)
    assert r.status_code == 200, r.text
    return code


def _student_ids(client, teacher_headers):
    r = client.get("/api/teacher/students?per_page=100", headers=teacher_headers)
    assert r.status_code == 200, r.text
    return {s["id"] for s in r.json()}


class TestTeacherScoping:
    def test_teacher_sees_only_linked_students(self, client):
        teacher, _ = _user(client, "teacher")
        mine, mine_id = _user(client)
        _, stranger_id = _user(client)
        _join(client, mine, teacher)

        ids = _student_ids(client, teacher)
        assert mine_id in ids
        assert stranger_id not in ids

    def test_unlinked_student_progress_is_404(self, client):
        teacher, _ = _user(client, "teacher")
        _, stranger_id = _user(client)
        for path in (f"/api/teacher/students/{stranger_id}/progress",
                     f"/api/teacher/students/{stranger_id}/report"):
            assert client.get(path, headers=teacher).status_code == 404

    def test_cannot_assign_to_unlinked_student(self, client):
        teacher, _ = _user(client, "teacher")
        _, stranger_id = _user(client)
        r = client.post(
            "/api/teacher/assign",
            json={"student_id": stranger_id, "chord_name": "G_major"},
            headers=teacher,
        )
        assert r.status_code == 404

    def test_other_teachers_class_is_invisible(self, client):
        teacher_a, _ = _user(client, "teacher")
        teacher_b, _ = _user(client, "teacher")
        student, student_id = _user(client)
        _join(client, student, teacher_a)
        assert student_id not in _student_ids(client, teacher_b)
        r = client.get(f"/api/teacher/students/{student_id}/progress", headers=teacher_b)
        assert r.status_code == 404

    def test_analytics_counts_only_own_students(self, client):
        teacher, _ = _user(client, "teacher")
        student, _ = _user(client)
        _user(client)  # someone outside the class
        _join(client, student, teacher)
        r = client.get("/api/teacher/analytics", headers=teacher)
        assert r.status_code == 200
        assert r.json()["total_students"] == 1

    def test_admin_sees_everyone(self, client):
        admin, _ = _user(client, "admin")
        _, stranger_id = _user(client)
        assert stranger_id in _student_ids(client, admin)
        r = client.get(f"/api/teacher/students/{stranger_id}/progress", headers=admin)
        assert r.status_code == 200

    def test_leaving_revokes_access(self, client):
        teacher, teacher_id = _user(client, "teacher")
        student, student_id = _user(client)
        _join(client, student, teacher)
        r = client.delete(f"/api/class/teachers/{teacher_id}", headers=student)
        assert r.status_code == 204
        assert student_id not in _student_ids(client, teacher)

    def test_teacher_can_remove_student(self, client):
        teacher, _ = _user(client, "teacher")
        student, student_id = _user(client)
        _join(client, student, teacher)
        r = client.delete(f"/api/teacher/students/{student_id}", headers=teacher)
        assert r.status_code == 204
        assert student_id not in _student_ids(client, teacher)

    def test_rotated_code_stops_new_joins_but_keeps_members(self, client):
        teacher, _ = _user(client, "teacher")
        member, member_id = _user(client)
        old_code = _join(client, member, teacher)
        new_code = client.post("/api/teacher/invite-code/rotate", headers=teacher).json()["code"]
        assert new_code != old_code

        latecomer, _ = _user(client)
        r = client.post("/api/class/join", json={"code": old_code}, headers=latecomer)
        assert r.status_code == 404
        assert member_id in _student_ids(client, teacher)

    def test_students_cannot_use_teacher_endpoints(self, client):
        student, _ = _user(client)
        assert client.get("/api/teacher/students", headers=student).status_code == 403
        assert client.get("/api/teacher/invite-code", headers=student).status_code == 403


class TestJoinAndAssignments:
    def test_bad_code_404(self, client):
        student, _ = _user(client)
        r = client.post("/api/class/join", json={"code": "NOPE1234"}, headers=student)
        assert r.status_code == 404

    def test_join_is_idempotent_and_lists_teacher(self, client):
        teacher, teacher_id = _user(client, "teacher", name="Ms Strings")
        student, _ = _user(client)
        _join(client, student, teacher)
        _join(client, student, teacher)
        teachers = client.get("/api/class/teachers", headers=student).json()
        assert [t["id"] for t in teachers] == [teacher_id]
        assert teachers[0]["display_name"] == "Ms Strings"

    def test_teacher_cannot_join_a_class(self, client):
        teacher_a, _ = _user(client, "teacher")
        teacher_b, _ = _user(client, "teacher")
        code = client.get("/api/teacher/invite-code", headers=teacher_a).json()["code"]
        r = client.post("/api/class/join", json={"code": code}, headers=teacher_b)
        assert r.status_code == 400

    def test_student_sees_assignments_only_while_in_class(self, client):
        teacher, teacher_id = _user(client, "teacher", name="Coach")
        student, student_id = _user(client)
        _join(client, student, teacher)
        r = client.post(
            "/api/teacher/assign",
            json={"student_id": student_id, "chord_name": "G_major", "note": "Clean strum"},
            headers=teacher,
        )
        assert r.status_code == 201

        items = client.get("/api/class/assignments", headers=student).json()
        assert len(items) == 1
        assert items[0]["chord_name"] == "G_major"
        assert items[0]["teacher_name"] == "Coach"

        client.delete(f"/api/class/teachers/{teacher_id}", headers=student)
        assert client.get("/api/class/assignments", headers=student).json() == []

    def test_deleting_teacher_cleans_up_links(self, client):
        teacher, _ = _user(client, "teacher")
        student, _ = _user(client)
        _join(client, student, teacher)
        r = client.request("DELETE", "/api/auth/me", json={"password": PASSWORD}, headers=teacher)
        assert r.status_code == 204
        assert client.get("/api/class/teachers", headers=student).json() == []
