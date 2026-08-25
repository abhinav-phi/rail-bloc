"""TASK-048 runtime evidence — G&SR-2 signal acknowledgment HTTP flow:
S&T plan stays DRAFT until BOTH Station Master and Controller acknowledge;
then it transitions to SENTINEL_PASSED with sentinel_hash bound."""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from packages.chronicle.canonical import content_hash
from .conftest import auth_header, make_token


def _mk_draft_snt_plan(engine) -> str:
    """DRAFT S&T plan (as the worker persists it when only G&SR-2 is outstanding)."""
    with engine.begin() as conn:
        sec = conn.execute(text(
            "SELECT id FROM infrastructure.block_sections WHERE section_code='GZB-ALJN-DN'")).scalar()
        dem = conn.execute(text(
            """INSERT INTO demands.block_demands
               (external_source, external_ref_id, department, section_id, activity_code,
                min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
               VALUES ('SMMS',:ref,'SIGNAL_TELECOM',:sec,'POINT_MACHINE_OVERHAUL',90,
                       :es,:ld,0.65,'SUBMITTED')
               RETURNING id"""),
            {"ref": f"ACK-{uuid.uuid4()}", "sec": sec,
             "es": datetime.now(timezone.utc) + timedelta(days=4),
             "ld": datetime.now(timezone.utc) + timedelta(days=7)}).scalar()
        run = conn.execute(text(
            "INSERT INTO optimization.solver_runs (horizon, division, status) "
            "VALUES ('WEEKLY','DLI','COMPLETED') RETURNING id")).scalar()
        st = datetime.now(timezone.utc) + timedelta(days=2)
        et = st + timedelta(hours=2)
        ch = content_hash(str(sec), st, et, str(dem), [])
        return str(conn.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, approval_status)
               VALUES ('WEEKLY',:sec,:st,:et,:dem,:run,:ch,'DRAFT')
               RETURNING id"""),
            {"sec": sec, "st": st, "et": et, "dem": dem, "run": run, "ch": ch}).scalar())


def test_gsr2_ack_flow(client, engine):
    plan_id = _mk_draft_snt_plan(engine)

    # Sentinel report: G&SR-2 must be PENDING (not passed) pre-acks.
    rep = client.get(f"/api/v1/plans/{plan_id}/sentinel-report",
                     headers=auth_header(make_token("srdom_dli", "SR_DOM"))).json()
    gsr2 = next(c for c in rep["checks"] if c["id"].startswith("G&SR-2"))
    assert not gsr2["passed"] and gsr2["pending"]

    sm = auth_header(make_token("sm_dli", "STATION_MASTER"))
    ctl = auth_header(make_token("controller_dli", "CONTROLLER"))

    # First ack alone must NOT flip the plan out of DRAFT.
    r = client.post(f"/api/v1/plans/{plan_id}/acknowledge-signal",
                    headers=sm, json={"as_role": "STATION_MASTER"})
    assert r.status_code == 200 and r.json()["both_acknowledged"] is False
    with engine.begin() as conn:
        st = conn.execute(text(
            "SELECT approval_status FROM optimization.block_plans WHERE id=:i"), {"i": plan_id}).scalar()
    assert st == "DRAFT"

    # Second ack completes G&SR-2 → SENTINEL_PASSED with hash binding.
    r = client.post(f"/api/v1/plans/{plan_id}/acknowledge-signal",
                    headers=ctl, json={"as_role": "CONTROLLER"})
    assert r.status_code == 200 and r.json()["both_acknowledged"] is True

    with engine.begin() as conn:
        row = conn.execute(text(
            "SELECT approval_status, sentinel_verified, sentinel_hash, content_hash "
            "FROM optimization.block_plans WHERE id=:i"), {"i": plan_id}).one()
        dem_st = conn.execute(text(
            "SELECT status FROM demands.block_demands WHERE id = "
            "(SELECT primary_demand_id FROM optimization.block_plans WHERE id=:i)"),
            {"i": plan_id}).scalar()
    assert row.approval_status == "SENTINEL_PASSED"
    assert row.sentinel_verified is True
    assert row.sentinel_hash == row.content_hash
    assert dem_st == "SENTINEL_PASSED"

    # Ledger evidence for the transition exists.
    with engine.begin() as conn:
        n = conn.execute(text(
            "SELECT count(*) FROM audit.action_ledger WHERE event_type='PLAN_SENTINEL_PASSED' "
            "AND payload_json->>'plan_id' = :p"), {"p": plan_id}).scalar()
    assert n >= 1
