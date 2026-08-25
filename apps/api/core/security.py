from __future__ import annotations
import hashlib, hmac, time
from dataclasses import dataclass
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from .config import settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Actor:
    username: str
    role: str
    division: str


def hash_pw(pw: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), b"railbloc-salt", 60_000).hex()


def create_token(username: str, role: str, division: str) -> str:
    payload = {"sub": username, "role": role, "division": division,
               "exp": int(time.time()) + settings.access_token_expire_minutes * 60}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Actor:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token")
    return Actor(claims["sub"], claims["role"], claims["division"])


def get_actor(creds=Depends(bearer)) -> Actor:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    return decode_token(creds.credentials)


def require_roles(*roles: str):
    async def dep(actor: Actor = Depends(get_actor)) -> Actor:
        if actor.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"requires role in {roles}")
        return actor
    return dep


def verify_source_credentials(system: str, key: str) -> None:
    """TEL-001/XC-011: machine feeds authenticate with per-source keys, not human roles."""
    expected = settings.ingest_keys().get(system)
    if not expected or not key or not hmac.compare_digest(expected, key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid source credentials for {system}")


def actor_from_query(request: Request) -> Optional[Actor]:
    token = request.query_params.get("token")
    return decode_token(token) if token else None
