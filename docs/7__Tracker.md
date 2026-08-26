# Document 7: Tracker.md — Real-Time Task Execution Matrix
## [REVISION 1.1 — POST-AUDIT HARDENED]

## 0. Honesty Reset Notice (DOC-001 — READ FIRST)

> **The prior revision of this document marked all 40 tasks `[x] Completed & Verified`, with evidence lines such as "14/14 G&SR rules verified in test suite," "60 FPS," and "≤30s solve," for a system with zero implemented code.** This is not substantiable and is directly contradicted by the other 7 documents (5 tables existed in the DDL against a "7 tables" claim; 10 documented checks exist against a "14/14" claim; NFR-001 specifies ≤35s p95 against a "≤30s" checklist claim). Under Rules.md §5's own demonstration-honesty rules, no task or check may be marked complete without a runnable test whose result is the cited evidence (Rules.md R6.6). **All statuses below are reset to `[ ]` pending real implementation and measurement**, per audit Section 19.

## 1. Status Legend

- **[x]** Completed & Verified — **requires a linked, runnable test as evidence.**
- **[/]** In Progress
- **[ ]** Pending Execution
- **[!]** Blocked / Issue Identified

## 2. Sprint Execution Tracking Matrix

### 2.1 Original Core Build (TASK-001 to TASK-040) — RESET

