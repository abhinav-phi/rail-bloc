"""Celery worker pipeline (TASK-020/022/044-046 + FSM-002 retry cap).

Solve FSM: IDLE → GRAPH_ASSEMBLY → SOLVING → SENTINEL_EVALUATION → COMMITTED
           ↘ REJECTED_RETRY (soft weights relaxed, capped at MAX_SENTINEL_RETRIES)
             ↘ FAILED_ESCALATE_HUMAN → demands become ESCALATED_OVERDUE.

All cadences come from environment (Rules.md §4 XC-010): WEEKLY_PLAN_CRON etc.
"""
from __future__ import annotations

import json
import os
from datetime import UTC, datetime, timedelta

import redis as sync_redis
from celery import Celery
from celery.schedules import crontab
from sqlalchemy import create_engine, text

from apps.api.core.metrics import PLANS_CREATED_TOTAL, SOLVES_TOTAL

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
DSN = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL", "").replace("+asyncpg", "+psycopg2")

app = Celery("railbloc", broker=REDIS_URL, backend=REDIS_URL)
app.conf.beat_schedule = {}
app.conf.timezone = "UTC"


def _env_float(k, d):
    try:
        return float(os.environ.get(k, d))
    except ValueError:
        return d


def _env_int(k, d):
    try:
        return int(os.environ.get(k, d))
    except ValueError:
        return d


_DOW_NAMES = {0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 7: "sun"}


def _parse_cron_field(field: str, lo, hi, dow=False):
    """Small standard-cron field parser; dow numbers map to names so the semantics are
    unambiguous regardless of celery's numbering convention."""
    def tok(t):
        if t == "*":
            return "*"
        if t.startswith("*/"):
            return f"*/{int(t[2:])}"
        v = int(t)
        if dow and v in _DOW_NAMES and not (lo <= v <= hi and v != 7):
            pass
        if dow:
            return _DOW_NAMES[v % 7]
        return v

    if "," in field:
        parts = [tok(x) for x in field.split(",")]
        return parts if len(parts) > 1 else parts[0]
    return tok(field)


def weekly_beat_schedule() -> dict:
    expr = os.environ.get("WEEKLY_PLAN_CRON", "0 15 * * 4").split()
    if len(expr) != 5:
        expr = "0 15 * * 4".split()
    minute = _parse_cron_field(expr[0], 0, 59)
    hour = _parse_cron_field(expr[1], 0, 23)
    day_of_month = _parse_cron_field(expr[2], 1, 31)
    month = _parse_cron_field(expr[3], 1, 12)
    day_of_week = _parse_cron_field(expr[4], 0, 6, dow=True)
    return {"generate-weekly-plans": {
        "task": "apps.workers.tasks.generate_weekly_plans",
        "schedule": crontab(minute=minute, hour=hour, day_of_month=day_of_month,
                            month_of_year=month, day_of_week=day_of_week),
    }}


app.conf.beat_schedule.update(weekly_beat_schedule())
app.conf.beat_schedule.update({
    "simulate-feed-ingest": {
        "task": "apps.workers.tasks.simulate_feed_ingest",
        # FR-001/2/3 cadence: every 6 hours.
        "schedule": crontab(minute=0, hour="*/6"),
    },
    "fois-forecast-poll": {
        "task": "apps.workers.tasks.fois_forecast_poll",
        # FR-005 cadence: hourly streaming poll.
        "schedule": crontab(minute=5),
    },
})

_engine = None


def _eng():
    global _engine
    if _engine is None:
        _engine = create_engine(DSN, pool_pre_ping=True)
    return _engine


def _sse_publish(event: str, data: dict) -> None:
    try:
        sync_redis.Redis.from_url(REDIS_URL).publish(
            "live_blocks", json.dumps({"event": event, **data}, default=str))
    except Exception:
        pass


