"""Admin-only endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import require_role
from db.engine import get_db
from db.models import ChordAttempt, TransitionDrill, User

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_role("admin"))],
)


class RoleUpdate(BaseModel):
    role: str


class UserListItem(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    role: str
    skill_level: str
    created_at: str


@router.get("/users", response_model=list[UserListItem])
async def list_users(
    page: int = 1,
    per_page: int = 20,
    role: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * per_page
    q = select(User)
    if role:
        q = q.where(User.role == role)
    q = q.offset(offset).limit(per_page).order_by(User.created_at.desc())

    result = await db.execute(q)
    users = result.scalars().all()
    return [
        UserListItem(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            skill_level=u.skill_level,
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]


@router.patch("/users/{user_id}")
async def update_user_role(
    user_id: uuid.UUID,
    body: RoleUpdate,
    db: AsyncSession = Depends(get_db),
):
    if body.role not in ("student", "teacher", "admin"):
        raise HTTPException(400, "Invalid role")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    user.role = body.role
    await db.commit()
    return {"id": str(user.id), "role": user.role}


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    await db.delete(user)
    await db.commit()


@router.get("/stats")
async def system_stats(db: AsyncSession = Depends(get_db)):
    total_users = await db.execute(select(func.count()).select_from(User))
    by_role = await db.execute(
        select(User.role, func.count()).group_by(User.role)
    )
    total_attempts = await db.execute(
        select(func.count()).select_from(ChordAttempt)
    )
    total_drills = await db.execute(
        select(func.count()).select_from(TransitionDrill)
    )

    return {
        "total_users": total_users.scalar(),
        "users_by_role": {r: c for r, c in by_role.all()},
        "total_chord_attempts": total_attempts.scalar(),
        "total_transition_drills": total_drills.scalar(),
    }
