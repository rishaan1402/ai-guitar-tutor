"""Personalised practice plan endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.engine import get_db
from db.models import User
from personalization.planner import build_daily_plan, build_weekly_plan

router = APIRouter(prefix="/api/plan", tags=["personalization"])


@router.get("/next")
async def get_daily_plan(
    tz: str | None = Query(default=None, max_length=64),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Today's recommended practice plan (5-7 items depending on skill level).
    Each item has: type, chord_key, chord_symbol, description + type-specific extras.
    """
    # read before the planner runs queries (keeps attribute access simple)
    skill, name = user.skill_level, user.display_name
    items = await build_daily_plan(db, user, tz)
    return {
        "skill_level": skill,
        "display_name": name,
        "items": items,
        "total": len(items),
    }


@router.get("/weekly")
async def get_weekly_plan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """7-day practice plan."""
    week = await build_weekly_plan(db, user)
    return {
        "skill_level": user.skill_level,
        "days": week,
    }


@router.get("/changes")
async def get_changes(
    tz: str | None = Query(default=None, max_length=64),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The chord pair to drill next for one-minute changes, plus alternatives."""
    from fastapi import Response

    from personalization.changes import ranked_pairs
    from personalization.mastery import user_mastery
    from personalization.planner import _key_to_symbol, _learning_order, _zone_of

    zone = _zone_of(tz)
    mastery = await user_mastery(db, user.id, zone)
    pairs = await ranked_pairs(db, user.id, zone, mastery, _learning_order())
    if not pairs:
        return Response(status_code=204)

    def out(p):
        a, b = p.pair
        return {"chord_a": a, "chord_b": b, "symbols": [_key_to_symbol(a), _key_to_symbol(b)],
                "target": p.target, "last": p.last, "best": p.best, "drills": p.drills}

    top = out(pairs[0])
    top["reason"] = (f"{top['symbols'][0]} → {top['symbols'][1]}: {top['last']} clean changes "
                     f"last time, aiming for {top['target']}" if top["last"] is not None
                     else f"New pair: aim for {top['target']} clean changes in a minute")
    top["alternatives"] = [out(p) for p in pairs[1:3]]
    return top
