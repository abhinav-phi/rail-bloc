# Document 2: TechSpec.md — Technical Architecture Specification
## [REVISION 1.1 — POST-AUDIT HARDENED]

> **Revision note:** Closes MILP-001, MILP-002, MILP-003, MILP-004, APP-001, API-001, TEL-001, SAFE-003, SAFE-006, DOC-005, XC-006, XC-007, XC-011 from the independent audit. The optimization model in the original §2 was mathematically malformed (undefined symbols, unconstrained decision variables, an infeasible exclusion constraint on saturated corridors) and is fully reformulated below. The core technology choices (CP-SAT, modular monolith, PostGIS) are unchanged.

## 1. System Architecture Overview

RAIL-BLOC follows a high-throughput, modular service architecture. Three services are added versus the original diagram to close binding, approval-enforcement, and emergency-safety gaps (SAFE-002, APP-001, SAFE-003):

```
                  [ FRONTEND INTERFACE ]
                Atlas: Spatial Console
             (React 18 + MapLibre GL JS)
       (+ stale-state overlay, honest 10-check card,
        colorblind-redundant states, sim-data watermark)
                         │
                         ▼ (HTTPS / REST / SSE)
         ┌──────────────────────────────────────────────┐
         │   FASTAPI API GATEWAY (AuthN, RBAC, division  │
         │   object-scope, idempotency keys)             │
         └───────┬──────────────────────┬────────────────┘
                 │                      │
                 ▼                      ▼
        ┌─────────────────┐    ┌─────────────────┐
        │ Nexus Ingestion │    │ Actuator Engine │
        │ (per-source     │    │ (COA / Field,   │
        │  creds, staleness│   │  outbox pattern) │
        │  TTL — TEL-001) │    └────────┬────────┘
        └────────┬────────┘             │
                 │                      │
                 ▼                      ▼
        ┌────────────────────────────────────────┐
        │            REDIS TASK QUEUE            │
        │      (single instance, async solve)     │
        └───────────────────┬────────────────────┘
                            │
                            ▼
        ┌────────────────────────────────────────┐
        │         Optima Optimizer Core          │
        │   (OR-Tools CP-SAT, interval-based —    │
        │    reformulated, see §2 below)          │
        └───────────────────┬────────────────────┘
                            │
                            ▼
        ┌────────────────────────────────────────┐
        │        Sentinel Safety Guardrail       │
        │  (10 enumerated deterministic G&SR /   │
        │   MILP checks + OHE boundary check —   │
        │   see Rules.md §1, Design.md §3)        │
        └───────────────────┬────────────────────┘
                            │
                            ▼
        ┌────────────────────────────────────────┐
        │   Plan Lifecycle Service (NEW)         │
        │   revision_no / content_hash /          │
        │   supersedes_id binding — SAFE-002      │
        └───────────────────┬────────────────────┘
                            │
                            ▼
        ┌────────────────────────────────────────┐
        │   Approval Service (NEW)               │
        │   distinct-approver CHECK, idempotent   │
        │   decide, division scoping — APP-001    │
        └───────────────────┬────────────────────┘
                            │
                            ▼
        ┌────────────────────────────────────────┐
        │        PostgreSQL 16 + PostGIS         │
        │    (Relational & Spatial Storage)      │
        │                   │                    │
        │         Chronicle Ledger Table         │
        │   (SHA-256 hash chain, advisory-locked, │
        │    INSERT-only ledger_writer role)      │
        └────────────────────────────────────────┘

        ┌────────────────────────────────────────┐
        │   Emergency Service (NEW — SAFE-003)   │
        │   incident coalescing, PROVISIONAL      │
        │   plans, advisory revoke to COA/SSE,    │
        │   Controller-acknowledgment gate        │
        └────────────────────────────────────────┘
```

## 2. Mathematical Optimization Model Specification (REFORMULATED)

> **Why this was rewritten (MILP-001, MILP-002):** the original objective had free indices with no summation binding them (`e` in the urgency term, `k₁,k₂` in the shadow term), four undefined symbols (`Δt_p(t)`, `Δt_f(t)`, `u_{m,e,t}`, `Idle(m,t)`), and treated train occupancy (`z`, `w`) as *free* decision variables with no constraint linking them to the actual timetable — meaning the trivial "optimal" solution was simply zero train occupancy everywhere, producing fictional zero-delay KPIs. Separately, the Absolute Block Exclusion constraint as originally written forbade **any two trains from sharing a section in the same 15-minute interval**, which is infeasible on the saturated corridors the problem statement is built around. Both are fixed below by making train occupancy an exogenous parameter (not a decision variable) and moving from binary time-bucket exclusion to interval-based `NoOverlap` scheduling.

