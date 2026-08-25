"""TEL-001/TEL-002/XC-011 — machine-credential ingestion, staleness TTL,
plausibility contradictions, idempotent re-ingest (DB-006)."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

from .conftest import auth_header, make_token

KEY = "mock_tms_source_key"


def _record(ref: str, stale: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "external_ref_id": ref,
        "department": "TRD",
        "section_code": "NDLS-GZB-UP",
        "activity_code": "OHE_CANTILEVER_ADJ",
        "min_duration_mins": 90,
        "earliest_start": (now + timedelta(days=1)).isoformat(),
        "latest_deadline": (now + timedelta(days=3)).isoformat(),
        "urgency_score": 0.7,
        "machinery_req": [],
        "features": {"contact_wire_diameter_mm": 10.0},
        "observed_at": (now - timedelta(days=2 if stale else 0)).isoformat(),
    }


def test_spoofed_source_key_rejected_401(client):
    r = client.post("/api/v1/demands/ingest",
                    headers={"X-Source-System": "TMS", "X-Source-Key": "wrong-key"},
                    json={"records": [_record("SPOOF-1")]})
    assert r.status_code == 401


def test_unknown_system_rejected_401(client):
    r = client.post("/api/v1/demands/ingest",
                    headers={"X-Source-System": "NOT_A_SYSTEM", "X-Source-Key": KEY},
                    json={"records": []})
    assert r.status_code == 401


def test_stale_record_flagged_and_fresh_ingested_then_reingest_idempotent(client):
    h = {"X-Source-System": "TMS", "X-Source-Key": KEY}
    r = client.post("/api/v1/demands/ingest", headers=h, json={
        "records": [_record("TEL-STALE-A", stale=True), _record("TEL-FRESH-B")]})
    assert r.status_code == 201
    body = r.json()
    assert body["rejected"] == 1
    assert any("stale" in d["reason"] for d in body["diagnostics"])
    assert body["ingested"] == 1

    # DB-006: re-ingesting the same external_ref must not duplicate rows.
    before = client.get("/api/v1/demands?status=SUBMITTED",
                        headers=auth_header(make_token("engineer_dli", "ENGINEER"))).json()
    count_before = sum(1 for d in before if d["external_ref_id"].startswith(("TEL-", )))
    r2 = client.post("/api/v1/demands/ingest", headers=h, json={"records": [_record("TEL-FRESH-B")]})
    assert r2.json()["ingested"] == 1
    after = client.get("/api/v1/demands?status=SUBMITTED",
                       headers=auth_header(make_token("engineer_dli", "ENGINEER"))).json()
    count_after = sum(1 for d in after if d["external_ref_id"].startswith(("TEL-", )))
    assert count_after == count_before


def test_plausibility_contradiction_rejected(client):
    rec = _record("TEL-CONTRA-C")
    rec["features"] = {"contact_wire_diameter_mm": 7.0}  # worn wire but low claimed urgency below threshold
    rec["urgency_score"] = 0.2
    r = client.post("/api/v1/demands/ingest",
                    headers={"X-Source-System": "TDMS", "X-Source-Key": "mock_tdms_source_key"},
                    json={"records": [rec]})
    assert r.status_code == 201
    assert r.json()["rejected"] == 1
    assert any("contradiction" in d["reason"] for d in r.json()["diagnostics"])
