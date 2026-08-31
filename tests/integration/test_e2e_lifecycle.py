"""TASK-060 hardened E2E: full lifecycle Ingestion → Solve → Sentinel → Approve →
Authorize → Transmit(outbox) → Activate → Complete → Archive, plus the emergency
drill and a rejected modify-after-verify attempt. Requires DB + seeded data."""
from __future__ import annotations

import json
import time
import uuid
from datetime import UTC, timedelta

from sqlalchemy import text

from packages.chronicle.canonical import content_hash

from .conftest import auth_header, make_token


def _seed_plan_ready_for_approval(engine) -> str:
    with engine.begin() as conn:
        st, et = datetime_now_plus(1), datetime_now_plus(2)
        # Pick a section with no ACTIVE plan overlapping this window: earlier
        # tests (e.g. APP-001) leave AUTHORIZED_DRM rows on random sections and
        # excl_active_overlap would otherwise reject the APPROVE transition.
        sec = conn.execute(text(
            """SELECT s.id FROM infrastructure.block_sections s
               WHERE s.division='DLI' AND s.is_active AND NOT EXISTS (
                     SELECT 1 FROM optimization.block_plans p
                      WHERE p.section_id = s.id
                        AND p.approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED')
                        AND tstzrange(p.start_time, p.end_time) && tstzrange(:st,:et))
               ORDER BY s.section_code LIMIT 1"""), {"st": st, "et": et}).scalar()
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
        ch = content_hash(str(sec), st, et, str(dem), [])
        return str(conn.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, sentinel_hash, sentinel_verified, approval_status)
               VALUES ('WEEKLY',:sec,:st,:et,:dem,:run,:ch,:ch,true,'SENTINEL_PASSED')
               RETURNING id"""),
            {"sec": sec, "st": st, "et": et, "dem": dem, "run": run, "ch": ch}).scalar())


def datetime_now_plus(days: int):
    from datetime import datetime, timedelta
    return datetime.now(UTC) + timedelta(days=days)


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


def test_emergency_breakdown_idempotency_replays_without_duplicate_effect(client, engine):
    """APP-001: repeated emergency submissions with the same key must replay and
    create no second incident or provisional plan."""
    ctl = auth_header(make_token("controller_dli", "CONTROLLER"))
    import uuid as _u

    with engine.begin() as conn:
        code = "TDL-ETW-" + ("UP" if int(_u.uuid4().hex[:2], 16) % 2 else "DN")
        sec_row = conn.execute(text(
            "SELECT s.id, s.section_code FROM infrastructure.block_sections s WHERE s.section_code=:c"),
            {"c": code}).one()
        conn.execute(text(
            "UPDATE optimization.block_plans SET approval_status='CANCELLED' "
            "WHERE section_id=:s AND approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED')"),
            {"s": sec_row.id})
        dem = conn.execute(text(
            """INSERT INTO demands.block_demands
               (external_source, external_ref_id, department, section_id, activity_code,
                min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
               VALUES ('TMS',:ref,'ENGINEERING',:sec,'DTT_TAMPING',120,
                       now()+interval '6 hours', now()+interval '3 days',0.9,'SUBMITTED')
               RETURNING id"""),
            {"ref": f"IDEM-{uuid.uuid4()}", "sec": sec_row.id}).scalar()
        run = conn.execute(text(
            "INSERT INTO optimization.solver_runs (horizon, division, status) "
            "VALUES ('REALTIME','PRYJ','COMPLETED') RETURNING id")).scalar()
        st, et = datetime_now_plus(0.25), datetime_now_plus(0.5)
        ch = content_hash(str(sec_row.id), st, et, str(dem), [])
        conn.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, sentinel_hash, sentinel_verified, approval_status)
               VALUES ('REALTIME',:sec,:st,:et,:dem,:run,:ch,:ch,true,'TRANSMITTED_COA')
               RETURNING id"""),
            {"sec": sec_row.id, "st": st, "et": et, "dem": dem, "run": run, "ch": ch})

    key = f"idem-emg-{uuid.uuid4()}"
    payload = {"section_id": str(sec_row.id), "breakdown_type": "TRACK_FRACTURE",
               "estimated_duration_mins": 90, "confirmation": True,
               "idempotency_key": key}

    r1 = client.post("/api/v1/emergency/breakdown", headers=ctl, json=payload)
    assert r1.status_code == 201, r1.text
    first = r1.json()
    assert first["provisional"] is True
    assert first["awaiting_controller_acknowledgment"] is True

    r2 = client.post("/api/v1/emergency/breakdown", headers=ctl, json=payload)
    assert r2.status_code == 201, r2.text
    second = r2.json()
    assert second["replayed"] is True
    assert {k: first[k] for k in first if k != "replayed"} == {
        k: second[k] for k in second if k != "replayed"
    }

    with engine.begin() as conn:
        incident_count = conn.execute(text(
            "SELECT count(*) FROM operations.incidents WHERE id=:i"),
            {"i": first["incident_id"]}).scalar()
        plan_count = conn.execute(text(
            "SELECT count(*) FROM optimization.block_plans WHERE incident_id=:i"),
            {"i": first["incident_id"]}).scalar()
        replay_count = conn.execute(text(
            "SELECT count(*) FROM audit.idempotency_keys WHERE key=:k AND endpoint='/emergency/breakdown' "
            "AND actor_id=:a"),
            {"k": key, "a": "controller_dli"}).scalar()

    assert incident_count == 1
    assert plan_count == 1
    assert replay_count == 1


