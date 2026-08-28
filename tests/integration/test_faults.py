"""TASK-057 fault-injection evidence (automated portion):

  F1  Solver cannot schedule anything (INFEASIBLE-class input) → retry-cap →
      FAILED_ESCALATE_HUMAN, demands ESCALATED_OVERDUE, ZERO unsafe plans committed.
  F2  Sentinel rejects every candidate (validator monkeypatched to fail-all) →
      exactly MAX_SENTINEL_RETRIES attempts, then escalate; no plans committed.
  F3  PostgreSQL backend killed mid-transaction after writes → full rollback
      (no plan-state change, no ledger row) — G&SR-3 fail-closed under crash.
  F4  Redis unavailable (publish raises) → committed state transitions still succeed;
      live-event fan-out degrades silently, authorizations unaffected.
"""
from __future__ import annotations
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from .conftest import auth_header, make_token


def _seed_run_with_impossible_demands(engine, feasible=False) -> str:
    """Isolated throwaway division so the solve sees ONLY these three demands.
    Default: min_duration exceeds the whole window → present forced 0 for all."""
    with engine.begin() as conn:
        div = f"FLT{uuid.uuid4().hex[:4].upper()}"
        sec = str(conn.execute(text(
            """INSERT INTO infrastructure.block_sections
               (section_code, division, zone, start_km, end_km, line_type,
               electrification, speed_limit_mps, track_geom)
               VALUES (:code, :div, 'NR', 900.0, 910.0, 'SINGLE', 'NONE', 60,
                       ST_GeomFromText('LINESTRING(77.2 28.6, 77.3 28.7)', 4326))
               RETURNING id"""),
            {"code": f"FLT-{div}", "div": div}).scalar())
        run = str(conn.execute(text(
            "INSERT INTO optimization.solver_runs (horizon, division, status) "
            "VALUES ('WEEKLY',:d,'QUEUED') RETURNING id"), {"d": div}).scalar())
        dur, es_off, ld_off = ((90, 48, 144) if feasible else (600, 48, 51))
        for i in range(3):
            conn.execute(text(
                """INSERT INTO demands.block_demands
                   (external_source, external_ref_id, department, section_id, activity_code,
                    min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
                   VALUES ('TMS',:ref,'ENGINEERING',:sec,'DTT_TAMPING',:dur,
                           now()+:es * interval '1 hour',
                           now()+:ld * interval '1 hour',0.9,'SUBMITTED')"""),
                {"ref": f"FLT1-{run[:8]}-{i}", "sec": sec, "dur": dur,
                 "es": es_off, "ld": ld_off})
        return run


@pytest.fixture()
def eager_worker():
    from apps.workers import tasks as wt
    wt.app.conf.task_always_eager = True
    wt.app.conf.task_eager_propagates = False
    yield wt
    wt.app.conf.task_always_eager = False


@pytest.fixture(autouse=True)
def flt_cleanup(engine):
    """TASK-062: fault tests create throwaway FLT* divisions; remove them and all
    dependents after each test so no phantom divisions reach the UI."""
    yield
    with engine.begin() as c:
        c.execute(text(
            """DELETE FROM optimization.machine_rosters WHERE plan_id IN (
                 SELECT p.id FROM optimization.block_plans p
                 JOIN infrastructure.block_sections s ON s.id = p.section_id
                 WHERE s.division LIKE 'FLT\\_%' ESCAPE '\\')"""))
        c.execute(text(
            """DELETE FROM optimization.plan_shadow_demands WHERE plan_id IN (
                 SELECT p.id FROM optimization.block_plans p
                 JOIN infrastructure.block_sections s ON s.id = p.section_id
                 WHERE s.division LIKE 'FLT\\_%' ESCAPE '\\')"""))
        c.execute(text(
            """DELETE FROM optimization.plan_sections WHERE plan_id IN (
                 SELECT p.id FROM optimization.block_plans p
                 JOIN infrastructure.block_sections s ON s.id = p.section_id
                 WHERE s.division LIKE 'FLT\\_%' ESCAPE '\\')"""))
        c.execute(text(
            """DELETE FROM optimization.block_plans
               WHERE section_id IN (
                     SELECT id FROM infrastructure.block_sections WHERE division LIKE 'FLT\\_%' ESCAPE '\\')
                  OR primary_demand_id IN (
                     SELECT id FROM demands.block_demands
                     WHERE external_ref_id LIKE 'FLTKILL-%' OR external_ref_id LIKE 'FLTRDS-%'
                        OR external_ref_id LIKE 'DBG-%')"""))
        c.execute(text(
            """DELETE FROM demands.block_demands WHERE section_id IN (
                 SELECT id FROM infrastructure.block_sections WHERE division LIKE 'FLT\\_%' ESCAPE '\\')
               OR external_ref_id LIKE 'FLT1-%' OR external_ref_id LIKE 'EMG-%' OR external_ref_id LIKE 'E2E-%'
               OR external_ref_id LIKE 'SAFE002-%' OR external_ref_id LIKE 'APP001-%'
               OR external_ref_id LIKE 'ACK-%' OR external_ref_id LIKE 'FLTKILL-%'
               OR external_ref_id LIKE 'FLTRDS-%' OR external_ref_id LIKE 'DBG-%'"""))
        c.execute(text(
            "DELETE FROM infrastructure.block_sections WHERE division LIKE 'FLT\\_%' ESCAPE '\\'"))