def solve_weights():
    from packages.core.models import SolveWeights
    return SolveWeights(
        pax_delay=_env_float("OBJECTIVE_WEIGHT_PAX_DELAY", 10.0),
        frt_delay=_env_float("OBJECTIVE_WEIGHT_FRT_DELAY", 4.0),
        shadow_reward=_env_float("OBJECTIVE_WEIGHT_SHADOW_REWARD", 25.0),
        machine_idle=_env_float("OBJECTIVE_WEIGHT_MACHINE_IDLE", 2.5),
        unaddressed_defect=_env_float("OBJECTIVE_WEIGHT_UNADDRESSED_DEFECT", 100.0),
        early_start=_env_float("OBJECTIVE_WEIGHT_EARLY_START", 0.05))


def solver_params(budget_seconds: float | None = None) -> SolverParams:
    from packages.core.models import SolverParams
    return SolverParams(
        max_time_seconds=budget_seconds or _env_float("SOLVER_MAX_TIME_SECONDS", 35.0),
        num_workers=_env_int("SOLVER_NUM_WORKERS", 8),
        headway_high_priority_mins=_env_int("HEADWAY_HIGH_PRIORITY_MINS", 15),
        headway_default_mins=_env_int("HEADWAY_DEFAULT_MINS", 5),
        freight_hard_confidence=_env_float("FREIGHT_HARD_CONFIDENCE", 0.60),
        bundling_gap_mins=_env_int("BUNDLING_GAP_MINS", 0),
        max_retries=_env_int("MAX_SENTINEL_RETRIES", 3))


HORIZON_DAYS = {"WEEKLY": 7, "STRATEGIC_26W": 182, "REALTIME": 2}


def refresh_weather_alerts_if_stale(conn) -> int:
    """Simulated IMD feed (FR-005-style poll): when every seeded alert has expired,
    roll a fresh fixed-seed alert set in so TEL-002 fail-closed deferrals reflect an
    ACTIVE weather event rather than a permanently stale feed."""
    now = datetime.now(UTC)
    fresh = conn.execute(text(
        "SELECT count(*) FROM operations.weather_alerts WHERE valid_until > :n"),
        {"n": now}).scalar()
    if fresh:
        return 0
    from data.generators.traffic_gen import gen_weather
    alerts = gen_weather(now, seed=now.toordinal())
    n = 0
    for a in alerts:
        poly = json.dumps({"type": "Polygon", "coordinates": [a["polygon"]]})
        conn.execute(text(
            """INSERT INTO operations.weather_alerts
               (alert_type, severity, impact_polygon, precipitation_mm_hr,
                rail_temperature_celsius, prohibited_work_types, valid_until)
               VALUES (:t,:s,ST_GeomFromGeoJSON(:g),:p,:rt,CAST(:w AS jsonb),:v)"""),
            {"t": a["alert_type"], "s": a["severity"], "g": poly,
             "p": a["precipitation_mm_hr"], "rt": a["rail_temperature_celsius"],
             "w": json.dumps(a["prohibited_work_types"]), "v": a["valid_until"]})
        n += 1
    return n


def load_weather_deferrals(conn) -> set[str]:
    """TEL-002 fail-closed: stale/missing IMD feed defers ALL weather-sensitive outdoor
    work; a fresh feed defers exactly the prohibited types of active alerts."""
    now = datetime.now(UTC)
    ttl = timedelta(hours=_env_float("WEATHER_STALENESS_TTL_HOURS", 3.0))
    fresh = conn.execute(text(
        "SELECT prohibited_work_types FROM operations.weather_alerts "
        "WHERE valid_until > :n AND created_at > :c"), {"n": now, "c": now - ttl}).scalars().all()
    from data.generators.corridor_gen import WEATHER_SENSITIVE
    if not fresh:
        return set(WEATHER_SENSITIVE)
    prohibited: set[str] = set()
    for types in fresh:
        prohibited.update(types or [])
    return prohibited & set(WEATHER_SENSITIVE)


