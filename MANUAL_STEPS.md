# RAIL-BLOC — Manual Setup Guide & Operator Runbook

> **Audience:** the developer/operator. Everything marked **AUTOMATIC** is handled by code/scripts/Docker. Everything marked **MANUAL** needs a human.
>
> **Safety Notice:** This project operates strictly in a **SIMULATED environment**. TMS, TDMS, SMMS, FOIS, COA and IMD are internal Indian Railways systems with no student-accessible API. All feeds are synthetic seeders with fixed seeds (42–44). Every synthetic UI layer carries a persistent `[SIMULATED]` watermark per `Rules.md` §5. Never connect to production credentials or live rail infrastructure. The system is **decision-support, not autonomous dispatch** — humans + COA retain final authority under G&SR.

---

## 1. What I Need to Do (High-Level Summary)

1. **MANUAL** Install prerequisites: Docker Desktop ≥ 4.30 (Engine ≥ 26), Git ≥ 2.40 (Python 3.11 / Node 20 optional).
2. **MANUAL** Configure `.env` from `.env.example`; generate `JWT_SECRET` and `POSTGRES_PASSWORD` via `openssl rand -hex`.
3. **AUTOMATIC after MANUAL start:** `docker compose up --build` brings up Postgres+PostGIS, Redis, seeder (one-shot), API, worker, beat, web.
4. Verify: `curl http://localhost:8000/health`, seeder log line, open `http://localhost:5173`.
5. **MANUAL** Run the demo playbook (§9): solve → preview card → signal acks → approve → authorize → transmit → emergency → ledger verify → modify-after-verify rejection.
6. Run tests + ledger tamper test + benchmark harness (§11).

---

## 2. Prerequisites & Verification

| Requirement | Minimum | Purpose | Verification |
|---|---|---|---|
| Docker Desktop | ≥ 4.30 (Engine ≥ 26) | Full stack | `docker --version` |
| Docker Compose | v2 (bundled) | Orchestration | `docker compose version` |
| Git | ≥ 2.40 | VCS | `git --version` |
| Python 3.11 *(optional)* | 3.11.x | Host pytest / eval runs | `python --version` |
| Node.js *(optional)* | 20 LTS | Host frontend dev | `node --version` |
| Hardware | 8 GB RAM · 4 CPU · 15 GB disk | Docker allocation ≥ 8 GB / 4 CPU | Docker Desktop → Settings → Resources |
| GPU | ❌ CPU-only | PyTorch CPU + CP-SAT CPU | N/A |

Windows WSL2 (if needed):
```powershell
wsl --install -d Ubuntu-22.04
# reboot, then:
wsl --status    # Default Version: 2
# C:\Users\<you>\.wslconfig → [wsl2] memory=8GB processors=4
```

Port availability (5432 / 6379 / 8000 / 5173 must be free):
```bash
lsof -i :5432 -i :6379 -i :8000 -i :5173                       # Linux/macOS
Get-NetTCPConnection -LocalPort 5432,6379,8000,5173 -ErrorAction SilentlyContinue   # Windows
```

Optional pre-pull (speeds first build):
```bash
docker pull postgis/postgis:16-3.4 && docker pull redis:7.2 && docker pull python:3.11-slim && docker pull node:20 && docker pull nginx:1.25-alpine
```

> **Network-filter note (seen in the field):** some networks return fake-404 for certain PyPI project index pages (observed for `or-tools`, `torch`). This repo's Dockerfiles already work around it: torch installs from the CPU wheel index, or-tools from pinned wheels in `build_wheels/`. If you ever see `No matching distribution found for or-tools>=9.9`, confirm `build_wheels/*.whl` exist before rebuilding.

---

## 3. Environment Variables Configuration

**MANUAL:** copy then edit:
```bash
cp .env.example .env && nano .env            # Linux/macOS
Copy-Item .env.example .env; notepad .env    # Windows PowerShell
```

### Critical variables (MUST generate)

