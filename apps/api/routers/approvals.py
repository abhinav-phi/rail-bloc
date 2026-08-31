"""FR-014/015 + FR-027 — Approval Service.
Server-side gates on every decision (TechSpec §4):
  * content_hash recomputed and compared to sentinel_hash → 409 on mismatch (SAFE-002/R6.2)
  * decided_by ≠ authorized_by → 403 on self-authorization (APP-001/R6.3)
  * required idempotency key → replay returns the stored original response, no second effect
  * division-scoped object access → 403 cross-division
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.database import get_session
from ..core.security import Actor, require_roles
from ..schemas.models import DecisionIn
from ..services.plan_lifecycle import load_plan, recompute_hash
from ..services.idempotency_service import check_replay, record
from ..services.ledger_service import append
from ..services import sse

router = APIRouter(prefix="/api/v1/approvals", tags=["approvals"])


@router.post("/decide")
async def decide(body: DecisionIn, actor: Actor = Depends(require_roles("SR_DOM", "DRM")),
                 session: AsyncSession = Depends(get_session)):
    replay = await check_replay(session, body.idempotency_key, "/approvals/decide", actor.username)
    if replay is not None:
        return replay

    plan = await load_plan(session, body.plan_id)
    if plan is None:
        raise HTTPException(404, "plan not found")
    if actor.role != "ADMIN" and plan["division"] != actor.division:
        raise HTTPException(403, "cross-division object access denied")
    if not body.signature or len(body.signature) < 8:
        raise HTTPException(400, "digital signature required")
        # SAFE-002: a superseded plan must never be approved.
    if plan["approval_status"] == "SUPERSEDED":
        raise HTTPException(
            status_code=409,
            detail={
                "error": "HASH_MISMATCH",
                "detail": (
                    "Plan was superseded by a newer revision; "
                    "approve the latest revision instead."
                ),
            },
        )
    # SAFE-002 / R6.2 — recompute the content hash server-side before accepting any decision.
    ch = await recompute_hash(session, plan)
    sentinel_hash = plan["sentinel_hash"] or ""
    if ch != plan["content_hash"] or ch != sentinel_hash:
        raise HTTPException(409, {"error": "HASH_MISMATCH",
                                  "detail": "plan content changed after Sentinel verification; create a new revision",
                                  "recomputed": ch, "sentinel_hash": sentinel_hash})

    status = plan["approval_status"]
    response: dict
    if body.decision == "APPROVE" and actor.role == "SR_DOM" and status == "SENTINEL_PASSED":
        await session.execute(text(
            "UPDATE optimization.block_plans SET approval_status='APPROVED_SR_DOM', "
            "decided_by=:a, decided_at=now() WHERE id=:i"),
            {"a": actor.username, "i": plan["id"]})
        await session.execute(text(
            """UPDATE demands.block_demands SET status='APPROVED_SR_DOM'
               WHERE status='SENTINEL_PASSED'
                 AND (id = (SELECT primary_demand_id FROM optimization.block_plans WHERE id=:i)
                      OR id IN (SELECT demand_id FROM optimization.plan_shadow_demands WHERE plan_id=:i))"""),
            {"i": plan["id"]})
        ledger_hash = await append(session, "PLAN_APPROVED_SR_DOM", actor.username,
                                   {"plan_id": str(plan["id"]), "revision_no": plan["revision_no"],
                                    "content_hash": ch, "signature": body.signature[:16] + "…"})
        response = {"plan_id": str(plan["id"]), "status": "APPROVED_SR_DOM",
                    "decided_by": actor.username, "transaction_hash": ledger_hash}
    elif body.decision == "APPROVE" and actor.role == "DRM" and status == "APPROVED_SR_DOM":
        if plan["decided_by"] == actor.username:
            # R6.3 / APP-001: same actor may not occupy both roles of the chain.
            raise HTTPException(403, "distinct-approver violation: the Sr. DOM decider cannot authorize the same plan")
        await session.execute(text(
            "UPDATE optimization.block_plans SET approval_status='AUTHORIZED_DRM', "
            "authorized_by=:a, authorized_at=now() WHERE id=:i"),
            {"a": actor.username, "i": plan["id"]})
        await session.execute(text(
            """UPDATE demands.block_demands SET status='AUTHORIZED_DRM'
               WHERE status='APPROVED_SR_DOM'
                 AND (id = (SELECT primary_demand_id FROM optimization.block_plans WHERE id=:i)
                      OR id IN (SELECT demand_id FROM optimization.plan_shadow_demands WHERE plan_id=:i))"""),
            {"i": plan["id"]})
        ledger_hash = await append(session, "PLAN_AUTHORIZED_DRM", actor.username,
                                   {"plan_id": str(plan["id"]), "revision_no": plan["revision_no"],
                                    "content_hash": ch, "decided_by": plan["decided_by"],
                                    "signature": body.signature[:16] + "…"})
        response = {"plan_id": str(plan["id"]), "status": "AUTHORIZED_DRM",
                    "authorized_by": actor.username, "transaction_hash": ledger_hash}
    elif body.decision == "REJECT" and status in ("SENTINEL_PASSED", "APPROVED_SR_DOM", "AUTHORIZED_DRM"):
        await session.execute(text(
            "UPDATE optimization.block_plans SET approval_status='CANCELLED' WHERE id=:i"),
            {"i": plan["id"]})
        await session.execute(text(
            """UPDATE demands.block_demands SET status='CANCELLED'
               WHERE status NOT IN ('ARCHIVED_SEALED','CANCELLED')
                 AND (id = (SELECT primary_demand_id FROM optimization.block_plans WHERE id=:i)
                      OR id IN (SELECT demand_id FROM optimization.plan_shadow_demands WHERE plan_id=:i))"""),
            {"i": plan["id"]})
        ledger_hash = await append(session, "PLAN_REJECTED", actor.username,
                                   {"plan_id": str(plan["id"]), "revision_no": plan["revision_no"],
                                    "content_hash": ch, "rejected_from": status})
        response = {"plan_id": str(plan["id"]), "status": "CANCELLED",
                    "rejected_by": actor.username, "transaction_hash": ledger_hash}
    else:
        raise HTTPException(409, f"invalid transition: role {actor.role} decision {body.decision} from state {status}")

    await record(session, body.idempotency_key, "/approvals/decide", actor.username, response)
    await session.commit()
    await sse.publish("PLAN_DECISION", {"plan_id": str(plan["id"]), **{k: v for k, v in response.items() if k != 'signature'}})
    return response
