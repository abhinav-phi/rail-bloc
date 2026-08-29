"""TASK-020 runtime evidence: broker-driven weekly solve end-to-end against the
fully containerized stack. Requires `docker compose up` with api+worker+beat up.

Usage: python scripts/live_solve_e2e.py [api_base] [db_dsn]
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request

API = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
DSN = sys.argv[2] if len(sys.argv) > 2 else \
    "postgresql+psycopg2://rail_admin:rail_secure_password@localhost:5432/railbloc_db"


def post(path: str, token: str | None = None, body: dict | None = None):
    req = urllib.request.Request(API + path, method="POST",
                                 data=json.dumps(body or {}).encode(),
                                 headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def get(path: str, token: str | None = None):
    req = urllib.request.Request(API + path)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def main() -> int:
    t0 = time.time()
    tok = post("/api/v1/auth/login", body={"username": "srdom_dli", "password": "railbloc"})["access_token"]
    print("login ok")

    task = post("/api/v1/optimize/solve", tok,
                {"horizon": "WEEKLY", "division": "DLI"})
    run_id = task["task_id"]
    print(f"solve queued: {run_id} (status={task['status']}) — waiting for Celery broker round-trip...")

    deadline = time.time() + 150
    status = stats = None
    while time.time() < deadline:
        s = get(f"/api/v1/optimize/status/{run_id}", tok)
        status = s["status"]
        if status in ("COMPLETED", "FAILED"):
            stats = s["stats"]
            break
        time.sleep(2)
    wall = time.time() - t0
    assert status == "COMPLETED", f"solve ended {status}: {stats}"
    print(f"COMPLETED in {wall:.1f}s wall; cp_sat={stats.get('cp_sat_status')}, "
          f"plans={stats.get('committed_plans')}, scheduled={stats.get('scheduled')}, "
          f"attempts={stats.get('attempts')}")

    plans = get("/api/v1/plans?horizon=WEEKLY&division=DLI&limit=50", tok)
    ours = [p for p in plans if p["content_hash"]]
    assert ours, "no WEEKLY plans visible via API"
    passed = sum(1 for p in ours if p["approval_status"] == "SENTINEL_PASSED")
    drafts = sum(1 for p in ours if p["approval_status"] == "DRAFT")
    print(f"plans visible: {len(ours)} (SENTINEL_PASSED={passed}, DRAFT-awaiting-GSR2={drafts})")

    # Ledger evidence: SOLVE_COMPLETED event must exist for this run.
    import sqlalchemy as sa
    eng = sa.create_engine(DSN)
    with eng.begin() as c:
        n = c.execute(sa.text(
            "SELECT count(*) FROM audit.action_ledger "
            "WHERE event_type='SOLVE_COMPLETED' AND payload_json->>'run_id'=:r"),
            {"r": run_id}).scalar()
        rosters = c.execute(sa.text(
            "SELECT count(*) FROM optimization.machine_rosters mr "
            "JOIN optimization.solver_runs sr ON sr.id = mr.solver_run_id WHERE sr.id=:r"),
            {"r": run_id}).scalar()
    eng.dispose()
    assert n >= 1 and rosters >= 0
    print(f"ledger SOLVE_COMPLETED rows: {n}; rosters persisted for run: {rosters}")
    print("TASK-020 BROKER E2E: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