```text
JWT_SECRET
→ What: HMAC secret for JWT signing (HS256)
→ Why needed: authenticates every API session (/auth/login, /auth/me, all bearer routes)
→ Generate: openssl rand -hex 32
→ Example: 9f2c8e7ab41d...64 hex chars
→ Paste into: JWT_SECRET=
→ If left default: tokens forgeable — MUST change before any shared-network demo

POSTGRES_PASSWORD
→ What: database password embedded in both DSNs
→ Why needed: all services connect through DATABASE_URL / DATABASE_URL_SYNC
→ Generate: openssl rand -hex 16   (hex only — it lives inside URLs)
→ Paste into: POSTGRES_PASSWORD= AND update DATABASE_URL and DATABASE_URL_SYNC to match
→ If left default: DB reachable with publicly-known credentials
```

### Standard defaults (safe locally)

**Infrastructure**
| Var | Default | Note |
|---|---|---|
| `API_PORT` / `API_HOST` | 8000 / 0.0.0.0 | published port mapping |
| `POSTGRES_USER` / `POSTGRES_DB` | rail_admin / railbloc_db | superuser inside container |
| `POSTGRES_HOST` / `POSTGRES_PORT` | postgres / 5432 | container DNS name |

**Auth**
| Var | Default | Note |
|---|---|---|
| `JWT_ALGORITHM` | HS256 | don't change without code review (security path) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 480 | one work-shift session |
| `SEED_PASSWORD` | railbloc | password for all 7 demo users |

**Solver parameters**
| Var | Default | Note |
|---|---|---|
| `SOLVER_MAX_TIME_SECONDS` | 35 | NFR-001 budget |
| `SOLVER_NUM_WORKERS` | 8 | CP-SAT search workers |
| `OBJECTIVE_WEIGHT_PAX_DELAY` | 10.0 | C_pax |
| `OBJECTIVE_WEIGHT_FRT_DELAY` | 4.0 | C_frt |
| `OBJECTIVE_WEIGHT_SHADOW_REWARD` | 25.0 | Ω_shadow |
| `OBJECTIVE_WEIGHT_MACHINE_IDLE` | 2.5 | C_mach |
| `OBJECTIVE_WEIGHT_UNADDRESSED_DEFECT` | 100.0 | dominates unexecuted urgent work |
| `OBJECTIVE_WEIGHT_EARLY_START` | 0.05 | tie-breaker toward earlier slots |

**Safety knobs**
| Var | Default | Note |
|---|---|---|
| `HEADWAY_HIGH_PRIORITY_MINS` | 15 | Rules §1 — do NOT lower in demos |
| `HEADWAY_DEFAULT_MINS` | 5 | non-priority trains |
| `FREIGHT_HARD_CONFIDENCE` | 0.60 | below → soft expected-delay cost |
| `EMERGENCY_SOLVE_BUDGET_SECONDS` | 35 | inside NFR-002's 45 s incl. structural check |
| `MAX_SENTINEL_RETRIES` | 3 | FSM-002 cap → FAILED_ESCALATE_HUMAN |
| `DEMAND_STALENESS_TTL_HOURS` | 12 | G&SR-3 fail-closed feed age |
| `WEATHER_STALENESS_TTL_HOURS` | 3 | TEL-002 fail-closed weather age |
| `WEEKLY_PLAN_CRON` | 0 15 * * 4 | FR-013 cadence — config, not hardcoded (XC-010) |
| `ENABLE_ML_URGENCY` | true | advisory toggle only |

**External keys — all MOCK, no real credentials required; safe as shipped**
`IMD_API_KEY=mock_imd_weather_key_railway_ops` · `INGEST_KEY_TMS/TDMS/SMMS=mock_*_source_key` · `INGEST_KEY_FOIS=FOIS_FEED_SECRET=mock_fois_freight_token` · `COA_BRIDGE_SECRET=mock_coa_dispatch_token`

*Security rule:* never commit `.env`; it is gitignored. Code-side extra knobs with sane defaults (not in `.env.example`): `BUNDLING_GAP_MINS=0`, `COA_ACK_DELAY_SECONDS=1.5`.

