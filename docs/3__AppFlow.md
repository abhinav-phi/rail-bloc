# Document 3: AppFlow.md — Application & Workflow Specifications
## [REVISION 1.1 — POST-AUDIT HARDENED]

> **Revision note:** Closes FSM-001, FSM-002, SAFE-003, XC-001, XC-006, XC-012, TEL-002 from the independent audit. Both FSMs are extended to match what the schema (Schema.md, post-hardening) can now actually represent, and the P0 Emergency scenario is rewritten so Sentinel is correctly positioned as a validator, not an executor.

## 1. Global Sitemap & Navigation Structure

- **/login:** Role-authenticated login supporting Indian Railways SSO credentials.
- **/dashboard:** Executive overview displaying operational punctuality, active block counts, machine utilization KPIs, and an **overdue/escalated demand list** (FSM-002 fix — safety-critical demands that failed to schedule after the retry cap are surfaced here, not silently dropped).
- **/corridor-map:** MapLibre GL JS spatial view with interactive track overlays, live train tracking (RTIS), and active block zones. Displays a persistent **"SIMULATED DATA"** watermark on synthetic layers (Rules.md §5 demonstration-honesty).
- **/string-chart:** Interactive Time-Distance train graph displaying train trajectory lines and rectangular maintenance block intervals.
- **/planner/26-week:** High-level strategic 26-week rolling calendar view for divisional coordination.
- **/planner/weekly:** Granular tactical weekly block planning console with multi-department shadow block co-allocation controls.
- **/approvals:** Administrative sign-off interface for Sr. DOM and DRM containing the enumerated 10-check Action Preview Card (Design.md §3) and impact summaries labeled as model estimates.
- **/disruptions:** Real-time incident response console for P0 emergency rail fractures, OHE snapping, and severe weather overrides, including the incident coalescing view and Controller-acknowledgment gate.
- **/audit-ledger:** Cryptographic hash ledger browser for audit trail verification (tamper-*evident*, not tamper-proof — see Rules.md §5).

## 2. Primary End-to-End Operational Workflow

1. **Demand Aggregation:** TMS, TDMS, and SMMS APIs transmit maintenance demands to Nexus, authenticating via per-source machine credentials (TEL-001; see TechSpec.md §4).
2. **Spatio-Temporal Mapping:** Nexus maps demands to standard PostGIS `block_sections` and calculates urgency indices $\Pi_k(t)$, tagging each demand's `urgency_source` lineage (raw ingestion vs. ML-estimated).
3. **Traffic Capacity Modeling:** Optima retrieves timetabled passenger paths from WTT and 7-day freight forecasts from FOIS as **exogenous, fixed-interval parameters** (TechSpec.md §2 — not free decision variables).
4. **Optimization Execution:** OR-Tools CP-SAT executes interval-based scheduling (TechSpec.md §2), bundling multi-department works into synchronized shadow blocks, warm-started from the Baseline 1 heuristic.
5. **Safety Validation:** Sentinel executes the 10 enumerated deterministic checks (TechSpec.md §2.3). If any check fails, the schedule transitions to `REJECTED_RETRY` (capped at 3 attempts — FSM-002 fix); if all pass, it transitions to `SENTINEL_PASSED` and its `content_hash` is sealed as `sentinel_hash`.
6. **Divisional Approval:** The Sr. DOM reviews the enumerated Action Preview Card on the Atlas console and approves the plan. The server verifies the plan's current `content_hash` still matches `sentinel_hash` before accepting the decision (SAFE-002) and records `decided_by`.
7. **Divisional Locking:** The DRM authorizes the plan — the server rejects the decision if `decided_by == authorized_by` (APP-001) — locking the 26-week / weekly schedule into the Chronicle cryptographic ledger and recording `authorized_by`.
8. **Field Dispatch:** On the day of operation (T−2h), Sentinel re-runs its structural checks against the latest COA_LIVE/RTIS train positions, then Actuator sends digital block authorities to COA (via an outbox pattern — `PENDING_TRANSMISSION` until COA acknowledges, SAFE-006) and field mobile terminals.
9. **Execution & Clearance:** The SSE certifies work completion and track fitness, releasing the block in COA and updating the audit ledger.

## 3. Finite State Machine (FSM) Formalizations

