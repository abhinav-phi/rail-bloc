# Document 5: Schema.md — Database & Geospatial Architecture
## [REVISION 1.1 — POST-AUDIT HARDENED]

> **Revision note:** This document has been updated to close the P0/P1 findings from the independent audit (SAFE-001, SAFE-002, SAFE-004, DB-001 through DB-006, FSM-001, APP-001, PERF-002). No component of the original architecture was replaced — only binding, enforcement, and concurrency-safety were added where they were previously missing.

## 1. Logical Architecture & Schemas

The database is deployed on PostgreSQL 16 with the PostGIS 3.4 spatial extension, structured across five logical schemas:

- **infrastructure:** Static track network topology, station locations, block sections, and OHE feeding-section / isolation boundaries.
- **demands:** Ingested maintenance demands from TMS, TDMS, and SMMS.
- **operations:** Timetables, dynamic freight forecasts, train paths, signal disconnection acknowledgments, and emergency incidents.
- **optimization:** AI-generated block plans (with revision/approval binding), shadow co-allocations, and machine rosters.
- **audit:** Append-only, cryptographic SHA-256 hash-chained transaction ledger (concurrency-safe, INSERT-only).

## 2. Table Specifications & PostGIS DDL

```sql
-- Enable required extensions
-- NOTE (SAFE-001): pgcrypto is REQUIRED because the ledger trigger calls digest().
-- Without it, every ledger insert raises "function digest(...) does not exist."
-- uuid-ossp is dropped: gen_random_uuid() is a native PostgreSQL 13+ builtin and
-- does not require any extension. Carrying uuid-ossp was dead weight.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- required for the active-plan EXCLUDE constraint (DB-003)

CREATE SCHEMA IF NOT EXISTS infrastructure;
CREATE SCHEMA IF NOT EXISTS demands;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS optimization;
CREATE SCHEMA IF NOT EXISTS audit;

-- 1. INFRASTRUCTURE SCHEMA
CREATE TABLE infrastructure.block_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_code VARCHAR(32) NOT NULL,
    division VARCHAR(16) NOT NULL,
    zone VARCHAR(8) NOT NULL,
    start_km NUMERIC(7, 3) NOT NULL,
    end_km NUMERIC(7, 3) NOT NULL,
    line_type VARCHAR(16) NOT NULL CHECK (line_type IN ('SINGLE', 'DOUBLE', '3RD_LINE', 'QUAD')),
    electrification VARCHAR(16) NOT NULL DEFAULT '25KV_AC' CHECK (electrification IN ('NONE', '25KV_AC', '2X25KV_AC')),
    speed_limit_mps SMALLINT NOT NULL DEFAULT 110,
    track_geom GEOMETRY(LineString, 4326) NOT NULL,
    -- DB-004 fix: soft-delete instead of hard ON DELETE RESTRICT deadlock for decommissioned sections
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_section UNIQUE (division, section_code)
);

CREATE INDEX idx_block_sections_geom ON infrastructure.block_sections USING GIST (track_geom);
CREATE INDEX idx_block_sections_active ON infrastructure.block_sections (is_active);

-- 1a. OHE FEEDING SECTION MODEL (SAFE-004 fix)
-- Without this, "Power Isolation Boundaries" (Rules.md §1) and G&SR-4 have NO
-- data model and CANNOT be checked by Sentinel. This closes that gap.
CREATE TABLE infrastructure.ohe_feeding_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feeding_section_code VARCHAR(32) NOT NULL,
    division VARCHAR(16) NOT NULL,
    isolator_boundary_geom GEOMETRY(LineString, 4326) NOT NULL,
    substation_ref VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_feeding_section UNIQUE (division, feeding_section_code)
);

CREATE INDEX idx_ohe_feeding_geom ON infrastructure.ohe_feeding_sections USING GIST (isolator_boundary_geom);

-- Maps each track block section to the OHE feeding section(s) that physically cover it.
-- A TRD block plan is only electrically safe if its section set is fully coverable
-- by a contiguous feeding-section boundary set — this is the enforcement point
-- Sentinel check G&SR-4 queries.
CREATE TABLE infrastructure.section_feeding_map (
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    feeding_section_id UUID NOT NULL REFERENCES infrastructure.ohe_feeding_sections(id) ON DELETE RESTRICT,
    PRIMARY KEY (section_id, feeding_section_id)
);

-- 2. DEMANDS SCHEMA
CREATE TABLE demands.block_demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_source VARCHAR(16) NOT NULL CHECK (external_source IN ('TMS', 'TDMS', 'SMMS', 'BDMS_MANUAL')),
    external_ref_id VARCHAR(64) NOT NULL,
    department VARCHAR(16) NOT NULL CHECK (department IN ('ENGINEERING', 'TRD', 'SIGNAL_TELECOM')),
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    activity_code VARCHAR(32) NOT NULL,
    min_duration_mins SMALLINT NOT NULL CHECK (min_duration_mins > 0),
    earliest_start TIMESTAMPTZ NOT NULL,
    latest_deadline TIMESTAMPTZ NOT NULL,
    urgency_score NUMERIC(4, 3) NOT NULL DEFAULT 0.500 CHECK (urgency_score BETWEEN 0.0 AND 1.0),
    -- ML-002 fix: explicit lineage so it's clear whether urgency came from raw
    -- ingestion (FR-001) or the PyTorch estimator (TASK-013) — the two must not
    -- silently overwrite one another.
    urgency_source VARCHAR(16) NOT NULL DEFAULT 'INGEST_RAW' CHECK (urgency_source IN ('INGEST_RAW', 'ML_ESTIMATED')),
    -- TEL-001 fix: freshness / staleness tracking for spoofing & staleness checks
    source_ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    machinery_req JSONB DEFAULT '[]'::jsonb,
    -- FSM-001 / XC-001 / XC-012 fix: CHECK aligned to the corrected 12-state
    -- Block Demand Lifecycle FSM (AppFlow.md §3), not the original 5-value set.
    status VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
        'SUBMITTED', 'NORMALIZED', 'SCHEDULED_DRAFT', 'SENTINEL_PASSED',
        'APPROVED_SR_DOM', 'AUTHORIZED_DRM', 'TRANSMITTED_COA', 'ACTIVE_GRANTED',
        'COMPLETED_FITNESS', 'ARCHIVED_SEALED', 'CANCELLED', 'ESCALATED_OVERDUE'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_deadline_order CHECK (latest_deadline >= earliest_start)
);

CREATE INDEX idx_demands_dept_status ON demands.block_demands (department, status);
-- PERF-002 fix: GiST range index replaces the plain B-tree, since demand
-- scheduling windows are queried as overlap ranges by the graph assembler,
-- not as independent equality/range predicates.
CREATE INDEX idx_demands_window_gist ON demands.block_demands USING GIST (tstzrange(earliest_start, latest_deadline));
CREATE INDEX idx_demands_section ON demands.block_demands (section_id);
-- DB-006 fix: idempotent re-ingestion key so a re-run TMS/TDMS/SMMS poll does
-- not duplicate demand rows.
CREATE UNIQUE INDEX uq_demands_source_ref ON demands.block_demands (external_source, external_ref_id);

-- 3. OPERATIONS SCHEMA
CREATE TABLE operations.train_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_number VARCHAR(16) NOT NULL,
    train_type VARCHAR(24) NOT NULL CHECK (train_type IN ('VANDE_RAJDHANI', 'MAIL_EXP', 'PASSENGER', 'FREIGHT')),
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    scheduled_entry TIMESTAMPTZ NOT NULL,
    scheduled_exit TIMESTAMPTZ NOT NULL,
    priority_rank SMALLINT NOT NULL DEFAULT 5 CHECK (priority_rank BETWEEN 1 AND 10),
    source VARCHAR(16) NOT NULL DEFAULT 'WTT' CHECK (source IN ('WTT', 'COA_LIVE', 'FOIS_FORECAST')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_train_window CHECK (scheduled_exit > scheduled_entry)
);

CREATE INDEX idx_train_paths_occupancy ON operations.train_paths (section_id, scheduled_entry, scheduled_exit);
CREATE INDEX idx_train_paths_number ON operations.train_paths (train_number);
-- DB-006 fix: idempotent daily WTT re-parse key
CREATE UNIQUE INDEX uq_train_paths_upsert ON operations.train_paths (train_number, section_id, scheduled_entry);

-- 3a. SIGNAL & TELECOM ACKNOWLEDGMENT (SAFE-004 fix)
-- Enforcement point for G&SR-2 "Deterministic Interlocking Precedence": a
-- Signal & Telecom demand cannot transition into an active work window until
-- BOTH the Station Master and the Chief Controller have formally acknowledged
-- the disconnection. Previously this rule existed only as prose in Rules.md
-- with no schema, no API, and no enforcement point.
CREATE TABLE operations.signal_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL, -- FK added below after optimization.block_plans exists
    sm_actor VARCHAR(64),
    sm_acked_at TIMESTAMPTZ,
    controller_actor VARCHAR(64),
    controller_acked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3b. EMERGENCY INCIDENTS (SAFE-003 fix)
-- Persists P0 emergency events so the Emergency Service (not Sentinel) can
-- issue advisory revocations, coalesce concurrent incidents on adjacent
-- sections, and hand the plan a PROVISIONAL status pending Controller ack.
CREATE TABLE operations.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    incident_type VARCHAR(32) NOT NULL CHECK (incident_type IN ('TRACK_FRACTURE', 'OHE_BREAKDOWN', 'SIGNAL_FAILURE', 'OTHER')),
    reported_by VARCHAR(64) NOT NULL,
    estimated_duration_mins SMALLINT,
    coalesced_into_incident_id UUID REFERENCES operations.incidents(id),
    controller_acknowledged BOOLEAN NOT NULL DEFAULT false,
    controller_ack_actor VARCHAR(64),
    controller_ack_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_section ON operations.incidents (section_id, created_at DESC);

-- 4. OPTIMIZATION SCHEMA
CREATE TABLE optimization.block_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_horizon VARCHAR(16) NOT NULL CHECK (plan_horizon IN ('STRATEGIC_26W', 'WEEKLY', 'REALTIME')),
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    primary_demand_id UUID NOT NULL REFERENCES demands.block_demands(id) ON DELETE RESTRICT,
    is_shadow_block BOOLEAN NOT NULL DEFAULT false,
    solver_run_id UUID NOT NULL,
    loss_pax_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    loss_frt_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    sentinel_verified BOOLEAN NOT NULL DEFAULT false,

    -- ===== SAFE-002 fix: binding columns =====
    -- Without these, nothing forces re-verification after FR-014's "Modify
    -- Parameters" action. This is the single worst safety bypass identified
    -- in the audit: an edited plan could be authorized and transmitted to
    -- COA without Sentinel ever having seen the edited content.
    revision_no INT NOT NULL DEFAULT 1,
    supersedes_id UUID REFERENCES optimization.block_plans(id),
    -- SHA-256 over canonical JSON: {section_id, start_time, end_time,
    -- primary_demand_id, shadow_demand_ids SORTED ASCENDING}. Any mutation
    -- changes this hash.
    content_hash CHAR(64) NOT NULL,
    -- The content_hash value that Sentinel actually verified. approve /
    -- authorize / transmit must all recompute content_hash server-side and
    -- reject (409) if it no longer matches sentinel_hash.
    sentinel_hash CHAR(64),

    -- ===== APP-001 fix: distinct-approver enforcement =====
    decided_by VARCHAR(64),
    decided_at TIMESTAMPTZ,
    authorized_by VARCHAR(64),
    authorized_at TIMESTAMPTZ,

    -- ===== FSM-001 / XC-001 fix: 12-state CHECK aligned to AppFlow.md §3 =====
    approval_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' CHECK (approval_status IN (
        'DRAFT', 'SENTINEL_PASSED', 'APPROVED_SR_DOM', 'AUTHORIZED_DRM',
        'TRANSMITTED_COA', 'ACTIVE_GRANTED', 'COMPLETED_FITNESS', 'ARCHIVED_SEALED',
        'SUPERSEDED', 'SUPERSEDED_EMERGENCY', 'CANCELLED', 'FAILED_ESCALATE'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_plan_window CHECK (end_time > start_time),
    CONSTRAINT chk_distinct_approvers CHECK (
        authorized_by IS NULL OR decided_by IS NULL OR decided_by <> authorized_by
    )
);

CREATE INDEX idx_block_plans_range ON optimization.block_plans (section_id, start_time, end_time);
CREATE INDEX idx_block_plans_status ON optimization.block_plans (approval_status);

-- DB-003 fix: prevent two racing solver runs from double-booking the same
-- section for overlapping active windows (routine solve vs emergency solve,
-- or two concurrent weekly re-solves).
ALTER TABLE optimization.block_plans
    ADD CONSTRAINT excl_active_overlap EXCLUDE USING gist (
        section_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (approval_status IN ('AUTHORIZED_DRM', 'TRANSMITTED_COA', 'ACTIVE_GRANTED'));

-- Now that block_plans exists, bind signal_acknowledgments to it.
ALTER TABLE operations.signal_acknowledgments
    ADD CONSTRAINT fk_sigack_plan FOREIGN KEY (plan_id) REFERENCES optimization.block_plans(id) ON DELETE RESTRICT;

-- DB-002 fix: shadow_demand_ids UUID[] is replaced with a proper junction
-- table. Postgres cannot enforce FK integrity or de-duplicate array
-- elements, and unstable element ordering breaks content_hash
-- canonicalization used by SAFE-002. Shadow IDs MUST be sorted ascending
-- before hashing at the application layer.
CREATE TABLE optimization.plan_shadow_demands (
    plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
    demand_id UUID NOT NULL REFERENCES demands.block_demands(id) ON DELETE RESTRICT,
    PRIMARY KEY (plan_id, demand_id)
);

-- DB-004 fix (P2, multi-section corridor blocks): a real block (e.g.
-- GZB-ALJN Down Main Line) frequently spans multiple block_sections. The
-- original single section_id column on block_plans cannot represent this.
-- This junction allows a plan to reference multiple contiguous sections
-- while start_time/end_time/section_id on block_plans remain the primary
-- (first) section for backward-compatible single-section queries.
CREATE TABLE optimization.plan_sections (
    plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    sequence_order SMALLINT NOT NULL DEFAULT 1,
    PRIMARY KEY (plan_id, section_id)
);

-- DB-005 fix: FR-009's Track Machine Route Optimizer (VRP sub-model) output
-- was never persisted anywhere. This table stores the machine roster the
-- solver's machine-routing stage produces.
CREATE TABLE optimization.machine_rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id VARCHAR(32) NOT NULL,
    plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
    depot_origin VARCHAR(64),
    travel_start TIMESTAMPTZ NOT NULL,
    travel_end TIMESTAMPTZ NOT NULL,
    solver_run_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_roster_window CHECK (travel_end > travel_start)
);

CREATE INDEX idx_machine_rosters_plan ON optimization.machine_rosters (plan_id);

-- 5. AUDIT SCHEMA (CRYPTOGRAPHIC SHA-256 HASH CHAIN)
CREATE TABLE audit.action_ledger (
    seq BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    payload_json JSONB NOT NULL,
    -- DB-001 fix: explicit prev_seq column so chain-walking during
    -- verification does not depend on arithmetic over seq, which is unsafe
    -- once BIGSERIAL gaps exist (rolled-back transactions).
    prev_seq BIGINT,
    prev_hash VARCHAR(64) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revoke mutation rights on audit ledger from PUBLIC. NOTE (DB-001): this
-- REVOKE does NOT bind the table owner or superuser. A dedicated INSERT-only
-- role is created below and MUST be the role the application connects as.
REVOKE UPDATE, DELETE, TRUNCATE ON audit.action_ledger FROM PUBLIC;

CREATE ROLE ledger_writer NOLOGIN;
GRANT INSERT, SELECT ON audit.action_ledger TO ledger_writer;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.action_ledger FROM ledger_writer;

-- Guard trigger: even the table owner cannot UPDATE or DELETE a sealed row.
-- Any attempt (including by a superuser role that bypasses GRANT/REVOKE)
-- raises and is logged.
CREATE OR REPLACE FUNCTION audit.fn_block_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit.action_ledger is append-only: % is prohibited on sealed ledger rows', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_ledger_update
BEFORE UPDATE ON audit.action_ledger
FOR EACH ROW EXECUTE FUNCTION audit.fn_block_ledger_mutation();

CREATE TRIGGER trg_block_ledger_delete
BEFORE DELETE ON audit.action_ledger
FOR EACH ROW EXECUTE FUNCTION audit.fn_block_ledger_mutation();

-- Cryptographic Trigger Function for Ledger Hash Integrity
-- DB-001 fix: the original `WHERE seq = NEW.seq - 1` lookup races under
-- concurrent inserts (the predecessor row may not yet be visible/committed)
-- and permanently bricks the chain the first time any transaction touching
-- the ledger rolls back (a BIGSERIAL gap becomes an unfillable hole).
-- Fix: serialize ledger writers with a session-level advisory transaction
-- lock, then look up the LAST COMMITTED row by seq DESC rather than by
-- arithmetic subtraction.
CREATE OR REPLACE FUNCTION audit.fn_seal_ledger_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_prev_seq BIGINT;
    v_prev_hash VARCHAR(64);
BEGIN
    -- Serialize all ledger inserts within this transaction's lifetime.
    PERFORM pg_advisory_xact_lock(hashtext('audit_ledger'));

    SELECT seq, hash INTO v_prev_seq, v_prev_hash
    FROM audit.action_ledger
    ORDER BY seq DESC
    LIMIT 1;

    IF v_prev_seq IS NULL THEN
        v_prev_seq := 0;
        v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    NEW.prev_seq := v_prev_seq;
    NEW.prev_hash := v_prev_hash;
    NEW.hash := encode(digest(NEW.seq::text || NEW.event_type || NEW.actor_id || NEW.payload_json::text || v_prev_hash, 'sha256'), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seal_ledger_entry
BEFORE INSERT ON audit.action_ledger
FOR EACH ROW
EXECUTE FUNCTION audit.fn_seal_ledger_entry();
```

