# RAIL-BLOC — MANUAL PREREQUISITES & INPUTS CHECKLIST
**Strict Gate Document. No implementation resumes until every box in Part 7 is confirmed.**

Classification legend used throughout (per Rules.md §5 honesty rules):
- ✅ **AUTO** — generated automatically by the codebase/seeder. You do nothing.
- 🔧 **MANUAL-CONFIG** — a value you must set once (copy/edit). No real-world procurement needed.
- 🔑 **MANUAL-REAL** — a genuine external credential. **None of these are required for the prototype** — see Part 2.2 for why.
- ⚠️ **OPTIONAL** — only if you want to override auto-generated defaults.

---

## PART 1 — HOST MACHINE INSTALLATIONS

### 1.0 Critical fact first (read before installing anything)

The entire stack (PostgreSQL 16 + PostGIS, Redis, FastAPI, Celery worker, React web) runs **inside Docker containers**. Therefore:

| Component | Required on host? |
|---|---|
| **Docker Desktop** (or Docker Engine + Compose v2) | ✅ **MANDATORY — the only hard requirement** |
| **Git** | ✅ MANDATORY (version control of the repo) |
| Python 3.11 | ⚠️ Optional (only for editing/running eval scripts outside Docker) |
| Node.js 20 | ⚠️ Optional (only for local frontend dev; Docker builds it internally) |
| PostgreSQL/PostGIS on host | ❌ **NOT required** (runs in `postgis/postgis:16-3.4` container) |
| Redis on host | ❌ NOT required |

Do **not** install host PostgreSQL/Redis — they will cause port conflicts with the containers.

### 1.1 Hardware minimums

| Resource | Minimum | Recommended |
|---|---|---|
| RAM | 8 GB | 16 GB |
| CPU cores | 4 (Docker Desktop: allocate ≥4) | 6–8 |
| Free disk | 15 GB | 20 GB (PyTorch + OR-Tools images ≈ 5–6 GB) |
| Internet | Required for first `docker compose build` (image + wheel pulls) | — |

### 1.2 Installations & exact verification commands

Run each verification command in a **new** terminal after installing. Expected output shown. Check the box only when the command succeeds.

**A. Operating system**

| OS | Requirement | Verify |
|---|---|---|
| Windows 10 (build 19044+) / 11 | WSL2 enabled | `wsl --status` → shows "Default Version: 2" |
| macOS | 12+ (Apple Silicon or Intel) | `sw_vers` |
| Linux (Ubuntu 22.04+/Debian 12) | 64-bit | `lsb_release -a` |

Windows-only WSL2 setup if missing:
```
wsl --install -d Ubuntu-22.04
```
(Then reboot; ensure Virtualization is enabled in BIOS if `wsl --status` fails.)

Windows-only memory cap — create `C:\Users\<you>\.wslconfig`:
```
[wsl2]
memory=8GB
processors=4
```

**B. Git ≥ 2.40**

Install: https://git-scm.com (defaults are fine).

Verify:
```
git --version
```
Expected: `git version 2.4x.x` (≥ 2.40)

**C. Docker Desktop ≥ 4.30 (Engine ≥ 26.0 — matches TechSpec.md stack table)**

Install: https://www.docker.com/products/docker-desktop
- Windows: choose **"Use WSL 2 based engine"** during install.
- After install: Settings → Resources → confirm ≥ 8 GB RAM, ≥ 4 CPUs allocated to Docker.

Verify (all four must pass):
```
docker --version
```
Expected: `Docker version 26.x.x` or newer (≥ 26.0)

```
docker compose version
```
Expected: `Docker Compose version v2.2x.x` (must be v2, the `docker compose` subcommand — **not** the legacy `docker-compose` standalone binary)

```
docker run --rm hello-world
```
Expected: `Hello from Docker!` (proves daemon runs and can pull images)

```
docker run --rm postgis/postgis:16-3.4 pg_config --version
```
Expected: `PostgreSQL 16.x` (proves image pull works — also pre-caches the DB image)

**D. (OPTIONAL) Python 3.11.x — only for running eval/generator scripts outside Docker**

Install: https://python.org (3.11.x; check "Add to PATH" on Windows).

Verify:
```
python --version      (Windows)
python3 --version     (macOS/Linux)
```
Expected: `Python 3.11.x`