---

## 4. API Keys & External Credentials

**Verified against codebase: no paid cloud accounts or third-party APIs required.**

| Variable | Real or Mock | Why |
|---|---|---|
| `IMD_API_KEY` | 🔧 mock (optional real) | IMD has a public API but the adapter is mock-driven + fail-closed (TEL-002); real key is a nice-to-have only |
| `INGEST_KEY_TMS/TDMS/SMMS` | 🔧 mock | internal IR systems; keys authenticate the simulated feed paths (TEL-001 mechanism demo) |
| `INGEST_KEY_FOIS` / `FOIS_FEED_SECRET` | 🔧 mock | FOIS is IR-internal |
| `COA_BRIDGE_SECRET` | 🔧 mock | COA bridge simulated by outbox acknowledger loop |

**No real Indian Railways credentials exist or can be obtained by a student team.** Demo honesty per Rules §5.

## 5. Third-Party Dashboard & Cloud Settings
**Not applicable.** 100% local/Docker. No Supabase, no cloud storage, no testnets.

---

## 6. Docker & Infrastructure Services

```bash
docker compose up --build          # full stack (first build ~10–25 min; later cached)
docker compose run --rm seeder     # re-seed only (idempotent — safe repeatedly)
docker compose down                # stop (keeps volume)
docker compose down -v             # stop + wipe data volume (fresh start)
```

### Service Port & Health Matrix
| Container | Port | Credentials | Healthcheck |
|---|---|---|---|
| PostgreSQL 16 + PostGIS + pgcrypto | 5432 | rail_admin / `<POSTGRES_PASSWORD>` | `docker compose ps` → healthy |
| Redis 7.2 | 6379 | none | `redis-cli ping` → PONG |
| FastAPI API | 8000 | JWT bearer | `curl localhost:8000/health` → ok |
| Celery worker (+ beat) | — | — | `docker compose logs worker beat` |
| Atlas web (nginx) | 5173 | — | `curl -I localhost:5173` → HTML |
| seeder (one-shot) | — | — | log line `Seeded: 12 sections, 286 demands, 276 paths.` |

---

## 7. Database Setup, Migrations & Verification

**AUTOMATIC:** on startup, the project runs Alembic migrations before the API and workers come up. The database is initialized by `data/sql/01_init_postgis.sql` → `02_schema_ddl.sql` → `03_ledger_triggers.sql` on first boot, then the `migrate` service applies the migration chain stored under `migrations/versions/`. Future schema changes should be added as new Alembic revision files and merged with the app image.

```bash
docker compose run --rm migrate             # apply pending schema migrations
alembic -c migrations/alembic.ini upgrade head  # local host equivalent
```

> If you need a clean slate, `docker compose down -v` still wipes the volume; otherwise, schema changes are applied incrementally instead of forcing a reset.

### Post-Migration Verification Queries
```bash
docker compose exec postgres psql -U rail_admin -d railbloc_db <<'SQL'
-- 1. Extensions present (SAFE-001: pgcrypto REQUIRED for digest())
SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto','postgis','btree_gist');

-- 2. Approval-status CHECK on block_plans (12 states + PROVISIONAL)
SELECT conname FROM pg_constraint
WHERE conrelid='optimization.block_plans'::regclass AND contype='c';

-- 3. ledger_writer is INSERT/SELECT-only
SELECT has_table_privilege('ledger_writer','audit.action_ledger','INSERT')  AS can_insert,
       has_table_privilege('ledger_writer','audit.action_ledger','UPDATE')  AS can_update,
       has_table_privilege('ledger_writer','audit.action_ledger','DELETE')  AS can_delete;
-- Expect: t / f / f

-- 4. EXCLUDE constraint on active plans (DB-003)
SELECT conname FROM pg_constraint
WHERE conrelid='optimization.block_plans'::regclass AND contype='x';   -- excl_active_overlap

-- 5. SAFE-002 binding columns + APP-001 approver columns exist
SELECT column_name FROM information_schema.columns
WHERE table_schema='optimization' AND table_name='block_plans'
  AND column_name IN ('content_hash','sentinel_hash','revision_no','supersedes_id',
                      'decided_by','authorized_by');

-- 6. Distinct-approver CHECK exists (APP-001/NFR-008)
SELECT conname FROM pg_constraint
WHERE conrelid='optimization.block_plans'::regclass AND conname='chk_distinct_approvers';

-- 7. append_event() exists (DB-001b — canonical write path)
SELECT proname FROM pg_proc
WHERE proname = 'append_event'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'audit');
-- Expected: one row named append_event

-- 8. Row counts (seeded values)
SELECT (SELECT count(*) FROM infrastructure.block_sections) AS sections,
       (SELECT count(*) FROM demands.block_demands)         AS demands,
       (SELECT count(*) FROM operations.train_paths)        AS train_paths,
       (SELECT count(*) FROM auth.users)                    AS users,
       (SELECT count(*) FROM audit.action_ledger)           AS ledger_rows;
SQL
```

