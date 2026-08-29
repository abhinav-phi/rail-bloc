"""FR-023 — ledger integrity verification (REPEATABLE READ snapshot) + explorer feed."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.chronicle.verifier import verify_ledger

from ..core.database import get_session
from ..core.security import Actor, require_roles

router = APIRouter(prefix="/api/v1/ledger", tags=["ledger"])


@router.get("/verify")
async def verify(actor: Actor = Depends(require_roles("AUDITOR", "ADMIN")),
                 session: AsyncSession = Depends(get_session)):
    res = await verify_ledger(session)
    await session.commit()  # end the REPEATABLE READ snapshot cleanly
    return {"chain_ok": res.chain_ok, "total": res.total, "verified": res.verified,
            "first_broken_seq": res.first_broken_seq,
            "verdict": "tamper-EVIDENT chain intact" if res.chain_ok else "CHAIN BROKEN",
            "isolation": "REPEATABLE READ"}


@router.get("/entries")
async def entries(limit: int = Query(100, le=500), offset: int = 0,
                  event_type: str | None = None,
                  actor: Actor = Depends(require_roles("AUDITOR", "ADMIN")),
                  session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(text(
        """SELECT seq, event_id, event_type, actor_id, payload_json, prev_seq, prev_hash, hash, created_at
           FROM audit.action_ledger
           WHERE (CAST(:e AS varchar) IS NULL OR event_type = :e)
           ORDER BY seq DESC LIMIT :l OFFSET :o"""),
        {"e": event_type, "l": limit, "o": offset})).mappings().all()
    return [{"seq": r["seq"], "event_id": str(r["event_id"]), "event_type": r["event_type"],
             "actor_id": r["actor_id"], "payload": r["payload_json"],
             "prev_seq": r["prev_seq"], "prev_hash": r["prev_hash"], "hash": r["hash"],
             "created_at": r["created_at"]} for r in rows]
