"""Baseline 1 (B1) – honest, tunable greedy heuristic (Rules.md §3). Doubles as the
CP-SAT warm-start hint (TechSpec §2.5): RAIL-BLOC is therefore never worse than B1.
"""
from __future__ import annotations

from datetime import datetime

from .formulations import _mins


def greedy_schedule(demands, trains, params, base: datetime, urgency_weight: float = 1.0,
                    step_mins: int = 15) -> dict[str, int]:
    schedule: dict[str, int] = {}
    tr_by_sec: dict[str, list] = {}
    for t in trains:
        tr_by_sec.setdefault(t.section_id, []).append(t)
    ordered = sorted(demands, key=lambda d: -(urgency_weight * d.urgency_score))
    for d in ordered:
        es = _mins(d.earliest_start, base)
        ld = _mins(d.latest_deadline, base)
        dur = int(d.min_duration_mins)
        t = es
        while t + dur <= ld:
            ok = True
            for tr in tr_by_sec.get(d.section_id, []):
                h = params.headway_high_priority_mins if tr.priority_rank <= 3 else params.headway_default_mins
                ts, te = _mins(tr.scheduled_entry, base) - h, _mins(tr.scheduled_exit, base) + h
                if t < te and ts < t + dur:
                    t = te if te > t else t + step_mins
                    ok = False
                    break
            if ok:
                schedule[d.id] = t
                break
    return schedule


def tuning_grid() -> list[dict]:
    """Rules.md §3 documented B1 tuning protocol: grid-search over a held-out tuning
    split; the best cell is frozen before any evaluation-split comparison."""
    return [{"urgency_weight": uw, "step_mins": sm}
            for uw in (0.5, 1.0, 2.0) for sm in (15, 30)]