## 3. Post-Audit Schema Change Log (traceability to findings)

| Audit ID | Change Applied |
|---|---|
| SAFE-001 | Added `pgcrypto` extension; removed unused `uuid-ossp`. |
| SAFE-002 | Added `revision_no`, `supersedes_id`, `content_hash`, `sentinel_hash`, `decided_by/at`, `authorized_by/at`, `chk_distinct_approvers` to `block_plans`. |
| SAFE-004 | Added `infrastructure.ohe_feeding_sections`, `infrastructure.section_feeding_map`, `operations.signal_acknowledgments`. |
| SAFE-003 | Added `operations.incidents` with coalescing (`coalesced_into_incident_id`) and Controller-acknowledgment columns. |
| FSM-001 / XC-001 / XC-012 | `block_plans.approval_status` extended to 12 states; `block_demands.status` extended to 12 states including `ESCALATED_OVERDUE`. |
| APP-001 | Distinct-approver CHECK constraint; `decided_by`/`authorized_by` columns for server-side identity comparison. |
| DB-001 | Advisory-lock ledger trigger, explicit `prev_seq`, `ledger_writer` INSERT-only role, UPDATE/DELETE guard triggers. |
| DB-002 | `shadow_demand_ids UUID[]` replaced with `optimization.plan_shadow_demands` junction table. |
| DB-003 | `excl_active_overlap` EXCLUDE constraint (requires `btree_gist`). |
| DB-004 | `is_active` soft-delete flag on `block_sections`; `optimization.plan_sections` junction for multi-section corridor blocks. |
| DB-005 | Added `optimization.machine_rosters`. |
| DB-006 | Unique upsert keys on `demands.block_demands` and `operations.train_paths`. |
| PERF-002 | GiST range index on demand scheduling windows replacing plain B-tree. |
| ML-002 | Added `urgency_source` lineage column to `block_demands`. |
| TEL-001 | Added `source_ingested_at` for staleness/freshness checks. |

**Note on "7 tables" (DOC-004 / XC-008):** the original Tracker.md claim of 7 tables against a 5-table DDL is resolved by this revision, which now defines the additional tables the functional requirements actually require (`ohe_feeding_sections`, `section_feeding_map`, `signal_acknowledgments`, `incidents`, `plan_shadow_demands`, `plan_sections`, `machine_rosters`) — 12 tables total across the five schemas. Tracker.md is corrected accordingly.
