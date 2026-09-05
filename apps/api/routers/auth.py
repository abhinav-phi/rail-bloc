from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_session
from ..core.security import Actor, create_token, get_actor, hash_pw, legacy_hash_pw, limiter
from ..schemas.models import LoginIn, TokenOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginIn, session: AsyncSession = Depends(get_session)):
    row = (await session.execute(text(
        "SELECT username, password_hash, salt, role, division FROM auth.users WHERE username = :u"),
        {"u": body.username})).mappings().first()
    if row is None:
        raise HTTPException(401, "invalid credentials")
        
    pw_hash = hash_pw(body.password, row["salt"])
    if pw_hash != row["password_hash"]:
        # Fallback for pre-v1.1 rows: fixed salt + 60k iterations (see legacy_hash_pw).
        # A match triggers the transparent re-salt to the hardened scheme below.
        if legacy_hash_pw(body.password) == row["password_hash"]:
            import secrets
            new_salt = secrets.token_hex(32)
            pw_hash = hash_pw(body.password, new_salt)
            await session.execute(text(
                "UPDATE auth.users SET salt = :s, password_hash = :p WHERE username = :u"
            ), {"s": new_salt, "p": pw_hash, "u": body.username})
            await session.commit()
        else:
            raise HTTPException(401, "invalid credentials")
    elif row["salt"] == "railbloc-salt":
        import secrets
        new_salt = secrets.token_hex(32)
        new_pw_hash = hash_pw(body.password, new_salt)
        await session.execute(text(
            "UPDATE auth.users SET salt = :s, password_hash = :p WHERE username = :u"
        ), {"s": new_salt, "p": new_pw_hash, "u": body.username})
        await session.commit()

    return TokenOut(access_token=create_token(row["username"], row["role"], row["division"]),
                    role=row["role"], division=row["division"])


@router.get("/me")
async def me(actor: Actor = Depends(get_actor)):
    return {"username": actor.username, "role": actor.role, "division": actor.division}
