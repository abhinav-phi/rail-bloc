# Document 6: ImplementationPlan.md — Engineering Sprint & Task DAG
## [REVISION 1.1 — POST-AUDIT HARDENED]

> **Revision note:** Closes DOC-003 (header said TASK-060, table ended at TASK-040) and INFO-001 (3-engineer allocation vs. a 6-member SIH team, leaving capacity unused). The header now matches the table: TASK-001 to TASK-060. Tasks 041–060 implement the P0/P1 hardening backlog from the audit's Section 18 Optimized Implementation Order, assigned to three newly-added team members (Eng D, E, F) so hardening runs in parallel with — not after — the original 40 tasks.

## 1. Team Allocation & Sprint Assumptions

- **Timeline:** 5-Day Intensive Sprint (SIH Final Build).
- **Team Structure (EXPANDED — INFO-001 fix, 3 → 6 engineers):**
  - **Engineer A (Math & Optimization):** Interval-based CP-SAT reformulation, machine VRP sub-model, Sentinel enumerated-check module.
  - **Engineer B (Backend & Data):** FastAPI micro-framework, PostgreSQL/PostGIS schemas, ingestion, SHA-256 ledger concurrency hardening.
  - **Engineer C (Frontend & Visualization):** React 18 UI, MapLibre GL JS corridor map, Canvas train string chart, hardened approval consoles.
  - **Engineer D (Safety & Workflow Services — NEW):** Plan Lifecycle Service (revision/hash binding), Approval Service (distinct-approver enforcement), Emergency Service (PROVISIONAL semantics, incident coalescing).
  - **Engineer E (ML & Benchmarking — NEW):** ML calibration and sensitivity analysis, benchmark harness with fixed-seed scenarios and documented $B_1$ tuning protocol.
  - **Engineer F (Verification & Performance — NEW):** Property/fault-injection test suite, performance profiling and index tuning, documentation-consistency pass across all 8 documents.

## 2. Granular Task Breakdown (TASK-001 to TASK-060)

### 2.1 Original Core Build (TASK-001 to TASK-040)