### Block Demand Lifecycle FSM (EXTENDED — FSM-001/XC-012 fix)

> The original 10-state FSM could not be represented by the original 5-value schema CHECK constraint. The schema (Schema.md, post-hardening) now defines a matching 12-state CHECK. Two states are added: `CANCELLED` (demand withdrawn before scheduling) and `ESCALATED_OVERDUE` (FSM-002 fix — a demand that exhausted its retry cap without being scheduled is surfaced for human escalation rather than remaining silently `PENDING` forever).

- **SUBMITTED:** Raw demand ingested from upstream TMS/TDMS/SMMS.
- **NORMALIZED:** Data validated, spatial coordinates mapped to PostGIS section UUIDs.
- **SCHEDULED_DRAFT:** Temporary time slot assigned by Optima solver.
- **SENTINEL_PASSED:** Formally verified against all 10 enumerated G&SR/MILP safety checks.
- **APPROVED_SR_DOM:** Punctuality and operational impact verified by Sr. DOM; `content_hash` verified server-side against `sentinel_hash`.
- **AUTHORIZED_DRM:** Sealed into formal divisional schedule by a DRM distinct from the approving Sr. DOM.
- **TRANSMITTED_COA:** Digital block token active in Control Office Application, confirmed via COA acknowledgment (not assumed on send — SAFE-006).
- **ACTIVE_GRANTED:** Physical line isolated; maintenance crews working on-track.
- **COMPLETED_FITNESS:** Maintenance finished; track safety certified by SSE.
- **ARCHIVED_SEALED:** Historical record permanently sealed in SHA-256 ledger.
- **CANCELLED:** Demand withdrawn prior to `TRANSMITTED_COA`; sealed to `ARCHIVED_SEALED`.
- **ESCALATED_OVERDUE:** Demand failed to reach `SENTINEL_PASSED` after 3 solver retry cycles; surfaced on `/dashboard` for mandatory human review rather than remaining silently pending.

### Optimization Solver Execution FSM (EXTENDED — FSM-002 fix)

> The original FSM had an unbounded `REJECTED_RETRY` loop with no terminal failure state, meaning a demand could consume solver capacity indefinitely while never actually being scheduled or escalated to a human.

- **IDLE:** Solver engine awaiting trigger.
- **GRAPH_ASSEMBLY:** Compiling network topology, train paths, and demand matrices.
- **SOLVING:** CP-SAT interval-based optimization active (warm-started from Baseline 1 — TechSpec.md §2.5).
- **SENTINEL_EVALUATION:** Deterministic 10-check safety validation of the schedule candidate.
- **COMMITTED:** Valid schedule written to database with audit event; `content_hash` sealed as `sentinel_hash`.
- **REJECTED_RETRY:** Safety violation detected; relaxing soft weights for re-run. **Capped at 3 attempts.**
- **FAILED_ESCALATE_HUMAN (NEW):** Retry cap exhausted without a passing schedule; the underlying demand(s) transition to `ESCALATED_OVERDUE` and are surfaced to Sr. DOM / Sr. DEN for manual intervention rather than silently remaining unscheduled.

### Block Plan Approval-Chain State Set (aligned to Schema.md `block_plans.approval_status`)

```
DRAFT ──Sentinel PASS──► SENTINEL_PASSED ──SrDOM (decided_by)──► APPROVED_SR_DOM ──DRM, decided_by≠authorized_by──► AUTHORIZED_DRM
  │                          │                                       │                                              │
  │ any edit (FR-014         │ Sentinel FAIL (≤3x)                   │ any edit after this point =                 │
  │ "Modify Parameters")     │                                       │ new revision, clears sentinel_verified       │
  ▼                          ▼                                       ▼                                              ▼
SUPERSEDED (revision+1)  REJECTED_RETRY ──3x──► FAILED_ESCALATE   SUPERSEDED (revision+1)                   SUPERSEDED (revision+1)

AUTHORIZED_DRM ──T−2h re-verify + transmit + COA ack (outbox)──► TRANSMITTED_COA ──block start / field confirm──► ACTIVE_GRANTED
TRANSMITTED_COA / ACTIVE_GRANTED ──P0 emergency (Emergency Service, NOT Sentinel)──► SUPERSEDED_EMERGENCY (PROVISIONAL; requires Controller acknowledgment)
ACTIVE_GRANTED ──SSE fitness certification──► COMPLETED_FITNESS ──seal──► ARCHIVED_SEALED
any state < TRANSMITTED_COA ──cancel──► CANCELLED ──► ARCHIVED_SEALED
```