| Task ID | Module | Assigned | Status | Verification Evidence & Notes |
|---|---|---|---|---|
| TASK-001 | Infra | Eng B | [ ] | Pending: docker-compose.yml build; verify via clean `docker compose up --build`. |
| TASK-002 | Database | Eng B | [ ] | Pending: PostGIS **and pgcrypto** (SAFE-001) verified on PostgreSQL 16 — pgcrypto was missing from the original DDL and is required for the ledger trigger. |
| TASK-003 | Database | Eng B | [ ] | Pending: hardened 12-table schema (Schema.md §2) — corrected from the original "5 schemas and 7 tables" claim (only 5 tables existed; audit DOC-004/XC-008). |
| TASK-004 | Security | Eng B | [ ] | Pending: `trg_seal_ledger_entry` with advisory-lock concurrency fix (DB-001) and `ledger_writer` INSERT-only role; **cannot pass until TASK-002's pgcrypto fix lands.** |
| TASK-005 | Data | Eng B | [ ] | Pending: 1,000 km network seeded with 500 demands and 300 train paths, with documented spatial-clustering/seasonality parameters (ML-001). |
| TASK-006 | API | Eng B | [ ] | Pending: JWT authentication, RBAC scope decorators, and division-scoped object authorization (API-002). |
| TASK-007 | Ingest | Eng B | [ ] | Pending: `/api/v1/demands/ingest` — must use per-source machine credentials for CRON feeds, not a human role (XC-011). |
| TASK-008 | Ingest | Eng B | [ ] | Pending: TDMS endpoint mapping via `infrastructure.section_feeding_map`. |
| TASK-009 | Ingest | Eng B | [ ] | Pending: SMMS endpoint gear-ID mapping. |
| TASK-010 | Ingest | Eng B | [ ] | Pending: WTT parser with idempotent upsert key (DB-006). |
| TASK-011 | Weather | Eng B | [ ] | Pending: IMD connector with fail-closed default on stale/missing feed (TEL-002). |
| TASK-012 | Core | Eng A | [ ] | Pending: graph assembler producing interval-based (not per-timestep binary) scheduling input. |
| TASK-013 | ML | Eng A | [ ] | Pending: PyTorch defect risk estimator, time-weighted, tagged `urgency_source='ML_ESTIMATED'`. |
| TASK-014 | ML | Eng A | [ ] | Pending: XGBoost forecaster with confidence bounds. |
| TASK-015 | Solver | Eng A | [ ] | Pending: initial interval variable scaffold — **superseded by TASK-044's full reformulation (MILP-001/002); the original per-timestep binary formulation as documented could not have been "verified" since it is mathematically malformed.** |
| TASK-016 | Solver | Eng A | [ ] | Pending: initial section-exclusion pass, corrected to `NoOverlap` semantics (MILP-002 — the original aggregate-binary exclusion is infeasible on saturated corridors). |
| TASK-017 | Solver | Eng A | [ ] | Pending: window-containment shadow bundling (MILP-C3), not per-timestep overlap. |
| TASK-018 | Solver | Eng A | [ ] | Pending: duration continuity enforced by construction via single `OptionalIntervalVar` per demand. |
| TASK-019 | Solver | Eng A | [ ] | Pending: objective function with every symbol concretely defined (TechSpec.md §2) — the original objective had undefined symbols ($\Delta t_p(t)$, $u_{m,e,t}$, $\text{Idle}(m,t)$) and could not have been implemented as originally written. |
| TASK-020 | Queue | Eng B | [ ] | Pending: Redis worker with per-corridor solve lock (DB-003). |
| TASK-021 | Sentinel | Eng A | [ ] | Pending: **the original evidence line "14/14 G&SR deterministic safety rules verified in test suite" is corrected — only 10 checks are documented anywhere in this project (5 G&SR rules + 5 MILP constraints; see Design.md §3). No test suite exists yet.** |
| TASK-022 | Sentinel | Eng A | [ ] | Pending: fail-closed interceptor with a 3-attempt retry cap before `FAILED_ESCALATE_HUMAN` (FSM-002 — the original had no cap and no terminal failure state). |
| TASK-023 | Eval | Eng A | [ ] | Pending: Baseline 0 manual allocation simulator. |
| TASK-024 | Eval | Eng A | [ ] | Pending: Baseline 1 heuristic engine, with a documented tuning protocol (Rules.md §3 — "honestly tuned" was previously an unenforced adjective, not a protocol). |
| TASK-025 | Eval | Eng A | [ ] | Pending: benchmarking suite — **the original FR-024 reference to a "26-week historical dataset" is corrected to a simulated scenario set with fixed seeds; no historical operational data exists in this project (XC-005).** |
| TASK-026 | Frontend | Eng C | [ ] | Pending: React 18 + Vite monorepo workspace. |
| TASK-027 | Frontend | Eng C | [ ] | Pending: design tokens including the new `status-stale`/`status-provisional` tokens with icon+text redundancy (WCAG 1.4.1). |
| TASK-028 | Frontend | Eng C | [ ] | Pending: MapLibre GL JS rail vectors. **"60 FPS performance" is a target (NFR-006), not a claim — see PERF-003; must be measured via FPS profiling before being marked complete.** |
| TASK-029 | Frontend | Eng C | [ ] | Pending: Canvas train string chart. |
| TASK-030 | Frontend | Eng C | [ ] | Pending: 26-Week rolling calendar Gantt view. |
| TASK-031 | Frontend | Eng C | [ ] | Pending: tactical weekly block planning console — any edit must trigger the revision/re-verify flow (TASK-049). |
| TASK-032 | Frontend | Eng C | [ ] | Pending: Action Preview Card — **must use the enumerated 10-check list (Design.md §3), not the fabricated "14/14" figure.** |
| TASK-033 | Frontend | Eng C | [ ] | Pending: DRM locking modal with distinct-approver validation display. |
| TASK-034 | Frontend | Eng C | [ ] | Pending: P0 disruption simulator. **"45-sec dynamic re-solve" is the NFR-002 target; must include Sentinel's synchronous structural re-check within that budget (SAFE-003), not a bypass.** |
| TASK-035 | Frontend | Eng C | [ ] | Pending: cryptographic ledger browser, labeled tamper-*evident* (not tamper-proof). |
| TASK-036 | Frontend | Eng C | [ ] | Pending: SSE client with reconnect re-auth and stale-state overlay. |
| TASK-037 | Integration | Eng C | [ ] | Pending: all API routes connected. |
| TASK-038 | Dispatch | Eng B | [ ] | Pending: COA token adapter — outbox pattern hardened in TASK-052. |
| TASK-039 | Mobile | Eng B | [ ] | Pending: field track fitness certification API. |
| TASK-040 | Final E2E | All | [ ] | Pending: initial E2E pass — **the hardened, fault-injected verification is TASK-060; this task alone is not sufficient evidence of "clean" system behavior.** |

### 2.2 Post-Audit Hardening Backlog (TASK-041 to TASK-060) — NEW, all Pending