def _count_plans_for_run(engine, run_id):
    with engine.begin() as c:
        return c.execute(text(
            "SELECT count(*) FROM optimization.block_plans WHERE solver_run_id=:r"),
            {"r": run_id}).scalar()


def _escalated_count(engine, marker):
    with engine.begin() as c:
        return c.execute(text(
            """SELECT count(*) FROM demands.block_demands
               WHERE status='ESCALATED_OVERDUE' AND external_ref_id LIKE :m"""),
            {"m": f"FLT1-{marker}-%"}).scalar()


def test_f1_solver_infeasible_escalates_without_committing_plans(engine, eager_worker):
    run_id = _seed_run_with_impossible_demands(engine)
    marker = run_id[:8]
    stats = eager_worker.run_solve.apply(args=[run_id]).result
    assert stats["status"] in ("INFEASIBLE", "UNKNOWN")
    assert _count_plans_for_run(engine, run_id) == 0          # nothing unsafe committed
    assert _escalated_count(engine, marker) == 3               # FSM-002 terminal state
    with engine.begin() as c:
        ev = c.execute(text(
            "SELECT count(*) FROM audit.action_ledger "
            "WHERE event_type='SOLVE_FAILED_ESCALATE_HUMAN' AND payload_json->>'run_id'=:r"),
            {"r": run_id}).scalar()
        st = c.execute(text("SELECT status FROM optimization.solver_runs WHERE id=:i"),
                       {"i": run_id}).scalar()
    assert ev >= 1 and st == "FAILED"


def test_f2_sentinel_fail_all_hits_retry_cap_then_escalates(engine, eager_worker, monkeypatch):
    from packages.sentinel.validator import CheckResult
    from packages.sentinel.validator import validate_set as real_validate_set

    # Feasible windows so the SOLVER succeeds and produces candidates — the
    # injected Sentinel must then reject them on every attempt.
    run_id = _seed_run_with_impossible_demands(engine, feasible=True)

    def fail_all(candidates, ctx):
        verdicts = real_validate_set(candidates, ctx)
        for v in verdicts:
            v.results = [CheckResult(r.check_id, False, False, "injected failure") for r in v.results]
        return verdicts

    # run_solve imports validate_set locally at call time → patch the source module.
    monkeypatch.setattr("packages.sentinel.validator.validate_set", fail_all)

    calls = {"n": 0}
    orig_solve_calls = {"n": 0}
    import packages.optima.solver as solver_mod
    real_solve = solver_mod.solve

    def counting_solve(*a, **kw):
        orig_solve_calls["n"] += 1
        return real_solve(*a, **kw)

    monkeypatch.setattr(solver_mod, "solve", counting_solve)

    stats = eager_worker.run_solve.apply(args=[run_id]).result
    max_retries = int(eager_worker._env_int("MAX_SENTINEL_RETRIES", 3))
    assert stats["attempts"] == max_retries                     # capped, not unbounded
    assert _count_plans_for_run(engine, run_id) == 0            # rejected output never persisted
    with engine.begin() as c:
        st = c.execute(text("SELECT status FROM optimization.solver_runs WHERE id=:i"),
                       {"i": run_id}).scalar()
    assert st == "FAILED"


