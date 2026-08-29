"""Prometheus metrics shared by the API and worker processes.

Counters live in one module so both entrypoints increment the same series
without importing each other; each process exposes its own /metrics payload.
"""
from prometheus_client import Counter, Gauge

REQUESTS_TOTAL = Counter("railbloc_requests_total", "HTTP requests", ["method", "path", "status"])
SOLVES_TOTAL = Counter("railbloc_solves_total", "Total solves processed", labelnames=("status",))
PLANS_CREATED_TOTAL = Counter("railbloc_plans_created_total", "Total plans created")
OUTBOX_PENDING = Gauge("railbloc_outbox_pending", "Pending outbox rows")