def maybe_apply_ml_urgency(conn, demand_rows) -> int:
    """TASK-013 advisory estimator. ML writes urgency_score with lineage ML_ESTIMATED;
    it never touches feasibility data (Rules.md §2)."""
    if os.environ.get("ENABLE_ML_URGENCY", "true").lower() != "true":
        return 0
    targets = [r for r in demand_rows
               if r["department"] == "ENGINEERING" and r["features"] and "tgi_index" in r["features"]]
    if not targets:
        return 0
    try:
        from packages.ml.degradation_model import FEATURES, estimate, train
        model = train(epochs=40)
    except Exception:
        return 0
    n = 0
    for r in targets:
        f = dict(r["features"])
        f.setdefault("imr_severity_num", {"P1_URGENT": 3, "P2_MONITOR": 2}.get(f.get("imr_severity"), 0))
        u = round(max(0.0, min(1.0, estimate(model, {k: f.get(k, 0) or 0 for k in FEATURES}))), 3)
        conn.execute(text(
            "UPDATE demands.block_demands SET urgency_score=:u, urgency_source='ML_ESTIMATED' WHERE id=:i"),
            {"u": u, "i": r["id"]})
        r["urgency_score"] = u
        n += 1
    return n


@app.task(name="apps.workers.tasks.run_solve", bind=True)
def run_solve(self, run_id: str):
    """FR-007/FR-011 full solve pipeline for one solver_runs row."""
    eng = _eng()
    from packages.chronicle.canonical import content_hash
    from packages.core.models import DemandInput, MachineInfo, TrainPathInput
    from packages.optima.objectives import replay_train_detention
    from packages.optima.solver import solve as optima_solve
    from packages.sentinel.validator import (
        FeedingMapEntry,
        SentinelContext,
        TrainInterval,
        build_ack_lookup,
        build_machine_assignments,
        validate_set,
    )

    with eng.begin() as conn:
        run = conn.execute(text(
            "SELECT horizon, division FROM optimization.solver_runs WHERE id=:i"), {"i": run_id}).mappings().first()
        if run is None:
            return {"error": "unknown run"}
        horizon, division = run["horizon"], run["division"]
        conn.execute(text("UPDATE optimization.solver_runs SET status='RUNNING' WHERE id=:i"), {"i": run_id})
        refresh_weather_alerts_if_stale(conn)

        now = datetime.now(UTC)
        until = now + timedelta(days=HORIZON_DAYS.get(horizon, 7))
        sections = conn.execute(text(
            "SELECT id, section_code, division, start_km, end_km FROM infrastructure.block_sections "
            "WHERE division=:d AND is_active"), {"d": division}).mappings().all()
        sec_ids = [s["id"] for s in sections]
        dem_rows = conn.execute(text(
            """SELECT d.*, s.section_code, s.division, s.start_km, s.end_km
               FROM demands.block_demands d JOIN infrastructure.block_sections s ON s.id=d.section_id
               WHERE d.section_id = ANY(CAST(:ss AS uuid[])) AND d.status IN ('SUBMITTED','NORMALIZED')
                 AND d.latest_deadline > :n AND d.earliest_start < :u
                 AND (d.source_ingested_at IS NULL OR d.source_ingested_at >= :stale_cut)
               ORDER BY d.urgency_score DESC"""),
            {"ss": sec_ids, "n": now, "u": until,
             "stale_cut": now - timedelta(hours=_env_float("DEMAND_STALENESS_TTL_HOURS", 12.0))}).mappings().all()

        deferred = load_weather_deferrals(conn)
        demands_all = []
        deferred_ids = []
        for r in dem_rows:
            if r["activity_code"] in deferred:
                deferred_ids.append(str(r["id"]))
                continue
            demands_all.append(DemandInput(
                id=str(r["id"]), section_id=str(r["section_id"]), section_code=r["section_code"],
                division=r["division"], section_start_km=float(r["start_km"]),
                section_end_km=float(r["end_km"]), department=r["department"],
                activity_code=r["activity_code"], min_duration_mins=int(r["min_duration_mins"]),
                earliest_start=r["earliest_start"], latest_deadline=r["latest_deadline"],
                urgency_score=float(r["urgency_score"]), machinery=list(r["machinery_req"] or []),
                source_ingested_at=r["source_ingested_at"], features=dict(r["features"] or {})))
        ml_n = maybe_apply_ml_urgency(conn, [dict(r) for r in dem_rows])

        if not demands_all:
            # Nothing eligible this cycle (everything already scheduled, cancelled,
            # or deliberately weather-deferred): a no-op COMPLETED run — escalation
            # is reserved for "we tried and Sentinel rejected", never for empty input.
            stats = {"status": "OPTIMAL", "objective": 0.0, "bound": 0.0,
                     "attempts": 0, "ml_updated": ml_n,
                     "weather_deferred": sorted(deferred_ids)[:20],
                     "total_demands": 0, "committed_plans": 0, "scheduled": 0,
                     "unscheduled": 0, "noop": True}
            conn.execute(text(
                """UPDATE optimization.solver_runs
                   SET status='COMPLETED', completed_at=now(), stats=CAST(:st AS jsonb) WHERE id=:i"""),
                {"st": json.dumps(stats), "i": run_id})
            conn.execute(text(
                "SELECT audit.append_event('SOLVE_COMPLETED','worker',CAST(:p AS jsonb))"),
                {"p": json.dumps({"run_id": run_id, **stats})})
            _sse_publish("SOLVE_COMPLETED", {"run_id": run_id, "noop": True})
            SOLVES_TOTAL.labels(status="COMPLETED_NOOP").inc()
            return stats

        tr_rows = conn.execute(text(
            """SELECT t.* FROM operations.train_paths t
               WHERE t.section_id = ANY(CAST(:ss AS uuid[])) AND t.scheduled_exit > :n AND t.scheduled_entry < :u"""),
            {"ss": sec_ids, "n": now - timedelta(days=1), "u": until}).mappings().all()
        trains = [TrainPathInput(train_number=r["train_number"], train_type=r["train_type"],
                                 section_id=str(r["section_id"]), priority_rank=int(r["priority_rank"]),
                                 scheduled_entry=r["scheduled_entry"], scheduled_exit=r["scheduled_exit"],
                                 source=r["source"],
                                 forecast_confidence=(r["metadata"] or {}).get("forecast_confidence"))
                  for r in tr_rows]
        machines = [MachineInfo(m[0], m[1], float(m[2]), int(m[3])) for m in conn.execute(text(
            "SELECT machine_code, machine_class, depot_km, transit_speed_kmph FROM infrastructure.machines")).fetchall()]

        feeds = {}
        for fsid, secid in conn.execute(text(
                "SELECT f.id, m.section_id FROM infrastructure.ohe_feeding_sections f "
                "JOIN infrastructure.section_feeding_map m ON m.feeding_section_id=f.id")).fetchall():
            feeds.setdefault(str(fsid), set()).add(str(secid))
        feeding_map = [FeedingMapEntry(k, frozenset(v)) for k, v in feeds.items()]
        acks = build_ack_lookup(conn.execute(text(
                """SELECT p.content_hash, s.sm_acked_at, s.controller_acked_at
                   FROM operations.signal_acknowledgments s
                   JOIN optimization.block_plans p ON p.id = s.plan_id""")).fetchall())

        committed_windows: dict[str, list[tuple[datetime, datetime]]] = {}
        for sid, pst, pet in conn.execute(text(
                "SELECT section_id, start_time, end_time FROM optimization.block_plans "
                "WHERE approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED')")).fetchall():
            committed_windows.setdefault(str(sid), []).append((pst, pet))

    ctx = SentinelContext(train_intervals=[TrainInterval(t.section_id, t.priority_rank,
                                                         t.scheduled_entry, t.scheduled_exit,
                                                         source=t.source,
                                                         forecast_confidence=t.forecast_confidence)
                                           for t in trains],
                          feeding_map=feeding_map, acks=acks, machine_infos=machines,
                          machine_assignments={},
                          committed_windows=committed_windows,
                          now=datetime.now(UTC),
                          staleness_ttl=timedelta(hours=_env_float("DEMAND_STALENESS_TTL_HOURS", 12)),
                          headway_high_priority_mins=_env_int("HEADWAY_HIGH_PRIORITY_MINS", 15))

    params = solver_params()
    weights = solve_weights()
    accepted = None
    attempts_used = 0
    result = None
    last_rejection: dict = {}
    attempt_trace: list[dict] = []
    for attempt in range(1, params.max_retries + 1):
        attempts_used = attempt
        result = optima_solve(demands_all, trains, machines, weights, params, horizon=horizon)
        if not result.candidates:
            break  # INFEASIBLE/UNKNOWN — retrying with softer soft-weights will not help
        ctx.machine_assignments = build_machine_assignments(result.candidates)
        verdicts = validate_set(result.candidates, ctx)
        acceptable = [v for v in verdicts if v.passed or v.only_gsr2_outstanding()]
        if len(acceptable) == len(verdicts):
            by_hash = {v.content_hash: v for v in verdicts}
            accepted = (result.candidates, by_hash)
            break
        # Observability: record WHY this attempt was rejected so operators can see
        # the failing checks in solver_runs.stats instead of a bare FAILED.
        attempt_trace.append({
            "attempt": attempt,
            "verdicts": len(verdicts),
            "acceptable": len(acceptable),
            "other_failing": [
                {"check": r.check_id.value, "detail": r.detail[:120]}
                for v in verdicts if not (v.passed or v.only_gsr2_outstanding())
                for r in v.results if not r.passed
            ][:8],
        })
        weights = weights.relaxed()  # FSM-002 REJECTED_RETRY

    stats = {"status": result.status if result else "UNKNOWN",
             "objective": result.objective if result else 0.0,
             "bound": result.best_bound if result else 0.0,
             "attempts": attempts_used, "ml_updated": ml_n,
             "weather_deferred": sorted(deferred_ids)[:20],
             "total_demands": len(demands_all)}
    if last_rejection:
        stats["last_rejection"] = last_rejection
    if attempt_trace:
        stats["attempt_trace"] = attempt_trace

    with eng.begin() as conn:
        if accepted is None:
            # FAILED_ESCALATE_HUMAN: cap exhausted without a passing schedule.
            conn.execute(text("""UPDATE optimization.solver_runs
                                 SET status='FAILED', completed_at=now(), stats=CAST(:st AS jsonb) WHERE id=:i"""),
                         {"st": json.dumps(stats), "i": run_id})
            ids = [d.id for d in demands_all]
            if ids:
                conn.execute(text(
                    "UPDATE demands.block_demands SET status='ESCALATED_OVERDUE' WHERE id = ANY(CAST(:ids AS uuid[])) "
                    "AND status IN ('SUBMITTED','NORMALIZED')"), {"ids": ids})
            conn.execute(text(
                "SELECT audit.append_event(:t, :a, CAST(:p AS jsonb))"),
                {"t": "SOLVE_FAILED_ESCALATE_HUMAN", "a": "worker",
                 "p": json.dumps({"run_id": run_id, **stats})})
            _sse_publish("SOLVE_FAILED", {"run_id": run_id})
            SOLVES_TOTAL.labels(status="FAILED_ESCALATED").inc()
            return stats

        candidates, by_hash = accepted
        scheduled_ids: set[str] = set()
        committed = 0
        for cand in candidates:
            ch = content_hash(cand.section_id, cand.start_time, cand.end_time,
                              cand.primary_demand_id, cand.shadow_demand_ids)
            verdict = by_hash[ch]
            passed = verdict.passed
            plan_status = "SENTINEL_PASSED" if passed else "DRAFT"  # DRAFT = awaiting G&SR-2 acks
            blocks = [(cand.section_id, w.start, w.end) for w in cand.works]
            ttuples = [(t.section_id, t.train_number, t.scheduled_entry, t.scheduled_exit, t.priority_rank)
                       for t in trains if t.section_id == cand.section_id]
            delays = replay_train_detention(blocks, ttuples, weights, params)
            plan_id = str(__import__("uuid").uuid4())
            conn.execute(text(
                """INSERT INTO optimization.block_plans
                   (id, plan_horizon, section_id, start_time, end_time, primary_demand_id,
                    is_shadow_block, solver_run_id, loss_pax_minutes, loss_frt_minutes,
                    sentinel_verified, revision_no, content_hash, sentinel_hash, approval_status)
                   VALUES (:id,:h,:sec,:st,:et,:pd,:sb,:sr,:lp,:lf,:sv,1,:ch,:sh,:ast)"""),
                {"id": plan_id, "h": cand.plan_horizon, "sec": cand.section_id,
                 "st": cand.start_time, "et": cand.end_time, "pd": cand.primary_demand_id,
                 "sb": cand.is_shadow_block, "sr": run_id,
                 "lp": delays["pax_delay_minutes"], "lf": delays["frt_delay_minutes"],
                 "sv": passed, "ch": ch, "sh": ch if passed else None, "ast": plan_status})
            conn.execute(text(
                "INSERT INTO optimization.plan_sections (plan_id, section_id) VALUES (:p,:s) "
                "ON CONFLICT DO NOTHING"), {"p": plan_id, "s": cand.section_id})
            for did in cand.shadow_demand_ids:
                conn.execute(text(
                    "INSERT INTO optimization.plan_shadow_demands (plan_id, demand_id) VALUES (:p,:d) "
                    "ON CONFLICT DO NOTHING"), {"p": plan_id, "d": did})
            involved = cand.shadow_demand_ids + [str(cand.primary_demand_id)]
            scheduled_ids.update(involved)
            conn.execute(text(
                "UPDATE demands.block_demands SET status=:ds WHERE id = ANY(CAST(:ids AS uuid[]))"),
                {"ds": plan_status, "ids": involved})
            # DB-005: per-plan machine roster persistence via the VRP sub-model stage.
            from packages.optima.vrp import build_roster
            roster, idle, violations = build_roster(cand.works, machines)
            for e in roster:
                conn.execute(text(
                    """INSERT INTO optimization.machine_rosters
                       (machine_id, plan_id, depot_origin, travel_start, travel_end, solver_run_id)
                       VALUES (:m,:p,:o,:ts,:te,:sr)"""),
                    {"m": e.machine_code, "p": plan_id, "o": e.origin,
                     "ts": e.travel_start, "te": e.travel_end, "sr": run_id})
            event = "PLAN_SENTINEL_PASSED" if passed else "PLAN_CREATED_DRAFT"
            conn.execute(text(
                "SELECT audit.append_event(:t, :a, CAST(:p AS jsonb))"),
                {"t": event, "a": "worker",
                 "p": json.dumps({"plan_id": plan_id, "content_hash": ch,
                                  "awaiting_signal_acks": not passed}, default=str)})
            _sse_publish("PLAN_CREATED", {"plan_id": plan_id, "status": plan_status})
            PLANS_CREATED_TOTAL.inc()
            committed += 1

        unscheduled = sorted({d.id for d in demands_all} - scheduled_ids)
        stats.update({"committed_plans": committed, "scheduled": len(scheduled_ids),
                      "unscheduled": len(unscheduled),
                      "unaddressed_urgency": result.unaddressed_urgency,
                      "machine_idle_minutes": result.machine_idle_minutes,
                      "machine_violations": result.machine_violations[:10],
                      "solver_wall_s": round(result.wall_time_seconds, 3),
                      "cp_sat_status": result.status})
        conn.execute(text(
            """UPDATE optimization.solver_runs
               SET status='COMPLETED', completed_at=now(), stats=CAST(:st AS jsonb), attempt=:a WHERE id=:i"""),
            {"st": json.dumps(stats), "a": attempts_used, "i": run_id})
        conn.execute(text(
            "SELECT audit.append_event(:t, :a, CAST(:p AS jsonb))"),
            {"t": "SOLVE_COMPLETED", "a": "worker", "p": json.dumps({"run_id": run_id, **stats})})
    _sse_publish("SOLVE_COMPLETED", {"run_id": run_id, **{k: stats.get(k) for k in ("committed_plans", "scheduled", "unscheduled")}})
    SOLVES_TOTAL.labels(status="COMPLETED").inc()
    return stats


