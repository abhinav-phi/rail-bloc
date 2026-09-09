# 🚀 RAIL-BLOC — Deployment Guide (LIVE — SIH final submission)

**This is the single, current deployment story. The older Oracle/DuckDNS path is
superseded and no longer describes production.**

## Live URLs

| Component | URL | Status |
|---|---|---|
| Frontend (Atlas console) | https://railbloc.vercel.app | 200 |
| Backend API | https://api-production-7dc0.up.railway.app | 200 |
| Health endpoint | https://api-production-7dc0.up.railway.app/health | `{"status":"ok","db":true,"version":"1.1.0"}` |
| API explorer (Swagger) | https://api-production-7dc0.up.railway.app/docs | 200 |

## Architecture (as deployed 2026-09-09)

```
Judge/anyone ──► https://railbloc.vercel.app        (Vercel, Next.js static export)
                       │  apps/web/vercel.json rewrites /api/*
                       ▼
            https://api-production-7dc0.up.railway.app   (Railway, public domain → port 8000)
                       │
            Railway project "railbloc" (3 services, all Dockerfile apps/api/Dockerfile)
            ├─ api     — uvicorn apps.api.main:app (healthcheck /health)
            ├─ worker  — celery -A apps.workers.tasks:app worker (solver + ML)
            └─ beat    — celery -A apps.workers.tasks:app beat (weekly/monthly crons)
                       │
            ├─ PostgreSQL 18.6 + PostGIS 3.6.4  → Aiven (external, always-on)
            ├─ Redis (broker + revocation list) → Upstash (external, rediss:// TLS, Mumbai)
            └─ Monitoring                        → cron-job.org job 8413649
                                                   (5-min GET /health, failure email alerts)
```

**ML is ON** (`ENABLE_ML_URGENCY=true`): the worker loads the degradation model;
live solve evidence — `ml_updated: 39` in `solver_runs.stats`.

## Why this shape

- **Vercel**: static export serves from the edge; `/api/*` rewrite means the
  frontend code keeps using relative URLs — zero frontend-code changes.
- **Railway**: three always-on services (api/worker/beat) on 2 vCPU / 1 GB each;
  the solver env is tuned for the 2-vCPU burst (`SOLVER_NUM_WORKERS=2`,
  `SOLVER_MAX_TIME_SECONDS=60`).
- **Aiven**: PostGIS 3.6.4 verified on the free plan (`CREATE EXTENSION postgis
  / pgcrypto / btree_gist` all pass); DB is ~20 MB seeded.
- **Upstash**: Celery broker over `rediss://` with `ssl_cert_reqs=required`
  (lowercase flag — redis-py rejects the `CERT_REQUIRED` spelling).
- **cron-job.org**: Railway never sleeps, so this is pure failure alerting, not
  keep-alive.

## Verified end-to-end (evidence, 2026-09-09)

- `POST /api/v1/auth/login` through the Vercel proxy → 200, SR_DOM/DLI JWT.
- **Live solve through the public URL**: run `COMPLETED`, **53 block plans
  committed (25 SENTINEL_PASSED + 28 DRAFT)**, first-attempt FEASIBLE,
  `ml_updated: 39` — recorded in Aiven `optimization.solver_runs`.
- **SSE through the Vercel rewrite**: `EventSource` opened (readyState 1) and
  real frames flowed — `CONNECTED` + `SIGNAL_ACK` received page-side after a
  `POST /plans/{id}/acknowledge-signal` (playwright-core headless probe).
- Ledger: `/api/v1/ledger/verify` → `chain_ok: true, 64/64 verified`.
- cron-job.org first run SUCCESS (1340 ms against `/health`).

## Repo deploy artifacts

- `apps/api/Dockerfile` — single image for api/worker/beat (torch CPU + or-tools
  wheels with PyPI fallback); start commands differ per Railway service.
- `apps/web/vercel.json` — `/api/*` rewrite → Railway URL; `.npmrc`
  `legacy-peer-deps=true` for Vercel installs.
- `railway.json` is a **local, untracked** helper for `railway up` CLI deploys —
  never commit it.
- `deploy/docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/deploy_vm.sh` —
  the older VM-path artifacts, kept for reference only; **not in use**.

## Local development (unchanged)

```bash
docker compose up --build        # full stack on localhost (API_PORT from .env, default 8290)
python -m pytest tests -q        # unit always run; integration auto-skip w/o DB
```

Seeded personas (password `railbloc`): `srdom_dli`, `drm_dli`, `sm_dli`,
`controller_dli`, `engineer_dli`, `auditor`, `admin`.

## Ops notes

- **Pre-demo warm-up**: trigger one solve a few minutes before demoing
  (`POST /api/v1/optimize/solve` as `srdom_dli`) so the first judge-visible solve
  is not a cold start.
- **Escalated demands**: a failed solve escalates its demands
  (`ESCALATED_OVERDUE`); reset via `UPDATE demands.block_demands SET
  status='SUBMITTED'` and re-solve — ledger-safe, append-only untouched.
- **Deploys**: push to `main` → Vercel auto-builds the frontend (Root Directory
  `apps/web`); Railway services redeploy via dashboard/CLI (`railway up`).
