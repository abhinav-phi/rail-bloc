"""TASK-044 DoD: known-optimum unit test + saturated-corridor feasibility (MILP fixes)."""
from datetime import UTC, datetime, timedelta

from data.generators.corridor_gen import corridor
from data.generators.demand_gen import gen_demands
from data.generators.traffic_gen import gen_freight, gen_timetable
from packages.core.models import DemandInput, SolverParams, TrainPathInput
from packages.optima.solver import cluster, solve

T0 = datetime(2026, 1, 5, tzinfo=UTC)


def weights():
    from packages.core.models import SolveWeights
    return SolveWeights(pax_delay=10.0, frt_delay=4.0, shadow_reward=25.0,
                        machine_idle=2.5, unaddressed_defect=100.0, early_start=0.05)


def params(t=10.0):
    from packages.core.models import SolverParams
    return SolverParams(max_time_seconds=t, num_workers=4, headway_high_priority_mins=15,
                        headway_default_mins=5, freight_hard_confidence=0.60)


def test_known_optimum_single_demand_schedules_at_earliest_start():
    d = DemandInput(id="d", section_id="S", section_code="SC", division="DLI",
                    section_start_km=0, section_end_km=10, department="ENGINEERING",
                    activity_code="DTT_TAMPING", min_duration_mins=120,
                    earliest_start=T0, latest_deadline=T0 + timedelta(days=3),
                    urgency_score=0.8)
    res = solve([d], [], [], weights(), params())
    assert res.status in ("OPTIMAL", "FEASIBLE")
    assert res.candidates and len(res.candidates[0].works) == 1
    w = res.candidates[0].works[0]
    assert w.start == T0  # early_start penalty + unaddressed penalty → schedule immediately


def test_unschedulable_demand_window_too_short_is_left_out_not_fragmented():
    d = DemandInput(id="d", section_id="S", section_code="SC", division="DLI",
                    section_start_km=0, section_end_km=10, department="ENGINEERING",
                    activity_code="DTT_TAMPING", min_duration_mins=600,
                    earliest_start=T0, latest_deadline=T0 + timedelta(minutes=120),
                    urgency_score=0.9)
    res = solve([d], [], [], weights(), params(5))
    assert res.scheduled_count == 0  # MILP-004: no fragmented execution possible


def test_saturated_corridor_solves_without_infeasibility_and_replays_zero_pax_delay():
    sections, _, _ = corridor(seed=42)
    raw = gen_demands(sections, T0 + timedelta(days=1), seed=7, n_eng=20, n_trd=12, n_snt=12)
    sec_by_code = {s["section_code"]: s for s in sections}
    demands = [DemandInput(id=d["external_ref_id"], section_id=d["section_code"],
                           section_code=d["section_code"], division="DLI",
                           section_start_km=float(sec_by_code[d["section_code"]]["start_km"]),
                           section_end_km=float(sec_by_code[d["section_code"]]["end_km"]),
                           department=d["department"], activity_code=d["activity_code"],
                           min_duration_mins=int(d["min_duration_mins"]),
                           earliest_start=d["earliest_start"], latest_deadline=d["latest_deadline"],
                           urgency_score=float(d["urgency_score"]), machinery=[],
                           features=dict(d["features"])) for d in raw]
    tt = gen_timetable(sections, T0, seed=9) + gen_freight(sections, T0, seed=10)
    trains = [TrainPathInput(train_number=t["train_number"],
                             train_type=("FREIGHT" if t["source"] == "FOIS_FORECAST" else t["train_type"]),
                             section_id=t["section_code"], priority_rank=t["priority_rank"],
                             scheduled_entry=t["scheduled_entry"], scheduled_exit=t["scheduled_exit"],
                             source=t["source"],
                             forecast_confidence=(t["metadata"] or {}).get("forecast_confidence"))
              for t in tt]
    res = solve(demands, trains, [], weights(), params(15))
    # MILP-002 fix: the per-train NoOverlap form must be feasible on a busy corridor.
    assert res.status in ("OPTIMAL", "FEASIBLE")
    assert res.scheduled_count > 0
    # Path-replay check: passenger trains must provably suffer zero detention.
    blocks = [(c.section_id, w.start, w.end) for c in res.candidates for w in c.works]
    from packages.optima.objectives import replay_train_detention
    det = replay_train_detention(blocks, [(t.section_id, t.train_number, t.scheduled_entry,
                                           t.scheduled_exit, t.priority_rank) for t in trains],
                                 params())
    assert det["pax_delay_minutes"] == 0.0


