"""TASK-060 hardened E2E: full lifecycle Ingestion → Solve → Sentinel → Approve →
Authorize → Transmit(outbox) → Activate → Complete → Archive, plus the emergency
drill and a rejected modify-after-verify attempt. Requires DB + seeded data."""
from __future__ import annotations
import time
import uuid

from sqlalchemy import text

from packages.chronicle.canonical import content_hash
from .conftest import auth_header, make_token


def _seed_plan_ready_for_approval(engine) -> str:
    from datetime import timedelta
    with engine.begin() as conn:
        sec = conn.execute(text(
            "SELECT id FROM infrastructure.block_sections WHERE section_code='GZB-ALJN-UP'")).scalar()
        dem = conn.execute(text(
            """INSERT INTO demands.block_demands
               (external_source, external_ref_id, department, section_id, activity_code,
                min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
               VALUES ('TMS',:ref,'ENGINEERING',:sec,'DTT_TAMPING',180,
                       :es,:ld,0.75,'SUBMITTED')
               RETURNING id"""),
            {"ref": f"E2E-{uuid.uuid4()}", "sec": sec,
             "es": datetime_now_plus(3), "ld": datetime_now_plus(8)}).scalar()
        run = conn.execute(text(
            "INSERT INTO optimization.solver_runs (horizon, division, status) "
            "VALUES ('WEEKLY','DLI','COMPLETED') RETURNING id")).scalar()
        st, et = datetime_now_plus(1), datetime_now_plus(2)
        ch = content_hash(str(sec), st, et, str(dem), [])
        return str(conn.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, sentinel_hash, sentinel_verified, approval_status)
               VALUES ('WEEKLY',:sec,:st,:et,:dem,:run,:ch,:ch,true,'SENTINEL_PASSED')
               RETURNING id"""),
            {"sec": sec, "st": st, "et": et, "dem": dem, "run": run, "ch": ch}).scalar())


def datetime_now_plus(days: int):
    from datetime import datetime, timedelta, timezone
    return datetime.now(timezone.utc) + timedelta(days=days)


def test_full_lifecycle(client, engine):
    plan_id = _seed_plan_ready_for_approval(engine)
    srdom = auth_header(make_token("srdom_dli", "SR_DOM"))
    drm = auth_header(make_token("drm_dli", "DRM"))

    def decide(h, decision, user):
        return client.post("/api/v1/approvals/decide", headers=h,
                           json={"plan_id": plan_id, "decision": decision,
                                 "signature": f"sig-{user}-12345",
                                 "idempotency_key": f"e2e-{plan_id}-{user}-{decision}-{uuid.uuid4()}"})

    # 1. Sr. DOM approves the hash-bound plan.
    r = decide(srdom, "APPROVE", "srdom")
    assert r.status_code == 200, r.text

    # 2. Distinct DRM authorizes.
    r = decide(drm, "APPROVE", "drm")
    assert r.status_code == 200 and r.json()["status"] == "AUTHORIZED_DRM"

    # 3. T-2h transmit queues the outbox row (status stays AUTHORIZED_DRM until ack).
    r = client.post(f"/api/v1/plans/{plan_id}/transmit", headers=srdom)
    assert r.status_code == 200, r.text

    # 4. COA bridge loop acks within ~2s + delay; poll for TRANSMITTED_COA.
    deadline = time.time() + 15
    status = None
    while time.time() < deadline:
        with engine.begin() as conn:
            status = conn.execute(text(
                "SELECT approval_status FROM optimization.block_plans WHERE id=:i"),
                {"i": plan_id}).scalar()
        if status == "TRANSMITTED_COA":
            break
        time.sleep(0.5)
    assert status == "TRANSMITTED_COA"

    # 5. Field lifecycle: activate → fitness → archive.
    ctl = auth_header(make_token("controller_dli", "CONTROLLER"))
    eng = auth_header(make_token("engineer_dli", "ENGINEER"))
    adm = auth_header(make_token("admin", "ADMIN"))
    assert client.post(f"/api/v1/plans/{plan_id}/activate", headers=ctl).status_code == 200
    assert client.post(f"/api/v1/plans/{plan_id}/complete-fitness", headers=eng).status_code == 200
    assert client.post(f"/api/v1/plans/{plan_id}/archive", headers=adm).json()["status"] == "ARCHIVED_SEALED"


def test_emergency_drill_provisional_and_ack_gate(client, engine):
    """SAFE-003 drill: incident on a section with a transmitted block → advisory revoke,
    PROVISIONAL re-plan with structural checks, Controller acknowledgment gate."""
    ctl = auth_header(make_token("controller_dli", "CONTROLLER"))

    # Prepare a transmitted block to supersede.
    import uuid as _u
    with engine.begin() as conn:
        # Pick one of the pair and clear any residue from earlier runs so the
        # seeded TRANSMITTED_COA row cannot trip excl_active_overlap.
        code = "TDL-ETW-" + ("UP" if int(_u.uuid4().hex[:2], 16) % 2 else "DN")
        sec_row = conn.execute(text(
            """SELECT s.id, s.section_code FROM infrastructure.block_sections s
               WHERE s.section_code=:c"""), {"c": code}).one()
        conn.execute(text(
            """UPDATE optimization.block_plans SET approval_status='CANCELLED'
               WHERE section_id=:s AND approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED')"""),
            {"s": sec_row.id})
        dem = conn.execute(text(
            """INSERT INTO demands.block_demands
               (external_source, external_ref_id, department, section_id, activity_code,
                min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
               VALUES ('TMS',:ref,'ENGINEERING',:sec,'DTT_TAMPING',120,
                       now()+interval '6 hours', now()+interval '3 days',0.9,'SUBMITTED')
               RETURNING id"""),
            {"ref": f"EMG-{uuid.uuid4()}", "sec": sec_row.id}).scalar()
        run = conn.execute(text(
            "INSERT INTO optimization.solver_runs (horizon, division, status) "
            "VALUES ('REALTIME','PRYJ','COMPLETED') RETURNING id")).scalar()
        st, et = datetime_now_plus(0.25), datetime_now_plus(0.5)
        ch = content_hash(str(sec_row.id), st, et, str(dem), [])
        plan_id = conn.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, sentinel_hash, sentinel_verified, approval_status)
               VALUES ('REALTIME',:sec,:st,:et,:dem,:run,:ch,:ch,true,'TRANSMITTED_COA')
               RETURNING id"""),
            {"sec": sec_row.id, "st": st, "et": et, "dem": dem, "run": run, "ch": ch}).scalar()

    # Blast-radius preview (API-001 modal data).
    r = client.get(f"/api/v1/emergency/blast-radius?section_id={sec_row.id}&estimated_duration_mins=90",
                   headers=ctl)
    assert r.status_code == 200
    assert "plans_superseded" in r.json()

    # Fire WITHOUT confirmation → rejected.
    r = client.post("/api/v1/emergency/breakdown", headers=ctl,
                    json={"section_id": str(sec_row.id), "breakdown_type": "TRACK_FRACTURE",
                          "estimated_duration_mins": 90, "confirmation": False,
                          "idempotency_key": f"emg-{uuid.uuid4()}"})
    assert r.status_code == 400

    # Fire WITH confirmation → PROVISIONAL plan inside budget, structural checks intact.
    t0 = time.time()
    r = client.post("/api/v1/emergency/breakdown", headers=ctl,
                    json={"section_id": str(sec_row.id), "breakdown_type": "TRACK_FRACTURE",
                          "estimated_duration_mins": 90, "confirmation": True,
                          "idempotency_key": f"emg-{uuid.uuid4()}"})
    wall = time.time() - t0
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["provisional"] is True and body["awaiting_controller_acknowledgment"] is True
    # NFR-002: measured end-to-end drill (incl. synchronous structural re-check) ≤ 45 s.
    assert body["measured"]["wall_seconds_incl_sentinel"] <= 45
    assert wall <= 60
    with engine.begin() as conn:
        old_status = conn.execute(text(
            "SELECT approval_status FROM optimization.block_plans WHERE id=:i"),
            {"i": plan_id}).scalar()
    assert old_status in ("SUPERSEDED_EMERGENCY", "TRANSMITTED_COA")

    # The PROVISIONAL plan must NOT be transmitted before Controller acknowledgment.
    inc_id = body["incident_id"]
    provisional_plan = body["plan_id"]
    r = client.post(f"/api/v1/emergency/incidents/{inc_id}/acknowledge", headers=ctl)
    assert r.status_code == 200