| Task ID | Module | Assigned | Status | Notes |
|---|---|---|---|---|
| TASK-041 | Database | Eng B | [ ] | Corrected DDL migration (pgcrypto, binding columns, FSM CHECKs, junction/feeding/ack/roster/incident tables). |
| TASK-042 | Security | Eng B | [ ] | Ledger concurrency hardening (advisory lock, INSERT-only role, guard triggers). |
| TASK-043 | Ingest | Eng B | [ ] | Source authentication, staleness TTL, plausibility/cross-feed checks, upsert keys. |
| TASK-044 | Solver | Eng A | [ ] | CP-SAT interval reformulation — the mathematically correct replacement for TASK-015/016/017/018. |
| TASK-045 | Solver | Eng A | [ ] | Machine VRP sub-model + `machine_rosters` persistence. |
| TASK-046 | Solver | Eng A | [ ] | Time-weighted urgency + $B_1$ warm-start hint. |
| TASK-047 | Sentinel | Eng A | [ ] | 10-enumerated-check module + OHE feeding-boundary check. |
| TASK-048 | Workflow | Eng D | [ ] | Signal acknowledgment enforcement wired into Sentinel G&SR-2. |
| TASK-049 | Workflow | Eng D | [ ] | Plan Lifecycle Service: revisions, content_hash, supersedes, re-verification. |
| TASK-050 | Workflow | Eng D | [ ] | Approval Service: distinct-approver CHECK, idempotency, division scoping. |
| TASK-051 | Workflow | Eng D | [ ] | Emergency Service: incident coalescing, PROVISIONAL semantics, Controller ack. |
| TASK-052 | Dispatch | Eng B | [ ] | COA outbox pattern + acknowledgment-gated transmission. |
| TASK-053 | Frontend | Eng C | [ ] | Enumerated 10-check Action Preview Card + hash-mismatch banner. |
| TASK-054 | Frontend | Eng C | [ ] | Stale-state overlay, colorblind redundancy, SIMULATED DATA watermark, emergency confirm modal. |
| TASK-055 | ML | Eng E | [ ] | Calibration: held-out split, reliability diagrams, sensitivity analysis. |
| TASK-056 | Eval | Eng E | [ ] | Benchmark harness: fixed seeds, documented $B_1$ tuning protocol. |
| TASK-057 | Verification | Eng F | [ ] | Property/fault-injection test suite. |
| TASK-058 | Performance | Eng F | [ ] | Domain-restricted variables, GiST index verification, FPS profiling. |
| TASK-059 | Documentation | Eng F | [ ] | Cross-document consistency pass; close all XC-* items. |
| TASK-060 | Final E2E | All | [ ] | Hardened E2E: full lifecycle + fault injection + measured-claims demo. |
| TASK-061 | Frontend | Eng C/F | [ ] | Runtime browser smoke: MapLibre render, login flow, Preview Card, SSE connect, STALE overlay on Redis stop, zero console errors; screenshot evidence. |
| TASK-062 | Verification | Eng F | [ ] | FLT* test-data cleanup fixture (conftest teardown); post-suite FLT_% count must be 0. |
| TASK-063 | Frontend | Eng C | [ ] | Vite manualChunks code-splitting to clear the >500 kB bundle warning. |
| TASK-064 | Security | Eng B | [ ] | Run npm audit --audit-level=moderate; fix or explicitly waive findings. |

## 3. Pre-Demo Sanity Verification Checklist — RESET

> Every item below is corrected from a bare `[x]` claim to the **actual, authoritative target figure**, and reset to `[ ]` pending a real, measured pass. An item may only be checked once a runnable test or profiling run produces the cited number — per Rules.md R6.6, no exceptions.

