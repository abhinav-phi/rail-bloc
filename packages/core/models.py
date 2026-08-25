from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


class Department(str, Enum):
    ENGINEERING = "ENGINEERING"
    TRD = "TRD"
    SIGNAL_TELECOM = "SIGNAL_TELECOM"


class PlanHorizon(str, Enum):
    STRATEGIC_26W = "STRATEGIC_26W"
    WEEKLY = "WEEKLY"
    REALTIME = "REALTIME"


@dataclass(frozen=True)
class DemandInput:
    id: str
    section_id: str
    section_code: str
    division: str
    section_start_km: float
    section_end_km: float
    department: str
    activity_code: str
    min_duration_mins: int
    earliest_start: datetime
    latest_deadline: datetime
    urgency_score: float
    machinery: list[str] = field(default_factory=list)
    source_ingested_at: Optional[datetime] = None
    features: dict = field(default_factory=dict)


@dataclass(frozen=True)
class TrainPathInput:
    train_number: str
    train_type: str
    section_id: str
    priority_rank: int
    scheduled_entry: datetime
    scheduled_exit: datetime
    source: str = "WTT"
    forecast_confidence: Optional[float] = None


@dataclass(frozen=True)
class MachineInfo:
    machine_code: str
    machine_class: str
    depot_km: float
    transit_speed_kmph: int


@dataclass(frozen=True)
class SolveWeights:
    pax_delay: float
    frt_delay: float
    shadow_reward: float
    machine_idle: float
    unaddressed_defect: float
    early_start: float

    def relaxed(self) -> "SolveWeights":
        """FSM-002 REJECTED_RETRY: relax soft weights for a re-run. Hard safety is
        never relaxed — only objective soft terms (shadow reward / early start)."""
        return SolveWeights(
            pax_delay=self.pax_delay,
            frt_delay=self.frt_delay,
            shadow_reward=self.shadow_reward * 0.5,
            machine_idle=self.machine_idle,
            unaddressed_defect=self.unaddressed_defect,
            early_start=self.early_start * 0.5,
        )


@dataclass(frozen=True)
class SolverParams:
    max_time_seconds: float
    num_workers: int
    headway_high_priority_mins: int
    headway_default_mins: int
    freight_hard_confidence: float
    bundling_gap_mins: int = 0
    max_retries: int = 3


@dataclass
class ScheduledWork:
    demand: DemandInput
    start: datetime
    end: datetime


@dataclass
class PlanCandidate:
    section_id: str
    section_code: str
    division: str
    start_time: datetime
    end_time: datetime
    primary_demand_id: str
    works: list[ScheduledWork]
    is_shadow_block: bool
    plan_horizon: str
    incident_id: Optional[str] = None

    @property
    def shadow_demand_ids(self) -> list[str]:
        return sorted(w.demand.id for w in self.works if w.demand.id != self.primary_demand_id)

    @property
    def departments(self) -> set[str]:
        return {w.demand.department for w in self.works}


@dataclass
class RosterEntry:
    machine_code: str
    plan_start: datetime
    plan_end: datetime
    travel_start: datetime
    travel_end: datetime
    origin: str


@dataclass
class SolveResult:
    status: str                     # OPTIMAL | FEASIBLE | INFEASIBLE | UNKNOWN
    objective: float
    best_bound: float
    wall_time_seconds: float
    candidates: list[PlanCandidate]
    roster: list[RosterEntry]
    machine_idle_minutes: float
    machine_violations: list[str]
    scheduled_count: int
    total_demands: int
    unaddressed_urgency: float
    attempt: int = 1


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
