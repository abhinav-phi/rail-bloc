"""APP-001 / FR-027 / R6.3 — distinct-approver enforcement and idempotency keys.
Also exercises the DB-level chk_distinct_approvers constraint."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from packages.chronicle.canonical import content_hash

from .conftest import auth_header, make_token


def _mk_sentinel_plan(engine) -> str:
    import uuid as _u
    with engine.begin() as conn:
        # Unique section per test: excl_active_overlap correctly blocks two
        # concurrently-AUTHORIZED overlapping windows on the same section.
        sec = conn.execute(text(
            """SELECT id FROM infrastructure.block_sections
               WHERE division='DLI' ORDER BY md5(id::text || :r) LIMIT 1"""),
            {"r": _u.uuid4().hex}).scalar()
        dem = conn.execute(text(
            """INSERT INTO demands.block_demands
               (external_source, external_ref_id, department, section_id, activity_code,
                min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
               VALUES ('TMS',:ref,'ENGINEERING',:sec,'POINTS_PACKING',120,
                       :es,:ld,0.6,'SUBMITTED')
               RETURNING id"""),
            {"ref": f"APP001-{uuid.uuid4()}", "sec": sec,
             "es": datetime.now(UTC) + timedelta(days=3),
             "ld": datetime.now(UTC) + timedelta(days=6)}).scalar()
        run = conn.execute(text(
            "INSERT INTO optimization.solver_runs (horizon, division, status) "
            "VALUES ('WEEKLY','DLI','COMPLETED') RETURNING id")).scalar()
        st = datetime.now(UTC) + timedelta(days=1)
        et = datetime.now(UTC) + timedelta(days=2)
        ch = content_hash(str(sec), st, et, str(dem), [])
        return str(conn.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, sentinel_hash, sentinel_verified, approval_status)
               VALUES ('WEEKLY',:sec,:st,:et,:dem,:run,:ch,:ch,true,'SENTINEL_PASSED') RETURNING id"""),
            {"sec": sec, "st": st, "et": et, "dem": dem, "run": run, "ch": ch}).scalar())


def _decide(client, plan_id, user, decision="APPROVE", key=None):
    return client.post("/api/v1/approvals/decide",
                       headers=auth_header(make_token(user, {"srdom_dli": "SR_DOM",
                                                             "drm_dli": "DRM"}[user])),
                       json={"plan_id": plan_id, "decision": decision,
                             "signature": f"sig-{user}-12345",
                             "idempotency_key": key or f"{plan_id}-{user}-{decision}-{uuid.uuid4()}"})


def test_same_actor_cannot_hold_both_roles(client, engine):
    plan_id = _mk_sentinel_plan(engine)
    r1 = _decide(client, plan_id, "srdom_dli")
    assert r1.status_code == 200
    # The same human tries the DRM step from a DRM-issued token of the SAME username.
    r2 = client.post("/api/v1/approvals/decide",
                     headers=auth_header(make_token("srdom_dli", "DRM")),
                     json={"plan_id": plan_id, "decision": "APPROVE",
                           "signature": "sig-x-123456", "idempotency_key": f"self-{plan_id}"})
    assert r2.status_code == 403
    with engine.begin() as conn:
        st = conn.execute(text(
            "SELECT approval_status, authorized_by FROM optimization.block_plans WHERE id=:i"),
            {"i": plan_id}).one()
    assert st.approval_status == "APPROVED_SR_DOM" and st.authorized_by is None


def test_distinct_drm_can_authorize(client, engine):
    plan_id = _mk_sentinel_plan(engine)
    assert _decide(client, plan_id, "srdom_dli").status_code == 200
    r = _decide(client, plan_id, "drm_dli")
    assert r.status_code == 200 and r.json()["status"] == "AUTHORIZED_DRM"
    with engine.begin() as conn:
        row = conn.execute(text(
            "SELECT decided_by, authorized_by FROM optimization.block_plans WHERE id=:i"),
            {"i": plan_id}).one()
    assert row.decided_by != row.authorized_by


def test_db_check_constraint_blocks_self_authorization(engine):
    """Even if application logic regressed, chk_distinct_approvers must raise."""
    plan_id = _mk_sentinel_plan(engine)
    with engine.begin() as conn:
        conn.execute(text(
            "UPDATE optimization.block_plans SET decided_by='same_user' WHERE id=:i"), {"i": plan_id})
        try:
            conn.execute(text(
                "UPDATE optimization.block_plans SET approval_status='AUTHORIZED_DRM', "
                "authorized_by='same_user' WHERE id=:i"), {"i": plan_id})
            raised = False
        except Exception:
            raised = True
            conn.rollback()
    assert raised


def test_idempotency_double_submit_single_effect(client, engine):
    plan_id = _mk_sentinel_plan(engine)
    key = f"idem-{plan_id}"
    r1 = _decide(client, plan_id, "srdom_dli", key=key)
    assert r1.status_code == 200 and "replayed" not in r1.json()
    r2 = _decide(client, plan_id, "srdom_dli", key=key)
    assert r2.status_code == 200 and r2.json().get("replayed") is True
    with engine.begin() as conn:
        n = conn.execute(text(
            "SELECT count(*) FROM audit.action_ledger WHERE event_type='PLAN_APPROVED_SR_DOM' "
            "AND payload_json->>'plan_id' = :p"), {"p": plan_id}).scalar()
    assert n == 1


def test_missing_idempotency_key_rejected(client, engine):
    plan_id = _mk_sentinel_plan(engine)
    r = client.post("/api/v1/approvals/decide",
                    headers=auth_header(make_token("srdom_dli", "SR_DOM")),
                    json={"plan_id": plan_id, "decision": "APPROVE", "signature": "sig-12345678"})
    assert r.status_code == 422  # pydantic Field required


def test_cross_division_object_access_denied(client, engine):
    plan_id = _mk_sentinel_plan(engine)
    r = client.post("/api/v1/approvals/decide",
                    headers=auth_header(make_token("srdom_pryj_fake", "SR_DOM", division="PRYJ")),
                    json={"plan_id": plan_id, "decision": "APPROVE",
                          "signature": "sig-12345678", "idempotency_key": f"x-{plan_id}"})
    assert r.status_code == 403