def test_f3_postgres_backend_kill_midflow_rolls_back_everything(engine):
    """Writes (plan transition + ledger row) inside a tx whose backend is killed →
    neither survives. G&SR-3: no authorization granted under a crashed writer."""
    marker = f"FLTKILL-{uuid.uuid4().hex[:8]}"
    plan_id = None
    with engine.begin() as c:
        sec = c.execute(text(
            "SELECT id FROM infrastructure.block_sections WHERE section_code='NDLS-GZB-DN'")).scalar()
        dem = c.execute(text(
            """INSERT INTO demands.block_demands
               (external_source, external_ref_id, department, section_id, activity_code,
                min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
               VALUES ('TMS',:ref,'ENGINEERING',:sec,'POINTS_PACKING',60,
                       now()+interval '4 days', now()+interval '8 days',0.5,'SUBMITTED')
               RETURNING id"""),
            {"ref": marker, "sec": sec}).scalar()
        run = c.execute(text(
            "INSERT INTO optimization.solver_runs (horizon, division, status) "
            "VALUES ('WEEKLY','DLI','COMPLETED') RETURNING id")).scalar()
        st = datetime.now(timezone.utc) + timedelta(days=5)
        et = st + timedelta(hours=3)
        plan_id = str(c.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, approval_status)
               VALUES ('WEEKLY',:sec,:st,:et,:dem,:run,:ch,'SENTINEL_PASSED')
               RETURNING id"""),
            {"sec": sec, "st": st, "et": et, "dem": dem, "run": run,
             "ch": "a" * 64}).scalar())

    victim = __import__("psycopg2").connect(
        "host=localhost port=5432 dbname=railbloc_db user=rail_admin password=rail_secure_password")
    vcur = victim.cursor()
    vcur.execute("BEGIN")
    vcur.execute("UPDATE optimization.block_plans SET approval_status='AUTHORIZED_DRM' WHERE id=%s",
                 (plan_id,))
    vcur.execute("SELECT audit.append_event(%s,%s,'{}'::jsonb)", ("KILLED_TX_EVENT", marker))
    sleep_started = threading.Event()
    sleep_finished = threading.Event()
    thread_error = {}

    def doze():
        try:
            sleep_started.set()
            vcur.execute("SELECT pg_sleep(6)")   # mid-flow hold while main thread kills us
        except Exception as exc:  # surfaced on main thread after join
            thread_error["exc"] = exc
        finally:
            sleep_finished.set()

    th = threading.Thread(target=doze)
    th.start()
    assert sleep_started.wait(timeout=5), "worker did not start pg_sleep thread"

    pid = None
    deadline = time.monotonic() + 5
    while pid is None and time.monotonic() < deadline:
        if "exc" in thread_error:
            pytest.fail(f"worker thread errored before backend kill: {thread_error['exc']}")
        with engine.begin() as c:
            pid = c.execute(text(
                "SELECT pid FROM pg_stat_activity WHERE datname='railbloc_db' AND query LIKE '%pg_sleep%'")).scalar()
        if pid is None:
            time.sleep(0.05)

    assert pid is not None, "could not find sleeping backend to terminate"
    with engine.begin() as c:
        c.execute(text("SELECT pg_terminate_backend(:p)"), {"p": pid})

    assert sleep_finished.wait(timeout=10), "worker thread did not finish after backend termination"
    th.join(timeout=1)
    victim.close()
    if "exc" in thread_error:
        err_text = str(thread_error["exc"]).lower()
        assert ("terminating connection" in err_text
                or "closed the connection unexpectedly" in err_text
                or "server closed the connection unexpectedly" in err_text), thread_error["exc"]

    with engine.begin() as c:
        st = c.execute(text("SELECT approval_status FROM optimization.block_plans WHERE id=:i"),
                       {"i": plan_id}).scalar()
        n_ev = c.execute(text(
            "SELECT count(*) FROM audit.action_ledger WHERE payload_json::text LIKE :m"),
            {"m": f"%{marker}%"}).scalar()
    assert st == "SENTINEL_PASSED", "partial write survived backend kill!"
    assert n_ev == 0, "ledger row from killed transaction survived!"


def test_f4_redis_down_does_not_block_authorization(client, engine, monkeypatch):
    from apps.api.services import sse as sse_mod

    plan_id = None
    with engine.begin() as c:
        sec = c.execute(text(
            "SELECT id FROM infrastructure.block_sections WHERE section_code='GZB-ALJN-3L'")).scalar()
        from packages.chronicle.canonical import content_hash
        dem = c.execute(text(
            """INSERT INTO demands.block_demands
               (external_source, external_ref_id, department, section_id, activity_code,
                min_duration_mins, earliest_start, latest_deadline, urgency_score, status)
               VALUES ('TMS',:ref,'ENGINEERING',:sec,'POINTS_PACKING',60,
                       now()+interval '4 days', now()+interval '8 days',0.5,'SUBMITTED')
               RETURNING id"""),
            {"ref": f"FLTRDS-{uuid.uuid4().hex[:8]}", "sec": sec}).scalar()
        run = c.execute(text(
            "INSERT INTO optimization.solver_runs (horizon, division, status) "
            "VALUES ('WEEKLY','DLI','COMPLETED') RETURNING id")).scalar()
        st = datetime.now(timezone.utc) + timedelta(days=5)
        et = st + timedelta(hours=3)
        ch = content_hash(str(sec), st, et, str(dem), [])
        plan_id = str(c.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, sentinel_hash, sentinel_verified, approval_status)
               VALUES ('WEEKLY',:sec,:st,:et,:dem,:run,:ch,:ch,true,'SENTINEL_PASSED')
               RETURNING id"""),
            {"sec": sec, "st": st, "et": et, "dem": dem, "run": run, "ch": ch}).scalar())

    def broken_client():
        raise ConnectionError("injected: redis unreachable")

    monkeypatch.setattr(sse_mod, "client", broken_client)

    r = client.post("/api/v1/approvals/decide",
                    headers=auth_header(make_token("srdom_dli", "SR_DOM")),
                    json={"plan_id": plan_id, "decision": "APPROVE",
                          "signature": "sig-faultinj-1",
                          "idempotency_key": f"fltrds-{plan_id}"})
    assert r.status_code == 200, r.text
    with engine.begin() as c:
        st = c.execute(text("SELECT approval_status FROM optimization.block_plans WHERE id=:i"),
                       {"i": plan_id}).scalar()
    assert st == "APPROVED_SR_DOM"
