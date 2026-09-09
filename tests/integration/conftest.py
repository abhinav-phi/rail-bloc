"""Shared fixtures for DB integration tests. Skips the module when no PostgreSQL
is reachable (e.g., unit-only runs); CI/docker runs provide DATABASE_URL_SYNC."""
from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine, text

DSN = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql+psycopg2://rail_admin:rail_secure_password@localhost:5432/railbloc_db",
)
# Host-run defaults: containers publish these ports on localhost.
os.environ.setdefault("DATABASE_URL_SYNC", DSN)
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://rail_admin:rail_secure_password@localhost:5432/railbloc_db"
)
os.environ.setdefault("REDIS_URL", "redis://:rail_redis_password@localhost:6379/0")


def _db_up() -> bool:
    try:
        eng = create_engine(DSN, connect_args={"connect_timeout": 3})
        with eng.connect() as c:
            c.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except Exception:
        return False


DB_AVAILABLE = _db_up()

pytestmark = pytest.mark.skipif(not DB_AVAILABLE, reason="PostgreSQL not reachable")


@pytest.fixture(autouse=True)
def require_db():
    """Runtime re-check: never let a transient probe false-positive turn into
    hard connection failures — skip instead."""
    if not _db_up():
        pytest.skip("PostgreSQL not reachable")


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(DSN)
    yield eng
    eng.dispose()


@pytest.fixture()
def conn(engine):
    """Autocommit-style connection for direct SQL assertions."""
    with engine.begin() as c:
        yield c


# Demands created by non-FLT integration tests (app001/safe002/e2e/ack use these
# marker prefixes; faults tests own FLT*/E2E-* through their own flt_cleanup).
_TEST_DEMANDS = """
    SELECT id FROM demands.block_demands
     WHERE external_ref_id LIKE 'APP001-%'
        OR external_ref_id LIKE 'SAFE002-%'
        OR external_ref_id LIKE 'E2E-%'
        OR external_ref_id LIKE 'IDEM-%'
        OR external_ref_id LIKE 'TX-%'
        OR external_ref_id LIKE 'ACK-%'"""
_TEST_PLANS = f"""
    SELECT p.id FROM optimization.block_plans p
     WHERE p.section_id IN (SELECT id FROM infrastructure.block_sections
                             WHERE section_code = 'NDLS-GZB-UP')
        OR p.primary_demand_id IN ({_TEST_DEMANDS})"""


@pytest.fixture(autouse=True)
def integration_cleanup(engine):
    """TASK (flake fix): app001/safe002/e2e leave AUTHORIZED/SENTINEL plans
    behind. On a persistent DB (Aiven) the next run's plan collides via
    excl_active_overlap — the constraint working, not a product bug. This
    autouse fixture removes those artifacts after every integration test so
    repeat runs are order-independent. Mirrors test_faults.flt_cleanup. Never
    touches seed data, demo plans, or the ledger (append-only, untouched)."""
    yield
    with engine.begin() as c:
        c.execute(text(f"DELETE FROM operations.signal_acknowledgments WHERE plan_id IN ({_TEST_PLANS})"))
        c.execute(text(f"DELETE FROM optimization.coa_outbox WHERE plan_id IN ({_TEST_PLANS})"))
        c.execute(text(f"DELETE FROM optimization.machine_rosters WHERE plan_id IN ({_TEST_PLANS})"))
        c.execute(text(
            f"DELETE FROM optimization.plan_shadow_demands WHERE plan_id IN ({_TEST_PLANS})"
            f" OR demand_id IN ({_TEST_DEMANDS})"))
        c.execute(text(f"DELETE FROM optimization.plan_sections WHERE plan_id IN ({_TEST_PLANS})"))
        c.execute(text(
            f"UPDATE optimization.block_plans SET supersedes_id = NULL WHERE supersedes_id IN ({_TEST_PLANS})"))
        c.execute(text(f"DELETE FROM optimization.block_plans WHERE id IN ({_TEST_PLANS})"))
        c.execute(text(f"DELETE FROM demands.block_demands WHERE id IN ({_TEST_DEMANDS})"))


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from apps.api.main import app
    with TestClient(app) as c:
        yield c
    # Release pooled asyncpg connections bound to this test's event loop so the
    # next test's loop cannot touch them ("another operation is in progress").
    import asyncio

    from apps.api.core.database import engine as app_engine
    try:
        asyncio.run(app_engine.dispose())
    except Exception:
        pass


def make_token(username: str, role: str, division: str = "DLI") -> str:
    from apps.api.core.security import create_token
    return create_token(username, role, division)


def auth_header(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}
