"""FR-007 solve trigger + job polling. Per-division/horizon Redis lock prevents racing
solves (DB-003 companion); the run registry is optimization.solver_runs (RES-04)."""
from __future__ import annotations

import json
import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..core.database import get_session
from ..core.security import Actor, require_roles
from ..schemas.models import SolveIn, TaskOut
from ..services.ledger_service import append

router = APIRouter(prefix="/api/v1/optimize", tags=["optimize"])


@router.post("/solve", response_model=TaskOut, status_code=202)
async def solve(body: SolveIn, actor: Actor = Depends(require_roles("SR_DOM", "ADMIN")),
                session: AsyncSession = Depends(get_session)):
    if actor.role != "ADMIN" and actor.division != body.division:
        raise HTTPException(403, "cross-division solve denied")
    r = aioredis.from_url(settings.redis_url)
    lock = f"solve:{body.division}:{body.horizon}"
    try:
        if not await r.set(lock, actor.username, nx=True, ex=300):
            raise HTTPException(409, "a solve for this division/horizon is already running")
    finally:
        await r.aclose()
    run_id = str(uuid.uuid4())
    await session.execute(text(
        "INSERT INTO optimization.solver_runs (id, horizon, division, status) VALUES (:i, :h, :d, 'QUEUED')"),
        {"i": run_id, "h": body.horizon, "d": body.division})
    await append(session, "SOLVE_REQUESTED", actor.username,
                 {"run_id": run_id, "horizon": body.horizon, "division": body.division})
    await session.commit()
    from apps.workers.tasks import run_solve
    run_solve.delay(run_id)
    return TaskOut(task_id=run_id, status="QUEUED")


@router.get("/status/{task_id}")
async def status(task_id: str, actor: Actor = Depends(require_roles(
        "SR_DOM", "DRM", "CONTROLLER", "ENGINEER", "AUDITOR", "ADMIN")),
        session: AsyncSession = Depends(get_session)):
    row = (await session.execute(text(
        "SELECT status, stats, created_at, completed_at FROM optimization.solver_runs WHERE id = :i"),
        {"i": task_id})).mappings().first()
    if row is None:
        raise HTTPException(404, "unknown task")
    return {"task_id": task_id, "status": row["status"],
            "stats": row["stats"] if isinstance(row["stats"], dict) else json.loads(row["stats"] or "{}"),
            "created_at": row["created_at"], "completed_at": row["completed_at"]}
