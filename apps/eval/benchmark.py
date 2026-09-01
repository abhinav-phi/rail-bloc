"""FR-024 / TASK-056 — Comparative benchmark harness (BENCH-001).

Runs Baseline 0 (manual BDMS allocation), Baseline 1 (tuned greedy heuristic) and
RAIL-BLOC (CP-SAT warm-started from B1) over IDENTICAL fixed-seed simulated scenarios.
Rules.md §3: no historical operational data exists anywhere — all KPIs are
simulated-scenario results; B1's tuning grid is searched on a held-out TUNING split
(seeds 900+) and frozen before evaluation on the EVAL split (seeds 100+).

Usage:  python -m apps.eval.benchmark [--weeks 4] [--seed-base 100]
"""
from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, timedelta

from data.generators.corridor_gen import MACHINES, corridor
from data.generators.demand_gen import gen_demands
from data.generators.traffic_gen import gen_freight, gen_timetable
from packages.core.models import DemandInput, MachineInfo, SolverParams, SolveWeights, TrainPathInput
from packages.optima.heuristic import greedy_schedule, tuning_grid
from packages.optima.objectives import replay_train_detention

TUNING_SEED_BASE = 900   # held-out tuning split (Rules.md §3 protocol)
EVAL_SEED_BASE = 100     # evaluation split


def build_scenario(seed: int):
    sections, _, _ = corridor(seed=42)
    week_start = datetime(2026, 1, 5, tzinfo=UTC)
    raw = gen_demands(sections, week_start, seed=seed, n_eng=24, n_trd=14, n_snt=14)
    # Timetable overlaps the demand week so path-replay has real interactions.
    day_start = week_start
    tt = gen_timetable(sections, day_start, seed=seed + 500)
    fr = gen_freight(sections, day_start, seed=seed + 700)

    sec_by_code = {s["section_code"]: s for s in sections}
    demands = [DemandInput(
        id=d["external_ref_id"], section_id=d["section_code"], section_code=d["section_code"],
        division="DLI", section_start_km=float(sec_by_code[d["section_code"]]["start_km"]),
        section_end_km=float(sec_by_code[d["section_code"]]["end_km"]),
        department=d["department"], activity_code=d["activity_code"],
        min_duration_mins=int(d["min_duration_mins"]), earliest_start=d["earliest_start"],
        latest_deadline=d["latest_deadline"], urgency_score=float(d["urgency_score"]),
        machinery=list(d["machinery_req"]), features=dict(d["features"])) for d in raw]
    trains = [TrainPathInput(
        train_number=t["train_number"], train_type=("FREIGHT" if t["source"] == "FOIS_FORECAST" else t["train_type"]),
        section_id=t["section_code"], priority_rank=t["priority_rank"],
        scheduled_entry=t["scheduled_entry"], scheduled_exit=t["scheduled_exit"],
        source=t["source"], forecast_confidence=(t["metadata"] or {}).get("forecast_confidence"))
        for t in tt + fr]
    machines = [MachineInfo(m[0], m[1], m[2], m[3]) for m in MACHINES]
    return demands, trains, machines


def weights() -> SolveWeights:
    return SolveWeights(pax_delay=10.0, frt_delay=4.0, shadow_reward=25.0,
                        machine_idle=2.5, unaddressed_defect=100.0, early_start=0.05)


def params(max_time: float = 35.0) -> SolverParams:
    return SolverParams(max_time_seconds=max_time, num_workers=8,
                        headway_high_priority_mins=15, headway_default_mins=5,
                        freight_hard_confidence=0.60, max_retries=1)


def kpis(schedule: dict[str, int], demand_map: dict[str, DemandInput], trains, p: SolverParams) -> dict:
    blocks = []
    for did, start in schedule.items():
        d = demand_map[did]
        blocks.append((d.section_id,
                       start_dt(did, start, demand_map),
                       start_dt(did, start + d.min_duration_mins, demand_map)))
    ttuples = [(t.section_id, t.train_number, t.scheduled_entry, t.scheduled_exit, t.priority_rank)
               for t in trains]
    det = replay_train_detention(blocks, ttuples, p)
    unaddr = sum(demand_map[k].urgency_score for k in demand_map if k not in schedule)
    return {"scheduled": len(schedule), "total": len(demand_map),
            "pax_delay_minutes": round(det["pax_delay_minutes"], 1),
            "frt_delay_minutes": round(det["frt_delay_minutes"], 1),
            "unaddressed_urgency": round(unaddr, 2)}


def start_dt(did: str, mins: int, demand_map) -> datetime:
    base = min(d.earliest_start for d in demand_map.values())
    return base + timedelta(minutes=mins)


