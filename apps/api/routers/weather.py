"""FR-019 — Weather Risk Adapter (IMD mock). PostGIS ST_Intersects matches alerts to
sections; TEL-002 fail-closed: a stale/missing feed DEFERS outdoor high-risk work."""
from __future__ import annotations
import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.config import settings
from ..core.database import get_session
from ..core.security import Actor, get_actor
from data.generators.corridor_gen import WEATHER_SENSITIVE

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])


@router.get("/alerts")
async def alerts(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    now = datetime.now(timezone.utc)
    ttl = timedelta(hours=settings.weather_staleness_ttl_hours)
    rows = (await session.execute(text(
        """SELECT w.id, w.alert_type, w.severity, w.precipitation_mm_hr,
                  w.rail_temperature_celsius, w.prohibited_work_types, w.valid_until, w.created_at,
                  ST_AsGeoJSON(w.impact_polygon) AS geom,
                  array_agg(s.section_code) FILTER (WHERE s.id IS NOT NULL) AS affected_sections
           FROM operations.weather_alerts w
           LEFT JOIN infrastructure.block_sections s
                  ON s.is_active AND ST_Intersects(s.track_geom, w.impact_polygon)
           GROUP BY w.id ORDER BY w.created_at DESC"""))).mappings().all()
    latest = max((r["created_at"] for r in rows), default=None)
    stale = latest is None or (now - latest) > ttl
    return {"stale_feed": stale,
            "fail_closed_default": "defer outdoor high-risk work" if stale else None,
            "staleness_ttl_hours": settings.weather_staleness_ttl_hours,
            "alerts": [{"id": str(r["id"]), "alert_type": r["alert_type"], "severity": r["severity"],
                        "precipitation_mm_hr": float(r["precipitation_mm_hr"] or 0),
                        "rail_temperature_celsius": float(r["rail_temperature_celsius"] or 0),
                        "prohibited_work_types": r["prohibited_work_types"],
                        "valid_until": r["valid_until"], "created_at": r["created_at"],
                        "affected_sections": list(r["affected_sections"] or []),
                        "geometry": json.loads(r["geom"])} for r in rows]}


@router.get("/deferred-activities")
async def deferred(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    """The exact work types currently deferred under fail-closed semantics."""
    now = datetime.now(timezone.utc)
    fresh_alerts = (await session.execute(text(
        "SELECT prohibited_work_types FROM operations.weather_alerts "
        "WHERE valid_until > :n AND created_at > :c"),
        {"n": now, "c": now - timedelta(hours=settings.weather_staleness_ttl_hours)})).scalars().all()
    if not fresh_alerts:
        return {"feed_state": "STALE_OR_MISSING",
                "deferred": WEATHER_SENSITIVE,
                "reason": "fail-closed default (TEL-002): no fresh IMD feed → defer outdoor high-risk work"}
    prohibited: set[str] = set()
    for types in fresh_alerts:
        prohibited.update(types or [])
    return {"feed_state": "FRESH", "deferred": sorted(prohibited & set(WEATHER_SENSITIVE)),
            "reason": "active IMD alert prohibitions"}
