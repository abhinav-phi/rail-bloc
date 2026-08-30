"""RAIL-BLOC FastAPI gateway (ADR-001 modular monolith). Includes the COA outbox
bridge loop (SAFE-006) started on startup."""
from __future__ import annotations

import asyncio
import contextlib
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
<<<<<<< Updated upstream
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy import text
=======
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, generate_latest
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
>>>>>>> Stashed changes
from starlette.responses import Response

from .core.config import settings
from .core.database import SessionLocal, ping
<<<<<<< Updated upstream
from .core.logging import configure_logging, get_logger
from .core.metrics import OUTBOX_PENDING, REQUESTS_TOTAL
from .routers import approvals, auth, demands, emergency, ledger, operations, optimize, plans, stream, weather
from .services import coa_adapter

logger = get_logger("api")
=======
from .core.logging import configure_logging, logger
from .services import coa_adapter

limiter = Limiter(key_func=get_remote_address)

from .routers import approvals, auth, demands, emergency, ledger, operations, optimize, plans, stream, weather

REQUESTS_TOTAL = Counter("railbloc_requests_total", "HTTP requests", ["method", "path", "status"])
OUTBOX_PENDING = Gauge("railbloc_outbox_pending", "Pending COA outbox rows")
SOLVES_TOTAL = Counter("railbloc_solves_total", "Solver runs by terminal status", ["status"])
PLANS_CREATED_TOTAL = Counter("railbloc_plans_created_total", "Plans created by status", ["status"])
>>>>>>> Stashed changes


async def outbox_bridge_loop() -> None:
    """Simulated COA bridge: acknowledges outbox rows after a round-trip delay.
    TRANSMITTED_COA is only ever set here, on acknowledgment — never on send."""
    logger.info("COA outbox bridge started")
    while True:
        try:
            async with SessionLocal() as session:
                await coa_adapter.process_outbox(session, settings.coa_ack_delay_seconds)
                await session.commit()
                OUTBOX_PENDING.set((await session.execute(
                    text("SELECT count(*) FROM optimization.coa_outbox WHERE state='PENDING'"))).scalar() or 0)
        except Exception:
            logger.exception("COA outbox bridge iteration failed")
        await asyncio.sleep(2.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("API startup begin")
    task = asyncio.create_task(outbox_bridge_loop())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
    logger.info("API shutdown complete")


app = FastAPI(title="RAIL-BLOC API", version="1.1.0",
              description="Post-audit hardened block planning system (SIH26027)",
              lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

configure_logging()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    start = time.perf_counter()
    logger.info("request_started", extra={"request_id": request_id, "method": request.method, "path": request.url.path})
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request_failed", extra={"request_id": request_id, "method": request.method, "path": request.url.path})
        raise
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    REQUESTS_TOTAL.labels(request.method, request.url.path, response.status_code).inc()
    logger.info("request_completed", extra={"request_id": request_id, "method": request.method, "path": request.url.path,
                                             "status": response.status_code, "duration_ms": duration_ms})
    return response


for r in (auth, demands, optimize, plans, approvals, emergency, ledger, stream, weather, operations):
    app.include_router(r.router)


@app.get("/metrics")
async def metrics() -> Response:
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)


@app.get("/health")
async def health():
    db_ok = True
    try:
        await ping()
    except Exception:
        db_ok = False
        logger.warning("database health check failed")
    return {"status": "ok" if db_ok else "degraded", "db": db_ok, "version": "1.1.0"}
