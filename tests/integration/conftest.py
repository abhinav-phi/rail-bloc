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
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")


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
