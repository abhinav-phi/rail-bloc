from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.database import get_session
from ..core.security import get_actor, hash_pw, create_token, Actor
from ..schemas.models import LoginIn, TokenOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, session: AsyncSession = Depends(get_session)):
    row = (await session.execute(text(
        "SELECT username, password_hash, role, division FROM auth.users WHERE username = :u"),
        {"u": body.username})).mappings().first()
    if row is None or hash_pw(body.password) != row["password_hash"]:
        raise HTTPException(401, "invalid credentials")
    return TokenOut(access_token=create_token(row["username"], row["role"], row["division"]),
                    role=row["role"], division=row["division"])


@router.get("/me")
async def me(actor: Actor = Depends(get_actor)):
    return {"username": actor.username, "role": actor.role, "division": actor.division}