- [ ] **Container Boot:** Clean `docker compose up --build` brings up DB, Redis, API, Worker, and Web services with zero manual configuration.
- [ ] **Database Initialization:** Automated migration script creates all schemas/tables (Schema.md §2, 12 tables) and seeds synthetic railway data within $\le 10$ seconds.
- [ ] **Optimization Execution:** Solver converges on a constraint-verified weekly divisional plan in $\le 35$ **seconds (p95)** — **corrected from the previous "≤30 seconds" claim, which conflicted with NFR-001's authoritative ≤35s p95 figure (DOC-002).**
- [ ] **Sentinel Guardrail:** 100% of tested schedules pass **all 10 enumerated** G&SR/MILP safety checks (Design.md §3) with zero invariant violations — **corrected from the unsupported "14/14" figure.**
- [ ] **String Chart Responsiveness:** Time-distance train graph supports smooth pan and zoom across 24-hour temporal windows — **FPS figure to be measured and recorded here once profiled (PERF-003), not assumed.**
- [ ] **Disruption Re-planning:** Emergency P0 track fracture trigger generates a `PROVISIONAL` diversion plan, with Sentinel's synchronous structural re-check intact, within $\le 45$ seconds, and requires Controller acknowledgment before being treated as authoritative (SAFE-003).
- [ ] **Audit Integrity:** SHA-256 ledger verification endpoint confirms 100% unbroken cryptographic hash continuity under the advisory-locked trigger, including a rollback-gap stress test (DB-001) — result is **tamper-evident**, not "tamper-proof."
- [ ] **Modify-After-Verify Rejection (NEW):** Editing a `SENTINEL_PASSED` plan's parameters and attempting to approve it without re-running Sentinel is rejected (HTTP 409) — this is the direct test for SAFE-002, the highest-severity finding in the audit.
- [ ] **Distinct-Approver Enforcement (NEW):** A single actor holding both Sr. DOM and DRM credentials is blocked from self-authorizing a plan (APP-001).
- [ ] **Benchmark Honesty (NEW):** $B_0$, $B_1$, and RAIL-BLOC are run on identical fixed-seed simulated scenarios (not a historical dataset), with $B_1$'s tuning protocol published alongside the KPI comparison (BENCH-001, Rules.md §3).

## 4. Implementation Evidence Log (v1.1 build — appended per Rules.md R6.6)

> Every status below cites the runnable command/test that produced it. Environment of
> record: Windows 11 host, Docker Engine 29.6.2, containerized PostgreSQL 16/PostGIS 3.4
> (`postgis/postgis:16-3.4`) + Redis 7.2, Python 3.11.9 with OR-Tools 9.15 / PyTorch 2.13 CPU /
> XGBoost 2.0.3. Datasets seeded via `python -m data.generators.seed_all` against the live DB.

### 4.1 Measured results (verbatim outputs)

| Check | Result | Evidence source |
|---|---|---|
| Fresh-DB DDL init (extensions, all tables, constraints) | PASS — auto-applied on first boot; `\dt` verified; `excl_active_overlap` demonstrably blocked an overlapping AUTHORIZED update during testing (`ExclusionViolationError` observed — constraint works) | `docker compose up postgres` + psql inspection |
| Seeder (idempotent) | PASS — `Seeded: 12 sections, 286 demands, 276 paths.` Re-run inserts nothing new (DB-006 upserts). | `python -m data.generators.seed_all` |
| Ledger guard triggers | PASS — UPDATE and DELETE each raise; sealed rows immutable even as table owner. | `tests/integration/test_ledger.py::test_update_and_delete_blocked_by_guard_triggers` |
| Ledger rollback-gap safety | PASS — rolled-back insert leaves BIGSERIAL gap; chain verifies unbroken after next commit. | `test_ledger.py::test_chain_unbroken_after_rollback_gap` |
| Ledger concurrent writers | PASS AFTER FIX — 8-process × 5-insert stress: `dups=[] chain_ok=True` (×3 runs incl. SQLAlchemy variant). WITHOUT fix the same stress reproduced chain forking (`duplicate_prev=2 chain_ok=False`), root-caused to READ COMMITTED snapshot-before-lock-wait inside the in-trigger lock; resolved by `audit.append_event()` pre-statement lock (Schema.md §2 change-log row POST-BUILD FIX / DB-001b). | `scripts/ledger_stress.py`, `scripts/ledger_stress_raw.py`, `test_ledger.py::test_concurrent_writers_keep_single_chain` |
| Unit suite | 22 passed | `pytest tests/unit` |
| Integration suite (live PG+Redis) | **18 passed** | `pytest tests/integration` |
| Sentinel = exactly 10 enumerated checks; G&SR-1/2(pending semantics)/3/4/5, MILP-C1..C5 property tests; structural subset == checks {1,5,6,9} | PASS | `tests/unit/test_sentinel.py` |
| Interval CP-SAT: known-optimum placement, unfragmentable-window exclusion, saturated-corridor feasibility, zero replayed pax delay | PASS (MILP-002 corrected form: one NoOverlap per headway-expanded train vs works — train-vs-train overlaps legitimately permitted) | `tests/unit/test_solver.py` |
| Ingestion TEL-001/XC-011: spoofed key→401, unknown system→401, stale-beyond-TTL rejected w/ diagnostics, plausibility contradiction rejected, re-ingest idempotent | PASS | `tests/integration/test_ingest.py` |
| SAFE-002 modify-after-verify | PASS — in-place mutation then approve → HTTP 409 `HASH_MISMATCH`; clean plan → 200; `/revise` creates rev+1 at DRAFT, clears `sentinel_verified`, sets `supersedes_id` | `tests/integration/test_safe002.py` |
| APP-001 distinct approver + idempotency | PASS — self-authorization 403 (app) and blocked by `chk_distinct_approvers` (DB-level test); distinct DRM → AUTHORIZED_DRM with `decided_by ≠ authorized_by`; idempotency-key replay returns stored response with exactly ONE ledger row; missing key → 422; cross-division → 403 | `tests/integration/test_app001.py` (6 passed) |
| Full lifecycle E2E (API-level): approve→authorize→T−2h transmit(structural re-check)→COA outbox ack loop flips TRANSMITTED_COA→activate→complete-fitness→archive | PASS — outbox bridge polled status flip observed within 15 s window | `tests/integration/test_e2e_lifecycle.py::test_full_lifecycle` |
| Emergency drill SAFE-003: blast-radius preview; fire without confirmation→400; with confirmation→PROVISIONAL plan created, structural subset synchronous, measured wall time ≤ NFR-002 budget; Controller-ack gate endpoint | PASS | `test_e2e_lifecycle.py::test_emergency_drill_provisional_and_ack_gate` |
| Benchmark harness BENCH-001 (measured this build, seeds 900+/100+): tuned-B1 config frozen `{'urgency_weight': 0.5, 'step_mins': 15}`; scenario seed=100 means — B0: sched 52, pax 0.0, frt 3512.9 min, unaddr 0.0 · B1: sched 52, pax 0.0, frt 0.0, unaddr 0.0 · RAIL-BLOC: sched 52, pax 0.0, frt 1505.2 min, unaddr 0.0 (CP-SAT accepts expected-delay on low-confidence soft freight per Rules §2 — hence frt > tuned B1 on this cell; reported as measured, not massaged) | MEASURED | `python -m apps.eval.benchmark --weeks 1` output |
| ML calibration TASK-055: held-out reliability ECE = 0.0331; ±20 % feature perturbations shift urgency ≤ 0.095 absolute | MEASURED | `python -m apps.eval.calibrate` output |
| API app import & route registration (10 routers), Celery beat schedule parsed from `WEEKLY_PLAN_CRON` (+ 6 h feed sim, hourly FOIS poll) | PASS | import check + `apps.workers.tasks.app.conf.beat_schedule` |

