"""Pricing experiment: visits and interest per variant; only admins see results."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.test_teacher_scoping import _user


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def test_counts_views_and_interest_per_variant(client):
    admin, _ = _user(client, role="admin")
    before = client.get("/api/pricing/results", headers=admin).json()["variants"]
    for v in ("A", "A", "B"):
        assert client.post("/api/pricing/view", json={"variant": v}).status_code == 204
    assert client.post("/api/pricing/interest", json={"variant": "A", "plan": "yearly", "email": "Fan@Example.com"}).status_code == 201
    learner, _ = _user(client)
    assert client.post("/api/pricing/interest", json={"variant": "B", "plan": "monthly"}, headers=learner).status_code == 201
    after = client.get("/api/pricing/results", headers=admin).json()
    a, b = after["variants"]["A"], after["variants"]["B"]
    assert a["views"] - before["A"]["views"] == 2 and a["yearly"] - before["A"]["yearly"] == 1
    assert b["views"] - before["B"]["views"] == 1 and b["monthly"] - before["B"]["monthly"] == 1
    assert a["prices"] == {"monthly": 4.99, "yearly": 39.99} and after["emails"] >= 1


def test_validation_and_access(client):
    assert client.post("/api/pricing/view", json={"variant": "Z"}).status_code == 422
    assert client.post("/api/pricing/interest", json={"variant": "A", "plan": "weekly"}).status_code == 422
    assert client.post("/api/pricing/interest", json={"variant": "A", "plan": "yearly", "email": "nope"}).status_code == 422
    learner, _ = _user(client)
    assert client.get("/api/pricing/results", headers=learner).status_code == 403
    assert client.get("/api/pricing/results").status_code == 401
