"""RAIL-BLOC FastAPI gateway (ADR-001 modular monolith). Includes the COA outbox
bridge loop (SAFE-006) started on startup."""
from __future__ import annotations

import asyncio
import contextlib
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy import text

from .core.config import settings
from .core.database import SessionLocal, ping
from .core.logging import get_logger
from .core.metrics import OUTBOX_PENDING, REQUESTS_TOTAL
from .routers import approvals, auth, demands, emergency, ledger, operations, optimize, plans, stream, weather
from .services import coa_adapter

logger = get_logger("api")


async def outbox_bridge_loop() -> None:
    """Simulated COA bridge: acknowledges outbox rows after a round-trip delay.
    TRANSMITTED_COA is only ever set here, on acknowledgment — never on send."""
    while True:
        try:
            async with SessionLocal() as session:
                await coa_adapter.process_outbox(session, settings.coa_ack_delay_seconds)
                await session.commit()
                OUTBOX_PENDING.set((await session.execute(
                    text("SELECT count(*) FROM optimization.coa_outbox WHERE state='PENDING'"))).scalar() or 0)
        except Exception as exc:
            logger.exception("outbox bridge iteration failed: %s", exc)
        await asyncio.sleep(2.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(outbox_bridge_loop())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="RAIL-BLOC API", version="1.1.0",
              description="Post-audit hardened block planning system (SIH26027)",
              lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    REQUESTS_TOTAL.labels(request.method, request.url.path, str(response.status_code)).inc()
    logger.info("request_completed", extra={"request_id": request_id, "method": request.method,
                                             "path": request.url.path, "status": response.status_code,
                                             "duration_ms": round(duration_ms, 1)})
    return response


for r in (auth, demands, optimize, plans, approvals, emergency, ledger, stream, weather, operations):
    app.include_router(r.router)


@app.get("/health")
async def health():
    db_ok = True
    try:
        await ping()
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok, "version": "1.1.0"}


@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
