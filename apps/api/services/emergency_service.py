"""SAFE-003 / FR-028 / ADR-006 — Emergency Service.
Issues advisory revocations (it executes; Sentinel never does), coalesces incidents on
adjacent sections, and gates PROVISIONAL plans on Controller acknowledgment."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.chronicle.canonical import content_hash
from packages.core.models import DemandInput, MachineInfo, PlanCandidate, ScheduledWork, TrainPathInput

from . import sse
from .ledger_service import append


async def adjacent_section_ids(session: AsyncSession, section_id: str) -> list[str]:
    """Sections sharing an OHE feeding group or physically touching in km."""
    rows = (await session.execute(text(
        """SELECT s.id, s.start_km, s.end_km,
                  EXISTS(SELECT 1 FROM infrastructure.section_feeding_map m1
                         JOIN infrastructure.section_feeding_map m2 ON m2.feeding_section_id = m1.feeding_section_id
                         WHERE m1.section_id = :sid AND m2.section_id = s.id) AS shares_feed
           FROM infrastructure.block_sections s WHERE s.id <> :sid AND s.is_active"""),
        {"sid": section_id})).mappings().all()
    me = (await session.execute(text(
        "SELECT start_km, end_km FROM infrastructure.block_sections WHERE id = :i"),
        {"i": section_id})).mappings().first()
    if me is None:
        return []
    out = []
    for r in rows:
        touches = (abs(float(r["start_km"]) - float(me["end_km"])) < 0.01
                   or abs(float(r["end_km"]) - float(me["start_km"])) < 0.01)
        if r["shares_feed"] or touches:
            out.append(str(r["id"]))
    return out


async def blast_radius(session: AsyncSession, section_id: str, est_mins: int) -> dict:
    now = datetime.now(UTC)
    until = now + timedelta(minutes=est_mins)
    trains = (await session.execute(text(
        """SELECT t.train_number, t.train_type, t.priority_rank, t.scheduled_entry, t.scheduled_exit
           FROM operations.train_paths t
           WHERE t.section_id = :s AND tstzrange(t.scheduled_entry, t.scheduled_exit) && tstzrange(CAST(:n AS timestamptz), CAST(:u AS timestamptz))
           ORDER BY t.scheduled_entry LIMIT 50"""), {"s": section_id, "n": now, "u": until})).mappings().all()
    plans = (await session.execute(text(
        """SELECT p.id, p.approval_status, p.revision_no, p.content_hash
           FROM optimization.block_plans p
           WHERE p.section_id = :s AND p.approval_status IN ('SENTINEL_PASSED','APPROVED_SR_DOM',
                 'AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED','PROVISIONAL')"""),
        {"s": section_id})).mappings().all()
    adj = await adjacent_section_ids(session, section_id)
    return {"section_id": section_id,
            "trains_held": [dict(t) for t in trains],
            "plans_superseded": [{"id": str(p["id"]), "approval_status": p["approval_status"],
                                  "revision_no": p["revision_no"]} for p in plans],
            "affected_sections": [section_id] + adj}


async def coalesce_or_create_incident(session: AsyncSession, section_id: str, itype: str,
                                      reported_by: str, est_mins: int) -> tuple[str, str | None]:
    """AppFlow Scenario A step 1: a second incident on an ADJACENT section inside the
    same window is coalesced into the first to prevent conflicting concurrent re-plans."""
    window_start = datetime.now(UTC) - timedelta(minutes=60)
    adj = await adjacent_section_ids(session, section_id)
    existing = None
    if adj:
        existing = (await session.execute(text(
            """SELECT id FROM operations.incidents
               WHERE section_id = ANY(CAST(:a AS uuid[])) AND created_at > :w
                 AND coalesced_into_incident_id IS NULL
               ORDER BY created_at DESC LIMIT 1"""),
            {"a": adj, "w": window_start})).scalar()
    inc_id = str(uuid.uuid4())
    await session.execute(text(
        """INSERT INTO operations.incidents
           (id, section_id, incident_type, reported_by, estimated_duration_mins, coalesced_into_incident_id)
           VALUES (:i, :s, :t, :by, :d, :c)"""),
        {"i": inc_id, "s": section_id, "t": itype, "by": reported_by, "d": est_mins, "c": existing})
    return inc_id, (str(existing) if existing else None)


async def issue_advisory_revocation(session: AsyncSession, section_id: str,
                                    incident_id: str, actor: str) -> list[str]:
    """ADR-006: the Emergency Service (not Sentinel) issues advisory revocations.
    Displaced routine blocks' demands drop back to SUBMITTED and re-enter the full chain."""
    rows = (await session.execute(text(
        """SELECT id FROM optimization.block_plans
           WHERE section_id = :s AND approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED')"""),
        {"s": section_id})).fetchall()
    superseded = []
    for (pid,) in rows:
        superseded.append(str(pid))
        await session.execute(text(
            "UPDATE optimization.block_plans SET approval_status = 'SUPERSEDED_EMERGENCY' WHERE id = :i"),
            {"i": pid})
        await session.execute(text(
            """UPDATE demands.block_demands SET status = 'SUBMITTED'
               WHERE status IN ('SCHEDULED_DRAFT','SENTINEL_PASSED','APPROVED_SR_DOM',
                                'AUTHORIZED_DRM','TRANSMITTED_COA')
                 AND (id = (SELECT primary_demand_id FROM optimization.block_plans WHERE id = :i)
                      OR id IN (SELECT demand_id FROM optimization.plan_shadow_demands WHERE plan_id = :i))"""),
            {"i": pid})
        await append(session, "PLAN_SUPERSEDED_EMERGENCY", actor,
                     {"plan_id": str(pid), "incident_id": incident_id})
    await append(session, "EMERGENCY_REVOKE_ISSUED", actor,
                 {"section_id": section_id, "incident_id": incident_id,
                  "plans_superseded": superseded, "advisory": True})
    await sse.publish("BLOCK_REVOKED", {"section_id": section_id, "incident_id": incident_id,
                                        "plans_superseded": superseded})
    return superseded


