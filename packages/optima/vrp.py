"""Machine VRP sub-model (TechSpec §2.4) — second stage. Assignments come from each
demand's machinery_req; the roster sequences travel legs, measures idle time, and
flags physically infeasible transitions. Output persisted to machine_rosters (DB-005)."""
from __future__ import annotations

from datetime import timedelta

from packages.core.models import MachineInfo, RosterEntry, ScheduledWork


def build_roster(works: list[ScheduledWork], machines: list[MachineInfo]) -> tuple[list[RosterEntry], float, list[str]]:
    entries: list[RosterEntry] = []
    violations: list[str] = []
    idle_total = 0.0
    by_machine: dict[str, list[ScheduledWork]] = {}
    for w in works:
        for mach in w.demand.machinery:
            by_machine.setdefault(mach, []).append(w)

    for mach, mworks in by_machine.items():
        info = next((m for m in machines if m.machine_code == mach), None)
        speed = info.transit_speed_kmph if info else 40
        depot_km = info.depot_km if info else 0.0
        mworks.sort(key=lambda w: w.start)
        prev_end = None
        prev_km = depot_km
        for w in mworks:
            km = (w.demand.section_start_km + w.demand.section_end_km) / 2
            travel = timedelta(minutes=abs(km - prev_km) / max(speed, 1) * 60)
            travel_start = w.start - travel
            if prev_end is not None and travel_start < prev_end:
                violations.append(f"{mach}: travel {travel_start.isoformat()} overlaps prior assignment ending {prev_end.isoformat()}")
            if prev_end is not None and travel_start > prev_end:
                idle_total += (travel_start - prev_end).total_seconds() / 60
            # travel_end is the machine ARRIVAL timestamp (== work start, zero-headroom
            # policy). Travel DURATION is therefore travel_end - travel_start; the
            # machine arrives exactly when the scheduled work begins.
            entries.append(RosterEntry(mach, w.start, w.end, travel_start, w.start,
                                       origin=f"KM {prev_km:.1f}" if prev_end else f"DEPOT KM {depot_km:.1f}"))
            prev_end = w.end
            prev_km = km
    return entries, idle_total, violations
