"""APP-001 / FR-027 — required idempotency keys. A retried POST with the same key
returns the stored original response and performs NO second effect: exactly one
ledger row, one state transition, one outbox entry per key."""
from __future__ import annotations

import json

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def check_replay(session: AsyncSession, key: str, endpoint: str, actor_id: str) -> dict | None:
    if not key:
        raise HTTPException(400, "idempotency_key is required")
    row = (await session.execute(text(
        "SELECT response FROM audit.idempotency_keys "
        "WHERE key = :k AND endpoint = :e AND actor_id = :a"),
        {"k": key, "e": endpoint, "a": actor_id})).mappings().first()
    if row is None:
        return None
    stored = dict(row["response"])
    stored["replayed"] = True
    return stored


async def record(session: AsyncSession, key: str, endpoint: str, actor_id: str, response: dict) -> None:
    await session.execute(text(
        "INSERT INTO audit.idempotency_keys (key, endpoint, actor_id, response) "
        "VALUES (:k, :e, :a, CAST(:r AS jsonb))"),
        {"k": key, "e": endpoint, "a": actor_id,
         "r": json.dumps(response, default=str)})