**E. (OPTIONAL) Node.js 20.x LTS — only for local React development**

Install: https://nodejs.org (20 LTS).

Verify:
```
node --version
npm --version
```
Expected: `v20.x.x` / `10.x.x`

### 1.3 Port availability check

The stack binds host ports **5432 (Postgres), 6379 (Redis), 8000 (API), 5173 (Web)**. A locally installed Postgres/Redis commonly conflicts on 5432/6379.

| OS | Command | Requirement |
|---|---|---|
| Linux/macOS | `lsof -i :5432 -i :6379 -i :8000 -i :5173` | No output (or only Docker processes) |
| Windows (PowerShell) | `Get-NetTCPConnection -LocalPort 5432,6379,8000,5173 -ErrorAction SilentlyContinue` | No output |

If a port is occupied: either stop the conflicting service, or tell me the ports to remap in `docker-compose.yml` **before** implementation (I will adjust bindings; this is the only code-impacting decision in this checklist).

### 1.4 First-build time budget

`docker compose up --build` pulls/builds: `python:3.11-slim` + PyTorch (~900 MB wheel) + OR-Tools + PostGIS image + Node build stage. **Expect 10–25 minutes on the first build** with normal broadband. Subsequent builds are cached. Ensure uninterrupted network for the first run.

---

## PART 2 — CREDENTIALS & CONFIGURATION VALUES

### 2.1 The one required manual file: `.env`

You create exactly **one file**: copy `rail-bloc/.env.example` → `rail-bloc/.env`, then edit only the values marked 🔧 below.

**Honesty statement (binding, per Rules.md §5):** this prototype is a closed-loop simulation. TMS, TDMS, SMMS, FOIS, COA and IMD feeds are **internal Indian Railways / IMD systems with no student-accessible API**. Every "external" credential below is therefore a locally invented mock, and the demo UI will label all data **SIMULATED**. No real credential procurement exists for this project at prototype stage.

### 2.2 Full variable inventory

**Group 1 — Infrastructure (🔧 set once; generated values recommended)**

