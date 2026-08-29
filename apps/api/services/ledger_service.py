"""FR-022 — every state mutation writes its ledger row in the SAME transaction.
Goes through audit.append_event(): the advisory lock is taken in its own statement
BEFORE the INSERT, so the sealing statement's snapshot already contains every
committed predecessor (READ COMMITTED snapshot-before-lock-wait flaw — see
data/sql/03_ledger_triggers.sql). Returns the sealed row's hash."""
from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def append(session: AsyncSession, event_type: str, actor_id: str, payload: dict) -> str:
    res = await session.execute(text(
        "SELECT audit.append_event(:t, :a, CAST(:p AS jsonb))"),
        {"t": event_type, "a": actor_id, "p": json.dumps(payload, default=str)})
    return str(res.scalar())
