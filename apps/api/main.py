"""RAIL-BLOC FastAPI gateway (ADR-001 modular monolith). Includes the COA outbox
bridge loop (SAFE-006) started on startup."""
from __future__ import annotations
import asyncio
import contextlib
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.database import SessionLocal, ping
from .core.config import settings
from .services import coa_adapter
from .routers import auth, demands, optimize, plans, approvals, emergency, ledger, stream, weather, operations


async def outbox_bridge_loop() -> None:
    """Simulated COA bridge: acknowledges outbox rows after a round-trip delay.
    TRANSMITTED_COA is only ever set here, on acknowledgment — never on send."""
    while True:
        try:
            async with SessionLocal() as session:
                await coa_adapter.process_outbox(session, settings.coa_ack_delay_seconds)
                await session.commit()
        except Exception:
            pass
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