| Task ID | Task Description | Lead | Priority | Dependencies | Size | Definition of Done (DoD) |
|---|---|---|---|---|---|---|
| TASK-001 | Setup Monorepo structure and Docker Compose base | Eng B | P0 | None | S | Multi-container setup runs cleanly via docker compose up --build. |
| TASK-002 | Configure PostgreSQL 16 with PostGIS **and pgcrypto** extensions | Eng B | P0 | TASK-001 | S | PostGIS **and pgcrypto** extensions active (SAFE-001 fix — pgcrypto is required for the ledger trigger's `digest()` call); connection verified via asyncpg. |
| TASK-003 | Execute Schema DDLs for all 5 database schemas, **12 tables total post-hardening** | Eng B | P0 | TASK-002 | M | Tables, indexes, foreign keys, constraints, junction tables, and the active-plan EXCLUDE constraint verified in PG (Schema.md §2). |
| TASK-004 | Implement SHA-256 ledger trigger and tamper test | Eng B | P0 | TASK-003 | M | Insertion trigger auto-calculates hash via advisory-locked lookup; UPDATE/DELETE guard triggers raise exceptions; `ledger_writer` INSERT-only role verified (DB-001 fix). |
| TASK-005 | Write synthetic data generation scripts (1,000 km network) | Eng B | P0 | TASK-003 | L | Seeds 100 sections, 200 passenger paths, 100 freight paths, 500 demands, with documented spatial-clustering and seasonal parameters (ML-001 fix). |
| TASK-006 | Build FastAPI authentication & RBAC middleware | Eng B | P0 | TASK-001 | M | JWT bearer token decoding, route-level role checks, and division-scoped object authorization active (API-002 fix). |
| TASK-007 | Develop TMS REST ingestion endpoint (/demands/ingest) | Eng B | P0 | TASK-003 | M | Pydantic schema validates TMS payload; **authenticates via per-source machine credential, not human role**; writes to demands table with upsert key. |
| TASK-008 | Develop TDMS REST ingestion endpoint | Eng B | P0 | TASK-003 | M | Maps OHE elementary sections to track IDs via `section_feeding_map`. |
| TASK-009 | Develop SMMS REST ingestion endpoint | Eng B | P0 | TASK-003 | M | Maps gear disconnections to station running lines. |
| TASK-010 | Develop WTT timetable CSV/JSON parser | Eng B | P0 | TASK-003 | M | Ingests passenger paths into operations.train_paths with idempotent upsert key (DB-006 fix). |
| TASK-011 | Build IMD Weather API connector and risk parser | Eng B | P1 | TASK-001 | S | Ingests severe weather alerts, calculates track risk coefficients via `ST_Intersects`, and defaults to fail-closed deferral on stale/missing feed (TEL-002 fix). |
| TASK-012 | Implement Spatio-Temporal Graph Assembler | Eng A | P0 | TASK-005 | L | Converts database demands and paths into interval-based scheduling input (not per-timestep binary arrays — see TASK-044). |
| TASK-013 | Implement Asset Degradation Risk Estimator (PyTorch) | Eng A | P1 | TASK-005 | M | Generates time-weighted defect urgency scores $\Pi_k(t)$ from GMT and defect history; writes `urgency_source='ML_ESTIMATED'`. |
| TASK-014 | Implement Freight Flow Density Forecaster (XGBoost) | Eng A | P1 | TASK-005 | M | Estimates freight path occupancy probabilities with confidence bounds for non-timetabled slots. |
| TASK-015 | Formulate OR-Tools CP-SAT Decision Variables & Bounds (initial pass) | Eng A | P0 | TASK-012 | M | Initializes interval variables per demand; **superseded by the full interval reformulation in TASK-044 (MILP-001/002 fix) before this is considered done.** |
| TASK-016 | Code Safety Invariant Constraints (Section Exclusion) | Eng A | P0 | TASK-015 | M | Initial `NoOverlap`-per-section pass; hardened in TASK-044. |
| TASK-017 | Code Multi-Department Shadow Bundling Constraints | Eng A | P0 | TASK-015 | L | Window-containment shadow-pair logic (MILP-C3 fix), not per-timestep overlap. |
| TASK-018 | Code Non-Fragmented Block Duration Constraints | Eng A | P0 | TASK-015 | M | Enforced by construction via single `OptionalIntervalVar` per demand (MILP-004 fix). |
| TASK-019 | Implement Multi-Objective Minimization Function | Eng A | P0 | TASK-016 | M | Balances passenger delay (path-replay), freight detention (path-replay), time-weighted unaddressed-defect penalty, and shadow block rewards — all symbols concretely defined (TechSpec.md §2). |
| TASK-020 | Build Redis Worker Queue for Optimization Jobs | Eng B | P0 | TASK-019 | M | Background celery/rq workers consume and execute solve tasks; per-corridor solve lock acquired to prevent racing solves (DB-003 fix). |
| TASK-021 | Develop Sentinel Deterministic Safety Verification Module (initial pass) | Eng A | P0 | TASK-019 | L | Implements structural checks; **superseded by the 10-enumerated-check module in TASK-047 before this is considered done.** |
| TASK-022 | Build Fail-Closed Schedule Interceptor | Eng A | P0 | TASK-021 | M | Rejects unsafe solver output and triggers automated re-solve, **capped at 3 attempts before `FAILED_ESCALATE_HUMAN` (FSM-002 fix).** |
| TASK-023 | Build Baseline 0 ($B_0$) Simulation Engine | Eng A | P0 | TASK-012 | M | Simulates disconnected manual BDMS allocation. |
| TASK-024 | Build Baseline 1 ($B_1$) Heuristic Rule Engine | Eng A | P0 | TASK-012 | M | Simulates greedy priority-sorted heuristic scheduling; **also serves as the CP-SAT warm-start hint source (TASK-046).** |
| TASK-025 | Build Comparative Evaluation Benchmarking Script (initial pass) | Eng A | P0 | TASK-023 | M | Initial comparison scaffold; **the honest, seeded, tuning-protocol-documented version is TASK-056.** |
| TASK-026 | Initialize React 18 + Vite + Tailwind CSS Frontend | Eng C | P0 | TASK-001 | S | Base layout, navigation drawer, and theme provider setup. |
| TASK-027 | Implement Design Tokens & Dark Slate Theme | Eng C | P0 | TASK-026 | S | Configures #0B111E palette, typography, departmental colors, **and the new status-stale / status-provisional tokens with icon+text redundancy (WCAG 1.4.1).** |
| TASK-028 | Integrate MapLibre GL JS with Rail Network Vectors | Eng C | P0 | TASK-027 | L | Renders track centerlines, stations, active block polygons, and OHE feeding-section boundary layers. |
| TASK-029 | Implement HTML5 Canvas Time-Distance String Chart | Eng C | P0 | TASK-027 | XL | Renders train lines, block intervals, pan/zoom, and tooltips. |
| TASK-030 | Develop 26-Week Rolling Calendar View | Eng C | P0 | TASK-026 | M | Renders 26-week sliding timeline showing corridor block allocations. |
| TASK-031 | Develop Tactical Weekly Block Planning View | Eng C | P0 | TASK-026 | M | Granular weekly scheduling view with drag-and-drop manual fine-tuning; **any edit triggers the revision/re-verify flow (TASK-049).** |
| TASK-032 | Build Sr. DOM Action Preview Card & Approval Modal (initial pass) | Eng C | P0 | TASK-026 | M | Displays block details and impact metrics; **superseded by the enumerated 10-check, hash-bound version in TASK-053.** |
| TASK-033 | Build DRM Divisional Locking Interface | Eng C | P0 | TASK-032 | S | Divisional seal button with cryptographic signature indicator and distinct-approver validation display. |
| TASK-034 | Implement Real-Time Disruption Console (P0 Incidents) | Eng C | P0 | TASK-026 | M | Controls to trigger track fractures and view real-time re-optimization; **PROVISIONAL badge and Controller-acknowledgment gate added in TASK-054.** |
| TASK-035 | Build Cryptographic Audit Ledger Explorer | Eng C | P1 | TASK-026 | M | Displays hash chain records (labeled tamper-*evident*), search filters, and verification badges. |
| TASK-036 | Implement Server-Sent Events (SSE) Live Feed Client | Eng C | P0 | TASK-026 | M | Real-time block state updates pushed to map and string chart; re-authenticates on reconnect. |
| TASK-037 | Integrate Frontend with Backend REST API Gateway | Eng C | P0 | TASK-006 | L | Connects all UI screens to live FastAPI endpoints. |
| TASK-038 | Implement COA Digital Block Token Dispatch Adapter (initial pass) | Eng B | P0 | TASK-007 | M | Generates digital block authority payloads; **outbox + ack pattern hardened in TASK-052.** |
| TASK-039 | Implement Field Mobile Reconnection Terminal API | Eng B | P1 | TASK-038 | M | Mock API for field SSE track fitness clearance. |
| TASK-040 | End-to-End System Integration & Docker Verification (initial pass) | All | P0 | TASK-037 | L | Full integration test: Ingestion -> Solve -> Sentinel -> Sign-off -> Clear. **The hardened, fault-injected version is TASK-060.** |

### 2.2 Post-Audit Hardening Backlog (TASK-041 to TASK-060) — NEW

| Task ID | Task Description | Lead | Priority | Dependencies | Size | Definition of Done (DoD) | Audit ID(s) Closed |
|---|---|---|---|---|---|---|---|
| TASK-041 | Apply corrected DDL migration: pgcrypto, binding columns, 12-state FSM CHECKs, junction/feeding/ack/roster/incident tables | Eng B | P0 | TASK-003 | M | Fresh-DB migration runs cleanly; every constraint in Schema.md §2 verified present. | SAFE-001, SAFE-002, FSM-001, DB-002, DB-004, DB-005 |
| TASK-042 | Harden ledger service: advisory lock, `ledger_writer` role, UPDATE/DELETE guard triggers | Eng B | P0 | TASK-041 | S | Concurrent-write stress test passes; rollback-gap test confirms chain does not brick. | DB-001 |
| TASK-043 | Ingestion hardening: per-source credentials, staleness TTL, plausibility/cross-feed checks, upsert keys | Eng B | P0 | TASK-041 | M | Spoofed-feed test is correctly flagged; re-ingest idempotency confirmed. | TEL-001, DB-006 |
| TASK-044 | CP-SAT interval reformulation: `OptionalIntervalVar` per demand, `NoOverlap` per section with headway expansion, exogenous train intervals | Eng A | P0 | TASK-015, TASK-016, TASK-017, TASK-018 | L | Known-optimum unit test passes; saturated-corridor scenario solves without infeasibility. | MILP-001, MILP-002, MILP-004 |
| TASK-045 | Machine VRP sub-model with travel-time arcs; persist to `optimization.machine_rosters` | Eng A | P1 | TASK-044 | M | Roster persists and is queryable; travel-time feasibility test passes. | DB-005 |
| TASK-046 | Time-weighted urgency $\Pi_k(t)$; CP-SAT warm-start from $B_1$ heuristic (`AddHint`) | Eng A | P1 | TASK-044, TASK-024 | S | Urgent-vs-routine demand scheduling comparison shows expected ordering; solve-time improves with warm start. | MILP-003, PERF-001 |
| TASK-047 | Sentinel 10-enumerated-check module + OHE feeding-boundary check | Eng A | P0 | TASK-044, TASK-041 | L | Per-check property/fuzz test suite passes; boundary-crossing TRD plan correctly fails. | SAFE-004, MILP-C1–C5 |
| TASK-048 | Signal acknowledgment enforcement (`operations.signal_acknowledgments`) wired into Sentinel G&SR-2 | Eng D | P0 | TASK-041 | S | S&T plan lacking SM+Controller ack correctly blocked at `SENTINEL_PASSED`. | SAFE-004 |
| TASK-049 | Plan Lifecycle Service: revisions, `content_hash`, `supersedes_id`, hash re-verification at approve/authorize/transmit | Eng D | P0 | TASK-041, TASK-047 | M | Modify-after-verify test: editing a `SENTINEL_PASSED` plan and attempting to approve it returns 409. | SAFE-002 |
| TASK-050 | Approval Service: distinct-approver CHECK, idempotency keys, division-scoped object authorization | Eng D | P0 | TASK-049 | M | Same-user-both-roles test returns 403; double-click/double-submit test produces exactly one ledger row. | APP-001 |
| TASK-051 | Emergency Service: incident coalescing lock, `PROVISIONAL` plan semantics, Controller-acknowledgment gate | Eng D | P0 | TASK-047, TASK-049 | M | End-to-end 45-second emergency drill, including a two-incident adjacent-section race, completes within budget with Sentinel verification intact. | SAFE-003 |
| TASK-052 | COA Adapter: outbox pattern, acknowledgment-gated `TRANSMITTED_COA` transition, reconciliation job | Eng B | P1 | TASK-050, TASK-038 | M | Killing the COA mock mid-transmit leaves the plan in `PENDING_TRANSMISSION`, not falsely `TRANSMITTED_COA`. | SAFE-006 |
| TASK-053 | Frontend: enumerated 10-check Action Preview Card, model-estimate labeling, hash-mismatch banner | Eng C | P0 | TASK-049, TASK-050, TASK-032 | M | Card renders all 10 named checks with rule IDs; approve button disabled on stale hash. | UX-001 |
| TASK-054 | Frontend: stale-state overlay, colorblind-redundant status tokens, SIMULATED DATA watermark, emergency confirm modal | Eng C | P1 | TASK-053, TASK-034 | M | SSE-kill test shows persistent STALE overlay with actions disabled; colorblind simulation passes. | UX-001, API-001 |
| TASK-055 | ML calibration: held-out scenario split, reliability diagrams, ±20% $\Pi$ sensitivity analysis | Eng E | P1 | TASK-043, TASK-013, TASK-014 | M | Reliability diagram produced; schedule stability under perturbation documented. | ML-001 |
| TASK-056 | Benchmark harness: fixed seeds, documented $B_1$ tuning protocol, identical-scenario $B_0$/$B_1$/RAIL-BLOC comparison | Eng E | P0 | TASK-044, TASK-055, TASK-025 | M | Published methodology document; measured (not assumed) KPI deltas replace all placeholder figures in Design.md. | BENCH-001 |
| TASK-057 | Property/fault-injection test suite (Section 5 & 9 invariants: kill each feed/solver/Sentinel/Redis/PG mid-flow) | Eng F | P0 | TASK-044, TASK-047, TASK-051 | L | No new authorization is granted under any injected fault; all property tests pass. | G&SR-3, Section 9 |
| TASK-058 | Performance tuning: domain-restricted solver variables, GiST index verification, FPS profiling on demo scenario | Eng F | P1 | TASK-044, TASK-003 | M | Measured solve time and FPS numbers recorded and reflected in NFR-001/NFR-006 status. | PERF-001, PERF-002, PERF-003 |
| TASK-059 | Documentation-consistency pass across all 8 documents (Tracker reset, terminology fixes, cross-reference check) | Eng F | P0 | All prior | M | Zero unresolved items remain in the Cross-Document Contradictions register. | DOC-001–006, XC-001–012 |
| TASK-060 | Hardened End-to-End Verification: full lifecycle + fault injection + measured-claims demo script | All | P0 | TASK-057, TASK-058, TASK-059 | L | Clean `docker compose up` run; full E2E lifecycle including an emergency drill and a rejected modify-after-verify attempt, all with measured (not assumed) evidence. | Section 17 verification list |
| TASK-061 | Frontend runtime browser smoke: open Atlas in Chrome/Firefox; verify MapLibre renders vectors, login flow, Preview Card 10 checks, SSE connect, STALE overlay on Redis stop, zero JS console errors; record screenshot evidence | Eng C/F | P1 | TASK-054 | M | Browser session recorded with zero console errors and all states exercised. | UX-001 |
| TASK-062 | FLT* test-data cleanup fixture: conftest teardown deletes throwaway fault-test divisions/sections after suite runs | Eng F | P2 | TASK-057 | S | Post-suite `SELECT count(*) FROM infrastructure.block_sections WHERE division LIKE 'FLT_%'` returns 0. | Test hygiene |
| TASK-063 | Vite code-splitting via `build.rollupOptions.output.manualChunks` (vendor/app chunks) to clear the >500 kB bundle warning | Eng C | P2 | TASK-026 | S | `npm run build` completes with no chunk-size warning. | PERF-003 prep |
| TASK-064 | Run `npm audit --audit-level=moderate` and resolve or waive findings (audit was skipped with `--no-audit` during the build) | Eng B | P2 | TASK-037 | S | Audit report archived; findings fixed or explicitly waived in writing. | Security hygiene |

## 3. Critical Path Directed Acyclic Graph (DAG)

```
[TASK-001: Monorepo & Docker]
            │
            ▼
[TASK-002: Postgres/PostGIS/pgcrypto] ──────► [TASK-006: Auth & RBAC]
            │                                            │
            ▼                                            ▼
[TASK-003: Schema DDLs] ──────────► [TASK-007..010: Ingestion APIs]
            │                                            │
            ▼                                            │
[TASK-005: Seed Data Generation]                         │
            │                                            │
            ▼                                            │
[TASK-012: Graph Assembler] ◄─────────────────────────────┘
            │
            ▼
[TASK-015..019: CP-SAT Solver, initial] ──► [TASK-044: Interval Reformulation]
            │                                            │
            ▼                                            ▼
[TASK-021: Sentinel, initial] ──────────────► [TASK-047: Sentinel 10-Check + OHE Boundary]
            │                                            │
            ▼                                            ▼
[TASK-022: Fail-Closed Interceptor]          [TASK-041: Hardened DDL] ──► [TASK-042: Ledger Concurrency]
            │                                            │                          │
            │                                            ▼                          │
            │                              [TASK-048: Signal Ack] ─► [TASK-049: Plan Lifecycle Service]
            │                                                                        │
            │                                                                        ▼
            │                                                          [TASK-050: Approval Service]
            │                                                                        │
            │                              [TASK-051: Emergency Service] ◄──────────┘
            │                                            │
            ▼                                            ▼
[TASK-037: API & Frontend Integration] ◄──── [TASK-052: COA Outbox Adapter]
            │
            ▼
[TASK-053/054: Hardened Frontend] ──► [TASK-055/056: ML Calibration + Benchmark Harness]
            │                                            │
            ▼                                            ▼
[TASK-057: Fault-Injection Suite] ──► [TASK-058: Performance Tuning] ──► [TASK-059: Doc Consistency Pass]
            │
            ▼
[TASK-060: Hardened End-to-End System Verification]
```
