"""App-level endpoints: client config for the mobile app, and reports on AI-written content."""
from __future__ import annotations

import os
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user_optional
from auth.rate_limit import RateLimiter, client_ip
from db.engine import get_db
from council import library
from db.models import ContentReport, User

router = APIRouter(prefix="/api", tags=["app"])

# Reports per ip: generous for a class, too few to flood the table
report_limiter = RateLimiter("report", max_hits=30, window_seconds=60 * 60)


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@router.get("/app/config")
async def app_config():
    """What the installed app checks at launch: a build below ``min_android_build`` must update."""
    return {
        "min_android_build": _int_env("APP_MIN_ANDROID_BUILD", 1),
        "latest_android_build": _int_env("APP_LATEST_ANDROID_BUILD", 1),
        "android_store_url": os.environ.get(
            "APP_ANDROID_STORE_URL", "https://play.google.com/store/apps/details?id=app.openstrings"
        ),
        "message": os.environ.get("APP_UPDATE_MESSAGE", "") or None,
    }


class ReportRequest(BaseModel):
    kind: Literal["feedback", "song_chart", "song_lesson", "tip", "other"]
    reason: Literal["wrong", "offensive", "unsafe", "copyright", "other"]
    content: str = Field(min_length=1, max_length=8000)
    context: Optional[str] = Field(default=None, max_length=200)
    note: Optional[str] = Field(default=None, max_length=500)
    # a song lesson from the song library: "wrong" reports count against its chords
    song_id: Optional[str] = Field(default=None, max_length=40)


@router.post("/reports", status_code=201)
async def report_content(
    body: ReportRequest,
    request: Request,
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Flag AI-generated text. Signed in or not; rate-limited per IP."""
    key = client_ip(request)
    await report_limiter.check(db, key)
    await report_limiter.hit(db, key)
    db.add(ContentReport(
        user_id=user.id if user else None,
        kind=body.kind,
        reason=body.reason,
        content=body.content,
        context=body.context,
        note=(body.note or "").strip() or None,
    ))
    await db.commit()
    song_id = library.parse_song_id(body.song_id) if body.song_id else None
    if song_id and body.reason == "wrong" and body.kind in ("song_chart", "song_lesson"):
        await library.add_report(db, song_id)
    return {"status": "received"}
