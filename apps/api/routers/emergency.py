"""FR-018/FR-028 — P0 Emergency endpoints (SAFE-003).
Blast-radius modal data, incident creation with coalescing, advisory revocation,
corridor-scoped synchronous re-plan with Sentinel's structural subset inside the
NFR-002 budget, PROVISIONAL plan, and the Controller acknowledgment gate."""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.core.models import SolverParams, SolveWeights
from packages.sentinel.validator import (
    FeedingMapEntry,
    SentinelContext,
    TrainInterval,
    validate_structural_subset,
)

from ..core.config import settings
from ..core.database import get_session
from ..core.security import Actor, get_actor, require_roles
from ..schemas.models import BreakdownIn
from ..services.emergency_service import (
    blast_radius,
    coalesce_or_create_incident,
    fetch_solve_inputs,
    issue_advisory_revocation,
    persist_emergency_plan,
)
from ..services.idempotency_service import check_replay, record
from ..services.ledger_service import append

router = APIRouter(prefix="/api/v1/emergency", tags=["emergency"])


@router.get("/blast-radius")
async def get_blast_radius(section_id: str, estimated_duration_mins: int = 120,
                           actor: Actor = Depends(require_roles(
                               "CONTROLLER", "SR_DOM", "DRM", "ENGINEER", "ADMIN")),
                           session: AsyncSession = Depends(get_session)):
    return await blast_radius(session, section_id, estimated_duration_mins)


@router.post("/breakdown", status_code=201)
async def breakdown(body: BreakdownIn, actor: Actor = Depends(require_roles("CONTROLLER")),
                    session: AsyncSession = Depends(get_session)):
    if not body.confirmation:
        raise HTTPException(400, "blast-radius confirmation flag is required (API-001)")
    replay = await check_replay(session, body.idempotency_key, "/emergency/breakdown", actor.username)
    if replay is not None:
        return replay

    sec = (await session.execute(text(
        "SELECT id, section_code, division FROM infrastructure.block_sections WHERE id = :i AND is_active"),
        {"i": body.section_id})).mappings().first()
    if sec is None:
        raise HTTPException(400, "unknown or inactive section")

    started = datetime.now(UTC)

    # FR-016 wording: validates the target section actually has an active/planned block.
    has_block = (await session.execute(text(
        """SELECT count(*) FROM optimization.block_plans
           WHERE section_id = :s AND approval_status IN ('SENTINEL_PASSED','APPROVED_SR_DOM',
                 'AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED')"""),
        {"s": body.section_id})).scalar()
    if not has_block:
        raise HTTPException(400, "no active or planned block on this section — nothing to supersede")

    incident_id, coalesced_into = await coalesce_or_create_incident(
        session, str(sec["id"]), body.breakdown_type, actor.username, body.estimated_duration_mins)
    superseded = await issue_advisory_revocation(session, str(sec["id"]), incident_id, actor.username)

    # Corridor-scoped re-plan within the NFR-002 budget (scoped solve, never skipped Sentinel).
    affected = await blast_radius(session, str(sec["id"]), body.estimated_duration_mins)
    section_ids = affected["affected_sections"]
    demands, trains, machines = await fetch_solve_inputs(session, section_ids,
                                                         horizon_hours=max(24, body.estimated_duration_mins / 60 * 2))
    run_id = str(uuid.uuid4())
    await session.execute(text(
        "INSERT INTO optimization.solver_runs (id, horizon, division, status) VALUES (:i,'REALTIME',:d,'RUNNING')"),
        {"i": run_id, "d": sec["division"]})

    weights = SolveWeights(pax_delay=settings.objective_weight_pax_delay,
                           frt_delay=settings.objective_weight_frt_delay,
                           shadow_reward=settings.objective_weight_shadow_reward,
                           machine_idle=settings.objective_weight_machine_idle,
                           unaddressed_defect=settings.objective_weight_unaddressed_defect,
                           early_start=settings.objective_weight_early_start)
    params = SolverParams(max_time_seconds=min(settings.emergency_solve_budget_seconds, 35.0),
                          num_workers=settings.solver_num_workers,
                          headway_high_priority_mins=settings.headway_high_priority_mins,
                          headway_default_mins=settings.headway_default_mins,
                          freight_hard_confidence=settings.freight_hard_confidence,
                          max_retries=1)

    def _solve():
        from packages.optima.solver import solve as optima_solve
        return optima_solve(demands, trains, machines, weights, params,
                            horizon="REALTIME", incident_id=incident_id)

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, _solve)
    wall = (datetime.now(UTC) - started).total_seconds()

    plan_id = None
    content_hash_value = None
    if result.candidates:
        cand = max(result.candidates, key=lambda c: len(c.works))
        # Load the OHE feeding map so G&SR-4 has real boundary data even in the drill.
        feeds = {}
        for fsid, secid in (await session.execute(text(
                "SELECT f.id, m.section_id FROM infrastructure.ohe_feeding_sections f "
                "JOIN infrastructure.section_feeding_map m ON m.feeding_section_id = f.id"))).fetchall():
            feeds.setdefault(str(fsid), set()).add(str(secid))
        ctx = SentinelContext(
            train_intervals=[TrainInterval(
                t.section_id,
                t.priority_rank,
                t.scheduled_entry,
                t.scheduled_exit,
                source=t.source,
                forecast_confidence=t.forecast_confidence,
            ) for t in trains],
            feeding_map=[FeedingMapEntry(k, frozenset(v)) for k, v in feeds.items()],
            now=datetime.now(UTC),
            staleness_ttl=timedelta(hours=settings.demand_staleness_ttl_hours),
            headway_high_priority_mins=settings.headway_high_priority_mins)
        structural = validate_structural_subset(cand, ctx)
        failed = [r.check_id.value for r in structural.results if not r.passed]
        if failed:
            # Fail-closed: no emergency plan is shown without a structural pass (R6.4).
            await append(session, "EMERGENCY_REPLAN_FAILED_STRUCTURAL", actor.username,
                         {"incident_id": incident_id, "failed_checks": failed})
            await record(session, body.idempotency_key, "/emergency/breakdown", actor.username,
                         {"status": "FAILED_STRUCTURAL", "failed_checks": failed})
            await session.commit()
            raise HTTPException(500, {"error": "emergency candidate failed structural checks — fail-closed",
                                      "failed_checks": failed})
        plan_id, content_hash_value = await persist_emergency_plan(
            session, cand, incident_id, run_id, actor.username)
        primary = [str(w.demand.id) for w in cand.works]
    else:
        primary = []

    stats = {"status": result.status, "objective": result.objective, "bound": result.best_bound,
             "scheduled": len(primary), "candidates": len(result.candidates),
             "wall_seconds_incl_sentinel": round(wall, 3), "nfr002_budget_s": settings.emergency_solve_budget_seconds}
    await session.execute(text(
        "UPDATE optimization.solver_runs SET status='COMPLETED', completed_at=now(), stats=CAST(:st AS jsonb) WHERE id=:i"),
        {"st": json.dumps(stats), "i": run_id})
    await append(session, "SOLVE_COMPLETED", actor.username, {"run_id": run_id, **stats})

    response = {"incident_id": incident_id, "coalesced_into": coalesced_into,
                "plan_id": plan_id, "content_hash": content_hash_value,
                "plans_superseded": superseded, "provisional": True,
                "awaiting_controller_acknowledgment": True, "measured": stats}
    await record(session, body.idempotency_key, "/emergency/breakdown", actor.username, response)
    await session.commit()
    return response


