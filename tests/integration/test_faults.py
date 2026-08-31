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
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from .conftest import DSN, auth_header, make_token


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
def eager_worker(monkeypatch):
    from apps.workers import tasks as wt
    wt.app.conf.task_always_eager = True
    wt.app.conf.task_eager_propagates = False
    # Seeded weather alerts must not defer the synthetic demands under test:
    # fail-closed deferral empties the candidate set and the solver then reports
    # a trivial OPTIMAL, masking the statuses these tests exist to pin down.
    monkeypatch.setattr(wt, "load_weather_deferrals", lambda conn: set())
    yield wt
    wt.app.conf.task_always_eager = False


# Demands owned by the fault tests (throwaway FLT* divisions or fault-test markers).
_VICTIM_DEMANDS = """
    SELECT id FROM demands.block_demands
     WHERE section_id IN (SELECT id FROM infrastructure.block_sections
                           WHERE division LIKE 'FLT\\_%' ESCAPE '\\')
        OR external_ref_id LIKE 'FLT1-%' OR external_ref_id LIKE 'EMG-%' OR external_ref_id LIKE 'E2E-%'
        OR external_ref_id LIKE 'SAFE002-%' OR external_ref_id LIKE 'APP001-%'
        OR external_ref_id LIKE 'ACK-%' OR external_ref_id LIKE 'FLTKILL-%'
        OR external_ref_id LIKE 'FLTRDS-%' OR external_ref_id LIKE 'DBG-%'"""

# Plans anchored on throwaway divisions OR planning any victim demand — escalation
# artifacts live on real sections, so the demand filter alone is not enough.
_VICTIM_PLANS = f"""
    SELECT p.id FROM optimization.block_plans p
     WHERE p.section_id IN (SELECT id FROM infrastructure.block_sections
                             WHERE division LIKE 'FLT\\_%' ESCAPE '\\')
        OR p.primary_demand_id IN ({_VICTIM_DEMANDS})"""


@pytest.fixture(autouse=True)
def flt_cleanup(engine):
    """TASK-062: fault tests create throwaway FLT* divisions; remove them and all
    dependents after each test so no phantom divisions reach the UI."""
    yield
    with engine.begin() as c:
        # Every child table of block_plans is ON DELETE RESTRICT — clear them
        # before the plans themselves, then the demands, then the divisions.
        c.execute(text(f"DELETE FROM operations.signal_acknowledgments WHERE plan_id IN ({_VICTIM_PLANS})"))
        c.execute(text(f"DELETE FROM optimization.coa_outbox WHERE plan_id IN ({_VICTIM_PLANS})"))
        c.execute(text(f"DELETE FROM optimization.machine_rosters WHERE plan_id IN ({_VICTIM_PLANS})"))
        c.execute(text(f"DELETE FROM optimization.plan_shadow_demands WHERE plan_id IN ({_VICTIM_PLANS})"
                       f" OR demand_id IN ({_VICTIM_DEMANDS})"))
        c.execute(text(f"DELETE FROM optimization.plan_sections WHERE plan_id IN ({_VICTIM_PLANS})"))
        c.execute(text(f"UPDATE optimization.block_plans SET supersedes_id = NULL"
                       f" WHERE supersedes_id IN ({_VICTIM_PLANS})"))
        c.execute(text(f"DELETE FROM optimization.block_plans WHERE id IN ({_VICTIM_PLANS})"))
        c.execute(text(f"DELETE FROM demands.block_demands WHERE id IN ({_VICTIM_DEMANDS})"))
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
    # The model treats unaddressable demands as soft (formulations.build_model
    # forces present=0 when the window cannot fit the duration), so CP-SAT
    # reports OPTIMAL with zero candidates; the escalation contract is driven
    # by "nothing schedulable", not by the raw CP-SAT status.
    assert stats["total_demands"] == 3          # demands reached the solver (not noop/deferred)
    assert stats["attempts"] == 1               # zero candidates → no sentinel retries
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
    import psycopg2

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
        st = datetime.now(UTC) + timedelta(days=5)
        et = st + timedelta(hours=3)
        plan_id = str(c.execute(text(
            """INSERT INTO optimization.block_plans
               (plan_horizon, section_id, start_time, end_time, primary_demand_id,
                solver_run_id, content_hash, approval_status)
               VALUES ('WEEKLY',:sec,:st,:et,:dem,:run,:ch,'SENTINEL_PASSED')
               RETURNING id"""),
            {"sec": sec, "st": st, "et": et, "dem": dem, "run": run,
             "ch": "a" * 64}).scalar())

    from sqlalchemy.engine import make_url
    _url = make_url(DSN)
    victim = psycopg2.connect(host=_url.host, port=_url.port or 5432, dbname=_url.database,
                              user=_url.username, password=_url.password)
    vcur = victim.cursor()
    vcur.execute("BEGIN")
    vcur.execute("UPDATE optimization.block_plans SET approval_status='AUTHORIZED_DRM' WHERE id=%s",
                 (plan_id,))
    vcur.execute("SELECT audit.append_event(%s,%s,'{}'::jsonb)", ("KILLED_TX_EVENT", marker))

    worker_started = threading.Event()
    worker_error: list[Exception] = []

    def doze():
        try:
            worker_started.set()
            vcur.execute("SELECT pg_sleep(6)")   # mid-flow hold while main thread kills us
        except Exception as exc:
            worker_error.append(exc)

    th = threading.Thread(target=doze)
    th.start()
    worker_started.wait(timeout=5)

    # Deterministically poll pg_stat_activity until the worker's pg_sleep query
    # is visible as an *active* backend — avoids matching idle pool connections
    # that previously ran this same poll query.
    pid = None
    for _ in range(50):
        with engine.begin() as c:
            pid = c.execute(text(
                "SELECT pid FROM pg_stat_activity "
                "WHERE datname = current_database() "
                "  AND state = 'active' "
                "  AND query LIKE '%pg_sleep%' "
                "  AND pid != pg_backend_pid()")).scalar()
        if pid is not None:
            break
        time.sleep(0.1)
    assert pid is not None, "worker pg_sleep query never appeared in pg_stat_activity"

    with engine.begin() as c:
        c.execute(text("SELECT pg_terminate_backend(:p)"), {"p": pid})

    th.join(timeout=10)
    assert not th.is_alive(), "worker thread still alive after pg_terminate_backend"
    assert worker_error and isinstance(worker_error[0], psycopg2.OperationalError), (
        f"expected backend-kill OperationalError, got: {worker_error or 'no error (kill never landed)'}")

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
        st = datetime.now(UTC) + timedelta(days=5)
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
