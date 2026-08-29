"""Idempotent seeder: corridor + machines + feeding map + 26-week demands + WTT/FOIS +
weather + demo users + signal-ack rows. Re-running never duplicates (DB-006 upsert keys)."""
from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, text

from .corridor_gen import MACHINES, corridor
from .demand_gen import gen_demands
from .traffic_gen import gen_freight, gen_timetable, gen_weather

DS = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)


def hash_pw(pw: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), b"railbloc-salt", 60_000).hex()


def main(dsn: str, seed_password: str = "railbloc") -> None:
    eng = create_engine(dsn)
    sections, feeding, stations = corridor(seed=42)
    with eng.begin() as c:
        sec_ids = {}
        for s in sections:
            geom = f"ST_GeomFromGeoJSON('{json.dumps({'type': 'LineString', 'coordinates': s['coordinates']})}')"
            row = c.execute(text(
                "SELECT id FROM infrastructure.block_sections WHERE division=:d AND section_code=:c"),
                {"d": s["division"], "c": s["section_code"]}).fetchone()
            if row:
                sec_ids[s["section_code"]] = str(row[0]); continue
            sid = c.execute(text(
                f"""INSERT INTO infrastructure.block_sections
                    (section_code, division, zone, start_km, end_km, line_type, electrification,
                     speed_limit_mps, crossover_points, track_geom)
                    VALUES (:sc, :d, :z, :sk, :ek, :lt, '25KV_AC', :sp, CAST(:cp AS jsonb), {geom})
                    RETURNING id"""),
                {"sc": s["section_code"], "d": s["division"], "z": s["zone"], "sk": s["start_km"],
                 "ek": s["end_km"], "lt": s["line_type"], "sp": s["speed_limit_mps"],
                 "cp": json.dumps(s["crossover_points"])}).scalar()
            sec_ids[s["section_code"]] = str(sid)
        feed_ids = {}
        for f in feeding:
            row = c.execute(text("SELECT id FROM infrastructure.ohe_feeding_sections WHERE feeding_section_code=:c AND division='DLI'"),
                            {"c": f["feeding_section_code"]}).fetchone()
            if row:
                feed_ids[f["feeding_section_code"]] = str(row[0]); continue
            geom = f"ST_GeomFromGeoJSON('{json.dumps({'type': 'LineString', 'coordinates': f['coordinates']})}')"
            fid = c.execute(text(
                f"""INSERT INTO infrastructure.ohe_feeding_sections
                    (feeding_section_code, division, isolator_boundary_geom, substation_ref)
                    VALUES (:c, 'DLI', {geom}, :s) RETURNING id"""),
                {"c": f["feeding_section_code"], "s": f["substation_ref"]}).scalar()
            feed_ids[f["feeding_section_code"]] = str(fid)
            for sc in f["section_codes"]:
                c.execute(text("INSERT INTO infrastructure.section_feeding_map (section_id, feeding_section_id) "
                               "VALUES (:s, :f) ON CONFLICT DO NOTHING"),
                          {"s": sec_ids[sc], "f": feed_ids[f["feeding_section_code"]]})
        for code, cls, depot, speed in MACHINES:
            c.execute(text("INSERT INTO infrastructure.machines (machine_code, machine_class, depot_km, transit_speed_kmph) "
                           "VALUES (:a,:b,:c,:d) ON CONFLICT (machine_code) DO NOTHING"),
                      {"a": code, "b": cls, "c": depot, "d": speed})

    week0 = DS + timedelta(days=1)
    demands = gen_demands(sections, week0, seed=42, n_eng=70, n_trd=45, n_snt=45)
    for week in range(1, 4):
        demands += gen_demands(sections, week0 + timedelta(weeks=week), seed=42 + week, n_eng=18, n_trd=12, n_snt=12)
    with eng.begin() as c:
        for d in demands:
            c.execute(text(
                """INSERT INTO demands.block_demands
                   (external_source, external_ref_id, department, section_id, activity_code,
                    min_duration_mins, earliest_start, latest_deadline, urgency_score,
                    urgency_source, features, machinery_req, status, source_ingested_at)
                   VALUES (:es,:er,:dep,:sec,:ac,:dur,:st,:ld,:u,'INGEST_RAW',CAST(:f AS jsonb),CAST(:m AS jsonb),
                           'SUBMITTED',:ing)
                   ON CONFLICT (external_source, external_ref_id) DO NOTHING"""),
                {"es": d["external_source"], "er": d["external_ref_id"], "dep": d["department"],
                 "sec": sec_ids[d["section_code"]], "ac": d["activity_code"],
                 "dur": d["min_duration_mins"], "st": d["earliest_start"], "ld": d["latest_deadline"],
                 "u": d["urgency_score"], "f": json.dumps(d["features"]),
                 "m": json.dumps(d["machinery_req"]), "ing": datetime.now(UTC)})

    tt = gen_timetable(sections, DS, seed=52)
    fr = gen_freight(sections, DS, seed=53)
    with eng.begin() as c:
        for p in tt + fr:
            c.execute(text(
                """INSERT INTO operations.train_paths
                   (train_number, train_type, section_id, scheduled_entry, scheduled_exit,
                    priority_rank, source, metadata)
                   VALUES (:n,:t,:s,:e,:x,:p,:src,CAST(:m AS jsonb))
                   ON CONFLICT (train_number, section_id, scheduled_entry) DO NOTHING"""),
                {"n": p["train_number"], "t": p["train_type"], "s": sec_ids[p["section_code"]],
                 "e": p["scheduled_entry"], "x": p["scheduled_exit"], "p": p["priority_rank"],
                 "src": p["source"], "m": json.dumps(p["metadata"])})

    alerts = gen_weather(DS, seed=44)
    with eng.begin() as c:
        existing = c.execute(text("SELECT count(*) FROM operations.weather_alerts")).scalar()
        if not existing:
            for a in alerts:
                poly = json.dumps({"type": "Polygon", "coordinates": [a["polygon"]]})
                c.execute(text(
                    f"""INSERT INTO operations.weather_alerts
                        (alert_type, severity, impact_polygon, precipitation_mm_hr,
                         rail_temperature_celsius, prohibited_work_types, valid_until)
                        VALUES (:t,:s,ST_GeomFromGeoJSON('{poly}'),:p,:rt,CAST(:w AS jsonb),:v)"""),
                    {"t": a["alert_type"], "s": a["severity"], "p": a["precipitation_mm_hr"],
                     "rt": a["rail_temperature_celsius"], "w": json.dumps(a["prohibited_work_types"]),
                     "v": a["valid_until"]})

    users = [("admin", "ADMIN", "DLI", "System Administrator"),
             ("srdom_dli", "SR_DOM", "DLI", "Sr. DOM (Delhi)"),
             ("drm_dli", "DRM", "DLI", "DRM (Delhi)"),
             ("controller_dli", "CONTROLLER", "DLI", "Chief Controller (Delhi)"),
             ("engineer_dli", "ENGINEER", "DLI", "Sr. DEN Coord (Delhi)"),
             ("sm_dli", "STATION_MASTER", "DLI", "Station Master (GZB)"),
             ("auditor", "AUDITOR", "DLI", "Vigilance Auditor")]
    pw = hash_pw(seed_password)
    with eng.begin() as c:
        for u, role, div, name in users:
            c.execute(text(
                "INSERT INTO auth.users (username, password_hash, role, division, full_name) "
                "VALUES (:u,:p,:r,:d,:n) ON CONFLICT (username) DO NOTHING"),
                {"u": u, "p": pw, "r": role, "d": div, "n": name})
        c.execute(text("SELECT audit.append_event('SYSTEM_SEEDED','seed_all',CAST(:p AS jsonb))"),
                  {"p": json.dumps({"sections": len(sections), "demands": len(demands),
                                    "train_paths": len(tt) + len(fr), "weather_alerts": len(alerts),
                                    "simulated": True})})
    print(f"Seeded: {len(sections)} sections, {len(demands)} demands, {len(tt)+len(fr)} paths.")


if __name__ == "__main__":
    dsn = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL", "").replace("+asyncpg", "+psycopg2")
    password = os.environ.get("SEED_PASSWORD") or (sys.argv[2] if len(sys.argv) > 2 else "railbloc")
    main(dsn, password)
