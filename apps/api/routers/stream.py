"""SSE live-block stream (FR-036 / TechSpec §4). Token via query param (EventSource
cannot set headers); re-authentication happens on every reconnect. Heartbeat lapses
drive the client's persistent STALE DATA overlay."""
from __future__ import annotations
import asyncio
import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from ..core.security import actor_from_query
from ..services import sse

router = APIRouter(prefix="/api/v1/stream", tags=["stream"])
HEARTBEAT_SECONDS = 10


@router.get("/live-blocks")
async def live_blocks(request: Request, token: str | None = None):
    actor = actor_from_query(request) if not token else None
    if actor is None and token:
        from ..core.security import decode_token
        try:
            actor = decode_token(token)
        except HTTPException:
            actor = None
    if actor is None:
        raise HTTPException(401, "valid token required (query param `token`)")

    async def gen():
        pubsub = sse.client().pubsub()
        await pubsub.subscribe(sse._channel)
        try:
            yield f"data: {json.dumps({'event': 'CONNECTED', 'actor': actor.username})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True),
                                                 timeout=HEARTBEAT_SECONDS)
                except asyncio.TimeoutError:
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
