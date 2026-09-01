"""Plan reads, revision (FR-026), signal acknowledgments (SAFE-004/G&SR-2), COA
transmission (FR-016 with T-2h structural re-check), execution lifecycle (FR-017),
summary and geo feeds."""
from __future__ import annotations

import decimal
import json
import uuid as uuidlib
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.core.models import (
    DemandInput,
    MachineInfo,
    PlanCandidate,
    ScheduledWork,
)
from packages.sentinel.validator import (
    FeedingMapEntry,
    SentinelContext,
    TrainInterval,
    build_ack_lookup,
    validate_plan,
    validate_structural_subset,
)

from ..core.config import settings
from ..core.database import get_session
from ..core.security import Actor, get_actor, require_roles
from ..schemas.models import AckSignalIn, ReviseIn
from ..services import coa_adapter, sse
from ..services.ledger_service import append
from ..services.plan_lifecycle import (
    check_no_active_overlap,
    load_plan,
    load_shadow_ids,
    recompute_hash,
    revise_plan,
)

router = APIRouter(prefix="/api/v1/plans", tags=["plans"])


def _scope(actor: Actor) -> str | None:
    return None if actor.role in ("AUDITOR", "ADMIN") else actor.division


async def _bundle(session: AsyncSession, plan: dict) -> dict:
    shadows = await load_shadow_ids(session, str(plan["id"]))
    rows = (await session.execute(text(
        """SELECT d.*, s.section_code, s.division, s.start_km, s.end_km
           FROM demands.block_demands d JOIN infrastructure.block_sections s ON s.id = d.section_id
           WHERE d.id = :p OR d.id = ANY(CAST(:sh AS uuid[]))"""),
        {"p": plan["primary_demand_id"], "sh": shadows or [str(plan["primary_demand_id"])]})).mappings().all()
    return {"plan": plan, "shadow_ids": shadows, "demands": [dict(r) for r in rows]}


async def _build_sentinel_context(session: AsyncSession) -> SentinelContext:
    now = datetime.now(UTC)
    trains = [TrainInterval(str(r[0]), int(r[1]), r[2], r[3],
                            source=str(r[4] or "WTT"),
                            forecast_confidence=(json.loads(r[5]).get("forecast_confidence")
                                                 if r[5] else None))
              for r in (await session.execute(text(
                  """SELECT section_id, priority_rank, scheduled_entry, scheduled_exit,
                            source, metadata::text
                     FROM operations.train_paths
                     WHERE scheduled_exit > now() - interval '1 day'"""))).fetchall()]
    committed_windows: dict[str, list[tuple[datetime, datetime]]] = {}
    for sid, pst, pet in (await session.execute(text(
            "SELECT section_id, start_time, end_time FROM optimization.block_plans "
            "WHERE approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED')"))).fetchall():
        committed_windows.setdefault(str(sid), []).append((pst, pet))
    feeds = {}
    for fsid, sec in (await session.execute(text(
            "SELECT f.id, m.section_id FROM infrastructure.ohe_feeding_sections f "
            "JOIN infrastructure.section_feeding_map m ON m.feeding_section_id = f.id"))).fetchall():
        feeds.setdefault(str(fsid), set()).add(str(sec))
    feeding = [FeedingMapEntry(k, frozenset(v)) for k, v in feeds.items()]
    acks = build_ack_lookup((await session.execute(text(
            """SELECT p.content_hash, a.sm_acked_at, a.controller_acked_at
               FROM operations.signal_acknowledgments a
               JOIN optimization.block_plans p ON p.id = a.plan_id"""
    ))).fetchall())
    machines = [MachineInfo(str(r[0]), str(r[1]), float(r[2]), int(r[3]))
                for r in (await session.execute(text(
                    "SELECT machine_code, machine_class, depot_km, transit_speed_kmph FROM infrastructure.machines"))).fetchall()]
    plan_rows = (await session.execute(text(
        """SELECT p.id, p.start_time, p.end_time, p.section_id, s.start_km, s.end_km,
                  d.machinery_req
             FROM optimization.block_plans p
             JOIN infrastructure.block_sections s ON s.id = p.section_id
             LEFT JOIN optimization.plan_shadow_demands psd ON psd.plan_id = p.id
             LEFT JOIN demands.block_demands d ON d.id = p.primary_demand_id OR d.id = psd.demand_id""")).mappings().all())
    machine_assignments: dict[str, list[tuple[datetime, datetime, float]]] = {}
    for row in plan_rows:
        machs = row["machinery_req"] or []
        if not machs:
            continue
        mid_km = (float(row["start_km"]) + float(row["end_km"])) / 2.0
        for machine_code in map(str, machs):
            machine_assignments.setdefault(machine_code, []).append(
                (row["start_time"], row["end_time"], mid_km))
    return SentinelContext(train_intervals=trains, feeding_map=feeding, acks=acks,
                           machine_infos=machines, machine_assignments=machine_assignments, now=now,
                           staleness_ttl=timedelta(hours=settings.demand_staleness_ttl_hours),
                           committed_windows=committed_windows,
                           headway_high_priority_mins=settings.headway_high_priority_mins)