### Sets and Parameters

- $e \in E$: Set of directed block sections.
- $k \in K$: Set of maintenance demands (Civil/ENG, Electrical/TRD, Signal/S&T), each already bound to a section via `demands.block_demands.section_id`.
- $D_k$: Minimum required duration of demand $k$ (`min_duration_mins`).
- $[\text{ES}_k, \text{LD}_k]$: Earliest-start / latest-deadline window for demand $k$.
- $\Pi_k(t)$: **Time-weighted** urgency of demand $k$ if unexecuted at time $t$ (MILP-003 fix — see below; the original was time-flat and gave no incentive to schedule urgent work early).
- $p \in P$: Timetabled passenger train paths — **exogenous parameters**, not decision variables. Each $p$ has a fixed interval $[\text{Entry}_{p,e}, \text{Exit}_{p,e}]$ per section $e$ it traverses, sourced from `operations.train_paths` (WTT).
- $f \in F$: Forecasted freight train paths — exogenous parameters from FOIS, each carrying a probabilistic occupancy weight $\rho_f \in [0,1]$ used only in the objective (not feasibility) below a configurable confidence threshold.
- $H$: Headway margin (15 minutes per Rules.md §1) — applied as interval expansion, not a separate constraint.
- $m \in M$: Heavy mechanized maintenance machines, resolved in a **separate VRP sub-model** (§2.4) with real travel-time arcs.

### Decision Variables (interval-based, CP-SAT `OptionalIntervalVar`)

- $X_k$: **One** optional interval variable per demand $k$, with `start ∈ [ES_k, LD_k]`, `size ≥ D_k`, `is_present ∈ {0,1}`. This replaces the original per-timestep binary $x_{k,e,t}$ and **eliminates the "x-flicker" exploit (MILP-004)** by construction — a demand is either scheduled as one contiguous interval or not scheduled at all; there is no way to represent fragmented/discontinuous execution.
- $Y_e(t)$: **Derived**, not free — section $e$ is under block isolation at time $t$ iff some present $X_k$ bound to $e$ covers $t$. (Replaces the original free binary $y_{e,t}$, which had no forcing constraint tying it to actual `x` values beyond one-directional enclosure.)
- $S_{k_1,k_2}$: Boolean, block-level (not per-timestep) shadow-bundling indicator between a Civil demand $k_1$ and a TRD/S&T demand $k_2$ on the same section, true only if their intervals' windows are **contained within a shared bundle window** (MILP-C3 fix — the original per-$t$ formulation allowed partial-overlap "shadow" claims to be rewarded).
- $U_{m,e}$: Machine $m$'s assignment interval on section $e$, resolved in the VRP sub-model (§2.4), with travel-time arcs between the machine's depot/prior assignment and $e$.

### Multi-Objective Formulation

$$\min \mathcal{Z} = \underbrace{\sum_{p \in P} C_{\text{pax}} \cdot \text{Delay}_p}_{\text{path-replay, §2.2}} + \underbrace{\sum_{f \in F} C_{\text{frt}} \cdot \rho_f \cdot \text{Delay}_f}_{\text{path-replay, §2.2}} + \sum_{k \in K} \Pi_k(\text{LD}_k) \cdot (1 - \text{is\_present}(X_k)) - \Omega_{\text{shadow}} \cdot \sum_{(k_1,k_2)} S_{k_1,k_2} + \sum_{m \in M} C_{\text{mach}} \cdot \text{Idle}(m)$$

Every undefined symbol from the original formulation is now concretely defined:

- **$\text{Delay}_p$ / $\text{Delay}_f$** are **not** free objective terms — they are computed by a deterministic path-replay function: a train's delay is the displacement (in minutes) between its WTT/FOIS scheduled entry time on section $e$ and its entry time under the candidate schedule, which only changes if an `is_present(X_k)=1` interval on $e$ forces a hold or reroute. If no block intersects a train's path, its delay is provably zero — this is checked, not assumed.
- **$\Pi_k(\text{LD}_k)$** — time-weighted urgency (MILP-003 fix): $\Pi_k(t) = \Pi_k^{\text{base}} \cdot \big(1 + \gamma \cdot \frac{t - \text{ES}_k}{\text{LD}_k - \text{ES}_k}\big)$, so urgency grows monotonically as the deadline approaches, removing the incentive to park urgent work at the edge of the horizon.
- **$\text{Idle}(m)$** — defined in the VRP sub-model (§2.4) as total non-traveling, non-working machine time within the planning horizon.

