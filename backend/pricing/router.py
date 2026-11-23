"""The pricing experiment: which Pro price people would pay, before anything is charged.

Each visitor sees one price variant (assigned in the browser). Visits and
"tell me when Pro is ready" clicks are counted per variant; admins see the
conversion. Nothing is sold and nothing is locked.
"""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user_optional, require_role
from auth.rate_limit import RateLimiter, client_ip
from db.engine import get_db
from db.models import PricingEvent, User

router = APIRouter(prefix="/api/pricing", tags=["pricing"])
_limiter = RateLimiter("pricing", max_hits=30, window_seconds=3600)

# The prices each variant shows (USD). Change them here and on the pricing page together.
VARIANTS = {"A": {"monthly": 4.99, "yearly": 39.99}, "B": {"monthly": 7.99, "yearly": 59.99}}


class ViewIn(BaseModel):
    variant: Literal["A", "B"]


class InterestIn(BaseModel):
    variant: Literal["A", "B"]
    plan: Literal["monthly", "yearly"]
    email: Optional[EmailStr] = None


@router.post("/view", status_code=204)
async def view(body: ViewIn, request: Request, db: AsyncSession = Depends(get_db)) -> None:
    key = client_ip(request)
    await _limiter.check(db, key)
    await _limiter.hit(db, key)
    db.add(PricingEvent(kind="view", variant=body.variant))
    await db.commit()


@router.post("/interest", status_code=201)
async def interest(body: InterestIn, request: Request, user: User | None = Depends(get_current_user_optional),
                   db: AsyncSession = Depends(get_db)) -> dict:
    key = client_ip(request)
    await _limiter.check(db, key)
    await _limiter.hit(db, key)
    user_id = user.id if user else None
    db.add(PricingEvent(kind="interest", variant=body.variant, plan=body.plan, user_id=user_id,
                        email=(str(body.email).lower() if body.email else None)))
    await db.commit()
    return {"status": "noted"}


@router.get("/results", dependencies=[Depends(require_role("admin"))])
async def results(db: AsyncSession = Depends(get_db)) -> dict:
    rows = (await db.execute(
        select(PricingEvent.variant, PricingEvent.kind, PricingEvent.plan, func.count()).group_by(PricingEvent.variant, PricingEvent.kind, PricingEvent.plan)
    )).all()
    out = {v: {"prices": p, "views": 0, "interest": 0, "monthly": 0, "yearly": 0} for v, p in VARIANTS.items()}
    for variant, kind, plan, n in rows:
        r = out.setdefault(variant, {"prices": {}, "views": 0, "interest": 0, "monthly": 0, "yearly": 0})
        if kind == "view":
            r["views"] += n
        else:
            r["interest"] += n
            if plan in ("monthly", "yearly"):
                r[plan] += n
    for r in out.values():
        r["conversion"] = round(r["interest"] / r["views"], 4) if r["views"] else None
    emails = (await db.execute(select(func.count(func.distinct(PricingEvent.email))).where(PricingEvent.email.is_not(None)))).scalar_one()
    return {"variants": out, "emails": emails}