async def fetch_solve_inputs(session: AsyncSession, section_ids: list[str],
                             horizon_hours: float = 48.0):
    now = datetime.now(UTC)
    until = now + timedelta(hours=horizon_hours)
    dem_rows = (await session.execute(text(
        """SELECT d.*, s.section_code, s.division, s.start_km, s.end_km
           FROM demands.block_demands d JOIN infrastructure.block_sections s ON s.id = d.section_id
           WHERE d.section_id = ANY(CAST(:ss AS uuid[])) AND d.status IN ('SUBMITTED','NORMALIZED','ESCALATED_OVERDUE')
             AND d.latest_deadline > :now ORDER BY d.urgency_score DESC"""),
        {"ss": section_ids, "now": now})).mappings().all()
    tr_rows = (await session.execute(text(
        """SELECT t.* FROM operations.train_paths t
           WHERE t.section_id = ANY(CAST(:ss AS uuid[])) AND t.scheduled_exit > :now AND t.scheduled_entry < :until"""),
        {"ss": section_ids, "now": now, "until": until})).mappings().all()
    mach_rows = (await session.execute(text(
        "SELECT machine_code, machine_class, depot_km, transit_speed_kmph FROM infrastructure.machines"))).fetchall()

    def _imr_num(sev):
        return {"P1_URGENT": 3, "P2_MONITOR": 2}.get(sev, 0)

    demands = [DemandInput(
        id=str(r["id"]), section_id=str(r["section_id"]), section_code=r["section_code"],
        division=r["division"], section_start_km=float(r["start_km"]), section_end_km=float(r["end_km"]),
        department=r["department"], activity_code=r["activity_code"],
        min_duration_mins=int(r["min_duration_mins"]), earliest_start=r["earliest_start"],
        latest_deadline=r["latest_deadline"], urgency_score=float(r["urgency_score"]),
        machinery=list(r["machinery_req"] or []), source_ingested_at=r["source_ingested_at"],
        features=dict(r["features"] or {})) for r in dem_rows]
    trains = [TrainPathInput(
        train_number=r["train_number"], train_type=r["train_type"], section_id=str(r["section_id"]),
        priority_rank=int(r["priority_rank"]), scheduled_entry=r["scheduled_entry"],
        scheduled_exit=r["scheduled_exit"], source=r["source"],
        forecast_confidence=(r["metadata"] or {}).get("forecast_confidence")) for r in tr_rows]
    machines = [MachineInfo(r[0], r[1], float(r[2]), int(r[3])) for r in mach_rows]
    return demands, trains, machines


def candidate_from_plan_window(demands, section, start, end, primary_id, horizon="REALTIME",
                               incident_id=None):
    works = [ScheduledWork(d, start, end) for d in demands]
    return PlanCandidate(section_id=section["id"], section_code=section["section_code"],
                         division=section["division"], start_time=start, end_time=end,
                         primary_demand_id=primary_id, works=works,
                         is_shadow_block=len({d.department for d in demands}) >= 2,
                         plan_horizon=horizon, incident_id=incident_id)


async def persist_emergency_plan(session: AsyncSession, cand: PlanCandidate, incident_id: str,
                                 run_id: str, actor: str) -> tuple[str, str]:
    ch = content_hash(cand.section_id, cand.start_time, cand.end_time,
                      cand.primary_demand_id, cand.shadow_demand_ids)
    plan_id = str(uuid.uuid4())
    await session.execute(text(
        """INSERT INTO optimization.block_plans
           (id, plan_horizon, section_id, start_time, end_time, primary_demand_id,
            is_shadow_block, solver_run_id, sentinel_verified, revision_no, content_hash,
            sentinel_hash, approval_status, incident_id)
           VALUES (:id, 'REALTIME', :sec, :st, :et, :pd, :sb, :sr, true, 1, :ch, :ch,
                   'PROVISIONAL', :inc)"""),
        {"id": plan_id, "sec": cand.section_id, "st": cand.start_time, "et": cand.end_time,
         "pd": cand.primary_demand_id, "sb": cand.is_shadow_block, "sr": run_id,
         "ch": ch, "inc": incident_id})
    await session.execute(text(
        "INSERT INTO optimization.plan_sections (plan_id, section_id) VALUES (:p, :s) "
        "ON CONFLICT DO NOTHING"), {"p": plan_id, "s": cand.section_id})
    for did in cand.shadow_demand_ids:
        await session.execute(text(
            "INSERT INTO optimization.plan_shadow_demands (plan_id, demand_id) VALUES (:p, :d) "
            "ON CONFLICT DO NOTHING"), {"p": plan_id, "d": did})
    involved = cand.shadow_demand_ids + [str(cand.primary_demand_id)]
    await session.execute(text(
        "UPDATE demands.block_demands SET status = 'SCHEDULED_DRAFT' WHERE id = ANY(CAST(:ids AS uuid[]))"),
        {"ids": involved})
    await append(session, "PLAN_PROVISIONAL_CREATED", actor,
                 {"plan_id": plan_id, "incident_id": incident_id, "content_hash": ch,
                  "awaiting_controller_ack": True})
    await sse.publish("PROVISIONAL_PLAN_CREATED", {"plan_id": plan_id, "incident_id": incident_id})
    return plan_id, ch
