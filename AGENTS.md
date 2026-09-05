# AGENTS.md — Operating Manual for Coding Agents

This file orients AI coding agents (and humans pairing with them) working in the RAIL-BLOC repository. Read it fully before making changes. It complements, and never overrides, the canonical docs in `docs/`.

---

## 1. What this project is

RAIL-BLOC (SIH26027) is an AI-powered automatic block-planning system for Indian Railways. Departmental maintenance demands go in; optimized, safety-checked maintenance block plans come out; every mutation lands in a tamper-evident audit ledger.

The pipeline is five packages with a deliberately adversarial relationship:

```
Nexus (ingestion, fail-closed) ──► Optima (CP-SAT solver + VRP rostering)
        ──► Sentinel (10 deterministic G&SR/MILP checks, independent)
        ──► Plan Lifecycle (hash-bound approvals: Sr.DOM → DRM → COA)
        ──► Chronicle (SHA-256 hash-chained ledger, append-only)
```

**Optima proposes; Sentinel disposes.** The solver never self-verifies. Preserve this separation in every change.

## 2. Repository layout

| Path | What it is |
|---|---|
| `apps/api/` | FastAPI gateway (routers, services, core config/security/logging) |
| `apps/workers/` | Celery worker + beat (weekly solve, T-2h recheck, weather/forecast polls) |
| `apps/web/` | Atlas console — Next.js 13 app-router, static export, Radix UI + Tailwind + MapLibre |
| `packages/core/` | Shared Pydantic models |
| `packages/optima/` | CP-SAT formulations, greedy heuristic, VRP rostering, objectives |
| `packages/sentinel/` | Independent validator: G&SR-1..5, MILP-C1..C5 checks, context builders |
| `packages/chronicle/` | Ledger verification (runs inside PostgreSQL for serialization parity) |
| `packages/ml/` | Degradation model + freight forecaster |
| `data/sql/` | Base DDL (fresh installs) — schema *changes* go through Alembic |
| `data/generators/` | Fixed-seed synthetic data (seeds: 42 corridor, 44 weather, 52 timetable, 53 freight) |
| `migrations/` | Alembic migrations |
| `tests/unit/`, `tests/integration/` | Pytest suites; integration tests auto-skip without PostgreSQL |
| `docs/` | 9 canonical numbered docs + Summary.md (PRD, TechSpec, Schema, Tracker, …) |
| `scripts/` | Ledger stress/probe, live E2E solve, stack smoke |
| `build_wheels/` | Pinned wheels for PyPI-filtered networks — **intentionally tracked, do not delete** |

## 3. Essential commands

```bash
# Backend tests (integration tests skip themselves if PostgreSQL is unreachable)
python -m pytest tests -q

# Host-run: point at published container ports (see .env)
export DATABASE_URL_SYNC="postgresql+psycopg2://rail_admin:rail_secure_password@localhost:5432/railbloc_db"
export DATABASE_URL="postgresql+asyncpg://rail_admin:rail_secure_password@localhost:5432/railbloc_db"
export REDIS_URL="redis://:rail_redis_password@localhost:6379/0"

# Lint / types
ruff check .
mypy packages apps   # configured in pyproject.toml

# Frontend (Next.js static export)
cd apps/web
npm install --legacy-peer-deps   # required: pinned Radix/React versions
npm run typecheck && npm run test && npm run build

# Full stack (Postgres+PostGIS, Redis, migrate, seed, api, worker, beat, web)
docker compose up --build
docker compose ps        # all services should report healthy
```

## 4. Environment gotchas (host vs container)

- Compose services use hostnames (`postgres`, `redis`); host-run tests need `localhost` + published ports (5432, 6379). The `.env` ships container values; export localhost overrides as shown above.
- Redis requires the password from `REDIS_PASSWORD` (`rail_redis_password`).
- Frontend `npm install` needs `--legacy-peer-deps` on some pinned versions.
- Windows hosts: run everything from Git Bash; Docker Desktop must be running for compose.

## 5. Non-negotiable invariants (breaking these is a rejected PR)

1. **Sentinel independence**: never move Sentinel logic into the solver, never let solver output skip validation, never weaken a check to make a test pass. If a check has a false positive, fix the *data or model*, and document why in the PR.
2. **`content_hash` sealing**: the hash binds section + window + demand set (see `packages/sentinel/canonical hashing`). Anything that mutates a verified plan must supersede it — new revision, new hash, re-approval from DRAFT. Superseding must clear the old sentinel verdict.
3. **`TRANSMITTED_COA` only on acknowledgment** — never on send. The COA outbox bridge is the only place that state is set.
4. **Ledger is append-only**: writes only via `audit.append_event()` (advisory-locked). No service code may UPDATE/DELETE ledger rows. Guard triggers exist; do not drop them in migrations.
5. **Fail-closed ingestion**: stale/contradicted feeds are rejected with diagnostics; weather defaults to defer-not-assume. Never "gracefully assume" missing operational data.
6. **Distinct approvers**: Sr. DOM and DRM must be different humans, enforced at the DB layer. Never bypass for convenience (including in tests — use two seeded users).
7. **Idempotency keys are mandatory** on effectful endpoints (emergency, approve/authorize/transmit).
8. **Honest status (Rules.md R6.6)**: never mark a Tracker/Summary item done without cited evidence. Write "verified: <how>" or leave it open. This rule outranks looking good.

## 6. When changing things

- **Schema**: add an Alembic revision in `migrations/versions/` (compose applies `upgrade head` before seeding). Edit `data/sql/02_schema_ddl.sql` only for *fresh-install* parity — keep both consistent.
- **Sentinel checks**: change check logic only with a matching unit test in `tests/unit/test_sentinel.py` and, if it affects a lifecycle transition, an integration test. Every check has a `CheckID` — do not renumber.
- **API**: routers validate roles via `require_roles(...)`, divisions via `actor.division`; async SQLAlchemy with `text()` queries — always bind parameters, never f-string SQL (except the two role_field interpolations in `acknowledge-signal`, which are whitelist-controlled).
- **Frontend**: TypeScript strict; components under `apps/web/app` + `apps/web/components`; API client in `apps/web/lib/api.ts` (attaches JWT, parses claims); live SSE via one-time tickets (`lib/live.ts`). Add vitest tests for new components; ErrorBoundary already wraps the tree.
- **Docs are load-bearing**: `docs/7__Tracker.md` and `docs/Summary.md` are the source of truth for status. If your change makes a doc claim stale, update the doc in the same PR.

## 7. Verification expectations

- Any Python change: `ruff check .` + full `pytest` locally (unit suite always runs; integration needs the two containers up).
- Any TS change: `typecheck` + `test` + a production `build` (static export catches more than dev mode).
- Anything touching solve/validate: run `scripts/live_solve_e2e.py` against a booted stack before claiming success.
- CI (`.github/workflows/ci.yml`) must be green on your branch before merge. CI runs the integration suite against real PostgreSQL 16/PostGIS + Redis services — a locally-skipped suite is still your responsibility to run once with DB up.

## 8. Style

- Python: 3.11+, type hints on public functions, `from __future__ import annotations`, ruff-clean (isort via ruff), docstrings that explain *why* where the code can't show it.
- TS: strict, function components, no `any` escape hatches without a comment justifying it.
- Commit subjects: `<type>(<scope>): <imperative>` (e.g. `fix(sentinel): key acks by content_hash`); reference tracked issues (`Fixes #NN`) in the body.