> **Write-path rule:** all application code MUST write ledger rows via `SELECT audit.append_event(...)`, never raw `INSERT INTO audit.action_ledger`. The trigger alone is insufficient under concurrent writers — under READ COMMITTED the INSERT statement fixes its snapshot before the in-trigger lock wait ends, which forked chains in stress testing (see Schema.md change-log DB-001b).

### Ledger Tamper Test
```bash
docker compose exec postgres psql -U rail_admin -d railbloc_db -c \
  "UPDATE audit.action_ledger SET hash='tampered' WHERE seq=1;"
# Expected ERROR: audit.action_ledger is append-only: UPDATE is prohibited on sealed ledger rows

docker compose exec postgres psql -U rail_admin -d railbloc_db -c \
  "SELECT n_total, n_verified, first_broken_seq, chain_ok FROM audit.verify_ledger();"
# Expected: chain_ok = t
```

---

## 8. Multi-Termial Service Startup Guide (local dev, outside Docker)

Preferred path remains `docker compose up --build`. For host development:

```bash
# Terminal 1 — API
python -m venv .venv && source .venv/bin/activate        # Windows: .\.venv\Scripts\Activate.ps1
pip install -r apps/api/requirements.txt
export PYTHONPATH="$PWD;$PWD"                             # repo root on path (Windows uses ;)
uvicorn apps.api.main:app --reload --port 8000

# Terminal 2 — Worker + Beat (separate terminals if desired)
celery -A apps.workers.tasks:app worker --loglevel=info --concurrency=2
celery -A apps.workers.tasks:app beat  --loglevel=info

# Terminal 3 — Frontend
cd apps/web && npm install && npm run dev
```
*For the hackathon demo always use `docker compose up --build` — reproducible, clean.*

---

## 9. First Login & Demo Playbook

Bootstrap users (password = `SEED_PASSWORD`, default `railbloc`):

| Username | Role | Division | Demo purpose |
|---|---|---|---|
| admin | ADMIN | DLI | trigger solves; system admin |
| srdom_dli | SR_DOM | DLI | approve (Action Preview Card) |
| drm_dli | DRM | DLI | authorize (distinct from Sr. DOM) |
| controller_dli | CONTROLLER | DLI | P0 emergency; PROVISIONAL ack; transmit |
| engineer_dli | ENGINEER | DLI | manual BDMS upload; fitness certification |
| sm_dli | STATION_MASTER | DLI | G&SR-2 SM acknowledgment |
| auditor | AUDITOR | DLI | ledger verification |

