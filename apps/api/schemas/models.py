from __future__ import annotations
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    role: str
    division: str


class DemandRecordIn(BaseModel):
    external_ref_id: str
    department: Literal["ENGINEERING", "TRD", "SIGNAL_TELECOM"]
    section_code: str
    activity_code: str
    min_duration_mins: int = Field(gt=0, le=1440)
    earliest_start: datetime
    latest_deadline: datetime
    urgency_score: float = Field(ge=0.0, le=1.0)
    machinery_req: list[str] = []
    features: dict = {}
    observed_at: datetime


class DemandIngestIn(BaseModel):
    records: list[DemandRecordIn]


class SolveIn(BaseModel):
    horizon: Literal["WEEKLY", "STRATEGIC_26W", "REALTIME"] = "WEEKLY"
    division: str


class TaskOut(BaseModel):
    task_id: str
    status: str


class DecisionIn(BaseModel):
    plan_id: str
    decision: Literal["APPROVE", "REJECT"]
    signature: str
    idempotency_key: str = Field(min_length=8, max_length=128)


class ReviseIn(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class BreakdownIn(BaseModel):
    section_id: str
    breakdown_type: Literal["TRACK_FRACTURE", "OHE_BREAKDOWN", "SIGNAL_FAILURE", "OTHER"]
    estimated_duration_mins: int = Field(gt=0, le=1440)
    confirmation: bool = False
    idempotency_key: str = Field(min_length=8, max_length=128)


class AckSignalIn(BaseModel):
    as_role: Literal["STATION_MASTER", "CONTROLLER"]


class PlanOut(BaseModel):
    id: str
    plan_horizon: str
    section_id: str
    section_code: str = ""
    division: str = ""
    start_time: datetime
    end_time: datetime
    primary_demand_id: str
    shadow_demand_ids: list[str] = []
    is_shadow_block: bool
    approval_status: str
    revision_no: int
    content_hash: str
    sentinel_verified: bool
    decided_by: Optional[str] = None
    authorized_by: Optional[str] = None
    incident_id: Optional[str] = None


class TimetableRowIn(BaseModel):
    train_number: str
    train_type: Literal["VANDE_RAJDHANI", "MAIL_EXP", "PASSENGER", "FREIGHT"]
    priority_rank: int = Field(ge=1, le=10)
    section_code: str
    scheduled_entry: datetime
    scheduled_exit: datetime
    source: Literal["WTT", "COA_LIVE", "FOIS_FORECAST"] = "WTT"


class TimetableUploadIn(BaseModel):
    rows: list[TimetableRowIn]