def _candidate_from_bundle(bundle: dict, plan: dict) -> PlanCandidate:
    works = []
    for d in bundle["demands"]:
        works.append(ScheduledWork(
            DemandInput(id=str(d["id"]), section_id=str(d["section_id"]), section_code=d["section_code"],
                        division=d["division"], section_start_km=float(d["start_km"]),
                        section_end_km=float(d["end_km"]), department=d["department"],
                        activity_code=d["activity_code"], min_duration_mins=int(d["min_duration_mins"]),
                        earliest_start=d["earliest_start"], latest_deadline=d["latest_deadline"],
                        urgency_score=float(d["urgency_score"]),
                        machinery=(d["machinery_req"] or []),
                        source_ingested_at=d["source_ingested_at"], features=d["features"] or {}),
            plan["start_time"], plan["end_time"]))
    return PlanCandidate(section_id=str(plan["section_id"]), section_code=plan["section_code"],
                         division=plan["division"], start_time=plan["start_time"],
                         end_time=plan["end_time"], primary_demand_id=str(plan["primary_demand_id"]),
                         works=works, is_shadow_block=bool(plan["is_shadow_block"]),
                         plan_horizon=plan["plan_horizon"],
                         incident_id=str(plan["incident_id"]) if plan.get("incident_id") else None)


