"""SSE live-block stream (FR-036 / TechSpec §4). The client authenticates with a
short-lived one-time ticket instead of the full JWT in the URL. Heartbeat lapses
drive the client's persistent STALE DATA overlay."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..core.security import Actor, actor_from_query, actor_from_ticket, get_actor, issue_stream_ticket
from ..services import sse

router = APIRouter(prefix="/api/v1/stream", tags=["stream"])
HEARTBEAT_SECONDS = 10


@router.get("/issue-ticket")
async def issue_ticket(actor: Actor = Depends(get_actor)):
    return {"ticket": issue_stream_ticket(actor)}


@router.get("/live-blocks")
async def live_blocks(request: Request):
    actor = actor_from_query(request)
    if actor is None:
        raise HTTPException(401, "valid ticket required")

    # Fail-closed at connect time too: an unreachable Redis must yield 503 (whose
    # EventSource onerror fires the client's STALE overlay), never a crash 500.
    try:
        pubsub = sse.client().pubsub()
        await pubsub.subscribe(sse._channel)
    except Exception as exc:
        raise HTTPException(503, f"live feed temporarily unavailable: {type(exc).__name__}")

    async def gen():
        try:
            yield f"data: {json.dumps({'event': 'CONNECTED', 'actor': actor.username})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True),
                                                 timeout=HEARTBEAT_SECONDS)
                except TimeoutError:
                    msg = None
                if msg is None:
                    yield ": heartbeat\n\n"
                    continue
                yield f"data: {msg['data']}\n\n"
        finally:
            await pubsub.unsubscribe(sse._channel)
            await pubsub.close()

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