def run_b0(demands, trains, p: SolverParams) -> tuple[dict[str, int], dict]:
    """Baseline 0 — disconnected manual allocation: each department books its own slot at
    the earliest feasible hour on its own, ignoring other departments and shadow bundling."""
    base = min(d.earliest_start for d in demands)
    demand_map = {d.id: d for d in demands}
    schedule: dict[str, int] = {}
    occupied: dict[str, list[tuple[int, int]]] = {}
    ordered = sorted(demands, key=lambda d: d.id)  # manual queues are FIFO by submission
    for d in ordered:
        es = int((d.earliest_start - base).total_seconds() // 60)
        ld = int((d.latest_deadline - base).total_seconds() // 60)
        placed = False
        t = es
        while t + d.min_duration_mins <= ld and not placed:
            ok = True
            for s0, e0 in occupied.get(d.section_id, []):
                if t < e0 and s0 < t + d.min_duration_mins:
                    t = e0
                    ok = False
                    break
            if not ok:
                continue
            for tr in trains:
                if tr.section_id != d.section_id or tr.priority_rank > 6:
                    continue
                h = p.headway_high_priority_mins if tr.priority_rank <= 3 else p.headway_default_mins
                ts = int((tr.scheduled_entry - base).total_seconds() // 60) - h
                te = int((tr.scheduled_exit - base).total_seconds() // 60) + h
                if t < te and ts < t + d.min_duration_mins:
                    t = te
                    ok = False
                    break
            if ok:
                schedule[d.id] = t
                occupied.setdefault(d.section_id, []).append((t, t + d.min_duration_mins))
                placed = True
    return schedule, kpis(schedule, demand_map, trains, p)


def run_b1(demands, trains, p: SolverParams, urgency_weight: float, step_mins: int) -> tuple[dict[str, int], dict]:
    base = min(d.earliest_start for d in demands)
    schedule = greedy_schedule(demands, trains, p, base, urgency_weight=urgency_weight, step_mins=step_mins)
    return schedule, kpis(schedule, {d.id: d for d in demands}, trains, p)


def run_railbloc(demands, trains, machines, p: SolverParams) -> tuple[dict[str, int], dict]:
    from packages.optima.solver import solve as optima_solve
    result = optima_solve(demands, trains, machines, weights(), p, horizon="WEEKLY")
    base = min(d.earliest_start for d in demands)
    schedule: dict[str, int] = {}
    for c in result.candidates:
        for w in c.works:
            schedule[w.demand.id] = int((w.start - base).total_seconds() // 60)
    k = kpis(schedule, {d.id: d for d in demands}, trains, p)
    k["cp_sat_status"] = result.status
    k["objective"] = round(result.objective, 1)
    k["bound"] = round(result.best_bound, 1)
    return schedule, k


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--weeks", type=int, default=1, help="scenario weeks per split cell")
    args = ap.parse_args()

    print("== RAIL-BLOC Benchmark (simulated scenarios, fixed seeds — BENCH-001/Rules §3) ==")

    # ---- Step 1: documented B1 tuning protocol on the held-out tuning split ----
    print("\n[B1 tuning] grid-search on held-out tuning split (seeds %d+):" % TUNING_SEED_BASE)
    best = None
    for cfg in tuning_grid():
        tot_pax = 0.0
        for i in range(args.weeks):
            dem, tr, _ = build_scenario(TUNING_SEED_BASE + i)
            _, k = run_b1(dem, tr, params(), cfg["urgency_weight"], cfg["step_mins"])
            tot_pax += k["pax_delay_minutes"]
        print(f"  {cfg}: total pax delay {tot_pax:.0f} min")
        if best is None or tot_pax < best[1]:
            best = ({**cfg}, tot_pax)
    print(f"  → frozen tuned config: {best[0]}")

    # ---- Step 2: identical-scenario comparison on the evaluation split ----
    rows = {"B0": [], "B1": [], "RAIL-BLOC": []}
    for i in range(args.weeks):
        seed = EVAL_SEED_BASE + i
        dem, tr, mach = build_scenario(seed)
        p = params()
        _, k0 = run_b0(dem, tr, p)
        _, k1 = run_b1(dem, tr, p, best[0]["urgency_weight"], best[0]["step_mins"])
        _, kr = run_railbloc(dem, tr, mach, p)
        rows["B0"].append(k0); rows["B1"].append(k1); rows["RAIL-BLOC"].append(kr)
        print(f"\n[scenario seed={seed}]")
        for name, k in (("B0", k0), ("B1", k1), ("RAIL-BLOC", kr)):
            print(f"  {name:10s} {json.dumps({x: k[x] for x in ('scheduled', 'pax_delay_minutes', 'frt_delay_minutes', 'unaddressed_urgency')})}")

    def avg(name):
        ks = rows[name]
        n = max(len(ks), 1)
        return {
            "scheduled": round(sum(k["scheduled"] for k in ks) / n, 1),
            "pax_delay_minutes": round(sum(k["pax_delay_minutes"] for k in ks) / n, 1),
            "frt_delay_minutes": round(sum(k["frt_delay_minutes"] for k in ks) / n, 1),
            "unaddressed_urgency": round(sum(k["unaddressed_urgency"] for k in ks) / n, 3),
        }

    summary = {name: avg(name) for name in rows}
    print("\n== MEAN KPI SUMMARY (measured on this run — cite this output, not assumptions) ==")
    print(json.dumps(summary, indent=2))
    print("\nMethodology: B1 tuned via documented grid-search on a held-out split;",
          "identical seeds across configurations; delays computed by deterministic path-replay.")


if __name__ == "__main__":
    main()
