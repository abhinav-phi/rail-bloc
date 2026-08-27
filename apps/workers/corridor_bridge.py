"""Bridge used by the worker's 6-hourly feed simulator (FR-001/002/003): generates a
small fresh batch per source and inserts it through the same per-source-credential
contract the API enforces (TEL-001/XC-011), with source_ingested_at = now()."""
from __future__ import annotations
import hashlib, json, os
from datetime import datetime, timedelta, timezone


def _source_key(source: str) -> str | None:
    return {"TMS": os.environ.get("INGEST_KEY_TMS"),
            "TDMS": os.environ.get("INGEST_KEY_TDMS"),
            "SMMS": os.environ.get("INGEST_KEY_SMMS")}.get(source)


def insert_feed_batch(eng) -> int:
    from sqlalchemy import text
    from data.generators.corridor_gen import corridor
    from data.generators.demand_gen import gen_demands

    sections, _, _ = corridor(seed=42)
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%d%H%M")  # minute-level: repeated polls stay unique
    total = 0
    with eng.begin() as conn:
        sec_ids = dict(conn.execute(text(
            "SELECT section_code, id FROM infrastructure.block_sections WHERE is_active")).fetchall())
        batches = gen_demands(sections, week_start=now, seed=int(hashlib.sha1(stamp.encode()).hexdigest(), 16) % (10 ** 8),
                              n_eng=2, n_trd=2, n_snt=2)
        for d in batches:
            expected = _source_key(d["external_source"])
            if not expected:
                continue  # never insert without a configured source credential
            ref = f"{d['external_ref_id']}-{stamp}"
            res = conn.execute(text(
                """INSERT INTO demands.block_demands
                   (external_source, external_ref_id, department, section_id, activity_code,
                    min_duration_mins, earliest_start, latest_deadline, urgency_score,
                    urgency_source, features, machinery_req, status, source_ingested_at)
                   VALUES (:src,:ref,:dep,:sec,:act,:dur,:st,:ld,:u,'INGEST_RAW',CAST(:f AS jsonb),CAST(:m AS jsonb),
                           'SUBMITTED',:ing)
                   ON CONFLICT (external_source, external_ref_id) DO NOTHING"""),
                {"src": d["external_source"], "ref": ref, "dep": d["department"],
                 "sec": sec_ids.get(d["section_code"]), "act": d["activity_code"],
                 "dur": d["min_duration_mins"],
                 "st": d["earliest_start"] + timedelta(days=1),
                 "ld": d["latest_deadline"] + timedelta(days=1),
                 "u": d["urgency_score"], "f": json.dumps(d["features"]),
                 "m": json.dumps(d["machinery_req"]), "ing": now})
            total += res.rowcount > 0
        conn.execute(text(
            "SELECT audit.append_event('FEED_SIMULATED','worker',CAST(:p AS jsonb))"),
            {"p": json.dumps({"batch_stamp": stamp, "inserted": total})})
    return total