def test_feeding_groups_preserve_section_division():
    sections, feeding, _ = corridor(seed=42)
    by_code = {s["section_code"]: s["division"] for s in sections}
    for feed in feeding:
        divisions = {by_code[sc] for sc in feed["section_codes"]}
        assert len(divisions) == 1
        assert feed["division"] == next(iter(divisions))


def test_machine_disjunction_uses_supplied_transit_speed():
    from packages.core.models import MachineInfo

    machine_code = "FAST-TAMPER"
    deadline = T0 + timedelta(minutes=180)

    first = DemandInput(
        id="machine-a",
        section_id="A",
        section_code="A",
        division="DLI",
        section_start_km=0,
        section_end_km=10,
        department="ENGINEERING",
        activity_code="DTT_TAMPING",
        min_duration_mins=60,
        earliest_start=T0,
        latest_deadline=deadline,
        urgency_score=0.9,
        machinery=[machine_code],
    )

    second = DemandInput(
        id="machine-b",
        section_id="B",
        section_code="B",
        division="DLI",
        section_start_km=95,
        section_end_km=105,
        department="ENGINEERING",
        activity_code="DTT_TAMPING",
        min_duration_mins=60,
        earliest_start=T0,
        latest_deadline=deadline,
        urgency_score=0.9,
        machinery=[machine_code],
    )

    machine = MachineInfo(
        machine_code=machine_code,
        machine_class="TAMPER",
        depot_km=0,
        transit_speed_kmph=120,
    )

    result = solve(
        [first, second],
        [],
        [machine],
        weights(),
        params(5),
    )

    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert result.scheduled_count == 2
    assert result.machine_violations == []

def test_cluster_shadow_flag_requires_true_containment():
    """MILP-C3 model/validator mismatch (Railway 2026-09-09): a multi-department
    cluster whose works do NOT nest inside the primary window must NOT claim
    is_shadow_block — Sentinel rejects such claims deterministically."""
    base = datetime(2026, 9, 15, 0, 0, tzinfo=UTC)

    def dem(did, dept, dur):
        return DemandInput(
            id=did, section_id="S1", section_code="BPL-ET", division="DLI",
            section_start_km=0.0, section_end_km=10.0, department=dept,
            activity_code="X", min_duration_mins=dur, earliest_start=base,
            latest_deadline=base + timedelta(hours=10), urgency_score=5.0,
            machinery=[],
        )

    params = SolverParams(max_time_seconds=1.0, num_workers=1,
                          headway_high_priority_mins=15, headway_default_mins=5,
                          freight_hard_confidence=0.60, bundling_gap_mins=0)
    # Two departments, overlapping but non-nesting windows (snt1 [180,210]
    # escapes eng1's [0,200]; 180 < 200 so bundling_gap 0 keeps one cluster).
    sched = {"eng1": 0, "snt1": 180}
    demands = {"eng1": dem("eng1", "ENGINEERING", 200), "snt1": dem("snt1", "SIGNAL_TELECOM", 30)}
    out = cluster(sched, demands, params, base, "WEEKLY")
    assert len(out) == 1
    assert out[0].is_shadow_block is False  # snt1 escapes eng1's window

    # Now nesting: shorter S&T work fully inside the engineering window.
    sched2 = {"eng1": 0, "snt1": 10}
    demands2 = {"eng1": dem("eng1", "ENGINEERING", 200), "snt1": dem("snt1", "SIGNAL_TELECOM", 30)}
    out2 = cluster(sched2, demands2, params, base, "WEEKLY")
    assert out2[0].is_shadow_block is True  # contained -> shadow claim is valid