### Demo Playbook (13 steps)
```bash
API=http://localhost:8000/api/v1
jqj() { python -c "import sys,json;print(json.load(sys.stdin)$1)"; }

# 1. Login (repeat per role)
TOKEN=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" \
  -d '{"username":"srdom_dli","password":"railbloc"}' | jqj '["access_token"]')

# 2. Trigger weekly solve (admin or srdom)
TASK=$(curl -s -X POST $API/optimize/solve -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"horizon":"WEEKLY","division":"DLI"}' | jqj '["task_id"]')

# 3. Poll until COMPLETED
curl -s $API/optimize/status/$TASK -H "Authorization: Bearer $TOKEN"

# 4. List produced plans
curl -s "$API/plans/weekly?division=DLI" -H "Authorization: Bearer $TOKEN"
PLAN=<pick an id from output>

# 5. Action Preview Card data
curl -s $API/plans/$PLAN -H "Authorization: Bearer $TOKEN"
curl -s $API/plans/$PLAN/sentinel-report -H "Authorization: Bearer $TOKEN"   # 10 named checks

# 6. S&T plan stuck at DRAFT? acknowledge as BOTH roles:
curl -s -X POST $API/plans/$PLAN/acknowledge-signal -H "Authorization: Bearer $SM_TOKEN" \
  -H "Content-Type: application/json" -d '{"as_role":"STATION_MASTER"}'
curl -s -X POST $API/plans/$PLAN/acknowledge-signal -H "Authorization: Bearer $CTL_TOKEN" \
  -H "Content-Type: application/json" -d '{"as_role":"CONTROLLER"}'      # → SENTINEL_PASSED

# 7. Approve (Sr. DOM) — signature + idempotency key REQUIRED
curl -s -X POST $API/approvals/decide -H "Authorization: Bearer $SRDOM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"plan_id\":\"$PLAN\",\"decision\":\"APPROVE\",\"signature\":\"sig-demo-$PLAN\",\"idempotency_key\":\"demo-approve-$PLAN\"}"

# 8. Authorize (DRM — different user!)
curl -s -X POST $API/approvals/decide -H "Authorization: Bearer $DRM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"plan_id\":\"$PLAN\",\"decision\":\"APPROVE\",\"signature\":\"sig-drm-$PLAN\",\"idempotency_key\":\"demo-authz-$PLAN\"}"

# 9. Transmit at T−2h (structural re-check runs server-side); bridge acks within ~2 s
curl -s -X POST $API/plans/$PLAN/transmit -H "Authorization: Bearer $CTL_TOKEN"

# 10. P0 emergency (needs confirmation=true; blast radius first!)
curl -s "$API/emergency/blast-radius?section_id=$SECTION&estimated_duration_mins=90" -H "Authorization: Bearer $CTL_TOKEN"
curl -s -X POST $API/emergency/breakdown -H "Authorization: Bearer $CTL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"section_id\":\"$SECTION\",\"breakdown_type\":\"TRACK_FRACTURE\",\"estimated_duration_mins\":90,\"confirmation\":true,\"idempotency_key\":\"emg-demo-1\"}"
curl -s -X POST $API/emergency/incidents/<incident_id>/acknowledge -H "Authorization: Bearer $CTL_TOKEN"

# 11. Modify-after-verify rejection (SAFE-002 proof): mutate times via revise, then try approving OLD plan → 409
curl -s -X POST $API/plans/$OLD_PLAN/revise -H "Authorization: Bearer $ENG_TOKEN" \
  -H "Content-Type: application/json" -d '{"start_time":"2026-09-01T01:00:00Z","end_time":"2026-09-01T05:00:00Z"}'

# 12. Ledger verify (auditor)
curl -s $API/ledger/verify -H "Authorization: Bearer $AUD_TOKEN"

# 13. Ledger tamper test (SQL) → expect ERROR (see §7)
```

## 10. Interactive Failure-Injection Proofs
| Proof | Sequence | Expected |
|---|---|---|
| SAFE-002 | revise a SENTINEL_PASSED plan (step 11) → decide APPROVE on old id | HTTP 409 `HASH_MISMATCH` |
| APP-001 | issue DRM token for the SAME username that approved → decide APPROVE | HTTP 403 distinct-approver violation |
| SAFE-003 | breakdown w/o `confirmation:true` → 400; with it → PROVISIONAL ≤45 s (measured wall time returned) | plan `PROVISIONAL`, transmission blocked until ack |
| DB-001 | SQL UPDATE/DELETE on action_ledger | guard-trigger exception |
| UX-001 | stop redis (`docker compose stop redis`) while Atlas open | persistent STALE DATA overlay; action buttons disabled |
| G&SR-3 | `pytest tests/integration/test_faults.py` | PG backend kill rolls back everything; Redis-down never blocks authorization |

