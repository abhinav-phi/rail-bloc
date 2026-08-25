"""FR-023 — chain verification. The re-hash runs inside PostgreSQL (audit.verify_ledger)
so JSONB text serialization is identical by construction; Python only orchestrates the
REPEATABLE READ snapshot (API-002: no torn reads mid-write)."""
from __future__ import annotations
from dataclasses import dataclass
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class LedgerVerification:
    chain_ok: bool
    total: int
    verified: int
    first_broken_seq: int | None


async def verify_ledger(session: AsyncSession) -> LedgerVerification:
    await session.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
    row = (await session.execute(text(
        "SELECT n_total, n_verified, first_broken_seq, chain_ok FROM audit.verify_ledger()"
    ))).one()
    return LedgerVerification(bool(row.chain_ok), int(row.n_total), int(row.n_verified),
                              int(row.first_broken_seq) if row.first_broken_seq is not None else None)
