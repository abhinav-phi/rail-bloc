"""FR-004 WTT parser upload path + FOIS forecast reads (TASK-010)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_session
from ..core.security import Actor, require_roles, verify_source_credentials
from ..schemas.models import TimetableUploadIn
from ..services.ledger_service import append

router = APIRouter(prefix="/api/v1/operations", tags=["operations"])


@router.post("/timetable/upload")
async def timetable_upload(body: TimetableUploadIn,
                           actor: Actor = Depends(require_roles("ADMIN", "ENGINEER")),
                           session: AsyncSession = Depends(get_session)):
    """Admin upload path; the CRON feed path authenticates with INGEST_KEY_* instead."""
    upserted = 0
    for row in body.rows:
        sec = (await session.execute(text(
            "SELECT id FROM infrastructure.block_sections WHERE section_code = :c AND is_active"),
            {"c": row.section_code})).scalar()
        if sec is None:
            raise HTTPException(400, f"unknown section {row.section_code}")
        await session.execute(text(
            """INSERT INTO operations.train_paths
               (train_number, train_type, section_id, scheduled_entry, scheduled_exit,
                priority_rank, source)
               VALUES (:n,:t,:s,:e,:x,:p,:src)
               ON CONFLICT (train_number, section_id, scheduled_entry) DO UPDATE SET
                 scheduled_exit = EXCLUDED.scheduled_exit, priority_rank = EXCLUDED.priority_rank"""),
            {"n": row.train_number, "t": row.train_type, "s": str(sec),
             "e": row.scheduled_entry, "x": row.scheduled_exit, "p": row.priority_rank,
             "src": row.source})
        upserted += 1
    await append(session, "TIMETABLE_UPLOADED", actor.username, {"rows": upserted})
    await session.commit()
    return {"upserted": upserted}


@router.post("/feeds/wtt-poll")
async def wtt_poll(x_source_system: str = "...", x_source_key: str = "...",
                   session: AsyncSession = Depends(get_session)):
    """Machine-credential CRON poll endpoint (FR-001 class). In production this would
    pull from the real TMS/WTT feed; here it validates per-source credentials and
    reports readiness — the worker beat job performs the actual simulated ingest."""
    verify_source_credentials(x_source_system, x_source_key)
    n = (await session.execute(text("SELECT count(*) FROM operations.train_paths"))).scalar()
    return {"source": x_source_system, "paths_on_record": int(n), "status": "OK"}