## 11. Testing, Quality & Security Verification Commands
```bash
pytest -q                                        # whole suite (DB suites auto-skip w/o DB)
pytest tests/unit tests/integration -q           # explicit split
pytest tests/unit/test_sentinel.py -q            # Sentinel property suite
pytest tests/integration/test_faults.py -q       # fault-injection proofs (F1–F4)
cd apps/web && npm run build                     # strict TS gate
PYTHONPATH=. python -m apps.eval.benchmark --weeks 1    # measured B0/B1/RB cell (cite output!)
PYTHONPATH=. python -m apps.eval.calibrate              # ECE + sensitivity (cite output!)
```

## 12. Manual vs Automatic Responsibility Matrix

| Task | MANUAL | AUTOMATIC |
|---|---|---|
| Install Docker/Git; generate secrets; edit `.env` | ✅ | — |
| Start services (`up --build`) | command | ✅ orchestration |
| Migrations 01/02/03 + extensions | — | ✅ entrypoint init |
| Seed 12/286/276 + weather + 7 users | — | ✅ seeder (idempotent) |
| Per-source credential checks (TEL-001) | — | ✅ ingest router |
| CP-SAT solve (warm-started) | — | ✅ worker task |
| Sentinel validation | — | ✅ pure library |
| content_hash/sentinel_hash binding | — | ✅ lifecycle service |
| Distinct-approver enforcement | — | ✅ CHECK + router |
| Idempotency replay protection | — | ✅ audit.idempotency_keys |
| Ledger sealing + tamper prevention | — | ✅ triggers + append_event |
| COA ack-gated TRANSMITTED_COA | — | ✅ outbox bridge loop |
| Emergency coalescing/revoke/PROVISIONAL | — | ✅ Emergency Service |
| `[SIMULATED]` watermark / STALE overlay | — | ✅ Atlas UI |
| Signal acknowledgments (G&SR-2) | ✅ SM + Controller clicks | gating automatic |
| Sr. DOM approval / DRM authorization / Controller ack | ✅ humans | hash/idempotency checks automatic |
| Ledger verification | ✅ auditor triggers | ✅ SQL function |
| Demo rehearsal | ✅ practice | — |

## 13. One-Time Setup vs Daily Development

```bash
# ONE-TIME (new machine)
git clone https://github.com/<you>/rail-bloc.git && cd rail-bloc
cp .env.example .env
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 16   # → POSTGRES_PASSWORD (+ fix both DSNs)
docker compose up --build && curl localhost:8000/health

# DAILY
docker compose up -d
docker compose run --rm seeder       # optional re-seed
pytest -q                            # tests (host) or docker compose exec api pytest -q
docker compose logs -f api worker    # tail
docker compose down                  # evening
```

## 14. Troubleshooting Engine