**Binding rule (SAFE-002):** every transition from `SENTINEL_PASSED` onward carries a `content_hash`; `APPROVE`, `AUTHORIZE`, and `TRANSMIT` all recompute the hash server-side and reject the transition (HTTP 409) on mismatch. Any mutation to plan content after `SENTINEL_PASSED` immediately creates a new revision at `DRAFT` and clears `sentinel_verified` — closing the "Modify Parameters" bypass that let an edited plan reach authorization without Sentinel ever re-verifying the edited content.

## 4. Disruption & Exception Handling Protocols

### Scenario A: P0 Emergency Track Fracture / OHE Breakdown (REWRITTEN — SAFE-003 fix)

> **Why this was rewritten:** the original version had "Sentinel instantly revokes all planned blocks," which contradicts Sentinel's role as a post-solve, pre-persistence *validator* (ADR-004) — Sentinel does not execute actions. The original also documented no Sentinel run and no human approval step anywhere inside the 45-second window, which implicitly required NFR-002 (≤45s re-plan) to violate NFR-003 (100% Sentinel verification before presentation). The corrected flow below resolves this without loosening either NFR.

1. Incident logged via API or Chief Controller console into `operations.incidents`. If a second incident is opened on an adjacent section within the same window, it is **coalesced** into the first (prevents conflicting concurrent re-plans).
2. The **Emergency Service** (a dedicated component, not Sentinel) issues an **advisory revocation** to COA and SSE field terminals for all planned blocks on the affected section, via the same outbox-acknowledgment pattern used for routine transmission (SAFE-006).
3. Optima executes a localized, corridor-scoped re-plan within the 45-second budget:
   - Holds upstream freight rakes at designated loop lines.
   - Computes passenger diversions or bi-directional single-line working on adjacent tracks.
   - Inserts an immediate emergency maintenance block window.
4. **Sentinel's structural checks (deterministic set operations — sub-second) run synchronously** against the emergency candidate before it is shown to anyone. This is the same 10-check suite (TechSpec.md §2.3), scoped to the affected corridor.
5. The resulting plan is marked **`PROVISIONAL`** (`SUPERSEDED_EMERGENCY` on the plan it replaces) and is presented to the Chief Controller for **acknowledgment** — not silent auto-execution. This is legitimate because the Controller already holds legal dispatch authority under G&SR; RAIL-BLOC remains decision-support even under emergency timing.
6. Displaced routine maintenance blocks are rolled forward: they **re-enter `DRAFT` and pass through the full Sentinel + Sr. DOM + DRM chain again** — they are not silently re-authorized.

**NFR-002 vs NFR-003 resolution:** the 45-second budget is consumed by the corridor-scoped solve; Sentinel's structural re-check is sub-second and does not need to be skipped. No plan reaches a console — routine or emergency — without a Sentinel token bound to its exact `content_hash`. See TechSpec.md ADR-006.

### Scenario B: Mechanized Track Machine In-Block Breakdown

1. Field SSE logs machine breakdown before block expiration into `operations.incidents`.
2. Actuator freezes incoming train authorities in COA for the target section.
3. Optima extends line closure, halts approaching traffic, and routes a rescue engine to the site via the machine VRP sub-model (TechSpec.md §2.4), persisting the updated roster to `optimization.machine_rosters`.

### Scenario C: Severe Weather Monsoon Red Alert

1. IMD API issues extreme rainfall / lightning warning for a rail subdivision, matched to affected `block_sections` via PostGIS `ST_Intersects` (ADR-003).
2. Outdoor OHE tower wagon and deep ballast screening works are automatically suspended.
3. Optima reschedules labor to sheltered signaling relay room maintenance.
4. **Fail-closed default (TEL-002 fix):** if the IMD feed is stale beyond its configured TTL or unavailable, the system defaults to **deferring** outdoor high-risk work rather than assuming clear weather — the original spec had no documented fallback, which fails open in exactly the wrong direction for a safety-relevant feed.
