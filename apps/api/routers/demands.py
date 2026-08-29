"""FR-001/2/3 + FR-030: machine-credential ingestion, staleness TTL, plausibility and
cross-feed contradiction checks, idempotent upsert (DB-006)."""
from __future__ import annotations
import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.config import settings
from ..core.database import get_session
from ..core.security import verify_source_credentials, Actor, get_actor
from ..schemas.models import DemandIngestIn
from ..services.ledger_service import append

router = APIRouter(prefix="/api/v1/demands", tags=["demands"])
# Cross-feed contradiction probes (TEL-001): a claimed urgency inconsistent with the
# reported physical measurement is rejected as implausible.
CONTRADICTIONS = [("contact_wire_diameter_mm", 8.25, "lt", 0.5),
                  ("point_operating_current_amps", 4.8, "gt", 0.6)]


@router.post("/ingest", status_code=201)
async def ingest(body: DemandIngestIn, session: AsyncSession = Depends(get_session),
                 x_source_system: str = Header(...), x_source_key: str = Header(...)):
    verify_source_credentials(x_source_system, x_source_key)
    now = datetime.now(timezone.utc)
    ttl = timedelta(hours=settings.demand_staleness_ttl_hours)
    ingested = rejected = 0
    flags: list[dict] = []
    for rec in body.records:
        stale = (now - rec.observed_at) > ttl
        contradiction = False
        for key, threshold, op, max_u in CONTRADICTIONS:
            v = rec.features.get(key)
            if v is None:
                continue
            violated = (float(v) < threshold and rec.urgency_score < max_u) if op == "lt" \
                else (float(v) > threshold and rec.urgency_score < max_u)
            if violated:
                contradiction = True
        if stale or contradiction:
            rejected += 1
            flags.append({"external_ref_id": rec.external_ref_id,
                          "reason": "stale beyond TTL" if stale else "plausibility contradiction"})
            continue
        sec = (await session.execute(text(
            "SELECT id FROM infrastructure.block_sections WHERE section_code = :c AND is_active"),
            {"c": rec.section_code})).scalar()
        if sec is None:
            rejected += 1
            flags.append({"external_ref_id": rec.external_ref_id, "reason": "unknown section"})
            continue
        await session.execute(text(
            """INSERT INTO demands.block_demands
               (external_source, external_ref_id, department, section_id, activity_code,
                min_duration_mins, earliest_start, latest_deadline, urgency_score,
                features, machinery_req, status, source_ingested_at)
               VALUES (:src, :ref, :dep, :sec, :act, :dur, :es, :ld, :u, CAST(:f AS jsonb), CAST(:m AS jsonb),
                       'SUBMITTED', :obs)
               ON CONFLICT (external_source, external_ref_id) DO UPDATE SET
                 urgency_score = EXCLUDED.urgency_score, features = EXCLUDED.features,
                 source_ingested_at = EXCLUDED.source_ingested_at, status = 'SUBMITTED'"""),
            {"src": x_source_system, "ref": rec.external_ref_id, "dep": rec.department,
             "sec": str(sec), "act": rec.activity_code, "dur": rec.min_duration_mins,
             "es": rec.earliest_start, "ld": rec.latest_deadline, "u": rec.urgency_score,
             "f": json.dumps(rec.features), "m": json.dumps(rec.machinery_req),
             "obs": rec.observed_at})
        ingested += 1
    await append(session, "DEMANDS_INGESTED", x_source_system,
                 {"ingested": ingested, "rejected": rejected, "flags": flags[:20]})
    await session.commit()
    return {"ingested": ingested, "rejected": rejected, "diagnostics": flags[:20]}


@router.get("")
async def list_demands(status: str | None = None, department: str | None = None,
                       division: str | None = None,
                       limit: int = Query(200, le=500),
                       actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    div = division or (None if actor.role in ("AUDITOR", "ADMIN") else actor.division)
    rows = (await session.execute(text(
        """SELECT d.id, d.external_ref_id, d.department, d.activity_code, d.status,
                  d.urgency_score, d.urgency_source, d.min_duration_mins, d.earliest_start,
                  d.latest_deadline, d.source_ingested_at, s.section_code, s.division
           FROM demands.block_demands d JOIN infrastructure.block_sections s ON s.id = d.section_id
           WHERE (CAST(:st AS varchar) IS NULL OR d.status = :st)
             AND (CAST(:dep AS varchar) IS NULL OR d.department = :dep)
             AND (CAST(:dv AS varchar) IS NULL OR s.division = :dv)
           ORDER BY d.urgency_score DESC LIMIT :l"""),
        {"st": status, "dep": department, "dv": div, "l": limit})).mappings().all()
    return [dict(r) for r in rows]


@router.post("/manual")
async def manual_upload(record: dict, actor: Actor = Depends(get_actor),
                        session: AsyncSession = Depends(get_session)):
    """BDMS_MANUAL path — human ENGINEER RBAC (XC-011 split auth)."""
    if actor.role not in ("ENGINEER", "ADMIN"):
        raise HTTPException(403, "requires ENGINEER or ADMIN")
    required = ["external_ref_id", "department", "section_code", "activity_code",
                "min_duration_mins", "earliest_start", "latest_deadline"]
    missing = [k for k in required if k not in record]
    if missing:
        raise HTTPException(400, f"missing fields: {missing}")
    sec = (await session.execute(text(
        "SELECT id FROM infrastructure.block_sections WHERE section_code = :c AND is_active"),
        {"c": record["section_code"]})).scalar()
    if sec is None:
        raise HTTPException(400, "unknown section")
    await session.execute(text(
        """INSERT INTO demands.block_demands
           (external_source, external_ref_id, department, section_id, activity_code,
            min_duration_mins, earliest_start, latest_deadline, urgency_score, features,
            machinery_req, status, source_ingested_at)
           VALUES ('BDMS_MANUAL', :ref, :dep, :sec, :act, :dur, :es, :ld, :u, CAST(:f AS jsonb),
                   CAST(:m AS jsonb), 'SUBMITTED', now())
           ON CONFLICT (external_source, external_ref_id) DO NOTHING"""),
        {"ref": record["external_ref_id"], "dep": record["department"], "sec": str(sec),
         "act": record["activity_code"], "dur": int(record["min_duration_mins"]),
         "es": record["earliest_start"], "ld": record["latest_deadline"],
         "u": float(record.get("urgency_score", 0.5)),
         "f": json.dumps(record.get("features", {})),
         "m": json.dumps(record.get("machinery_req", []))})
    await append(session, "DEMAND_MANUAL_UPLOADED", actor.username,
                 {"external_ref_id": record["external_ref_id"]})
    await session.commit()
    return {"ok": True}
