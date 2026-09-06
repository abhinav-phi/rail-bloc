"""Catch #1 + #2 audit — dense-cell honesty probe (2026-09-06). v2 (fairness-fixed).

Fixes vs v1 (audit-of-the-audit):
  1. ctx.now = scenario planning moment (real "now" made every demand 8-month
     stale -> G&SR-3 was an artifact, hitting all arms).
  2. machine_assignments are synthesized for EVERY arm's own schedule with the
     same rule (incl. RAIL-BLOC) — v1 passed None for RAIL-BLOC, making C5
     vacuously pass in its favour (the exact C5 trap, reversed).
  3. B0 is actually run (v1 audited an empty dict).
  4. Production accept-semantics modelled: after solve, candidates failing
     Sentinel are rejected+retried in the real system — so the benchmark now
     reports scheduled vs VERIFIED (no-FAIL) demands per arm.

Phase A: is the tuned-B1 hint FEASIBLE under the full CP-SAT model?
  (fix_variables_to_their_hinted_value probe — INFEASIBLE = hint dropped.)
Phase B: same Sentinel validate_set, same hard-path context, over every arm.
R6.6: report whatever comes out.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from ortools.sat.python import cp_model

from apps.eval.benchmark import build_scenario, params, run_b0, weights
from data.generators.corridor_gen import FEEDING_GROUPS
from packages.core.models import DemandInput, MachineInfo, TrainPathInput
from packages.optima.formulations import add_hint, build_model
from packages.optima.heuristic import greedy_schedule
from packages.optima.solver import cluster
from packages.optima.solver import solve as optima_solve
from packages.sentinel.validator import (
    FeedingMapEntry,
    SentinelContext,
    TrainInterval,
    build_ack_lookup,
    validate_set,
)

DENSITY = 2.5
SEED = 100


def to_intervals(trains: list[TrainPathInput]) -> list[TrainInterval]:
    return [
        TrainInterval(
            section_id=t.section_id,
            priority_rank=t.priority_rank,
            entry=t.scheduled_entry,
            exit=t.scheduled_exit,
            source=t.source,
            forecast_confidence=t.forecast_confidence,
        )
        for t in trains
    ]


def make_context(
    trains: list[TrainPathInput],
    dem_map: dict[str, DemandInput],
    schedule: dict[str, int],
    machines: list[MachineInfo],
    base,
) -> SentinelContext:
    """FAIR context: hard = WTT + freight conf>=0.60 (is_hard_path), same rule
    for every arm; machine_assignments synthesized from the arm's OWN schedule
    with the same rule (so C5 is a real check, not a vacuous pass); now =
    scenario planning moment so G&SR-3 staleness is measured honestly."""
    feeding = [
        FeedingMapEntry(feeding_section_id=f"ES-{gi + 1:03d}", section_ids=frozenset(group))
        for gi, group in enumerate(FEEDING_GROUPS)
    ]
    machine_assignments: dict[str, list[tuple[datetime, datetime, float]]] = {}
    for did, start in schedule.items():
        d = dem_map[did]
        s = base + timedelta(minutes=start)
        e = s + timedelta(minutes=d.min_duration_mins)
        mid = (d.section_start_km + d.section_end_km) / 2
        for m in d.machinery:
            machine_assignments.setdefault(m, []).append((s, e, mid))
    return SentinelContext(
        train_intervals=to_intervals(trains),
        feeding_map=feeding,
        acks=build_ack_lookup([]),
        machine_infos=list(machines),
        machine_assignments=machine_assignments,
        now=base + timedelta(minutes=1),
        headway_high_priority_mins=15,
        high_priority_max_rank=3,
    )


def audit_arm(
    name: str,
    schedule: dict[str, int],
    dem_map: dict[str, DemandInput],
    trains: list[TrainPathInput],
    machines: list[MachineInfo],
    base,
    p,
) -> dict:
    candidates = cluster(schedule, dem_map, p, base, "WEEKLY")
    ctx = make_context(trains, dem_map, schedule, machines, base)
    verdicts = validate_set(candidates, ctx)

    fails: dict[str, list[str]] = {}
    for v in verdicts:
        for r in v.results:
            if not r.passed and not r.pending:
                fails.setdefault(r.check_id.value, []).append(
                    f"{v.plan_id or 'plan'}: {r.detail}"
                )

    # Production accept-semantics: a candidate with any FAIL is rejected
    # (retried in the real loop). PENDING-only candidates persist as DRAFT.
    verified: set[str] = set()
    draft_pending: set[str] = set()
    rejected: set[str] = set()
    for v, cand in zip(verdicts, candidates, strict=True):
        has_fail = any(not r.passed and not r.pending for r in v.results)
        for w in cand.works:
            target = rejected if has_fail else draft_pending
            target.add(w.demand.id)

    # A demand covered by BOTH a rejected plan and a verified plan counts as
    # rejected — the verified plan loses that coverage when superseding.
    verified -= rejected
    draft_pending -= rejected

    print(f"\n[B] {name}")
    print(
        f"    scheduled={len(schedule)} | verified(no-FAIL)={len(verified)} | "
        f"pending-draft={len(draft_pending)} | "
        f"rejected(has-FAIL)={len(rejected)}"
    )
    if fails:
        total = sum(len(v) for v in fails.values())
        print(f"    FAIL-checks={total}")
        for check, details in sorted(fails.items()):
            print(f"      FAIL {check}: {len(details)} -- {details[0][:100]}")
    else:
        print("    OK zero FAILs -- every plan passes the full 10-check rule set")
    return {
        "scheduled": len(schedule),
        "verified": len(verified),
        "pending_draft": len(draft_pending),
        "rejected": len(rejected),
        "fail_checks": sum(len(v) for v in fails.values()),
    }


def main() -> None:
    dem, tr, mach = build_scenario(SEED, density=DENSITY)
    p = params()
    base = min(d.earliest_start for d in dem)
    # G&SR-3 fairness: scenario demands are freshly ingested just before
    # planning. source_ingested_at=None would make every demand stale for
    # every arm -- a context artifact, not a capability difference.
    dem = [
        d.__class__(**{**d.__dict__, "source_ingested_at": base - timedelta(minutes=30)})
        for d in dem
    ]
    dem_map = {d.id: d for d in dem}

    tuned_b1 = greedy_schedule(dem, tr, p, base, urgency_weight=0.5, step_mins=15)
    default_greedy = greedy_schedule(dem, tr, p, base)

    print(f"== DENSE AUDIT v2 (seed={SEED}, density={DENSITY}x, demands={len(dem)}) ==")
    print(
        f"tuned-B1 scheduled: {len(tuned_b1)}/{len(dem)} | "
        f"default-greedy: {len(default_greedy)}/{len(dem)}"
    )

    # -- PHASE A: hint feasibility probe (fix-to-hint) --------------------
    for name, hint in (("tuned-B1", tuned_b1), ("default-greedy", default_greedy)):
        built = build_model(dem, tr, mach, weights(), p, base)
        add_hint(built, hint)
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 20
        solver.parameters.fix_variables_to_their_hinted_value = True
        solver.parameters.num_search_workers = 8
        status = solver.Solve(built.model)
        print(f"[A] hint={name:14s} fix-to-hint status: {solver.StatusName(status)}")

    # -- PHASE A-fix: solve WITH tuned warm-start, both budgets -----------
    rb_results = {}
    for budget, label in ((35, "35s NFR budget"), (120, "120s extended budget")):
        pp = params(max_time=float(budget))
        result = optima_solve(
            dem, tr, mach, weights(), pp, horizon="WEEKLY", warm_start=tuned_b1
        )
        rb_results[label] = result
        sched = {}
        for c in result.candidates:
            for w in c.works:
                sched[w.demand.id] = int((w.start - base).total_seconds() // 60)
        print(
            f"[A-fix {label}] status={result.status} scheduled={len(sched)}/{len(dem)} "
            f"unaddr={round(result.unaddressed_urgency, 2)} "
            f"wall={round(result.wall_time_seconds, 1)}s "
            f"obj={round(result.objective, 1)} bound={round(result.best_bound, 1)}"
        )

    # -- PHASE B: same-context Sentinel audit over every arm --------------
    s0, _ = run_b0(dem, tr, p)
    results = {
        "B0": audit_arm("B0 (manual BDMS)", s0, dem_map, tr, mach, base, p),
        "B1(tuned greedy)": audit_arm(
            "B1 (tuned greedy)", tuned_b1, dem_map, tr, mach, base, p
        ),
        "default-greedy": audit_arm(
            "default greedy (untuned)", default_greedy, dem_map, tr, mach, base, p
        ),
    }
    for label, result in rb_results.items():
        sched = {}
        for c in result.candidates:
            for w in c.works:
                sched[w.demand.id] = int((w.start - base).total_seconds() // 60)
        results[f"RAIL-BLOC ({label})"] = audit_arm(
            f"RAIL-BLOC ({label})", sched, dem_map, tr, mach, base, p
        )

    print("\n== SUMMARY TABLE (measured, R6.6) ==")
    print(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
