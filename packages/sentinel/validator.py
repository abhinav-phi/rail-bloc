"""Sentinel — deterministic, side-effect-free, no network calls, no ML (ADR-004).
It is a validator, never an executor (ADR-006). Inputs are the candidate plans and
the current structural state; output is a per-check verdict bound to content hashes."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional
from packages.core.models import PlanCandidate, MachineInfo
from packages.chronicle.canonical import content_hash
from .rules import CheckID, STRUCTURAL_SUBSET


@dataclass(frozen=True)
class TrainInterval:
    section_id: str
    priority_rank: int
    entry: datetime
    exit: datetime


@dataclass(frozen=True)
class FeedingMapEntry:
    feeding_section_id: str
    section_ids: frozenset


@dataclass(frozen=True)
class AckRecord:
    plan_id: str
    sm_acked: bool
    controller_acked: bool


@dataclass
class SentinelContext:
    train_intervals: list[TrainInterval]
    feeding_map: list[FeedingMapEntry]
    acks: dict[str, AckRecord] = field(default_factory=dict)   # key: content_hash of plan
    machine_infos: list[MachineInfo] = field(default_factory=list)
    machine_assignments: dict[str, list[tuple[datetime, datetime, float]]] = field(default_factory=dict)  # machine -> (start, end, section_km_mid)
    now: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    staleness_ttl: timedelta = timedelta(hours=12)
    headway_high_priority_mins: int = 15
    high_priority_max_rank: int = 3


@dataclass(frozen=True)
class CheckResult:
    check_id: CheckID
    passed: bool
    pending: bool = False   # G&SR-2 may be PENDING until SM+Controller acks land
    detail: str = ""


@dataclass
class SentinelVerdict:
    plan_id: Optional[str]
    content_hash: str
    results: list[CheckResult]

    @property
    def passed(self) -> bool:
        return all(r.passed for r in self.results)

    @property
    def has_pending(self) -> bool:
        return any(r.pending for r in self.results)

    def only_gsr2_outstanding(self) -> bool:
        """True when every non-passing result is G&SR-2 awaiting SM/Controller acks.
        Such a plan is persistable as DRAFT (never SENTINEL_PASSED) until acked."""
        return all(r.passed or (r.check_id == CheckID.GSR2_INTERLOCKING_PRECEDENCE and r.pending)
                   for r in self.results)


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def validate_plan(plan: PlanCandidate, ctx: SentinelContext) -> SentinelVerdict:
    ch = content_hash(plan.section_id, plan.start_time, plan.end_time,
                      plan.primary_demand_id, plan.shadow_demand_ids)
    results: list[CheckResult] = []

    trains = [t for t in ctx.train_intervals if t.section_id == plan.section_id]

    # G&SR-1: raw occupancy vs block — any intersection is a hard failure.
    bad = [t for t in trains if _overlaps(plan.start_time, plan.end_time, t.entry, t.exit)]
    results.append(CheckResult(CheckID.GSR1_ABSOLUTE_BLOCK_EXCLUSION, not bad,
        detail="no train occupancy intersects the block" if not bad else f"conflicts with {len(bad)} train path(s)"))

    # G&SR-2: SM + Controller acknowledgments for S&T work (Rules.md §1).
    if "SIGNAL_TELECOM" in plan.departments:
        ack = ctx.acks.get(ch)
        ok = bool(ack and ack.sm_acked and ack.controller_acked)
        results.append(CheckResult(CheckID.GSR2_INTERLOCKING_PRECEDENCE, ok, pending=not ok,
            detail="Station Master and Controller acknowledgment required" if not ok else "SM+Controller acknowledged"))
    else:
        results.append(CheckResult(CheckID.GSR2_INTERLOCKING_PRECEDENCE, True, detail="no S&T work in bundle"))

    # G&SR-3: fail-closed — no demand may ride on stale telemetry.
    stale = [w.demand.id for w in plan.works
             if w.demand.source_ingested_at is None or (ctx.now - w.demand.source_ingested_at) > ctx.staleness_ttl]
    results.append(CheckResult(CheckID.GSR3_FAIL_CLOSED_CONSISTENCY, not stale,
        detail="all feeds fresh" if not stale else f"stale demands: {stale}"))

    # G&SR-4: every OHE feeding section touching this plan must lie fully inside the plan
    # (no isolator boundary spilling outside the block → no back-feed path).
    plan_secs = {plan.section_id}
    touching = [f for f in ctx.feeding_map if plan_secs & set(f.section_ids)]
    spill = [f.feeding_section_id for f in touching if not (set(f.section_ids) <= plan_secs)]
    needs_trd = "TRD" in plan.departments
    results.append(CheckResult(CheckID.GSR4_POWER_ISOLATION_BOUNDARY,
        (not spill) if needs_trd else True,
        detail="boundaries contained" if not spill else f"feeding sections spill outside block: {spill}"))

    # G&SR-5: >= headway margin before high-priority arrivals.
    hp = [t for t in trains if t.priority_rank <= ctx.high_priority_max_rank]
    margin = timedelta(minutes=ctx.headway_high_priority_mins)
    viol = [t for t in hp if _overlaps(plan.start_time - margin, plan.end_time + margin, t.entry, t.exit)]
    results.append(CheckResult(CheckID.GSR5_HEADWAY_MARGIN, not viol,
        detail=f">={ctx.headway_high_priority_mins} min clear of priority<={ctx.high_priority_max_rank} trains"
               if not viol else f"headway violation vs {len(viol)} high-priority paths"))

    # MILP-C2: enclosure — every work window inside the plan window.
    out = [w.demand.id for w in plan.works if w.start < plan.start_time or w.end > plan.end_time]
    results.append(CheckResult(CheckID.MILP_C2_MAINTENANCE_ENCLOSURE, not out,
        detail="all works enclosed" if not out else f"works outside window: {out}"))

    # MILP-C3: shadow containment — bundled works inside the bundle hull.
    c3_ok = all(w.start >= plan.start_time and w.end <= plan.end_time for w in plan.works)
    results.append(CheckResult(CheckID.MILP_C3_SHADOW_CONTAINMENT, c3_ok,
        detail="shadow windows contained in bundle" if c3_ok else "shadow window escapes bundle"))

    # MILP-C4: non-fragmented — single contiguous interval per demand, >= min duration.
    frag = [w.demand.id for w in plan.works
            if w.end <= w.start or (w.end - w.start).total_seconds() / 60 < w.demand.min_duration_mins]
    results.append(CheckResult(CheckID.MILP_C4_NON_FRAGMENTED_DURATION, not frag,
        detail="single contiguous interval per demand" if not frag else f"fragmented: {frag}"))

    # MILP-C1 / C5 are set-level; validate_plan covers the plan-local remainder.
    results.append(CheckResult(CheckID.MILP_C1_SECTION_EXCLUSION, True, detail="checked at set level"))
    results.append(CheckResult(CheckID.MILP_C5_MACHINE_CONSERVATION, True, detail="checked at set level"))
    return SentinelVerdict(plan_id=None, content_hash=ch, results=results)


def validate_set(candidates: list[PlanCandidate], ctx: SentinelContext) -> list[SentinelVerdict]:
    verdicts = [validate_plan(p, ctx) for p in candidates]

    # MILP-C1: no two plans may overlap on the same section (RES-03: section-level here;
    # multi-section plans additionally checked by the Plan Lifecycle service).
    by_sec: dict[str, list[PlanCandidate]] = {}
    for p in candidates:
        by_sec.setdefault(p.section_id, []).append(p)
    for sec, plans in by_sec.items():
        plans_sorted = sorted(plans, key=lambda p: p.start_time)
        for a, b in zip(plans_sorted, plans_sorted[1:]):
            if _overlaps(a.start_time, a.end_time, b.start_time, b.end_time):
                for v in verdicts:
                    if v.content_hash == content_hash(a.section_id, a.start_time, a.end_time,
                                                      a.primary_demand_id, a.shadow_demand_ids) or \
                       v.content_hash == content_hash(b.section_id, b.start_time, b.end_time,
                                                      b.primary_demand_id, b.shadow_demand_ids):
                        v.results = [CheckResult(r.check_id, False, r.pending,
                                       "overlapping plans on same section")
                                     if r.check_id == CheckID.MILP_C1_SECTION_EXCLUSION else r
                                     for r in v.results]

    # MILP-C5: no machine may be in two places at once; travel time respected.
    for machine, windows in ctx.machine_assignments.items():
        windows_sorted = sorted(windows)
        for (s1, e1, km1), (s2, e2, km2) in zip(windows_sorted, windows_sorted[1:]):
            info = next((m for m in ctx.machine_infos if m.machine_code == machine), None)
            speed = info.transit_speed_kmph if info else 40
            travel = timedelta(minutes=abs(km2 - km1) / max(speed, 1) * 60)
            if s2 < e1 + travel:
                for v in verdicts:
                    for i, r in enumerate(v.results):
                        if r.check_id == CheckID.MILP_C5_MACHINE_CONSERVATION:
                            v.results[i] = CheckResult(r.check_id, False, r.pending,
                                f"machine {machine}: travel/overlap infeasible ({s1}-{e1} -> {s2}-{e2})")
    return verdicts


def validate_structural_subset(plan: PlanCandidate, ctx: SentinelContext) -> SentinelVerdict:
    """T-2h transmission re-check and the synchronous check inside the 45s emergency
    budget (SAFE-003 / ADR-006) — checks 1, 5, 6, 9 per TechSpec §2.3."""
    full = validate_plan(plan, ctx)
    return SentinelVerdict(plan_id=None, content_hash=full.content_hash,
                           results=[r for r in full.results if r.check_id in STRUCTURAL_SUBSET])
