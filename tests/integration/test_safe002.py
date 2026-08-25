"""SAFE-002 / FR-026 / R6.2 — the modify-after-verify bypass must be rejected (409),
and revisions must clear sentinel verification."""
from __future__ import annotations
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from packages.chronicle.canonical import content_hash
from .conftest import auth_header, make_token


def _mk_plan(conn) -> str:
    from datetime import timedelta
    sec = conn.execute(text(
        "SELECT id FROM infrastructure.block_sections WHERE section_code='NDLS-GZB-UP'")).scalar()
    dem = conn.execute(text(
        """INSERT INTO demands.block_demands
           (external_source, external_ref_id, department, section_id, activity_code,
            min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
           VALUES ('TMS',:ref,'ENGINEERING',:sec,'DTT_TAMPING',120,
                   :es,:ld,0.8,'SUBMITTED')
           RETURNING id"""),
        {"ref": f"SAFE002-{uuid.uuid4()}", "sec": sec,
         "es": datetime.now(timezone.utc) + timedelta(days=3),
         "ld": datetime.now(timezone.utc) + timedelta(days=6)}).scalar()
    run = conn.execute(text(
        "INSERT INTO optimization.solver_runs (horizon, division, status) "
        "VALUES ('WEEKLY','DLI','COMPLETED') RETURNING id")).scalar()
    st = datetime.now(timezone.utc) + timedelta(days=1)
    et = datetime.now(timezone.utc) + timedelta(days=2)
    ch = content_hash(str(sec), st, et, str(dem), [])
    plan_id = conn.execute(text(
        """INSERT INTO optimization.block_plans
           (plan_horizon, section_id, start_time, end_time, primary_demand_id,
            solver_run_id, content_hash, sentinel_hash, sentinel_verified, approval_status)
           VALUES ('WEEKLY',:sec,:st,:et,:dem,:run,:ch,:ch,true,'SENTINEL_PASSED') RETURNING id"""),
        {"sec": sec, "st": st, "et": et, "dem": dem, "run": run, "ch": ch}).scalar()
    return str(plan_id)


def test_modified_after_verify_approve_rejected_409(client, engine):
    with engine.begin() as conn:
        plan_id = _mk_plan(conn)
        # Simulate the "Modify Parameters" bypass attempt: mutate content in place.
        conn.execute(text(
            "UPDATE optimization.block_plans SET end_time = end_time + interval '30 minutes' "
            "WHERE id = :i"), {"i": plan_id})
    r = client.post("/api/v1/approvals/decide",
                    headers=auth_header(make_token("srdom_dli", "SR_DOM")),
                    json={"plan_id": plan_id, "decision": "APPROVE",
                          "signature": "sig-12345678", "idempotency_key": f"k-{plan_id}-a"})
    assert r.status_code == 409
    assert r.json()["detail"]["error"] == "HASH_MISMATCH"


def test_unmodified_plan_passes_hash_gate_to_approval(client, engine):
    with engine.begin() as conn:
        plan_id = _mk_plan(conn)
    r = client.post("/api/v1/approvals/decide",
                    headers=auth_header(make_token("srdom_dli", "SR_DOM")),
                    json={"plan_id": plan_id, "decision": "APPROVE",
                          "signature": "sig-12345678", "idempotency_key": f"k-{plan_id}-b"})
    assert r.status_code == 200
    assert r.json()["status"] == "APPROVED_SR_DOM"
    # Ledger evidence exists for the approval.
    with engine.begin() as conn:
        n = conn.execute(text(
            "SELECT count(*) FROM audit.action_ledger WHERE event_type='PLAN_APPROVED_SR_DOM' "
            "AND payload_json->>'plan_id' = :p"), {"p": plan_id}).scalar()
    assert n >= 1


def test_revise_creates_new_draft_revision_clearing_sentinel(client, engine):
    from apps.api.services.plan_lifecycle import load_plan
    from apps.api.core.database import SessionLocal
    with engine.begin() as conn:
        plan_id = _mk_plan(conn)
    async def _do():
        async with SessionLocal() as s:
            plan = await load_plan(s, plan_id)
            from apps.api.services.plan_lifecycle import revise_plan
            new_id = await revise_plan(s, plan, "tester", None, None)
            await s.commit()
            return new_id

    new_id = asyncio.run(_do())
    with engine.begin() as conn:
        old = conn.execute(text(
            "SELECT approval_status FROM optimization.block_plans WHERE id=:i"), {"i": plan_id}).one()
        new = conn.execute(text(
            """SELECT approval_status, revision_no, supersedes_id, sentinel_verified
               FROM optimization.block_plans WHERE id=:i"""), {"i": new_id}).one()
    assert old.approval_status == "SUPERSEDED"
    assert new.approval_status == "DRAFT"
    assert not new.sentinel_verified
    assert new.revision_no == 2 and str(new.supersedes_id) == plan_id
