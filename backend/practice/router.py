"""Grooves, the learning path, the AI coach and the game layer."""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, get_current_user_optional
from auth.rate_limit import RateLimiter, client_ip
from db.engine import get_db
from db.models import ChordTip, CoachReport, GrooveRun, PathProgress, User, UserGoal
from practice import chordtips, coach, game, grooves, theory
from practice.profile import build_profile

router = APIRouter(prefix="/api", tags=["practice"])

# AI calls cost money: per signed-in user, or per IP when signed out
ai_limiter = RateLimiter(max_hits=60, window_seconds=60 * 60)


def _limit(request: Request, user: Optional[User]) -> None:
    key = f"user:{user.id}" if user else f"ip:{client_ip(request)}"
    ai_limiter.check(key)
    ai_limiter.hit(key)


# ------------------------------------------------------------------ grooves

class GenerateRequest(BaseModel):
    focus: Optional[list[str]] = Field(default=None, max_length=2)
    style: Optional[Literal["pop", "ballad", "rock", "folk"]] = None
    request: Optional[str] = Field(default=None, max_length=300)
    daily: bool = False
    faster: bool = False


@router.post("/grooves/generate", response_model=grooves.GrooveSpec)
async def generate_groove(body: GenerateRequest, request: Request,
                          user: Optional[User] = Depends(get_current_user_optional),
                          db: AsyncSession = Depends(get_db)):
    """A Groove built for this learner (works signed out too, from a beginner profile)."""
    _limit(request, user)
    prof = await build_profile(db, user)
    focus = None
    if body.focus and len(body.focus) == 2:
        focus = [theory.normalise(c) for c in body.focus]
        if not all(focus):
            raise HTTPException(status_code=422, detail="Unknown chord in focus")
    spec = await grooves.generate(prof, focus, body.style, body.request, body.faster)
    if body.daily:
        spec.source = "daily"
        spec.title = f"Today's Groove: {spec.title}"[:60]
    return spec


class ChangeIn(BaseModel):
    from_: str = Field(alias="from", max_length=12)
    to: str = Field(max_length=12)
    status: Literal["on_time", "late", "slow", "missed"]
    offset: float = 0.0


class RunIn(BaseModel):
    title: str = Field(max_length=80)
    source: Literal["preset", "ai", "template", "daily", "path", "song", "fix", "lead"] = "preset"
    mode: Literal["wait", "play", "follow"]
    bpm: int = Field(ge=30, le=240)
    stars: int = Field(ge=0, le=3)
    groove: dict[str, Any] = {}
    changes: list[ChangeIn] = Field(default=[], max_length=400)

    @field_validator("groove")
    @classmethod
    def _small(cls, v: dict[str, Any]) -> dict[str, Any]:
        if len(json.dumps(v)) > 8000:
            raise ValueError("groove too large")
        return v


@router.post("/grooves/runs", status_code=201)
async def save_run(body: RunIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    db.add(GrooveRun(
        user_id=user.id, title=body.title, source=body.source, mode=body.mode, bpm=body.bpm, stars=body.stars,
        groove=body.groove,
        changes=[{"from": c.from_, "to": c.to, "status": c.status, "offset": round(max(-5.0, min(30.0, c.offset)), 2)} for c in body.changes],
    ))
    await db.commit()
    return {"status": "saved"}


@router.get("/grooves/runs")
async def list_runs(limit: int = Query(20, ge=1, le=100), user: User = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(GrooveRun).where(GrooveRun.user_id == user.id)
                             .order_by(GrooveRun.created_at.desc()).limit(limit))).scalars().all()
    return [{"title": r.title, "source": r.source, "mode": r.mode, "bpm": r.bpm, "stars": r.stars,
             "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]


# ------------------------------------------------------------------ learning path

class PathIn(BaseModel):
    session_id: str = Field(pattern=r"^[a-z0-9-]{2,40}$")
    stars: int = Field(ge=0, le=3)


@router.get("/path/progress")
async def path_progress(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(PathProgress).where(PathProgress.user_id == user.id))).scalars().all()
    return {"sessions": {r.session_id: r.stars for r in rows}}


@router.post("/path/progress")
async def save_path(body: PathIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(PathProgress).where(PathProgress.user_id == user.id,
                                                       PathProgress.session_id == body.session_id))).scalar_one_or_none()
    if row is None:
        db.add(PathProgress(user_id=user.id, session_id=body.session_id, stars=body.stars))
    else:
        row.stars = max(row.stars, body.stars)  # keep the best
        row.completed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "saved"}


