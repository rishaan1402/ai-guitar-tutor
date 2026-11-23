"""Practice reminders.

A learner picks an hour; at that hour in their time zone, if they haven't
practised today, each browser they enabled gets a Web Push notification
(the Android app schedules its own on the device). An hourly scheduled job
calls POST /api/reminders/run with REMINDER_CRON_SECRET.
"""
from __future__ import annotations

import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.engine import get_db
from db.models import PushSubscription, User
from progress.router import _zone, practice_days, streak_with_rest
from reminders import webpush

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reminders", tags=["reminders"])


class ReminderSettings(BaseModel):
    hour: Optional[int] = Field(default=None, ge=0, le=23)
    tz: str = Field(default="UTC", max_length=64)


class SubscriptionIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=1000)
    p256dh: str = Field(min_length=20, max_length=200)
    auth: str = Field(min_length=8, max_length=100)


def reminder_message(streak: int, rest_days: int, rested_yesterday: bool) -> dict:
    """What the notification says: about their streak when there is one, never guilt."""
    if streak >= 2 and rested_yesterday:
        title = f"Yesterday was a rest day"
        body = f"Play today to keep your {streak}-day streak going."
    elif streak >= 2:
        title = f"Keep your {streak}-day streak going"
        body = "A few minutes is enough. Your next lesson is ready." + (f" ({rest_days} rest day{'s' if rest_days > 1 else ''} banked.)" if rest_days else "")
    else:
        title = "Time to play"
        body = "Five minutes with your guitar: pick up where you left off."
    return {"title": title, "body": body, "url": "/studio"}


@router.get("")
async def get_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    subs = (await db.execute(select(PushSubscription.id).where(PushSubscription.user_id == user.id))).all()
    return {"hour": user.reminder_hour, "tz": user.reminder_tz or "UTC", "browsers": len(subs), "push_available": webpush.vapid_public_key() is not None}


@router.put("")
async def put_settings(body: ReminderSettings, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    user.reminder_hour = body.hour
    user.reminder_tz = str(_zone(body.tz))
    await db.commit()
    return {"hour": user.reminder_hour, "tz": user.reminder_tz}


@router.get("/vapid-key")
async def vapid_key() -> dict:
    key = webpush.vapid_public_key()
    if not key:
        raise HTTPException(status_code=404, detail="Browser reminders aren't set up.")
    return {"key": key}


@router.post("/subscriptions", status_code=204)
async def add_subscription(body: SubscriptionIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> None:
    if not body.endpoint.startswith("https://"):
        raise HTTPException(status_code=422, detail="Not a push subscription.")
    existing = (await db.execute(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))).scalar_one_or_none()
    if existing:
        existing.user_id, existing.p256dh, existing.auth = user.id, body.p256dh, body.auth
    else:
        db.add(PushSubscription(user_id=user.id, endpoint=body.endpoint, p256dh=body.p256dh, auth=body.auth))
    await db.commit()


@router.delete("/subscriptions", status_code=204)
async def remove_subscription(body: SubscriptionIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> None:
    await db.execute(delete(PushSubscription).where(PushSubscription.user_id == user.id, PushSubscription.endpoint == body.endpoint))
    await db.commit()


@router.post("/run")
async def run_reminders(
    x_reminder_secret: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Hourly: notify everyone whose reminder hour it is and who hasn't practised today."""
    secret = os.environ.get("REMINDER_CRON_SECRET", "")
    if not secret or not hmac.compare_digest(secret, x_reminder_secret):
        raise HTTPException(status_code=404, detail="Not Found")
    if webpush.vapid_public_key() is None:
        return {"due": 0, "sent": 0, "skipped": "VAPID_PRIVATE_KEY not set"}

    rows = (await db.execute(
        select(User).where(User.reminder_hour.is_not(None), User.id.in_(select(PushSubscription.user_id)))
    )).scalars().all()
    due = sent = removed = 0
    now = datetime.now(timezone.utc)
    for user in rows:
        zone = _zone(user.reminder_tz)
        local = now.astimezone(zone)
        if local.hour != user.reminder_hour or user.reminder_sent_on == local.date():
            continue
        days = await practice_days(db, user.id, zone, days=60)
        today = local.date()
        if today in days:
            continue  # already played today
        due += 1
        streak, rest = streak_with_rest(days, today=today)
        rested_yesterday = bool(days) and (today - max(days)).days == 2 and streak > 0
        message = reminder_message(streak, rest, rested_yesterday)
        subs = (await db.execute(select(PushSubscription).where(PushSubscription.user_id == user.id))).scalars().all()
        for sub in subs:
            try:
                status = await webpush.send(sub.endpoint, sub.p256dh, sub.auth, message)
            except Exception:
                logger.exception("Reminder push failed")
                continue
            if status in (404, 410):
                await db.delete(sub)  # the browser unsubscribed
                removed += 1
            elif 200 <= status < 300:
                sent += 1
        user.reminder_sent_on = today
        await db.commit()
    return {"due": due, "sent": sent, "removed": removed}
