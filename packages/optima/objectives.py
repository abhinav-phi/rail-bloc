"""Objective components (TechSpec §2). ML-derived quantities (Pi, rho) appear ONLY in
objective coefficients — never in a feasibility constraint (Rules.md §2)."""
from __future__ import annotations

from datetime import datetime, timedelta

from packages.core.models import DemandInput, SolverParams, SolveWeights


def time_weighted_urgency(d: DemandInput, at: datetime) -> float:
    """MILP-003: Pi_k(t) = base * (1 + gamma * (t - ES)/(LD - ES)) — urgency grows
    monotonically toward the deadline; no incentive to park urgent work late."""
    span = (d.latest_deadline - d.earliest_start).total_seconds()
    if span <= 0:
        return d.urgency_score
    frac = max(0.0, min(1.0, (at - d.earliest_start).total_seconds() / span))
    gamma = 0.5
    return min(1.0, d.urgency_score * (1.0 + gamma * frac))


def headway_minutes(priority_rank: int, params: SolverParams) -> int:
    return params.headway_high_priority_mins if priority_rank <= 3 else params.headway_default_mins


def timedelta_h(minutes: int) -> timedelta:
    return timedelta(minutes=minutes)


def replay_train_detention(blocks: list[tuple[str, datetime, datetime]],
                           trains: list[tuple[str, str, datetime, datetime, int]],
                           params: SolverParams) -> dict[str, float]:
    """Deterministic path-replay (TechSpec §2): a train whose raw occupancy intersects a
    block is held until the block clears + headway. The replay metric is driven by the
    actual occupancy conflicts and headway policy, not by objective weights; keeping the
    weights out of the signature avoids a misleading dead parameter."""
    det_pax = det_frt = 0.0
    block_by_sec: dict[str, list[tuple[datetime, datetime]]] = {}
    for sec, bstart, bend in blocks:
        block_by_sec.setdefault(sec, []).append((bstart, bend))
    for sec, _tnum, entry, exit_, rank in trains:
        for bstart, bend in block_by_sec.get(sec, []):
            if entry < bend and bstart < exit_:
                h = timedelta(minutes=headway_minutes(rank, params))
                held_until = bend + h
                det = max(0.0, (held_until - entry).total_seconds() / 60.0)
                if rank <= 6:
                    det_pax += det
                else:
                    det_frt += det
                break  # first conflicting block holds the train; later ones are re-checked live
    return {"pax_delay_minutes": det_pax, "frt_delay_minutes": det_frt}
