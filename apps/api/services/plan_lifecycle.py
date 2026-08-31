"""SAFE-002 / FR-026 — revision & content-hash binding; RES-03 — multi-section overlap."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.chronicle.canonical import content_hash


async def load_plan(session: AsyncSession, plan_id: str) -> dict | None:
    row = (await session.execute(text(
        "SELECT p.*, s.section_code, s.division FROM optimization.block_plans p "
        "JOIN infrastructure.block_sections s ON s.id = p.section_id WHERE p.id = :i"),
        {"i": plan_id})).mappings().first()
    return dict(row) if row else None


async def load_shadow_ids(session: AsyncSession, plan_id: str) -> list[str]:
    rows = await session.execute(text(
        "SELECT demand_id FROM optimization.plan_shadow_demands WHERE plan_id = :i ORDER BY demand_id"),
        {"i": plan_id})
    return [str(r[0]) for r in rows]


async def recompute_hash(session: AsyncSession, plan: dict) -> str:
    shadows = await load_shadow_ids(session, str(plan["id"]))
    return content_hash(plan["section_id"], plan["start_time"], plan["end_time"],
                        plan["primary_demand_id"], shadows)


async def check_no_active_overlap(session: AsyncSession, section_id: str,
                                  start: datetime, end: datetime, exclude_plan_id: str) -> bool:
    """RES-03: application-level complement to excl_active_overlap (covers plan_sections)."""
    row = await session.execute(text(
        """SELECT count(*) FROM optimization.block_plans p
           WHERE p.id <> :x AND p.approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED')
             AND p.section_id = :s AND tstzrange(p.start_time, p.end_time) && tstzrange(CAST(:st AS timestamptz), CAST(:et AS timestamptz))"""),
        {"x": exclude_plan_id, "s": section_id, "st": start, "et": end})
    return int(row.scalar() or 0) == 0


async def revise_plan(session: AsyncSession, plan: dict, actor: str,
                      new_start: datetime | None, new_end: datetime | None) -> str:
    """FR-026: any mutation after SENTINEL_PASSED creates a NEW revision at DRAFT and
    clears sentinel_verified — the edited plan can never reuse the old Sentinel verdict."""
    start = new_start or plan["start_time"]
    end = new_end or plan["end_time"]
    if end <= start:
        raise ValueError("end_time must be after start_time")
    shadows = await load_shadow_ids(session, str(plan["id"]))
    ch = content_hash(plan["section_id"], start, end, plan["primary_demand_id"], shadows)
    new_id = str(uuid.uuid4())
    await session.execute(text(
        """INSERT INTO optimization.block_plans
           (id, plan_horizon, section_id, start_time, end_time, primary_demand_id,
            is_shadow_block, solver_run_id, content_hash, revision_no, supersedes_id,
            approval_status, incident_id)
           VALUES (:id, :h, :sec, :st, :et, :pd, :sb, :sr, :ch, :rev, :sup, 'DRAFT', :inc)"""),
        {"id": new_id, "h": plan["plan_horizon"], "sec": plan["section_id"], "st": start, "et": end,
         "pd": plan["primary_demand_id"], "sb": plan["is_shadow_block"], "sr": plan["solver_run_id"],
         "ch": ch, "rev": plan["revision_no"] + 1, "sup": plan["id"], "inc": plan.get("incident_id")})
    await session.execute(text(
    """UPDATE optimization.block_plans
       SET approval_status = 'SUPERSEDED',
           sentinel_verified = false,
           sentinel_hash = NULL
       WHERE id = :i"""),
    {"i": plan["id"]})
    for sid in shadows:
        await session.execute(text(
            "INSERT INTO optimization.plan_shadow_demands (plan_id, demand_id) VALUES (:p, :d) "
            "ON CONFLICT DO NOTHING"), {"p": new_id, "d": sid})
    # The displaced revision's demands drop back to SCHEDULED_DRAFT: they re-enter the chain.
    involved = shadows + [str(plan["primary_demand_id"])]
    await session.execute(text(
        "UPDATE demands.block_demands SET status = 'SCHEDULED_DRAFT' WHERE id = ANY(CAST(:ids AS uuid[]))"),
        {"ids": involved})
    return new_id
