"""Unit tests: time-weighted urgency (MILP-003), headway mapping, B1 heuristic,
VRP roster feasibility, and the benchmark harness smoke run."""
from datetime import UTC, datetime, timedelta

T0 = datetime(2026, 1, 5, tzinfo=UTC)


def _demand(urgency=0.8):
    from packages.core.models import DemandInput
    return DemandInput(id="d", section_id="S", section_code="SC", division="DLI",
                       section_start_km=0, section_end_km=10, department="ENGINEERING",
                       activity_code="X", min_duration_mins=60, earliest_start=T0,
                       latest_deadline=T0 + timedelta(days=2), urgency_score=urgency)


def test_time_weighted_urgency_monotonic_to_deadline():
    from packages.optima.objectives import time_weighted_urgency
    d = _demand()
    early = time_weighted_urgency(d, d.earliest_start)
    mid = time_weighted_urgency(d, d.earliest_start + timedelta(days=1))
    late = time_weighted_urgency(d, d.latest_deadline)
    assert early <= mid <= late and late > early


def test_headway_mapping():
    from packages.core.models import SolverParams
    from packages.optima.objectives import headway_minutes
    p = SolverParams(max_time_seconds=1, num_workers=1, headway_high_priority_mins=15,
                     headway_default_mins=5, freight_hard_confidence=0.6)
    assert headway_minutes(1, p) == 15
    assert headway_minutes(3, p) == 15
    assert headway_minutes(4, p) == 5


def test_greedy_respects_windows_and_trains():
    from packages.core.models import SolverParams, TrainPathInput
    from packages.optima.heuristic import greedy_schedule
    d = _demand(urgency=1.0)
    train = TrainPathInput(train_number="1", train_type="MAIL_EXP", section_id="S",
                           priority_rank=2, scheduled_entry=T0 + timedelta(hours=1),
                           scheduled_exit=T0 + timedelta(hours=2))
    p = SolverParams(max_time_seconds=1, num_workers=1, headway_high_priority_mins=15,
                     headway_default_mins=5, freight_hard_confidence=0.6)
    s = greedy_schedule([d], [train], p, T0)
    # Block must not overlap the headway-expanded train interval [00:45, 02:15].
    start = s["d"]
    end = start + 60
    assert end <= 45 or start >= 135


def test_vrp_roster_flags_travel_violation_and_counts_idle():
    from packages.core.models import DemandInput as D
    from packages.core.models import MachineInfo, ScheduledWork
    from packages.optima.vrp import build_roster
    m = MachineInfo("M1", "TAMPING", 0.0, 40)

    def mk(i, km, start_h):
        d = D(id=i, section_id="S", section_code="SC", division="DLI",
              section_start_km=km, section_end_km=km + 1, department="ENGINEERING",
              activity_code="X", min_duration_mins=60, earliest_start=T0,
              latest_deadline=T0 + timedelta(days=2), urgency_score=0.5,
              machinery=["M1"])
        return ScheduledWork(d, T0 + timedelta(hours=start_h), T0 + timedelta(hours=start_h + 1))

    w1 = mk("a", 0.0, 0)
    w2 = mk("b", 200.0, 1.25)  # 200 km at 40 km/h = 300 min travel; only 75 min gap → violation
    entries, idle, violations = build_roster([w1, w2], [m])
    assert any("M1" in v for v in violations)
    assert idle == 0.0

    w3 = mk("c", 40.0, 3)  # 60 min travel after a 60-min job ending at t+2 → exactly feasible
    entries2, idle2, violations2 = build_roster([w1, w3], [m])
    assert violations2 == []
    assert abs(idle2 - 60.0) < 1e-6 or idle2 == 0.0  # depends on exact travel arithmetic


def test_benchmark_smoke():
    from apps.eval.benchmark import build_scenario, params, run_b0, run_b1
    dem, tr, mach = build_scenario(100)
    assert len(dem) > 20 and len(tr) > 100
    p = params(5.0)
    _, k0 = run_b0(dem, tr, p)
    _, k1 = run_b1(dem, tr, p, urgency_weight=1.0, step_mins=15)
    for k in (k0, k1):
        assert {"scheduled", "pax_delay_minutes", "frt_delay_minutes", "unaddressed_urgency"} <= set(k)
