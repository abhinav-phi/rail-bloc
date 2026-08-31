from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass

import jwt
import redis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

limiter = Limiter(key_func=get_remote_address)

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Actor:
    username: str
    role: str
    division: str


_FALLBACK_REVOKED: set[str] = set()
_FALLBACK_TICKETS: dict[str, dict[str, str]] = {}


def _redis_client() -> redis.Redis | None:
    try:
        return redis.Redis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        return None


def _revoked_key(jti: str) -> str:
    return f"jwt:revoked:{jti}"


def _stream_ticket_key(ticket: str) -> str:
    return f"stream:ticket:{ticket}"


def _fetch_revoked_jti(jti: str) -> bool:
    client = _redis_client()
    if client is None:
        return jti in _FALLBACK_REVOKED
    try:
        return bool(client.get(_revoked_key(jti))) or jti in _FALLBACK_REVOKED
    except redis.exceptions.ConnectionError:
        return jti in _FALLBACK_REVOKED


def _store_setex(key: str, value: str, ttl_seconds: int) -> None:
    client = _redis_client()
    if client is not None:
        try:
            client.setex(key, ttl_seconds, value)
            return
        except redis.exceptions.ConnectionError:
            pass
    if key.startswith("jwt:revoked:"):
        _FALLBACK_REVOKED.add(value)
    elif key.startswith("stream:ticket:"):
        _FALLBACK_TICKETS[key] = {"value": value}


def hash_pw(pw: str, salt: str | bytes = "") -> str:
    salt_bytes = salt.encode() if isinstance(salt, str) else salt
    if not salt_bytes:
        salt_bytes = os.urandom(32)
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt_bytes, 600_000).hex()


def create_token(username: str, role: str, division: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "division": division,
        "jti": uuid.uuid4().hex,
        "iat": int(time.time()),
        "exp": int(time.time()) + settings.access_token_expire_minutes * 60,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def revoke_token(token: str) -> str:
    claims = jwt.decode(token, options={"verify_signature": False})
    jti = claims.get("jti")
    if not jti:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "token does not include jti")
    expires_in = max(1, int(float(claims.get("exp", time.time() + 60)) - time.time()))
    _store_setex(_revoked_key(jti), jti, expires_in)
    return jti


def decode_token(token: str) -> Actor:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token")
    jti = claims.get("jti")
    if not jti:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token missing jti")
    if _fetch_revoked_jti(jti):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token revoked")
    return Actor(claims["sub"], claims["role"], claims["division"])


def issue_stream_ticket(actor: Actor) -> str:
    ticket = uuid.uuid4().hex
    payload = {"sub": actor.username, "role": actor.role, "division": actor.division}
    client = _redis_client()
    if client is not None:
        try:
            client.setex(_stream_ticket_key(ticket), 60, json.dumps(payload))
            return ticket
        except redis.exceptions.ConnectionError:
            pass
    _FALLBACK_TICKETS[ticket] = payload
    return ticket


def actor_from_ticket(ticket: str | None) -> Actor | None:
    if not ticket:
        return None
    client = _redis_client()
    if client is not None:
        try:
            raw = client.get(_stream_ticket_key(ticket))
            if not raw:
                return None
            client.delete(_stream_ticket_key(ticket))
            try:
                claims = json.loads(raw)
            except json.JSONDecodeError:
                return None
            return Actor(claims["sub"], claims["role"], claims["division"])
        except redis.exceptions.ConnectionError:
            pass

    claims = _FALLBACK_TICKETS.pop(ticket, None)
    if not claims:
        return None
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


def actor_from_query(request: Request) -> Actor | None:
    ticket = request.query_params.get("ticket")
    if ticket:
        return actor_from_ticket(ticket)
    token = request.query_params.get("token")
    if token:
        try:
            return decode_token(token)
        except HTTPException:
            return None
    return None
