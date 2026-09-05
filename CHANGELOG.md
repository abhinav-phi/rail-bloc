# Changelog

All notable changes to **RAIL-BLOC** are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

RAIL-BLOC is an AI-powered automatic block-planning system for Indian Railways (SIH26027): departmental demands in → CP-SAT optimal maintenance blocks out → 10 deterministic G&SR/MILP checks → dual-ack approval → COA transmission → hash-chained audit ledger.

---

## [1.1.0] — 2026-09-05 · Post-audit hardening

Full word-by-word code audit (38 findings) plus a second security/observability/process review (16 findings) produced **tracked issues #7–#60. Of these 54, 49 are closed** in this release — every closure verified against the code, not just claimed. The 5 that remain open are documented-intended behavior and doc-sync items, deliberately left open until the Atlas frontend redesign lands.

### Added

- **CI pipeline** (`.github/workflows/ci.yml`): backend test job against real PostgreSQL 16 + PostGIS + Redis 7.2 service containers, frontend build/lint/typecheck job. CI has caught and blocked real regressions during development (multiple failing runs on 2026-09-02/03, fixed before merge).
- **Database migrations**: Alembic tooling (`migrations/`), applied automatically by a dedicated migrate step in Docker Compose before seeding — schema changes no longer require wiping the data volume.
- **Structured observability**: `apps/api/core/logging.py` with request-ID middleware (`X-Request-ID` propagation), Prometheus counters (`REQUESTS_TOTAL` by method/path/status, `OUTBOX_PENDING`), and `logger.exception` on the COA outbox bridge loop (previously a silent `except: pass`).
- **Login rate limiting**: `slowapi` limiter at 5 req/min on `/api/v1/auth/login`, registered app-wide with a `429` handler.
- **JWT hardening**: `jti` + `iat` claims, Redis-backed token revocation (`revoke_token`) with in-process fallback, and short-lived **one-time stream tickets** for SSE — the browser never sends the JWT in a URL query parameter anymore (`/api/v1/stream/issue-ticket` → `?ticket=`).
- **Per-user password salts** with a transparent legacy-hash re-salting migration on successful login (see Security).
- **Frontend modernization**: Atlas console migrated to **Next.js 13 (app router, static export)** with Radix UI primitives, Tailwind, Framer Motion; **React ErrorBoundary** wired at the app root; **vitest + React Testing Library** test suite; prettier + typecheck scripts.
- **Community files**: PR template, bug/feature issue templates, `CODEOWNERS`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, this changelog, `AGENTS.md`, `llms.txt`.
- **Ops hardening**: `restart: unless-stopped` on api/worker/beat/web; Redis started with `--requirepass`; `beat`/`worker` now gate on `redis: service_healthy` (matching postgres gating); `.dockerignore`-minimized build contexts.

### Fixed

