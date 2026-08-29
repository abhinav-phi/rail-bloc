"""SAFE-002: the single canonical content-hash implementation.
Every mutation-holding field of a plan is hashed: section, window, primary demand,
and the SORTED shadow demand IDs. Used identically by solver persistence, the
approve/authorize/transmit gates, and the revise endpoint — one definition, no drift."""
from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).isoformat()


def canonical_plan_payload(section_id: str, start_time: datetime, end_time: datetime,
                           primary_demand_id: str, shadow_demand_ids: list[str]) -> str:
    payload = {
        "section_id": str(section_id),
        "start_time": _iso(start_time),
        "end_time": _iso(end_time),
        "primary_demand_id": str(primary_demand_id),
        "shadow_demand_ids": sorted(str(u) for u in shadow_demand_ids),  # DB-002: canonical order
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def content_hash(section_id: str, start_time: datetime, end_time: datetime,
                 primary_demand_id: str, shadow_demand_ids: list[str]) -> str:
    return hashlib.sha256(
        canonical_plan_payload(section_id, start_time, end_time, primary_demand_id, shadow_demand_ids).encode()
    ).hexdigest()