# ------------------------------------------------------------------ coach

class ChatIn(BaseModel):
    messages: list[coach.ChatMessage] = Field(min_length=1, max_length=20)


@router.post("/coach/chat", response_model=coach.CoachReply)
async def coach_chat(body: ChatIn, request: Request, user: Optional[User] = Depends(get_current_user_optional),
                     db: AsyncSession = Depends(get_db)):
    _limit(request, user)
    prof = await build_profile(db, user)
    return await coach.chat(prof, body.messages)


class GoalIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    chords: list[str] = Field(min_length=1, max_length=24)
    days: int = Field(ge=3, le=90)


def _goal_out(g: UserGoal) -> dict[str, Any]:
    return {"title": g.title, "chords": g.chords, "target_date": g.target_date.isoformat(), "plan": g.plan}


@router.get("/coach/goal")
async def get_goal(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    g = (await db.execute(select(UserGoal).where(UserGoal.user_id == user.id, UserGoal.active.is_(True))
                          .order_by(UserGoal.created_at.desc()))).scalars().first()
    return _goal_out(g) if g else None


@router.post("/coach/goal")
async def set_goal(body: GoalIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    chords = [c for c in (theory.normalise(x) for x in body.chords) if c]
    if not chords:
        raise HTTPException(status_code=422, detail="No chords we can teach in that list")
    for old in (await db.execute(select(UserGoal).where(UserGoal.user_id == user.id, UserGoal.active.is_(True)))).scalars():
        old.active = False
    prof = await build_profile(db, user)
    plan = coach.build_goal_plan(chords, body.days, prof)
    g = UserGoal(user_id=user.id, title=body.title.strip(), chords=chords,
                 target_date=date.today() + timedelta(days=body.days), plan=plan)
    db.add(g)
    await db.commit()
    return _goal_out(g)


@router.delete("/coach/goal", status_code=204)
async def clear_goal(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for g in (await db.execute(select(UserGoal).where(UserGoal.user_id == user.id, UserGoal.active.is_(True)))).scalars():
        g.active = False
    await db.commit()


@router.get("/coach/weekly")
async def weekly_report(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stats = await coach.weekly_stats(db, user)
    week = date.fromisoformat(stats["week_start"])
    cached = (await db.execute(select(CoachReport).where(CoachReport.user_id == user.id,
                                                         CoachReport.week_start == week))).scalar_one_or_none()
    # one written report per day-window; regenerate when the numbers changed
    if cached and cached.stats == stats:
        return {"stats": stats, "summary": cached.summary}
    _limit(request, user)
    prof = await build_profile(db, user)
    summary = await coach.weekly_summary(stats, prof)
    if cached:
        cached.stats, cached.summary = stats, summary
    else:
        db.add(CoachReport(user_id=user.id, week_start=week, stats=stats, summary=summary))
    await db.commit()
    return {"stats": stats, "summary": summary}


# ------------------------------------------------------------------ game layer

@router.get("/game")
async def game_status(tz: Optional[str] = Query(default=None, max_length=64), user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    return await game.game_state(db, user, tz)


# ------------------------------------------------------------------ chord builder

@router.post("/chords/tips")
async def chord_tips(body: chordtips.ChordShapeIn, request: Request,
                     user: Optional[User] = Depends(get_current_user_optional),
                     db: AsyncSession = Depends(get_db)):
    """Coaching tips for a chord shape built in the app. Stored once per shape and shared."""
    key = body.frets_key()
    row = (await db.execute(select(ChordTip).where(ChordTip.symbol == body.symbol, ChordTip.frets == key))).scalar_one_or_none()
    if row is not None:
        return {"tips": row.tips, "source": row.source, "shared": True}
    _limit(request, user)  # only new shapes cost an AI call
    tips = await chordtips.ai_tips(body)
    source = "ai" if tips else "template"
    tips = tips or chordtips.template_tips(body)
    db.add(ChordTip(symbol=body.symbol, frets=key, tips=tips, source=source))
    try:
        await db.commit()
    except Exception:  # someone else stored the same shape a moment ago
        await db.rollback()
    return {"tips": tips, "source": source, "shared": False}