*Sentinel & solver (correctness of the safety layer):*
- **P0 — sentinel-report acks never found**: API `_build_sentinel_context` keyed acknowledgments by `plan_id` while `validate_plan` looks up by `content_hash`; G&SR-2 showed "pending" for acknowledged S&T plans. Both the API and the worker now build acks through the same content-hash lookup (`build_ack_lookup` + `JOIN block_plans`). (#7, #9, #10)
- **MILP-C5 was vacuous in production**: `machine_assignments` was never populated by either context builder, so the machine-conservation check could never fire. Now built by `build_machine_assignments` in both the worker (post-solve) and the API (from persisted rosters). (#8)
- **MILP-C2 vs MILP-C3 were identical checks**: C3 is now a true shadow-bundle containment test — every non-primary demand's window must fit inside the primary demand's window. (#15)
- **G&SR-4 partial isolation is physically correct**: the unreachable `if not neighbours` branch was replaced with a real partial-isolation path — adjacent member sections must be *idle* for the plan window for isolation to be safe. (#14)
- **G&SR-5 soft/hard path semantics**: the `is_hard_path` filter in the headway check is intentional (soft/forecast paths are relaxed by design); kept with an explicit rationale and fixed to preserve train source metadata. (#13)
- **Machine travel times used a hardcoded default speed**: the `hasattr(params, "machines")` hack always evaluated false. `build_model` now takes the `machines` list directly, `_travel_minutes` resolves per-machine speed at the call site, and ceiling-rounded travel times were restored. (#23, #24)

*Data & lifecycle:*
- **`work_minutes` in the summary endpoint summed travel time** — it now sums plan work durations (`block_plans.end_time − start_time`). (#20)
- **Feeding sections were hard-divested to `division='DLI'`** even for PRYJ-division sections; seeding is now division-aware. (#11)
- **Weather and freight-forecast seeds are reproducible**: calendar-day seeds (`date.toordinal()`) instead of wall-clock hour/day timestamps; `gen_freight` default seed aligned with production (53). (#17, #18, #19)
- **`shadow_weight_scale` dead parameter removed**; `replay_train_detention` no longer takes-and-drops `weights`. (#12, #16)
- Dead code and duplication removed: cron-parser no-op branch, duplicate `_mins` helper, unused imports. (#21, #22)
- **Legacy password hashes were permanently locked out** — the S1 hardening raised PBKDF2 to 600k iterations, but the login fallback re-hashed candidates at the *new* count against rows hashed at the *old* 60k count, so pre-migration users could never sign in again. Fixed with a dedicated `legacy_hash_pw()` (60k, fixed salt) used only for recognition-then-upgrade; regression-tested at unit and API level and verified live: a pre-v1.1 row logs in and is transparently re-salted. (Found by the full-stack boot smoke test on 2026-09-05.)

*API & tests:*
- **Pagination caps** unified: `Query(200, ge=1, le=500)` on demands/plans list endpoints (ledger already capped). (#54)
- **`travel_end` semantics clarified** in roster docs/comments — it stores arrival-at-site (work start), by VRP design. (#21-bis)
- **New integration tests**: sentinel-report endpoint (would have caught the P0), revise → re-approve → hash-mismatch flow, T-2h structural re-check failure path, emergency endpoint idempotency, full-stack boot health check; flaky emergency-drill and revise tests made deterministic; fragile `pg_sleep` fault test hardened. (#38–#44)

### Security

- **S1 — static PBKDF2 salt removed**: passwords hash with a per-user 32-byte random salt at **600,000 iterations** (10× the previous count); existing hashes are transparently re-salted on next successful login. (#45)
- **S2 — brute-forceable login closed** by the rate limiter above. (#46)
- **S3 — invalid CORS combination fixed**: `allow_origins=["*"]` is no longer paired with `allow_credentials=True`. (#47)
- **S4 — token exposure reduced**: `jti`-based revocation, no more JWT-in-URL for SSE (one-time tickets), Redis-backed deny list surviving restarts. (#48)
- **S5 — Redis authenticated** and every long-running service restarts on crash. (#49)

### Verified (evidence, not claims)

- Tracker §2.2 and §4.2 statuses synced with reality (TASK-020 broker-solve evidence recorded; TASK-048 self-contradiction resolved). (#30, #31)
- Docs ↔ code consistency re-audited: Schema/TechSpec/ImplementationPlan cross-checks pass. (#32–#35)

### Still open (honest, deliberate)

- #27 — ADMIN division-scope bypass is **documented intended behavior** (demo-role escape hatch), kept until a real deployment story exists.
- #28 — frontend runtime browser smoke + SSE heartbeat-lapse → STALE-overlay combo: pending the Atlas redesign currently in progress.
- #29 / #36 / #37 — remaining doc-sync polish (being closed in this release).

## [1.0.0] — 2026-08 · Initial SIH26027 build

- **Nexus ingestion**: per-source machine credentials (TMS/TDMS/SMMS/FOIS), staleness TTLs, plausibility-contradiction rejection, fail-closed weather (defer-not-assume).
- **Optima**: interval CP-SAT scheduler (headway-expanded exogenous train paths, `OptionalIntervalVar` per demand, `NoOverlap` per section), shadow-block bundling, greedy B1 warm start, VRP-based machine rostering, fixed-seed benchmark harness with a measured cell (seed=100).
- **Sentinel**: 10 deterministic G&SR/MILP checks, content-hash sealing, S&T dual-ack gating (G&SR-2).
- **Plan lifecycle**: revision-number + hash binding, distinct Sr. DOM → DRM authorization enforced at the DB layer, mandatory idempotency keys, COA outbox (`TRANSMITTED_COA` only on acknowledgment).
- **Chronicle**: SHA-256 hash-chained ledger with advisory-lock serialization, INSERT-only role, UPDATE/DELETE guard triggers; 8-process stress reports `chain_ok=true`.
- **ML modules**: rail degradation model + freight forecaster with measured calibration (ECE 0.0331).
- **Atlas console**: MapLibre GIS, Canvas string chart, approvals, audit ledger views — TypeScript strict build passing.
- 40 automated tests green against host-started PostgreSQL 16 + Redis 7.2.

[1.1.0]: https://github.com/abhinav-phi/rail-bloc/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/abhinav-phi/rail-bloc/releases/tag/v1.0.0