@router.get("/incidents")
async def list_incidents(actor: Actor = Depends(get_actor),
                         session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(text(
        """SELECT i.*, s.section_code, s.division,
                  (SELECT p.id FROM optimization.block_plans p WHERE p.incident_id = i.id
                   ORDER BY p.created_at DESC LIMIT 1) AS provisional_plan_id
           FROM operations.incidents i JOIN infrastructure.block_sections s ON s.id = i.section_id
           ORDER BY i.created_at DESC LIMIT 50"""))).mappings().all()
    out = []
    for r in rows:
        d = dict(r)
        for k in ("id", "section_id", "coalesced_into_incident_id", "provisional_plan_id"):
            d[k] = str(d[k]) if d[k] else None
        out.append(d)
    return out


@router.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: str, actor: Actor = Depends(require_roles("CONTROLLER")),
                               session: AsyncSession = Depends(get_session)):
    row = (await session.execute(text(
        "SELECT id, controller_acknowledged FROM operations.incidents WHERE id = :i"),
        {"i": incident_id})).mappings().first()
    if row is None:
        raise HTTPException(404, "unknown incident")
    if not row["controller_acknowledged"]:
        await session.execute(text(
            "UPDATE operations.incidents SET controller_acknowledged=true, "
            "controller_ack_actor=:a, controller_ack_at=now() WHERE id=:i"),
            {"a": actor.username, "i": incident_id})
        await append(session, "INCIDENT_ACKNOWLEDGED", actor.username,
                     {"incident_id": incident_id,
                      "note": "PROVISIONAL plan now authoritative for COA transmission"})
        await session.commit()
    plan = (await session.execute(text(
        "SELECT id FROM optimization.block_plans WHERE incident_id = :i ORDER BY created_at DESC LIMIT 1"),
        {"i": incident_id})).scalar()
    return {"incident_id": incident_id, "acknowledged_by": actor.username,
            "provisional_plan_id": str(plan) if plan else None}