| Variable | Real or Mock | How to produce | Example |
|---|---|---|---|
| `API_PORT` | 🔧 | Fixed | `8000` |
| `API_HOST` | 🔧 | Fixed | `0.0.0.0` |
| `POSTGRES_USER` | 🔧 | Fixed | `rail_admin` |
| `POSTGRES_PASSWORD` | 🔧 **generate** | `openssl rand -hex 16` | `a3f9c2e81b7d4f60` (hex only — no special chars, it's embedded in the DSN) |
| `POSTGRES_DB` | 🔧 | Fixed | `railbloc_db` |
| `POSTGRES_HOST` / `POSTGRES_PORT` | 🔧 | Fixed (container names) | `postgres` / `5432` |
| `DATABASE_URL` | 🔧 | Derived: `postgresql+asyncpg://<user>:<pass>@postgres:5432/railbloc_db` — must match POSTGRES_* values | — |
| `DATABASE_URL_SYNC` | 🔧 | Same with `+psycopg2` (seeder uses it) | — |

PowerShell secret generator (no openssl on Windows):
```powershell
-join ((48..57)+(97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Group 2 — Auth (🔧 generate JWT secret)**

| Variable | Real or Mock | How |
|---|---|---|
| `JWT_SECRET` | 🔧 **generate** | `openssl rand -hex 32` — must be ≥ 32 chars; never commit |
| `JWT_ALGORITHM` | 🔧 | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 🔧 | `480` |
| `SEED_PASSWORD` | 🔧 | demo password for the 7 seeded accounts (e.g. `railbloc`) — change freely; documented as demo-only |

**Group 3 — Solver / safety parameters (🔧 defaults provided; edit only for tuning)**

`SOLVER_MAX_TIME_SECONDS=35` (NFR-001), `SOLVER_NUM_WORKERS=8`, `OBJECTIVE_WEIGHT_PAX_DELAY=10.0`, `OBJECTIVE_WEIGHT_FRT_DELAY=4.0`, `OBJECTIVE_WEIGHT_SHADOW_REWARD=25.0`, `OBJECTIVE_WEIGHT_MACHINE_IDLE=2.5`, `OBJECTIVE_WEIGHT_UNADDRESSED_DEFECT=100.0`, `OBJECTIVE_WEIGHT_EARLY_START=0.05`, `FREIGHT_HARD_CONFIDENCE=0.60`, `HEADWAY_HIGH_PRIORITY_MINS=15` (Rules.md §1 — do not lower), `HEADWAY_DEFAULT_MINS=5`, `EMERGENCY_SOLVE_BUDGET_SECONDS=35`, `MAX_SENTINEL_RETRIES=3` (FSM-002 cap), `WEEKLY_PLAN_CRON=0 15 * * 4` (XC-010 — configurable cadence), `ENABLE_ML_URGENCY=true`, `DEMAND_STALENESS_TTL_HOURS=12`, `WEATHER_STALENESS_TTL_HOURS=3`.

**Group 4 — External system keys (ALL MOCK — cannot be real at prototype stage)**

| Variable | Classification | Truth |
|---|---|---|
| `IMD_API_KEY` | 🔑 **OPTIONAL-REAL / default mock** | IMD does operate a real public API (registration at mausam.imd.gov.in). The weather adapter is mock-driven and fail-closed (TEL-002); a real key is a nice-to-have for a live overlay, never required. Default: `mock_imd_weather_key_railway_ops` |
| `INGEST_KEY_TMS`, `INGEST_KEY_TDMS`, `INGEST_KEY_SMMS` | 🔧 mock | TMS/TDMS/SMMS are internal IR systems — no public access exists. Generate any random string; used only to authenticate the simulated feed scripts (TEL-001 mechanism demonstration) |
| `INGEST_KEY_FOIS` / `FOIS_FEED_SECRET` | 🔧 mock | Same — FOIS is internal to IR |
| `COA_BRIDGE_SECRET` | 🔧 mock | COA bridge is simulated by the outbox acknowledger |

**Group 5 — Summary of what is genuinely "real"**

| Category | Verdict |
|---|---|
| Real credentials you must obtain | **NONE. Zero external procurement is required to build and demo this prototype.** |
| Secrets you must generate locally | `JWT_SECRET`, `POSTGRES_PASSWORD` (2 values) |
| Values safe to keep as shipped defaults | Everything else in `.env.example` |
| Production-only real integrations (out of scope, do not attempt) | IR SSO, TMS/TDMS/SMMS/FOIS/COA endpoints, real IMD key |

**Security hygiene:** `.env` must appear in `.gitignore` (I include it); never paste real values into the repo; rotate `JWT_SECRET` if you ever demo on shared networks.

---

## PART 3 — DATASETS & INPUTS

### 3.1 Verdict up front

**Every dataset is auto-generated by the seeder with fixed seeds (42–44) and zero manual input.** The full command is:

```
docker compose up --build        # seeder container runs once, then api/worker/web start
```

or, for a re-seed: `docker compose run --rm seeder`.

### 3.2 Dataset inventory (all ✅ AUTO unless marked ⚠️)

| # | Dataset | Target table | Rows (exact) | Generator | Synthetic? |
|---|---|---|---|---|---|
| 1 | Corridor: 12 block sections, NDLS→CNB, 250 km | `infrastructure.block_sections` | 12 | `corridor_gen.corridor(seed=42)` | ✅ Synthetic, watermarked in UI |
| 2 | OHE feeding sections + mapping | `infrastructure.ohe_feeding_sections`, `section_feeding_map` | 5 + 12 | same | ✅ |
| 3 | Track machines | `infrastructure.machines` | 5 | same | ✅ |
| 4 | TMS civil demands | `demands.block_demands` (dept=ENGINEERING) | 70 (week 0) + 3×18 (weeks 1–3) = **124** | `demand_gen.gen_demands` | ✅ |
| 5 | TDMS traction demands | same (dept=TRD) | 45 + 3×12 = **81** | same | ✅ |
| 6 | SMMS signal demands | same (dept=SIGNAL_TELECOM) | 45 + 3×12 = **81** | same | ✅ |
| 7 | WTT passenger timetable | `operations.train_paths` (source=WTT) | 15 trains × 12 sections = **180** | `traffic_gen.gen_timetable(seed=52)` | ✅ |
| 8 | FOIS freight forecasts | same (source=FOIS_FORECAST) | 8 rakes × 12 = **96** | `traffic_gen.gen_freight(seed=53)` | ✅ |
| 9 | IMD weather alert mocks | `operations.weather_alerts` | 3 | `traffic_gen.gen_weather(seed=44)` | ✅ |
| 10 | Demo users (7 roles) | `auth.users` | 7 | seeder | ✅ (password = `SEED_PASSWORD`) |
| 11 | Signal acknowledgments | `operations.signal_acknowledgments` | 0 seeded — **created live during the demo** via `/plans/{id}/acknowledge-signal` | runtime API | — |
| 12 | Benchmark scenarios (B0/B1/RAIL-BLOC) | in-memory, fixed seeds | 26-week scenario set | `apps/eval` | ✅ Identical seeds for all three baselines (BENCH-001) |

**Total seeded rows ≈ 600 (≈ 3–5 MB).** All ingestion is idempotent (upsert keys, DB-006) — re-seeding never duplicates.

### 3.3 Mandatory field specifications (for your reference / optional overrides)

If you ever want to **replace** a generator with your own data, these are the exact accepted schemas. Place files in `data/uploads/` (⚠️ OPTIONAL — only if you insist on custom data):

**`data/uploads/sections.csv`** (⚠️ optional override, default AUTO)
```
section_code,division,zone,start_km,end_km,line_type,electrification,speed_limit_mps,crossover_points
NDLS-GZB-UP,DLI,NR,0.000,24.500,DOUBLE,25KV_AC,160,["PM-NDLS-1","PM-NDLS-2"]
GZB-ALJN-3L,DLI,NR,24.500,68.200,3RD_LINE,25KV_AC,120,["PM-GZB-1"]
```
Rules: `line_type ∈ {SINGLE,DOUBLE,3RD_LINE,QUAD}`; `electrification ∈ {NONE,25KV_AC,2X25KV_AC}`; `end_km > start_km`; geometry auto-interpolated between station anchors (real `track_geom` Linestrings are generated, not required from you).

**`data/uploads/demands_<SOURCE>.csv`** (⚠️ optional; SOURCE ∈ TMS/TDMS/SMMS)
```
external_ref_id,department,section_code,activity_code,min_duration_mins,earliest_start,latest_deadline,urgency_score,machinery_req,features
TMS-DEF-2026-0891,ENGINEERING,GZB-ALJN-DN,DTT_TAMPING,180,2026-01-05T01:00:00Z,2026-01-09T23:00:00Z,0.812,["DTT_TAMP_01"],{"tgi_index":38.4,"cumulative_gmt":47.2,"imr_severity":"P1_URGENT","rail_wear_loss_percent":6.8}
TDMS-OHE-2026-4412,TRD,GZB-ALJN-DN,OHE_CANTILEVER_ADJ,120,2026-01-05T01:00:00Z,2026-01-08T23:00:00Z,0.740,[],{"contact_wire_diameter_mm":8.10,"carbon_brush_sparking_index":4}
SMMS-SIG-2026-7781,SIGNAL_TELECOM,GZB-ALJN-DN,POINT_MACHINE_OVERHAUL,90,2026-01-05T01:00:00Z,2026-01-07T23:00:00Z,0.655,[],{"interlocking_gear_id":"PM-102B","point_operating_current_amps":4.9,"relay_pick_up_time_ms":132.5,"disconnection_notice_type":"RESTRICTED_DISCONNECTION"}
```
Mandatory: ISO-8601 UTC timestamps; `urgency_score ∈ [0,1]`; duration > 0. Valid activity codes: ENG — `BCM_DEEP_SCREENING, DTT_TAMPING, TTR_RAIL_RENEWAL, POINTS_PACKING`; TRD — `OHE_CANTILEVER_ADJ, CONTACT_WIRE_RENEWAL, INSULATOR_WASHING, TSS_TRANSFORMER_MAINT`; S&T — `POINT_MACHINE_OVERHAUL, TRACK_CIRCUIT_TUNING, AXLE_COUNTER_RESET, EI_CARD_TESTING`.

**`data/uploads/timetable.csv`** (⚠️ optional)
```
train_number,train_type,priority_rank,section_code,scheduled_entry,scheduled_exit
22436,VANDE_RAJDHANI,1,NDLS-GZB-UP,2026-01-05T06:00:00Z,2026-01-05T06:12:00Z
```
`train_type ∈ {VANDE_RAJDHANI, MAIL_EXP, PASSENGER, FREIGHT}`; `priority_rank ∈ [1,10]`.

**`data/uploads/weather.geojson`** (⚠️ optional) — FeatureCollection of Polygons with properties: `alert_type ∈ {THUNDERSTORM_LIGHTNING, TORRENTIAL_RAIN, EXCESSIVE_HEAT_EXPANSION, CYCLONIC_GALE}`, `severity ∈ {YELLOW_WATCH, ORANGE_BE_PREPARED, RED_ACTION_REQUIRED}`, `precipitation_mm_hr`, `rail_temperature_celsius`, `prohibited_work_types` (array), `valid_until`.

**Explicitly forbidden inputs:** any file claiming to be real IR operational data must not be imported — the demo runs under the SIMULATED-DATA honesty rule, and no sanitized real IR dataset is assumed to exist in your possession.

### 3.4 Demo-credentials card (auto-seeded — record these)

| Username | Role | Division | Purpose in demo |
|---|---|---|---|
| `srdom_dli` | SR_DOM | DLI | Approves plans (Action Preview Card) |
| `drm_dli` | DRM | DLI | Authorizes (distinct-approver test APP-001) |
| `controller_dli` | CONTROLLER | DLI | P0 emergency + Controller acknowledgment |
| `engineer_dli` | ENGINEER | DLI | Manual BDMS upload path |
| `sm_dli` | STATION_MASTER | DLI | G&SR-2 SM acknowledgment |
| `auditor` | AUDITOR | DLI | Ledger verification |
| `admin` | ADMIN | DLI | Solve trigger, seeding admin |

All use password = value of `SEED_PASSWORD`.

---

## PART 4 — AUTOMATIC vs MANUAL — FINAL MATRIX

| Item | Who provides |
|---|---|
| All SQL DDL, triggers, extensions | ✅ Agent (codebase `data/sql/`) |
| All 12 datasets (Part 3.2) | ✅ Agent (seeders, fixed seeds) |
| Demo users | ✅ Agent |
| Mock COA bridge, mock weather engine, mock feed endpoints | ✅ Agent |
| ML models training data + training | ✅ Agent (synthetic, seeded) |
| Benchmark scenarios + B1 tuning protocol | ✅ Agent |
| `.env` file creation + 2 generated secrets (JWT, DB password) | 🔧 **You (≈5 minutes)** |
| Docker Desktop / Git installation & port check | 🔧 **You (once)** |
| Repo folder + `git init` | 🔧 You (or I include instructions) |
| Real IR system credentials | ❌ Not required; not obtainable; not claimed |
| Real IMD key | ⚠️ Optional nice-to-have only |
| Custom CSV/GeoJSON overrides | ⚠️ Optional only |
| Post-build verification runs (tracker checklist items) | 🔧 You execute commands I provide; measurements are then real |

---

## PART 5 — PRE-BUILD SANITY GATES

Before I resume code generation, run and confirm:

1. `git --version` → ≥ 2.40 ☐
2. `docker --version` → ≥ 26.0 ☐
3. `docker compose version` → v2.x ☐
4. `docker run --rm hello-world` → success ☐
5. `docker run --rm postgis/postgis:16-3.4 pg_config --version` → PostgreSQL 16.x ☐
6. Ports 5432 / 6379 / 8000 / 5173 free (Part 1.3 commands) ☐ — **if any is occupied, tell me the remap now**
7. Docker Desktop resource allocation ≥ 8 GB RAM / 4 CPUs ☐
8. ≥ 15 GB free disk ☐
9. First-build time budget of 10–25 min accepted ☐
10. Secrets generated: `JWT_SECRET` (64-hex) and `POSTGRES_PASSWORD` (32-hex) — ready to paste into `.env` ☐

---

## PART 6 — WHAT HAPPENS AFTER YOUR GO SIGNAL

Upon your confirmation I will resume implementation in this order (unchanged from the plan): DDL + triggers → generators/seeder → `packages/core|chronicle|sentinel|optima|ml` → FastAPI routers + Celery worker → React/Atlas frontend → eval harness → tests → one-command `docker compose up --build` with zero manual configuration.

**No coding begins until you reply with either:**
- **"GO — all gates checked"**, or
- **"GO with exceptions:"** followed by the specific failing gate numbers and details (port remaps, lower specs, OS quirks), so I can adapt the compose file and build plan before writing a single line.

Be strict with yourself here: a failed gate discovered after implementation costs hours; discovered now, it costs minutes.