"""ADR-005 — interval-based CP-SAT formulation. Train paths are EXOGENOUS fixed
intervals (not decision variables); exclusion is per-train NoOverlap with headway
expansion (fixes the infeasible aggregate-binary form); one OptionalIntervalVar per
demand kills x-flicker by construction (MILP-004); shadow bundling is window
containment at block level (MILP-C3); low-confidence freight enters as an
expected-delay cost, never as a feasibility constraint (Rules.md §2)."""
from __future__ import annotations

from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from packages.core.models import DemandInput, MachineInfo, SolverParams, SolveWeights, TrainPathInput

from .objectives import headway_minutes, time_weighted_urgency


@dataclass
class DemandVar:
    demand: DemandInput
    start: object | None = None
    present: object | None = None
    interval: object | None = None


@dataclass
class BuiltModel:
    model: cp_model.CpModel
    dvars: dict[str, DemandVar] = field(default_factory=dict)
    shadow: dict[tuple[str, str], object] = field(default_factory=dict)
    base: object = None


def _mins(dt, base) -> int:
    return int((dt - base).total_seconds() // 60)


def _travel_minutes(a: DemandInput, b: DemandInput, machines: list[MachineInfo]) -> int:
    km_a = (a.section_start_km + a.section_end_km) / 2
    km_b = (b.section_start_km + b.section_end_km) / 2
    speed = 40
    if a.machinery:
        info = next((m for m in machines if m.machine_code == a.machinery[0]), None)
        if info:
            speed = max(info.transit_speed_kmph, 1)
    return int(abs(km_b - km_a) / speed * 60)


def build_model(demands: list[DemandInput], trains: list[TrainPathInput],
                weights: SolveWeights, params: SolverParams, base,
                shadow_weight_scale: float = 1.0) -> BuiltModel:
    m = cp_model.CpModel()
    built = BuiltModel(model=m, base=base)

    for d in demands:
        es, ld = _mins(d.earliest_start, base), _mins(d.latest_deadline, base)
        dur = int(d.min_duration_mins)
        present = m.NewBoolVar(f"present_{d.id}")
        if ld - dur >= es:
            start = m.NewIntVar(es, ld - dur, f"start_{d.id}")
            iv = m.NewOptionalIntervalVar(start, dur, start + dur, present, f"iv_{d.id}")
            built.dvars[d.id] = DemandVar(d, start, present, iv)
        else:
            m.Add(present == 0)
            built.dvars[d.id] = DemandVar(d, None, present, None)

    trains_by_sec: dict[str, list[TrainPathInput]] = {}
    for t in trains:
        trains_by_sec.setdefault(t.section_id, []).append(t)

    soft_freight_terms: list[tuple[object, float]] = []
    for sec, ts in trains_by_sec.items():
        fixed = []
        for t in ts:
            conf = t.forecast_confidence if t.forecast_confidence is not None else 1.0
            if t.source == "FOIS_FORECAST" and conf < params.freight_hard_confidence:
                continue  # soft: expected-delay cost below
            h = headway_minutes(t.priority_rank, params)
            s = _mins(t.scheduled_entry, base) - h
            e = _mins(t.scheduled_exit, base) + h
            fixed.append(m.NewIntervalVar(s, e - s, e, f"tr_{t.train_number}_{sec[:8]}"))
        opts = [dv.interval for dv in built.dvars.values()
                if dv.demand.section_id == sec and dv.interval is not None]
        # MILP-002 (correct form): each maintenance interval must avoid EVERY individual
        # headway-expanded train window. Trains are exogenous and may legitimately
        # overlap EACH OTHER's expanded windows on a saturated corridor, so posting a
        # single NoOverlap over fixed+fixed would re-create the original infeasibility.
        # One NoOverlap per train vs all works preserves exactly the safety property.
        for tr_iv in fixed:
            if opts:
                m.AddNoOverlap([tr_iv] + opts)

        for t in ts:
            conf = t.forecast_confidence if t.forecast_confidence is not None else 1.0
            if not (t.source == "FOIS_FORECAST" and conf < params.freight_hard_confidence):
                continue
            sf, ef = _mins(t.scheduled_entry, base), _mins(t.scheduled_exit, base)
            dfr = max(ef - sf, 1)
            for dv in built.dvars.values():
                if dv.demand.section_id != sec or dv.interval is None:
                    continue
                dur = int(dv.demand.min_duration_mins)
                b1 = m.NewBoolVar(""); b2 = m.NewBoolVar(""); o = m.NewBoolVar("")
                m.Add(dv.start >= ef).OnlyEnforceIf(b1)
                m.Add(dv.start <= ef - 1).OnlyEnforceIf(b1.Not())
                m.Add(sf >= dv.start + dur).OnlyEnforceIf(b2)
                m.Add(sf <= dv.start + dur - 1).OnlyEnforceIf(b2.Not())
                m.AddBoolOr([b1, b2, o.Not()])
                m.AddImplication(o, b1.Not())
                m.AddImplication(o, b2.Not())
                c = m.NewBoolVar("")
                m.Add(c <= o); m.Add(c <= dv.present); m.Add(c >= o + dv.present - 1)
                soft_freight_terms.append((c, conf * weights.frt_delay * dfr))

    # Shadow bundling: window containment (one contains the other) on shared section.
    eng = [dv for dv in built.dvars.values()
           if dv.demand.department == "ENGINEERING" and dv.interval is not None]
    other = [dv for dv in built.dvars.values()
             if dv.demand.department in ("TRD", "SIGNAL_TELECOM") and dv.interval is not None]
    for a in eng:
        for b in other:
            if a.demand.section_id != b.demand.section_id:
                continue
            if _mins(b.demand.latest_deadline, base) < _mins(a.demand.earliest_start, base):
                continue
            s = m.NewBoolVar(f"shadow_{a.demand.id[:8]}_{b.demand.id[:8]}")
            sel = m.NewBoolVar("")
            m.Add(b.start >= a.start).OnlyEnforceIf([s, sel])
            m.Add(b.start + int(b.demand.min_duration_mins) <= a.start + int(a.demand.min_duration_mins)).OnlyEnforceIf([s, sel])
            m.Add(a.start >= b.start).OnlyEnforceIf([s, sel.Not()])
            m.Add(a.start + int(a.demand.min_duration_mins) <= b.start + int(b.demand.min_duration_mins)).OnlyEnforceIf([s, sel.Not()])
            built.shadow[(a.demand.id, b.demand.id)] = s

    # Machine disjunctive with travel time (MILP-C5 feasibility side).
    machines: list[MachineInfo] = params.machines if hasattr(params, "machines") else []
    by_machine: dict[str, list[DemandVar]] = {}
    for dv in built.dvars.values():
        for mach in dv.demand.machinery:
            by_machine.setdefault(mach, []).append(dv)
    for mach, dvs in by_machine.items():
        for i in range(len(dvs)):
            for j in range(i + 1, len(dvs)):
                a, b = dvs[i], dvs[j]
                if a.interval is None or b.interval is None:
                    continue
                T = _travel_minutes(a.demand, b.demand, machines)
                ab = m.NewBoolVar("")
                m.Add(b.start >= a.start + int(a.demand.min_duration_mins) + T).OnlyEnforceIf([ab, a.present, b.present])
                m.Add(a.start >= b.start + int(b.demand.min_duration_mins) + T).OnlyEnforceIf([ab.Not(), a.present, b.present])

    terms = []
    for dv in built.dvars.values():
        pi = time_weighted_urgency(dv.demand, dv.demand.latest_deadline)
        terms.append(weights.unaddressed_defect * pi * (1 - dv.present))
        if dv.start is not None:
            es = _mins(dv.demand.earliest_start, base)
            terms.append(weights.early_start * dv.demand.urgency_score * (dv.start - es))
    for (aid, bid), s in built.shadow.items():
        terms.append(-weights.shadow_reward * shadow_weight_scale * s)
    for c, w in soft_freight_terms:
        terms.append(w * c)
    m.Minimize(sum(terms))
    return built


def add_hint(built: BuiltModel, schedule: dict[str, int]) -> None:
    for dv in built.dvars.values():
        if dv.start is None:
            continue
        if dv.demand.id in schedule:
            built.model.AddHint(dv.present, 1)
            built.model.AddHint(dv.start, schedule[dv.demand.id])
        else:
            built.model.AddHint(dv.present, 0)