### Primary Constraints (reformulated)

**Section Exclusion via NoOverlap (replaces the original `Σz + Σw + y ≤ 1` — fixes MILP-002):**

For every section $e$, a single `NoOverlap` constraint is posted over the union of:
1. Every present $X_k$ bound to section $e$, and
2. Every fixed train interval $[\text{Entry}_{p,e} - H, \text{Exit}_{p,e} + H]$ and $[\text{Entry}_{f,e} - H, \text{Exit}_{f,e} + H]$ (headway-expanded, per Rules.md §1's 15-minute margin).

This forbids a maintenance block from overlapping **any individual train's** occupancy window on that section — the correct safety property — without falsely forbidding two trains from legitimately traversing the same saturated section in the same 15-minute bucket, since trains are no longer forced onto a shared discrete grid against each other.

**Maintenance Enclosure:** by construction, $Y_e(t)=1$ for every $t$ covered by a present $X_k$ on $e$ — enclosure no longer needs a separate inequality; it is definitional.

**Shadow Block Coupling (window-containment, fixes MILP-C3):**

$$S_{k_1,k_2} = 1 \implies \text{window}(X_{k_1}) \supseteq \text{window}(X_{k_2}) \lor \text{window}(X_{k_2}) \supseteq \text{window}(X_{k_1}), \quad \forall k_1 \in \text{ENG}, k_2 \in \{\text{TRD}, \text{S\&T}\} \text{ sharing a section}$$

**Non-Fragmented Duration:** enforced by construction — each $X_k$ is a single `OptionalIntervalVar` of `size ≥ D_k`; fragmented/discontinuous execution is not representable.

### §2.3 Sentinel-Checkable Invariant Set

The 10 deterministic checks Sentinel evaluates against every candidate plan (see Rules.md §1, enumerated in full in Design.md §3's Action Preview Card) map directly to this model:

1. G&SR-1 Absolute Block Exclusion (NoOverlap holds for every section)
2. G&SR-2 Interlocking Precedence (`operations.signal_acknowledgments` present for all S&T demands in-plan)
3. G&SR-3 Fail-Closed Consistency (no state transition occurred under a stale/missing feed)
4. G&SR-4 Power Isolation Boundary (plan's section set is coverable by `infrastructure.section_feeding_map`)
5. G&SR-5 Headway Margin (≥15 min enforced by the NoOverlap expansion above)
6. MILP-C1 Section Exclusion (structural re-check of the solver's own NoOverlap output)
7. MILP-C2 Maintenance Enclosure ($Y_e(t)=1$ for all $X_k$-covered intervals)
8. MILP-C3 Shadow Bundling Window Containment
9. MILP-C4 Non-Fragmented Duration (single-interval-per-demand structural check)
10. MILP-C5 Machine Spatial Conservation (§2.4)

**Sentinel also re-runs the structural subset (checks 1, 5, 6, 9) synchronously at T−2h transmission time against the latest COA_LIVE/RTIS train positions** — closing the "zero-slack window" composition gap (audit §6, item 1) where a plan valid against the timetable at solve-time could conflict with a delayed train still physically occupying a section at transmission time.

### §2.4 Machine Routing Sub-Model (FR-009, separately solved)

A Vehicle Routing Problem (VRP) sub-model assigns machines $m \in M$ to demand intervals via $U_{m,e}$, using real travel-time arcs computed from PostGIS `ST_Distance`/routing between the machine's current depot or prior assignment and section $e$'s geometry. $\text{Idle}(m)$ is the machine's total non-traveling, non-working time in-horizon. Output is persisted to `optimization.machine_rosters` (new table, Schema.md §2, DB-005 fix) — the original spec defined this output but never persisted it anywhere.

**Machine Spatial Conservation:**

$$\sum_{e \in E} U_{m,e}(t) \le 1, \quad \forall m \in M, \forall t \in T$$

### §2.5 Solver Warm-Start and Status Reporting

CP-SAT is warm-started using Baseline 1's ($B_1$) greedy heuristic solution as a search hint (`AddHint`) — this both improves solve latency toward the ≤35s p95 target (NFR-001, PERF-001) and guarantees RAIL-BLOC's solution is never worse than the honest baseline it is benchmarked against. **Every solve reports its CP-SAT status (`OPTIMAL`/`FEASIBLE`/`INFEASIBLE`/`UNKNOWN`) and best bound alongside the schedule** — see ADR-002 correction below; the system does not claim guaranteed optimality under a hard time budget.

## 3. Technology Stack & Component Justification

| Layer | Selected Technology | Version | Rationale & Trade-off Justification |
|---|---|---|---|
| Frontend Core | React + TypeScript (Vite) | React 18.3+ | Type safety, high rendering speed, component modularity. |
| Geospatial Map | MapLibre GL JS | v4.1+ | Open-source, GPU-accelerated vector rendering of large track graphs. |
| Backend Framework | FastAPI (Python) | v0.111+ | Asynchronous I/O, native Pydantic validation, OpenAPI compliance. |
| Optimization Core | Google OR-Tools (CP-SAT) | v9.9+ | High-performance interval/constraint scheduling — see §2 reformulation. |
| Predictive ML | PyTorch + XGBoost | PyTorch 2.3+ | Tabular defect growth modeling and time-series freight forecasting; advisory-only (Rules.md §2), feeds objective parameters ($\Pi_k$, $\rho_f$), never a feasibility constraint. |
| Database | PostgreSQL + PostGIS | PG 16 / PostGIS 3.4 | Relational integrity, ACID compliance, native spatial indexing (GiST), pgcrypto for ledger hashing (SAFE-001). |
| Queue / Cache | Redis | v7.2+ | Low-latency task queue for asynchronous optimization worker jobs. |
| Containerization | Docker + Compose | Docker v26.0+ | Reproducible, isolated multi-container deployment architecture. |

## 4. API Specification Contract (HARDENED)

All routes are versioned under `/api/v1`. Division-scoped object access applies on top of role gating: a non-admin actor may only touch objects whose owning section belongs to the actor's division.

### Auth
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/auth/login | POST | public | username, password | JWT access_token, role, division | 200, 401 |
| /api/v1/auth/me | GET | any bearer | — | actor claims (username/role/division) | 200 |

### Demands (Nexus)
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/demands/ingest | POST | **Split auth (XC-011 fix):** machine feeds authenticate via per-source key headers (`X-Source-System`, `X-Source-Key`), not a human role; BDMS_MANUAL keeps human RBAC | bulk demand records with `observed_at` | ingested/rejected counts + per-record staleness/plausibility diagnostics (TEL-001); upsert on source reference (DB-006) | 201, 400, 401, 422 |
| /api/v1/demands | GET | any bearer (division-scoped) | filters: status, department, division | demand list | 200 |
| /api/v1/demands/manual | POST | ENGINEER, ADMIN | single manual record | ok flag | 200, 400, 403 |

### Optimize
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/optimize/solve | POST | SR_DOM, ADMIN (division match) | horizon, division | task id; per-division Redis solve lock (DB-003 companion) | 202, 400, 403, 409 |
| /api/v1/optimize/status/{task_id} | GET | operations roles incl. AUDITOR (**API-002 fix — was ALL**) | — | run state + stats JSON | 200, 404 |

### Plans & Lifecycle
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/plans | GET | any bearer (division-scoped) | horizon, division, status, limit | plan list | 200 |
| /api/v1/plans/weekly | GET | any bearer (division-scoped) | division, week_number | weekly schedule feed | 200 |
| /api/v1/plans/geo | GET | any bearer | — | GeoJSON sections/blocks/OHE layers | 200 |
| /api/v1/plans/timetable | GET | any bearer | — | train-path feed for string chart/map | 200 |
| /api/v1/plans/summary | GET | any bearer | — | KPIs, escalated-overdue list, fleet utilization | 200 |
| /api/v1/plans/{id} | GET | any bearer (division check) | — | plan bundle: demands, acks, roster | 200, 403, 404 |
| /api/v1/plans/{id}/sentinel-report | GET | any bearer | — | live re-run of the 10 checks bound to content_hash | 200, 404 |
| /api/v1/plans/{id}/acknowledge-signal | POST | STATION_MASTER, CONTROLLER, ADMIN | as_role | both_acknowledged flag; flips DRAFT → SENTINEL_PASSED when both exist (SAFE-004/G&SR-2) | 200, 404 |
| /api/v1/plans/{id}/revise | POST | SR_DOM, ENGINEER, ADMIN | optional new start/end | revision n+1 at DRAFT, sentinel_verified cleared (SAFE-002/FR-026) | 200, 400, 403, 404, 409 |
| /api/v1/plans/{id}/transmit | POST | SR_DOM, CONTROLLER, ADMIN | — | hash gate vs sentinel_hash (R6.2), T−2h structural re-check, outbox enqueue; TRANSMITTED_COA only on COA ack (SAFE-006) | 200, 403, 404, 409 |
| /api/v1/plans/{id}/activate | POST | CONTROLLER, ADMIN | — | block start; ACTIVE_GRANTED | 200, 403, 409 |
| /api/v1/plans/{id}/complete-fitness | POST | ENGINEER, STATION_MASTER, CONTROLLER, ADMIN | — | SSE fitness certification; COMPLETED_FITNESS | 200, 403, 409 |
| /api/v1/plans/{id}/archive | POST | ADMIN, AUDITOR | — | ARCHIVED_SEALED seal | 200, 403, 409 |
| /api/v1/plans/{id}/cancel | POST | SR_DOM, DRM, ADMIN | — | CANCELLED (pre-transmission only) | 200, 403, 409 |

### Approvals
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/approvals/decide | POST | SR_DOM, DRM | plan_id, decision, digital signature, **idempotency key (required)** | updated status, ledger transaction hash. **Server recomputes content_hash and rejects (409) on mismatch with sentinel_hash; rejects if decided_by == authorized_by; replays return the stored response via idempotency key; rejects cross-division object access.** | 200, 400, 403, 409 |

### Emergency
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/emergency/blast-radius | GET | CONTROLLER, SR_DOM, DRM, ENGINEER, ADMIN | section_id, duration | trains held, plans superseded, adjacent sections (API-001 modal data) | 200 |
| /api/v1/emergency/breakdown | POST | CONTROLLER | section_id, type, duration, **confirmation flag (blast-radius acknowledged), idempotency key** | incident id (+coalescing), PROVISIONAL plan within ≤45 s budget incl. synchronous structural checks, measured wall time; fails closed if structural checks fail (SAFE-003/ADR-006) | 201, 400, 500 |
| /api/v1/emergency/incidents | GET | any bearer | — | incident feed incl. coalescing links and ack state | 200 |
| /api/v1/emergency/incidents/{id}/acknowledge | POST | CONTROLLER | — | Controller-ack gate enabling outbox transmission of the PROVISIONAL plan | 200, 404 |

### Ledger (Chronicle)
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/ledger/verify | GET | AUDITOR, ADMIN | none | full-chain re-hash under `REPEATABLE READ` snapshot so a verification pass mid-write sees a consistent view rather than a torn read (API-002 note) | 200, 409 |
| /api/v1/ledger/entries | GET | AUDITOR, ADMIN | limit, offset, event_type | explorer feed | 200 |

### Stream
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/stream/live-blocks | GET (SSE) | any bearer via query token (`?token=`; EventSource cannot set headers) | — | real-time stream of block activations/releases/transmissions; heartbeats between events. **Re-authenticates on every reconnect; client must show a persistent "STALE DATA" state if the stream drops or heartbeats lapse (Design.md §3).** | 200, 401 |

### Weather (FR-019 / TEL-002)
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/weather/alerts | GET | any bearer | — | alerts ∩ sections via PostGIS `ST_Intersects`, plus feed-staleness flag | 200 |
| /api/v1/weather/deferred-activities | GET | any bearer | — | fail-closed deferred work types (stale/missing feed defers outdoor high-risk work) | 200 |

### Operations
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /api/v1/operations/timetable/upload | POST | ADMIN, ENGINEER | timetable rows | upsert count keyed on (train_number, section_id, scheduled_entry) — DB-006 | 200, 400 |
| /api/v1/operations/feeds/wtt-poll | POST | per-source key headers | — | poll readiness report | 200, 401 |

### Health
| Route Endpoint | Verb | RBAC | Request | Response | Codes |
|---|---|---|---|---|---|
| /health | GET | public | — | liveness + database probe (reports degraded, never lies) | 200 |

## 5. Architectural Decision Records (ADRs)

### ADR-001: Modular Monolith vs. Distributed Microservices

- **Context:** SIH deployment requires rapid setup, deterministic transactions, and minimal DevOps overhead.
- **Decision:** Implement a Modular Monolith in FastAPI with Redis background workers.
- **Consequence:** Eliminates distributed transaction failures; simplifies single-command Docker deployment.

### ADR-002: Google OR-Tools CP-SAT over Reinforcement Learning

- **Context:** Autonomous scheduling requires 100% adherence to safety invariants and predictable convergence.
- **Decision:** Use OR-Tools CP-SAT for multi-horizon scheduling, using ML only for parameter estimation (defect risk, freight density).
- **Consequence (CORRECTED — XC-007 fix):** CP-SAT under a hard ≤35s p95 time budget (NFR-001) returns the best **feasible** solution found plus a provable **bound**, not a guaranteed-optimal solution on every run. The original wording "guarantees mathematical optimality" is overstated and is replaced with: *every solve reports its CP-SAT solver status (OPTIMAL/FEASIBLE/UNKNOWN) and best bound alongside the schedule, and every returned schedule is 100% constraint-verified regardless of status.* This still eliminates the unsafe exploratory actions inherent in RL — that guarantee is unaffected.

### ADR-003: PostGIS Relational Storage over Pure Graph Database (Neo4j)

- **Context:** Railway data requires both network graph calculations and spatial GIS queries.
- **Decision:** Use PostgreSQL 16 with PostGIS extension.
- **Consequence:** Supports standard SQL ACID transactions, spatial operators (`ST_DWithin`, `ST_Intersects`), and cryptographic trigger functions in a single database engine. **`ST_Intersects` is concretely used in FR-019's weather risk adapter (IMD alert polygon ∩ `block_sections.track_geom`) and in the OHE feeding-section coverage check (SAFE-004) — closing INFO-002's finding that this capability was previously asserted but unused.**

### ADR-004: Deterministic Sentinel Safety Validator

- **Context:** Railway operations strictly enforce Indian Railways General & Subsidiary Rules (G&SR).
- **Decision:** Implement Sentinel as an independent, deterministic Python module executing after optimization and prior to database persistence.
- **Consequence (CORRECTED — DOC-005 fix):** the original description "air-gapped" is imprecise, since Sentinel runs in the same FastAPI process as the rest of the modular monolith (ADR-001). The accurate characterization is: **deterministic, side-effect-free, makes no network calls, and invokes no ML model** — its inputs are exactly the candidate plan and the database's current structural state, and its output is a binary pass/fail token plus the 10-check breakdown (§2.3). Any model hallucination or solver bug is intercepted and blocked before field transmission.

### ADR-005: Interval-Based CP-SAT Reformulation over Fixed 15-Minute Binary Grid (NEW — MILP-001/002 fix)

- **Context:** The original per-timestep binary formulation (`x_{k,e,t}`, `y_{e,t}`, `z_{p,e,t}`, `w_{f,e,t}`) produced an objective with undefined free-index terms and an exclusion constraint that was infeasible on saturated multi-train corridors — the exact network topology this project targets.
- **Decision:** Reformulate around CP-SAT `OptionalIntervalVar` per demand and `NoOverlap` constraints per section, with train occupancy treated as exogenous fixed intervals rather than free decision variables (§2).
- **Consequence:** The model becomes both mathematically well-defined and feasible on saturated corridors; per-demand execution semantics eliminate the "x-flicker" fragmentation exploit by construction; variable count drops by 2–3 orders of magnitude versus the unrestricted per-(k,e,t) grid, directly supporting the ≤35s p95 solve budget (NFR-001, PERF-001).

### ADR-006: Emergency Path as Advisory PROVISIONAL State, Not Sentinel-Executed Revocation (NEW — SAFE-003 fix)

- **Context:** AppFlow.md's original Scenario A had **Sentinel** directly "revoking" active blocks, contradicting ADR-004 (Sentinel is a post-solve validator, not an executor), and documented no Sentinel run or human approval step within the 45-second emergency window — implicitly requiring NFR-002 (≤45s re-plan) to violate NFR-003 (100% Sentinel verification before presentation).
- **Decision:** A dedicated **Emergency Service** (not Sentinel) issues advisory revocations to COA/SSE field terminals. Sentinel's **structural** checks (deterministic set operations, sub-second) still run synchronously within the 45s budget. The resulting plan is marked `PROVISIONAL` (`SUPERSEDED_EMERGENCY` supersedes the routine plan) and requires explicit **Controller acknowledgment** before it is treated as authoritative — legitimate because the Chief Controller already holds legal dispatch authority under G&SR, and RAIL-BLOC remains decision-support rather than autonomous dispatch.
- **Consequence:** NFR-002 and NFR-003 are both satisfied — no plan ever reaches a console without a Sentinel token bound to its exact `content_hash`, including under emergency timing.
