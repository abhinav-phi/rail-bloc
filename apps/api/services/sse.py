import json

import redis.asyncio as aioredis

from ..core.config import settings

_channel = "live_blocks"
_pool: aioredis.Redis | None = None


def client() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _pool


async def publish(event_type: str, data: dict) -> None:
    """Fire-and-forget: a broken/unavailable Redis must never roll back or fail a
    committed state transition (G&SR-3 fail-closed applies to authorizations, not
    to notification fan-out)."""
    try:
        await client().publish(_channel, json.dumps({"event": event_type, **data}, default=str))
    except Exception:
        pass