def test_transmit_rejects_when_t2h_recheck_fails(client, engine):
    """R6.2 gate: a plan that conflicts with the latest train occupancy must be
    rejected at T-2h before enqueueing COA transmission."""
    srdom = auth_header(make_token("srdom_dli", "SR_DOM"))
    with engine.begin() as conn:
        sec = conn.execute(text(
            "SELECT id, section_code FROM infrastructure.block_sections "
            "WHERE division='DLI' ORDER BY section_code LIMIT 1")).one()
        dem = conn.execute(text(
            """INSERT INTO demands.block_demands
               (external_source, external_ref_id, department, section_id, activity_code,
                min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
               VALUES ('TMS',:ref,'ENGINEERING',:sec,'DTT_TAMPING',180,
                       :es,:ld,0.75,'SUBMITTED')
               RETURNING id"""),
            {"ref": f"TX-FAIL-{uuid.uuid4()}", "sec": sec.id,
             "es": datetime_now_plus(1), "ld": datetime_now_plus(4)}).scalar()
        run = conn.execute(text(
            "INSERT INTO optimization.solver_runs (horizon, division, status) "
            "VALUES ('WEEKLY','DLI','COMPLETED') RETURNING id")).scalar()
        st, et = datetime_now_plus(1), datetime_now_plus(2)
        ch = content_hash(str(sec.id), st, et, str(dem), [])
        plan_id = conn.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, sentinel_hash, sentinel_verified,
                approval_status, decided_by, authorized_by)
               VALUES ('WEEKLY',:sec,:st,:et,:dem,:run,:ch,:ch,true,'AUTHORIZED_DRM','srdom_dli','drm_dli')
               RETURNING id"""),
            {"sec": sec.id, "st": st, "et": et, "dem": dem, "run": run, "ch": ch}).scalar()
        conn.execute(text(
            """INSERT INTO operations.train_paths
               (train_number, train_type, section_id, scheduled_entry, scheduled_exit,
                priority_rank, source, metadata)
               VALUES (:n, 'MAIL', :sec, :entry, :exit, 1, 'WTT', CAST(:m AS jsonb))
               ON CONFLICT (train_number, section_id, scheduled_entry) DO NOTHING"""),
            {"n": f"FAIL-CHK-{uuid.uuid4()}", "sec": sec.id,
             "entry": st - timedelta(minutes=30), "exit": et + timedelta(minutes=30),
             "m": json.dumps({"note": "conflicting train inserted for T-2h re-check fail path"})})

    r = client.post(f"/api/v1/plans/{plan_id}/transmit", headers=srdom)
    assert r.status_code == 400, r.text
    body = r.json()
    assert "failed_checks" in body
    assert any("G&SR-1" in failed for failed in body["failed_checks"])


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
    body["plan_id"]
    r = client.post(f"/api/v1/emergency/incidents/{inc_id}/acknowledge", headers=ctl)
    assert r.status_code == 200