@app.task(name="apps.workers.tasks.generate_weekly_plans")
def generate_weekly_plans():
    """FR-013 tactical generator — fires on WEEKLY_PLAN_CRON per division."""
    eng = _eng()
    with eng.begin() as conn:
        divisions = [r[0] for r in conn.execute(text(
            "SELECT DISTINCT division FROM infrastructure.block_sections WHERE is_active")).fetchall()]
        run_ids = []
        for div in divisions:
            rid = str(__import__("uuid").uuid4())
            conn.execute(text(
                "INSERT INTO optimization.solver_runs (id, horizon, division, status) VALUES (:i,'WEEKLY',:d,'QUEUED')"),
                {"i": rid, "d": div})
            conn.execute(text(
                "SELECT audit.append_event(:t, :a, CAST(:p AS jsonb))"),
                {"t": "WEEKLY_PLAN_TRIGGERED", "a": "beat",
                 "p": json.dumps({"run_id": rid, "division": div,
                                  "cron": os.environ.get("WEEKLY_PLAN_CRON")})})
            run_ids.append(rid)
    for rid in run_ids:
        run_solve.delay(rid)
    return {"queued": run_ids}


@app.task(name="apps.workers.tasks.simulate_feed_ingest")
def simulate_feed_ingest():
    """FR-001/002/003 CRON simulation: small fresh batches through the machine-
    credential ingest path (per-source keys honored internally, TEL-001)."""
    from .corridor_bridge import insert_feed_batch
    inserted = insert_feed_batch(_eng())
    _sse_publish("FEED_INGESTED", {"inserted": inserted})
    return {"inserted": inserted}


