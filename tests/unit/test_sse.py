import asyncio
import json
from unittest.mock import AsyncMock, patch

from apps.api.services import sse


def test_sse_publish_swallows_connection_error(monkeypatch):
    mock_client = AsyncMock()
    mock_client.publish.side_effect = ConnectionError("Redis unreachable")
    monkeypatch.setattr(sse, "client", lambda: mock_client)

    # Must complete without raising an exception (fire-and-forget by design)
    with patch.object(sse.logger, "exception") as mock_log:
        asyncio.run(sse.publish("PLAN_DECISION", {"plan_id": "test-123", "status": "APPROVED"}))
        mock_log.assert_called_once()
        assert "SSE publish failed for event" in mock_log.call_args[0][0]


def test_sse_publish_success(monkeypatch):
    mock_client = AsyncMock()
    mock_client.publish.return_value = 1
    monkeypatch.setattr(sse, "client", lambda: mock_client)

    asyncio.run(sse.publish("PLAN_DECISION", {"plan_id": "test-456", "status": "APPROVED_SR_DOM"}))

    mock_client.publish.assert_awaited_once()
    channel, raw_payload = mock_client.publish.call_args[0]
    assert channel == "live_blocks"
    payload = json.loads(raw_payload)
    assert payload["event"] == "PLAN_DECISION"
    assert payload["plan_id"] == "test-456"
    assert payload["status"] == "APPROVED_SR_DOM"


def test_sse_client_caches_pool(monkeypatch):
    monkeypatch.setattr(sse, "_pool", None)
    with patch("redis.asyncio.from_url") as mock_from_url:
        mock_redis = object()
        mock_from_url.return_value = mock_redis
        c1 = sse.client()
        c2 = sse.client()
        assert c1 is mock_redis
        assert c2 is mock_redis
        mock_from_url.assert_called_once()
    monkeypatch.setattr(sse, "_pool", None)