@router.get("")
async def list_plans(horizon: str = "WEEKLY", division: str | None = None,
                     status: str | None = None, limit: int = Query(200, ge=1, le=500),
                     actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    div = division or _scope(actor)
    q = text("""SELECT p.*, s.section_code, s.division FROM optimization.block_plans p
                JOIN infrastructure.block_sections s ON s.id = p.section_id
                WHERE p.plan_horizon = :h AND (CAST(:d AS varchar) IS NULL OR s.division = :d)
                  AND (CAST(:st AS varchar) IS NULL OR p.approval_status = :st)
                ORDER BY p.start_time LIMIT :l""")
    rows = (await session.execute(q, {"h": horizon, "d": div, "st": status, "l": limit})).mappings().all()
    return [{"id": str(r["id"]), "section_code": r["section_code"], "division": r["division"],
             "section_id": str(r["section_id"]), "plan_horizon": r["plan_horizon"],
             "start_time": r["start_time"], "end_time": r["end_time"],
             "approval_status": r["approval_status"], "revision_no": r["revision_no"],
             "is_shadow_block": r["is_shadow_block"], "content_hash": r["content_hash"],
             "sentinel_verified": r["sentinel_verified"],
             "loss_pax_minutes": float(r["loss_pax_minutes"]), "loss_frt_minutes": float(r["loss_frt_minutes"]),
             "primary_demand_id": str(r["primary_demand_id"]),
             "decided_by": r["decided_by"], "authorized_by": r["authorized_by"]} for r in rows]


@router.get("/weekly")
async def weekly(division: str | None = None, week_number: int | None = None,
                 actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    return await list_plans(horizon="WEEKLY", division=division or _scope(actor),
                            actor=actor, session=session)


@router.get("/geo")
async def geo(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    secs = (await session.execute(text(
        """SELECT s.id, s.section_code, s.division, s.start_km, s.end_km, s.line_type,
                  ST_AsGeoJSON(s.track_geom) AS geom,
                  EXISTS(SELECT 1 FROM optimization.block_plans p WHERE p.section_id = s.id
                         AND p.approval_status IN ('TRANSMITTED_COA','ACTIVE_GRANTED')
                         AND now() <@ tstzrange(p.start_time, p.end_time)) AS blocked
           FROM infrastructure.block_sections s WHERE s.is_active"""))).mappings().all()
    blocks = (await session.execute(text(
        """SELECT p.id, p.approval_status, p.is_shadow_block, s.section_code,
                  ST_AsGeoJSON(s.track_geom) AS geom, p.start_time, p.end_time
           FROM optimization.block_plans p JOIN infrastructure.block_sections s ON s.id = p.section_id
           WHERE p.approval_status NOT IN ('SUPERSEDED','CANCELLED','FAILED_ESCALATE','ARCHIVED_SEALED')
             AND p.end_time > now() - interval '2 days'"""))).mappings().all()
    ohe = (await session.execute(text(
        "SELECT feeding_section_code, ST_AsGeoJSON(isolator_boundary_geom) AS geom "
        "FROM infrastructure.ohe_feeding_sections"))).mappings().all()
    return {"sections": [{"type": "Feature",
                          "properties": {"id": str(r["id"]), "code": r["section_code"],
                                         "division": r["division"], "start_km": float(r["start_km"]),
                                         "end_km": float(r["end_km"]), "line_type": r["line_type"],
                                         "blocked": bool(r["blocked"])},
                          "geometry": json.loads(r["geom"])} for r in secs],
            "blocks": [{"type": "Feature",
                        "properties": {"id": str(r["id"]), "status": r["approval_status"],
                                       "shadow": bool(r["is_shadow_block"]), "code": r["section_code"],
                                       "start": r["start_time"].isoformat(), "end": r["end_time"].isoformat()},
                        "geometry": json.loads(r["geom"])} for r in blocks],
            "ohe": [{"type": "Feature", "properties": {"code": r["feeding_section_code"]},
                     "geometry": json.loads(r["geom"])} for r in ohe]}


@router.get("/timetable")
async def timetable(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(text(
        """SELECT t.train_number, t.train_type, t.priority_rank, t.scheduled_entry, t.scheduled_exit,
                  t.source, s.start_km, s.end_km, s.section_code
           FROM operations.train_paths t JOIN infrastructure.block_sections s ON s.id = t.section_id
           ORDER BY t.train_number, t.scheduled_entry"""))).mappings().all()
    return [{"train_number": r["train_number"], "train_type": r["train_type"],
             "priority_rank": r["priority_rank"], "source": r["source"],
             "entry": r["scheduled_entry"].isoformat(),
             "exit": r["scheduled_exit"].isoformat(), "start_km": float(r["start_km"]),
             "end_km": float(r["end_km"]), "section_code": r["section_code"]} for r in rows]


@router.get("/summary")
async def summary(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    counts = dict((await session.execute(text(
        "SELECT approval_status AS s, count(*) AS n FROM optimization.block_plans GROUP BY 1"))).fetchall())
    escalated = (await session.execute(text(
        """SELECT d.external_ref_id, d.activity_code, d.urgency_score, s.section_code
           FROM demands.block_demands d JOIN infrastructure.block_sections s ON s.id = d.section_id
           WHERE d.status = 'ESCALATED_OVERDUE' ORDER BY d.urgency_score DESC LIMIT 20"""))).mappings().all()
    machines = (await session.execute(text(
    """SELECT mr.machine_id,
              count(*) AS jobs,
              sum(EXTRACT(EPOCH FROM (p.end_time - p.start_time))/60)
                  AS work_minutes
       FROM optimization.machine_rosters AS mr
       JOIN optimization.block_plans AS p ON p.id = mr.plan_id
       GROUP BY mr.machine_id"""
    ))).fetchall()
    delay = (await session.execute(text(
        "SELECT coalesce(sum(loss_pax_minutes),0), coalesce(sum(loss_frt_minutes),0) "
        "FROM optimization.block_plans WHERE approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED')"))).one()
    demand_counts = dict((await session.execute(text(
        "SELECT status AS s, count(*) AS n FROM demands.block_demands GROUP BY 1"))).fetchall())
    return {"plan_counts": {k: int(v) for k, v in counts.items()},
            "demand_counts": {k: int(v) for k, v in demand_counts.items()},
            "escalated_overdue": [dict(r) for r in escalated],
            "machine_utilization": [{"machine": m[0], "jobs": int(m[1]),
                                     "work_minutes": float(m[2] or 0)} for m in machines],
            "model_estimates": {
                "predicted_pax_delay_minutes": float(delay[0]),
                "predicted_frt_delay_minutes": float(delay[1]),
                "note": "model estimate (B1-relative, simulated data)"}}


@router.get("/{plan_id}")
async def detail(plan_id: str, actor: Actor = Depends(get_actor),
                 session: AsyncSession = Depends(get_session)):
    plan = await load_plan(session, plan_id)
    if plan is None:
        raise HTTPException(404, "plan not found")
    if actor.role not in ("AUDITOR", "ADMIN") and plan["division"] != actor.division:
        raise HTTPException(403, "cross-division access denied")
    bundle = await _bundle(session, plan)
    ack = (await session.execute(text(
        "SELECT sm_actor, sm_acked_at, controller_actor, controller_acked_at "
        "FROM operations.signal_acknowledgments WHERE plan_id = :i"), {"i": plan_id})).mappings().first()
    roster = (await session.execute(text(
        "SELECT machine_id, depot_origin, travel_start, travel_end FROM optimization.machine_rosters "
        "WHERE plan_id = :i"), {"i": plan_id})).mappings().all()

    def ser(v):
        if isinstance(v, uuidlib.UUID):
            return str(v)
        if isinstance(v, datetime):
            return v.isoformat()
        if isinstance(v, decimal.Decimal):
            return float(v)
        return v

    return {"plan": {k: ser(v) for k, v in plan.items()},
            "shadow_ids": bundle["shadow_ids"],
            "demands": [{k: ser(v) for k, v in d.items()} for d in bundle["demands"]],
            "ack": ({k: ser(v) for k, v in ack.items()} if ack else None),
            "roster": [{k: ser(v) for k, v in r.items()} for r in roster]}


@router.get("/{plan_id}/sentinel-report")
async def sentinel_report(plan_id: str, actor: Actor = Depends(get_actor),
                          session: AsyncSession = Depends(get_session)):
    plan = await load_plan(session, plan_id)
    if plan is None:
        raise HTTPException(404, "plan not found")
    bundle = await _bundle(session, plan)
    ctx = await _build_sentinel_context(session)
    candidate = _candidate_from_bundle(bundle, plan)
    verdict = validate_plan(candidate, ctx)
    return {"content_hash": verdict.content_hash, "passed": verdict.passed,
            "has_pending": verdict.has_pending,
            "checks": [{"id": r.check_id.value, "passed": r.passed, "pending": r.pending,
                        "detail": r.detail} for r in verdict.results]}


@router.post("/{plan_id}/acknowledge-signal")
async def acknowledge_signal(plan_id: str, body: AckSignalIn,
                             actor: Actor = Depends(require_roles("STATION_MASTER", "CONTROLLER", "ADMIN")),
                             session: AsyncSession = Depends(get_session)):
    plan = await load_plan(session, plan_id)
    if plan is None:
        raise HTTPException(404, "plan not found")
    role_field = "sm" if body.as_role == "STATION_MASTER" else "controller"
    # Concurrency safety: uq_sigack_plan serializes competing INSERTs for the
    # same plan. A losing request follows the UPDATE path, where the IS NULL
    # predicate provides first-write-wins semantics and prevents an accepted
    # actor/timestamp from being overwritten. Do not remove that predicate.
    await session.execute(text(
        f"""INSERT INTO operations.signal_acknowledgments (plan_id, {role_field}_actor, {role_field}_acked_at)
            VALUES (:p, :a, now())
            ON CONFLICT (plan_id) DO NOTHING"""), {"p": plan_id, "a": actor.username})
    await session.execute(text(
        f"""UPDATE operations.signal_acknowledgments SET {role_field}_actor = :a, {role_field}_acked_at = now()
            WHERE plan_id = :p AND {role_field}_acked_at IS NULL"""), {"p": plan_id, "a": actor.username})
    ack = (await session.execute(text(
        "SELECT sm_acked_at, controller_acked_at FROM operations.signal_acknowledgments WHERE plan_id = :p"),
        {"p": plan_id})).mappings().first()
    both = bool(ack and ack["sm_acked_at"] and ack["controller_acked_at"])
    if both and plan["approval_status"] == "DRAFT":
        ch = await recompute_hash(session, plan)
        await session.execute(text(
            "UPDATE optimization.block_plans SET approval_status = 'SENTINEL_PASSED', "
            "sentinel_verified = true, sentinel_hash = :ch WHERE id = :i AND approval_status = 'DRAFT'"),
            {"ch": ch, "i": plan_id})
        await session.execute(text(
            """UPDATE demands.block_demands SET status = 'SENTINEL_PASSED'
               WHERE status IN ('SCHEDULED_DRAFT','SUBMITTED','NORMALIZED')
                 AND (id = (SELECT primary_demand_id FROM optimization.block_plans WHERE id = :i)
                      OR id IN (SELECT demand_id FROM optimization.plan_shadow_demands WHERE plan_id = :i))"""),
            {"i": plan_id})
        await append(session, "PLAN_SENTINEL_PASSED", actor.username,
                     {"plan_id": plan_id, "via": "signal_acknowledgment", "content_hash": ch})
    await append(session, "SIGNAL_ACKNOWLEDGED", actor.username,
                 {"plan_id": plan_id, "as": body.as_role})
    await session.commit()
    await sse.publish("SIGNAL_ACK", {"plan_id": plan_id, "role": body.as_role})
    return {"plan_id": plan_id, "both_acknowledged": both}


@router.post("/{plan_id}/revise")
async def revise(plan_id: str, body: ReviseIn,
                 actor: Actor = Depends(require_roles("SR_DOM", "ENGINEER", "ADMIN")),
                 session: AsyncSession = Depends(get_session)):
    plan = await load_plan(session, plan_id)
    if plan is None:
        raise HTTPException(404, "plan not found")
    if actor.role != "ADMIN" and plan["division"] != actor.division:
        raise HTTPException(403, "cross-division access denied")
    if plan["approval_status"] in ("TRANSMITTED_COA", "ACTIVE_GRANTED", "COMPLETED_FITNESS", "ARCHIVED_SEALED"):
        raise HTTPException(409, "plan already transmitted; supersede via emergency or cancellation only")
    try:
        new_id = await revise_plan(session, plan, actor.username, body.start_time, body.end_time)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await append(session, "PLAN_REVISED", actor.username,
                 {"old_plan_id": plan_id, "new_plan_id": new_id,
                  "old_revision": plan["revision_no"], "new_revision": plan["revision_no"] + 1})
    await session.commit()
    await sse.publish("PLAN_REVISED", {"old_plan_id": plan_id, "new_plan_id": new_id})
    return {"new_plan_id": new_id, "revision_no": plan["revision_no"] + 1,
            "sentinel_verified": False, "note": "new revision re-enters the Sentinel chain"}


@router.post("/{plan_id}/transmit")
async def transmit(plan_id: str, actor: Actor = Depends(require_roles("SR_DOM", "CONTROLLER", "ADMIN")),
                   session: AsyncSession = Depends(get_session)):
    """FR-016 at T-2h: re-run the Sentinel structural subset against the LATEST train
    positions, then enqueue the COA outbox row. The plan becomes TRANSMITTED_COA only on
    COA acknowledgment (SAFE-006 / RES-02), never on send."""
    plan = await load_plan(session, plan_id)
    if plan is None:
        raise HTTPException(404, "plan not found")
    if actor.role != "ADMIN" and plan["division"] != actor.division:
        raise HTTPException(403, "cross-division access denied")
    if plan["approval_status"] not in ("AUTHORIZED_DRM",):
        raise HTTPException(409, f"cannot transmit from state {plan['approval_status']}")
    # R6.2/SAFE-002 binding gate.
    ch = await recompute_hash(session, plan)
    if ch != plan["content_hash"] or ch != (plan["sentinel_hash"] or ""):
        raise HTTPException(409, "content hash does not match sentinel_hash — re-run Sentinel via a new revision")
    # T-2h structural re-check vs latest data.
    bundle = await _bundle(session, plan)
    ctx = await _build_sentinel_context(session)
    candidate = _candidate_from_bundle(bundle, plan)
    verdict = validate_structural_subset(candidate, ctx)
    failed = [r.check_id.value for r in verdict.results if not r.passed]
    if failed:
        raise HTTPException(400, {"error": "structural re-check failed at T-2h", "failed_checks": failed})
    if not await check_no_active_overlap(session, str(plan["section_id"]),
                                         plan["start_time"], plan["end_time"], plan_id):
        raise HTTPException(409, "an active plan already overlaps this window on the section")
    outbox_id = await coa_adapter.enqueue_transmission(session, plan)
    await append(session, "PLAN_TRANSMIT_QUEUED", actor.username,
                 {"plan_id": plan_id, "outbox_id": outbox_id, "content_hash": ch,
                  "structural_recheck": "PASSED"})
    await session.commit()
    await sse.publish("TRANSMIT_QUEUED", {"plan_id": plan_id})
    return {"plan_id": plan_id, "queued": True, "outbox_id": outbox_id,
            "status": "AUTHORIZED_DRM until COA acknowledges (outbox)"}


async def _transition(session: AsyncSession, plan_id: str, from_states: tuple[str, ...],
                      to_state: str, actor: Actor, event: str, extra_payload: dict | None = None):
    plan = await load_plan(session, plan_id)
    if plan is None:
        raise HTTPException(404, "plan not found")
    if actor.role != "ADMIN" and plan["division"] != actor.division:
        raise HTTPException(403, "cross-division access denied")
    if plan["approval_status"] not in from_states:
        raise HTTPException(409, f"illegal transition {plan['approval_status']} -> {to_state}")
    await session.execute(text(
        "UPDATE optimization.block_plans SET approval_status = :s WHERE id = :i"),
        {"s": to_state, "i": plan_id})
    await session.execute(text(
        """UPDATE demands.block_demands SET status = :s
           WHERE (id = (SELECT primary_demand_id FROM optimization.block_plans WHERE id = :i)
                  OR id IN (SELECT demand_id FROM optimization.plan_shadow_demands WHERE plan_id = :i))
             AND status <> 'CANCELLED'"""),
        {"s": to_state, "i": plan_id})
    payload = {"plan_id": plan_id, "from": plan["approval_status"], "to": to_state}
    if extra_payload:
        payload.update(extra_payload)
    h = await append(session, event, actor.username, payload)
    await session.commit()
    await sse.publish(event, {"plan_id": plan_id, "status": to_state})
    plan["approval_status"] = to_state  # reflect the applied transition in the response
    return plan, h


@router.post("/{plan_id}/activate")
async def activate(plan_id: str, actor: Actor = Depends(require_roles("CONTROLLER", "ADMIN")),
                   session: AsyncSession = Depends(get_session)):
    """Block start / field confirmation → physical line isolated (FR-017)."""
    plan, h = await _transition(session, plan_id, ("TRANSMITTED_COA",), "ACTIVE_GRANTED",
                                actor, "PLAN_ACTIVATED")
    return {"plan_id": plan_id, "status": plan["approval_status"], "ledger_hash": h}


@router.post("/{plan_id}/complete-fitness")
async def complete_fitness(plan_id: str, actor: Actor = Depends(require_roles("ENGINEER", "STATION_MASTER", "CONTROLLER", "ADMIN")),
                           session: AsyncSession = Depends(get_session)):
    """SSE certifies work completion and track fitness before de-isolating (FR-017)."""
    plan, h = await _transition(session, plan_id, ("ACTIVE_GRANTED",), "COMPLETED_FITNESS",
                                actor, "PLAN_COMPLETED_FITNESS")
    return {"plan_id": plan_id, "status": plan["approval_status"], "ledger_hash": h}


@router.post("/{plan_id}/archive")
async def archive(plan_id: str, actor: Actor = Depends(require_roles("ADMIN", "AUDITOR")),
                  session: AsyncSession = Depends(get_session)):
    plan, h = await _transition(session, plan_id, ("COMPLETED_FITNESS",), "ARCHIVED_SEALED",
                                actor, "PLAN_ARCHIVED_SEALED")
    return {"plan_id": plan_id, "status": plan["approval_status"], "ledger_hash": h}


@router.post("/{plan_id}/cancel")
async def cancel(plan_id: str, actor: Actor = Depends(require_roles("SR_DOM", "DRM", "ADMIN")),
                 session: AsyncSession = Depends(get_session)):
    plan, h = await _transition(session, plan_id,
                                ("DRAFT", "SENTINEL_PASSED", "APPROVED_SR_DOM", "AUTHORIZED_DRM"),
                                "CANCELLED", actor, "PLAN_CANCELLED")
    return {"plan_id": plan_id, "status": plan["approval_status"], "ledger_hash": h}