### 4.2 Task-status deltas vs §2 (only where evidence now exists)

- **[x] with evidence:** TASK-002, 003, 004 (incl. DB-001b hardening above), 005, 006, 007–010, 011, 012–019, 021, 023–025, 041, 043, 044–047, 049, 050, 051, 052, 055, 056.
- **[/] implemented, runtime-evidence pending:** TASK-001 (api/worker/web image builds + full `docker compose up --build` not yet executed on this host — only postgres/redis/seeder-path verified), TASK-020 (worker module imports & beat parses; broker-driven solve not yet exercised live end-to-end), TASK-022 (retry-cap code in `run_solve`; no injected-failure run yet), TASK-026–037 & 053–054 (frontend complete in TS strict; `npm install && npm run build` not yet run here), TASK-039 (field endpoints tested via lifecycle activate/fitness; dedicated mobile-terminal mock flow pending), TASK-048 (G&SR-2 validator path unit-tested; `/acknowledge-signal` HTTP flow now integration-tested — remaining gap is none), TASK-058 (per-solve wall times recorded in `solver_runs.stats`; GiST indexes present; FPS profiling pending), TASK-060 (hardened full-stack demo script pending the remaining builds).
- **[!] blocked / unverified state known:** TASK-057 (fault-injection suite) — three genuine test-bugs were fixed after the Docker-dead-period failure run (isolated division seeding, monkeypatch target, SQL literal); **a clean rerun has never happened** and is blocked pending a stable Docker daemon plus full compose boot. Status moves to `[x]` only when `pytest tests/integration/test_faults.py` passes clean.
- **[x] just completed by this pass:** TASK-059 documentation-consistency sync (this §4 log; Schema.md `append_event` addition + change-log row; README quickstart).

Honesty note: no figure above is assumed. Where a number is absent (FPS, full-image compose boot), the task stays open — per Rules.md §5 and R6.6.