| Symptom | Root cause | Fix | Verify |
|---|---|---|---|
| `function digest(...) does not exist` | pgcrypto missing (SAFE-001) | fresh volume: `down -v && up --build` | ext query §7.1 |
| Build fails: `No matching distribution found for or-tools` | network filter on PyPI index pages | ensure `build_wheels/*.whl` present (repo ships them); rebuild | image builds green |
| Build hangs on torch | slow wheel download | wait; or pre-pull base images | build completes |
| Port 5432/6379/8000/5173 busy | local service conflict | stop service or remap in compose | ports free |
| `401 Unauthorized` everywhere | JWT_SECRET changed after boot | `down && up --build` (re-read env) | login works |
| `409` on `/optimize/solve` | division/horizon solve lock held (TTL 300 s) | wait, or `redis-cli DEL solve:DLI:WEEKLY` | 202 QUEUED |
| `409 HASH_MISMATCH` on decide/transmit | plan mutated post-Sentinel (SAFE-002 working) | create revision via `/revise`, redo chain | new rev at DRAFT |
| `403` on DRM authorize | same actor as Sr. DOM (APP-001 working) | use different DRM account | AUTHORIZED_DRM |
| `ERROR: ... append-only ... UPDATE prohibited` | ledger guard trigger (DB-001 working) | INSERT only | tamper test passes |
| Atlas shows STALE DATA overlay | SSE dropped / Redis stopped | restart redis; EventSource reconnects | overlay clears |
| Seeder duplicates rows | shouldn't happen — upsert keys | `docker compose run --rm seeder` | counts unchanged |
| Integration tests skip | no reachable DB | set `DATABASE_URL_SYNC`, start postgres | tests run |
| Solver returns INFEASIBLE often | windows vs traffic too tight for scenario | inspect stats json; widen demand windows | FEASIBLE/OPTIMAL |
| `docker info` fails with `npipe ... cannot find` | Docker Desktop daemon not running (crashed or never started) | Start the Docker Desktop app manually; wait for the whale icon; if it crashes repeatedly check `wsl --status` and BIOS virtualization | `docker info` returns Server information |
| Phantom `FLT*` divisions appear in UI after fault tests | fault-test pollution — tests leave throwaway divisions/sections with no teardown | `docker compose exec postgres psql -U rail_admin -d railbloc_db -c "DELETE FROM demands.block_demands WHERE section_id IN (SELECT id FROM infrastructure.block_sections WHERE division LIKE 'FLT_%'); DELETE FROM optimization.block_plans WHERE section_id IN (SELECT id FROM infrastructure.block_sections WHERE division LIKE 'FLT_%'); DELETE FROM infrastructure.block_sections WHERE division LIKE 'FLT_%';"` | `SELECT count(*) FROM infrastructure.block_sections WHERE division LIKE 'FLT_%';` → 0 |
| SSE endpoint `/stream/live-blocks` returns HTTP 500 on connect | Redis down at connect time (graceful degradation exists only on the publish side, not connect side) | `docker compose start redis`, then refresh the Atlas page | SSE connects; STALE overlay clears within ~30 s |

## 15. Blocker & Impact Reference Table

| If you skip… | What breaks |
|---|---|
| pgcrypto extension | digest() undefined → every ledger insert fails → approvals/plans blocked chain-wide |
| JWT_SECRET generation | forgeable tokens on shipped default |
| POSTGRES_PASSWORD generation | known-credential DB access; DSN mismatch pain if half-changed |
| Seeder | empty network/users → login impossible |
| Worker/beat containers | solves queue forever; weekly cadence dead; escalations never fire |
| Signal acknowledgments | every S&T plan stuck DRAFT (G&SR-2 pending) — correct behaviour, not a bug |
| Distinct-approver discipline | self-authorization attempt → 403 now, and even raw SQL hits the CHECK |

## 16. TL;DR — Start Everything From Scratch (copy-paste)

```bash
git clone https://github.com/<your-username>/rail-bloc.git && cd rail-bloc
cp .env.example .env
openssl rand -hex 32   # → JWT_SECRET=
openssl rand -hex 16   # → POSTGRES_PASSWORD= (+ update DATABASE_URL & DATABASE_URL_SYNC)

docker compose up --build          # 10–25 min first time
curl http://localhost:8000/health  # {"status":"ok"}
docker compose logs seeder | tail -1
open http://localhost:5173         # login srdom_dli / railbloc — everything [SIMULATED]

pytest -q                          # evidence suite (with DB env set)
docker compose exec postgres psql -U rail_admin -d railbloc_db -c \
  "UPDATE audit.action_ledger SET hash='x' WHERE seq=1;"   # → ERROR = guards alive
PYTHONPATH=. python -m apps.eval.benchmark --weeks 1       # measured KPI cell
```

*System operational at `http://localhost:5173`. All data `[SIMULATED]`. Governing principle: ML estimates; CP-SAT decides; Sentinel verifies; humans authorize; COA executes.*
