"""SAFE-006 — outbox pattern: TRANSMITTED_COA is set only on COA acknowledgment,
never on send (RES-02: plan status stays AUTHORIZED_DRM / PROVISIONAL until then).
The bridge loop (main.py startup) acks rows after a simulated COA round-trip;
production would POST to the real COA bridge with COA_BRIDGE_SECRET."""
from __future__ import annotations
import json, uuid
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .ledger_service import append
from . import sse


async def enqueue_transmission(session: AsyncSession, plan: dict) -> str:
    payload = {"token": f"BLK-{str(plan['id'])[:8].upper()}",
               "section": plan["section_code"], "start": plan["start_time"].isoformat(),
               "end": plan["end_time"].isoformat(), "revision": plan["revision_no"],
               "content_hash": plan["content_hash"]}
    outbox_id = str(uuid.uuid4())
    await session.execute(text(
        "INSERT INTO optimization.coa_outbox (id, plan_id, payload) VALUES (:i, :p, CAST(:j AS jsonb))"),
        {"i": outbox_id, "p": plan["id"], "j": json.dumps(payload, default=str)})
    return outbox_id


async def process_outbox(session: AsyncSession, ack_delay_seconds: float = 1.5) -> int:
    rows = (await session.execute(text(
        """SELECT o.id, o.plan_id, o.created_at FROM optimization.coa_outbox o
           WHERE o.state = 'PENDING' AND o.attempts < 3
             AND o.created_at < :c"""), {"c": datetime.now(timezone.utc)})).mappings().all()
    n = 0
    for r in rows:
        age = (datetime.now(timezone.utc) - r["created_at"]).total_seconds()
        if age < ack_delay_seconds:
            continue
        plan = (await session.execute(text(
            "SELECT p.*, s.section_code FROM optimization.block_plans p "
            "JOIN infrastructure.block_sections s ON s.id = p.section_id WHERE p.id = :i"),
            {"i": r["plan_id"]})).mappings().first()
        if plan is None:
            continue
        allowed = plan["approval_status"] in ("AUTHORIZED_DRM", "PROVISIONAL")
        if plan["approval_status"] == "PROVISIONAL":
            acked = (await session.execute(text(
                "SELECT controller_acknowledged FROM operations.incidents WHERE id = :i"),
                {"i": plan["incident_id"]})).scalar()
            allowed = bool(acked)
        if not allowed:
            await session.execute(text(
                "UPDATE optimization.coa_outbox SET attempts = attempts + 1 WHERE id = :i"), {"i": r["id"]})
            continue
        await session.execute(text(
            "UPDATE optimization.coa_outbox SET state = 'ACKED', acked_at = now() WHERE id = :i"),
            {"i": r["id"]})
        await session.execute(text(
            "UPDATE optimization.block_plans SET approval_status = 'TRANSMITTED_COA' WHERE id = :i"),
            {"i": r["plan_id"]})
        await session.execute(text(
            "UPDATE demands.block_demands SET status = 'TRANSMITTED_COA' "
            "WHERE id IN (SELECT demand_id FROM optimization.plan_shadow_demands WHERE plan_id = :p) "
            "   OR id = (SELECT primary_demand_id FROM optimization.block_plans WHERE id = :p)"),
            {"p": r["plan_id"]})
        await append(session, "PLAN_TRANSMITTED_COA", "coa_bridge",
                     {"plan_id": str(r["plan_id"]), "revision_no": plan["revision_no"],
                      "content_hash": plan["content_hash"]})
        await sse.publish("BLOCK_TRANSMITTED", {"plan_id": str(r["plan_id"])})
        n += 1
    return n
