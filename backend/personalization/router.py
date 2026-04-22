"""Personalised practice plan endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.engine import get_db
from db.models import User
from personalization.planner import build_daily_plan, build_weekly_plan

router = APIRouter(prefix="/api/plan", tags=["personalization"])


@router.get("/next")
async def get_daily_plan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Today's recommended practice plan (5-7 items depending on skill level).
    Each item has: type, chord_key, chord_symbol, description + type-specific extras.
    """
    items = await build_daily_plan(db, user)
    return {
        "skill_level": user.skill_level,
        "display_name": user.display_name,
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
