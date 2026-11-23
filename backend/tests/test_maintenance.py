"""Housekeeping deletes only rows nobody can use, and is safe to run twice."""
from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from db.engine import async_session
from db.models import LessonSessionDB, PasswordResetToken, RateCounter, RefreshToken, User
from maintenance import interval_hours, sweep


def test_sweep_removes_only_what_has_expired():
    from main import app
    with TestClient(app):  # schema ready
        pass
    now = datetime.now(timezone.utc)
    tag = uuid.uuid4().hex[:8]

    async def go():
        async with async_session() as db:
            user = User(email=f"m-{tag}@example.com", password_hash="!social", display_name="M", role="student", skill_level="beginner")
            db.add(user)
            await db.flush()
            db.add_all([
                LessonSessionDB(lesson_id=f"old-{tag}", song_data={}, lesson_data={}, chord_scores={}, expires_at=now - timedelta(hours=1)),
                LessonSessionDB(lesson_id=f"live-{tag}", song_data={}, lesson_data={}, chord_scores={}, expires_at=now + timedelta(days=5)),
                PasswordResetToken(user_id=user.id, token_hash=f"a{tag}".ljust(64, "0"), expires_at=now - timedelta(days=2)),
                PasswordResetToken(user_id=user.id, token_hash=f"b{tag}".ljust(64, "0"), expires_at=now + timedelta(minutes=20)),
                RefreshToken(user_id=user.id, token_hash=f"c{tag}".ljust(64, "0"), expires_at=now - timedelta(days=1)),
                RefreshToken(user_id=user.id, token_hash=f"d{tag}".ljust(64, "0"), expires_at=now + timedelta(days=3)),
                RateCounter(name="t-sweep", key=tag, bucket=int(time.time()) - 3 * 24 * 3600, count=4),
                RateCounter(name="t-sweep", key=tag, bucket=int(time.time()), count=1),
            ])
            await db.commit()
            first = await sweep(db)
            again = await sweep(db)
            left = {
                "sessions": sorted(r.lesson_id for r in (await db.execute(LessonSessionDB.__table__.select().where(LessonSessionDB.lesson_id.like(f"%{tag}")))).all()),
                "resets": (await db.execute(PasswordResetToken.__table__.select().where(PasswordResetToken.user_id == user.id))).all(),
                "refresh": (await db.execute(RefreshToken.__table__.select().where(RefreshToken.user_id == user.id))).all(),
                "counters": (await db.execute(RateCounter.__table__.select().where(RateCounter.key == tag))).all(),
            }
            return first, again, left

    first, again, left = asyncio.run(go())
    assert first["lesson_sessions"] >= 1 and first["password_reset_tokens"] >= 1
    assert first["refresh_tokens"] >= 1 and first["rate_counters"] >= 1
    assert all(v == 0 for v in again.values())
    assert left["sessions"] == [f"live-{tag}"]
    assert len(left["resets"]) == 1 and len(left["refresh"]) == 1 and len(left["counters"]) == 1


def test_runs_only_on_cloud_run_by_default(monkeypatch):
    monkeypatch.delenv("K_SERVICE", raising=False)
    monkeypatch.delenv("MAINTENANCE_INTERVAL_HOURS", raising=False)
    assert interval_hours() == 0
    monkeypatch.setenv("K_SERVICE", "x")
    assert interval_hours() == 6
    monkeypatch.setenv("MAINTENANCE_INTERVAL_HOURS", "0")
    assert interval_hours() == 0