@app.task(name="apps.workers.tasks.fois_forecast_poll")
def fois_forecast_poll():
    """FR-005 hourly poll: roll FOIS forecast paths forward for tomorrow, enriching
    missing confidence values with the XGBoost forecaster."""
    eng = _eng()
    created = 0
    with eng.begin() as conn:
        sections = conn.execute(text(
            "SELECT section_code, start_km, end_km FROM infrastructure.block_sections WHERE is_active ORDER BY start_km")
        ).mappings().all()
        from datetime import timedelta

        from data.generators.traffic_gen import gen_freight
        tomorrow = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=2)
        # Calendar-day seed: reproducible for repeated polls of the same forecast day.
        paths = gen_freight(
        [dict(s) for s in sections],
         tomorrow,
        seed=tomorrow.toordinal(),
        )
        conf_by_hour = None
        for p in paths:
            meta = p["metadata"]
            if meta.get("forecast_confidence") is None:
                try:
                    from packages.ml.freight_forecaster import forecast, train
                    if conf_by_hour is None:
                        conf_by_hour = train()
                    meta["forecast_confidence"] = round(forecast(
                        conf_by_hour, p["scheduled_entry"].hour, p["scheduled_entry"].weekday(), 2), 2)
                except Exception:
                    meta["forecast_confidence"] = 0.5
            sec_id = conn.execute(text(
                "SELECT id FROM infrastructure.block_sections WHERE section_code=:c"),
                {"c": p["section_code"]}).scalar()
            if sec_id is None:
                continue
            res = conn.execute(text(
                """INSERT INTO operations.train_paths
                   (train_number, train_type, section_id, scheduled_entry, scheduled_exit,
                    priority_rank, source, metadata)
                   VALUES (:n,'FREIGHT',:s,:e,:x,:p,'FOIS_FORECAST',CAST(:m AS jsonb))
                   ON CONFLICT (train_number, section_id, scheduled_entry) DO NOTHING"""),
                {"n": p["train_number"], "s": str(sec_id), "e": p["scheduled_entry"],
                 "x": p["scheduled_exit"], "p": p["priority_rank"], "m": json.dumps(meta)})
            created += res.rowcount > 0
    return {"new_paths": created}
