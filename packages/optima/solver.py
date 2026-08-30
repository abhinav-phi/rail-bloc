"""Optima orchestrator: B1 warm-start -> interval CP-SAT -> cluster into block plans
-> machine VRP. Reports CP-SAT status and bound with every solve (ADR-002 corrected:
constraint-verified always; optimality only when status == OPTIMAL)."""
from __future__ import annotations

from datetime import timedelta

from ortools.sat.python import cp_model

from packages.core.models import (
    DemandInput,
    MachineInfo,
    PlanCandidate,
    ScheduledWork,
    SolveResult,
    SolverParams,
    SolveWeights,
    TrainPathInput,
)

from .formulations import add_hint, build_model
from .heuristic import greedy_schedule
from .vrp import build_roster


def _dt(mins: int, base):
    return base + timedelta(minutes=mins)


def cluster(schedule: dict[str, int], demands: dict[str, DemandInput], params: SolverParams,
            base, horizon: str, incident_id: str | None = None) -> list[PlanCandidate]:
    by_sec: dict[str, list[tuple[int, DemandInput]]] = {}
    for did, start in schedule.items():
        d = demands[did]
        by_sec.setdefault(d.section_id, []).append((start, d))
    candidates: list[PlanCandidate] = []
    gap = params.bundling_gap_mins
    for _sec, items in by_sec.items():
        items.sort(key=lambda x: x[0])
        clusters: list[list[tuple[int, DemandInput]]] = []
        for start, d in items:
            if clusters and start - (clusters[-1][-1][0] + int(clusters[-1][-1][1].min_duration_mins)) <= gap:
                clusters[-1].append((start, d))
            else:
                clusters.append([(start, d)])
        for cl in clusters:
            works = [ScheduledWork(d, _dt(s, base), _dt(s + int(d.min_duration_mins), base)) for s, d in cl]
            primary = max(cl, key=lambda x: (x[1].urgency_score, x[1].min_duration_mins))[1]
            sample = cl[0][1]
            candidates.append(PlanCandidate(
                section_id=sample.section_id, section_code=sample.section_code, division=sample.division,
                start_time=min(w.start for w in works), end_time=max(w.end for w in works),
                primary_demand_id=primary.id, works=works,
                is_shadow_block=len({w.demand.department for w in works}) >= 2,
                plan_horizon=horizon, incident_id=incident_id))
    return candidates


def solve(demands: list[DemandInput], trains: list[TrainPathInput], machines: list[MachineInfo],
          weights: SolveWeights, params: SolverParams, horizon: str = "WEEKLY",
          incident_id: str | None = None, shadow_weight_scale: float = 1.0) -> SolveResult:
    active = [d for d in demands]
    if not active:
        return SolveResult("OPTIMAL", 0.0, 0.0, 0.0, [], [], 0.0, [], 0, 0, 0.0)
    base = min(d.earliest_start for d in active)
    demand_map = {d.id: d for d in active}

    hint_schedule = greedy_schedule(active, trains, params, base)
    built = build_model(active, trains, weights, params, base, shadow_weight_scale)
    add_hint(built, hint_schedule)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = params.max_time_seconds
    solver.parameters.num_search_workers = params.num_workers
    status = solver.Solve(built.model)
    status_name = solver.StatusName(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveResult(status_name, 0.0, 0.0, solver.WallTime(), [], [], 0.0, [],
                           0, len(active),
                           sum(d.urgency_score for d in active))

    schedule: dict[str, int] = {}
    for did, dv in built.dvars.items():
        if dv.start is not None and solver.Value(dv.present):
            schedule[did] = solver.Value(dv.start)

    candidates = cluster(schedule, demand_map, params, base, horizon, incident_id)
    all_works = [w for c in candidates for w in c.works]
    roster, idle, violations = build_roster(all_works, machines)
    unaddr = sum(demand_map[did].urgency_score for did in demand_map if did not in schedule)

    return SolveResult(status_name, solver.ObjectiveValue(), solver.BestObjectiveBound(),
                       solver.WallTime(), candidates, roster, idle, violations,
                       len(schedule), len(active), unaddr)
