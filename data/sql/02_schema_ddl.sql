CREATE SCHEMA IF NOT EXISTS infrastructure;
CREATE SCHEMA IF NOT EXISTS demands;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS optimization;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS auth;

-- ============ INFRASTRUCTURE ============
CREATE TABLE infrastructure.block_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_code VARCHAR(32) NOT NULL,
    division VARCHAR(16) NOT NULL,
    zone VARCHAR(8) NOT NULL,
    start_km NUMERIC(7,3) NOT NULL,
    end_km NUMERIC(7,3) NOT NULL,
    line_type VARCHAR(16) NOT NULL CHECK (line_type IN ('SINGLE','DOUBLE','3RD_LINE','QUAD')),
    electrification VARCHAR(16) NOT NULL DEFAULT '25KV_AC' CHECK (electrification IN ('NONE','25KV_AC','2X25KV_AC')),
    speed_limit_mps SMALLINT NOT NULL DEFAULT 110,
    crossover_points JSONB DEFAULT '[]'::jsonb,   -- RES-07: mission-brief Dataset 1
    track_geom GEOMETRY(LineString, 4326) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,       -- DB-004 soft-delete
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_section UNIQUE (division, section_code)
);
CREATE INDEX idx_block_sections_geom ON infrastructure.block_sections USING GIST (track_geom);
CREATE INDEX idx_block_sections_active ON infrastructure.block_sections (is_active);

-- SAFE-004: OHE feeding-section model (G&SR-4 enforcement data)
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

CREATE TABLE infrastructure.section_feeding_map (
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    feeding_section_id UUID NOT NULL REFERENCES infrastructure.ohe_feeding_sections(id) ON DELETE RESTRICT,
    PRIMARY KEY (section_id, feeding_section_id)
);

-- RES-08: machine registry for VRP sub-model (FR-009 / TASK-045)
CREATE TABLE infrastructure.machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_code VARCHAR(32) NOT NULL UNIQUE,
    machine_class VARCHAR(32) NOT NULL,
    depot_km NUMERIC(7,3) NOT NULL,
    transit_speed_kmph SMALLINT NOT NULL DEFAULT 40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ DEMANDS ============
CREATE TABLE demands.block_demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_source VARCHAR(16) NOT NULL CHECK (external_source IN ('TMS','TDMS','SMMS','BDMS_MANUAL')),
    external_ref_id VARCHAR(64) NOT NULL,
    department VARCHAR(16) NOT NULL CHECK (department IN ('ENGINEERING','TRD','SIGNAL_TELECOM')),
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    activity_code VARCHAR(32) NOT NULL,
    min_duration_mins SMALLINT NOT NULL CHECK (min_duration_mins > 0),
    earliest_start TIMESTAMPTZ NOT NULL,
    latest_deadline TIMESTAMPTZ NOT NULL,
    urgency_score NUMERIC(4,3) NOT NULL DEFAULT 0.500 CHECK (urgency_score BETWEEN 0.0 AND 1.0),
    urgency_source VARCHAR(16) NOT NULL DEFAULT 'INGEST_RAW' CHECK (urgency_source IN ('INGEST_RAW','ML_ESTIMATED')), -- ML-002
    source_ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- TEL-001
    features JSONB NOT NULL DEFAULT '{}'::jsonb,            -- RES-08: ML feature lineage
    machinery_req JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
        'SUBMITTED','NORMALIZED','SCHEDULED_DRAFT','SENTINEL_PASSED','APPROVED_SR_DOM',
        'AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED','COMPLETED_FITNESS',
        'ARCHIVED_SEALED','CANCELLED','ESCALATED_OVERDUE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_deadline_order CHECK (latest_deadline >= earliest_start)
);
CREATE INDEX idx_demands_dept_status ON demands.block_demands (department, status);
CREATE INDEX idx_demands_window_gist ON demands.block_demands USING GIST (tstzrange(earliest_start, latest_deadline)); -- PERF-002
CREATE INDEX idx_demands_section ON demands.block_demands (section_id);
CREATE UNIQUE INDEX uq_demands_source_ref ON demands.block_demands (external_source, external_ref_id); -- DB-006

-- ============ OPERATIONS ============
CREATE TABLE operations.train_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_number VARCHAR(16) NOT NULL,
    train_type VARCHAR(24) NOT NULL CHECK (train_type IN ('VANDE_RAJDHANI','MAIL_EXP','PASSENGER','FREIGHT')),
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    scheduled_entry TIMESTAMPTZ NOT NULL,
    scheduled_exit TIMESTAMPTZ NOT NULL,
    priority_rank SMALLINT NOT NULL DEFAULT 5 CHECK (priority_rank BETWEEN 1 AND 10),
    source VARCHAR(16) NOT NULL DEFAULT 'WTT' CHECK (source IN ('WTT','COA_LIVE','FOIS_FORECAST')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,  -- RES-07: commodity/rake/stabling/forecast_confidence
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_train_window CHECK (scheduled_exit > scheduled_entry)
);
CREATE INDEX idx_train_paths_occupancy ON operations.train_paths (section_id, scheduled_entry, scheduled_exit);
CREATE INDEX idx_train_paths_number ON operations.train_paths (train_number);
CREATE UNIQUE INDEX uq_train_paths_upsert ON operations.train_paths (train_number, section_id, scheduled_entry); -- DB-006

-- SAFE-004: G&SR-2 enforcement entity
CREATE TABLE operations.signal_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL,
    sm_actor VARCHAR(64), sm_acked_at TIMESTAMPTZ,
    controller_actor VARCHAR(64), controller_acked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One acknowledgment row per plan (required by the ack upsert path used by
-- POST /plans/{id}/acknowledge-signal).
CREATE UNIQUE INDEX uq_sigack_plan ON operations.signal_acknowledgments (plan_id);

-- SAFE-003: emergency incident persistence + coalescing
CREATE TABLE operations.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    incident_type VARCHAR(32) NOT NULL CHECK (incident_type IN ('TRACK_FRACTURE','OHE_BREAKDOWN','SIGNAL_FAILURE','OTHER')),
    reported_by VARCHAR(64) NOT NULL,
    estimated_duration_mins SMALLINT,
    coalesced_into_incident_id UUID REFERENCES operations.incidents(id),
    controller_acknowledged BOOLEAN NOT NULL DEFAULT false,
    controller_ack_actor VARCHAR(64),
    controller_ack_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incidents_section ON operations.incidents (section_id, created_at DESC);

-- RES-07: IMD weather alert persistence (FR-019 / TEL-002 fail-closed source)
CREATE TABLE operations.weather_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(32) NOT NULL CHECK (alert_type IN ('THUNDERSTORM_LIGHTNING','TORRENTIAL_RAIN','EXCESSIVE_HEAT_EXPANSION','CYCLONIC_GALE')),
    severity VARCHAR(24) NOT NULL CHECK (severity IN ('YELLOW_WATCH','ORANGE_BE_PREPARED','RED_ACTION_REQUIRED')),
    impact_polygon GEOMETRY(Polygon, 4326) NOT NULL,
    precipitation_mm_hr NUMERIC(6,2),
    rail_temperature_celsius NUMERIC(5,1),
    prohibited_work_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_weather_alerts_geom ON operations.weather_alerts USING GIST (impact_polygon);

-- ============ OPTIMIZATION ============
-- RES-04: solver run registry (block_plans.solver_run_id now references something real)
CREATE TABLE optimization.solver_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    horizon VARCHAR(16) NOT NULL CHECK (horizon IN ('STRATEGIC_26W','WEEKLY','REALTIME')),
    division VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CONFLICT')),
    attempt SMALLINT NOT NULL DEFAULT 1,
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE optimization.block_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_horizon VARCHAR(16) NOT NULL CHECK (plan_horizon IN ('STRATEGIC_26W','WEEKLY','REALTIME')),
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    primary_demand_id UUID NOT NULL REFERENCES demands.block_demands(id) ON DELETE RESTRICT,
    is_shadow_block BOOLEAN NOT NULL DEFAULT false,
    solver_run_id UUID NOT NULL REFERENCES optimization.solver_runs(id),
    loss_pax_minutes NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    loss_frt_minutes NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    sentinel_verified BOOLEAN NOT NULL DEFAULT false,
    -- SAFE-002 binding columns
    revision_no INT NOT NULL DEFAULT 1,
    supersedes_id UUID REFERENCES optimization.block_plans(id),
    content_hash CHAR(64) NOT NULL,
    sentinel_hash CHAR(64),
    -- APP-001 approver identity columns
    decided_by VARCHAR(64), decided_at TIMESTAMPTZ,
    authorized_by VARCHAR(64), authorized_at TIMESTAMPTZ,
    -- FSM-001: aligned to AppFlow §3. RES-01: 'PROVISIONAL' added (referenced by
    -- FR-028/Design token status-provisional, was missing from the v1.1 CHECK).
    approval_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' CHECK (approval_status IN (
        'DRAFT','SENTINEL_PASSED','APPROVED_SR_DOM','AUTHORIZED_DRM','TRANSMITTED_COA',
        'ACTIVE_GRANTED','COMPLETED_FITNESS','ARCHIVED_SEALED','SUPERSEDED',
        'SUPERSEDED_EMERGENCY','CANCELLED','FAILED_ESCALATE','PROVISIONAL')),
    incident_id UUID REFERENCES operations.incidents(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_plan_window CHECK (end_time > start_time),
    CONSTRAINT chk_distinct_approvers CHECK (authorized_by IS NULL OR decided_by IS NULL OR decided_by <> authorized_by)
);
CREATE INDEX idx_block_plans_range ON optimization.block_plans (section_id, start_time, end_time);
CREATE INDEX idx_block_plans_status ON optimization.block_plans (approval_status);
CREATE INDEX idx_block_plans_incident ON optimization.block_plans (incident_id);

-- DB-003: no two ACTIVE-status plans may overlap on the same section
ALTER TABLE optimization.block_plans
    ADD CONSTRAINT excl_active_overlap EXCLUDE USING gist (
        section_id WITH =, tstzrange(start_time, end_time) WITH &&
    ) WHERE (approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED'));

ALTER TABLE operations.signal_acknowledgments
    ADD CONSTRAINT fk_sigack_plan FOREIGN KEY (plan_id) REFERENCES optimization.block_plans(id) ON DELETE RESTRICT;

-- DB-002: junction replaces UUID[]
CREATE TABLE optimization.plan_shadow_demands (
    plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
    demand_id UUID NOT NULL REFERENCES demands.block_demands(id) ON DELETE RESTRICT,
    PRIMARY KEY (plan_id, demand_id)
);

-- DB-004: multi-section corridor blocks (RES-03: overlap enforced in service layer + Sentinel MILP-C1)
CREATE TABLE optimization.plan_sections (
    plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
    section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
    sequence_order SMALLINT NOT NULL DEFAULT 1,
    PRIMARY KEY (plan_id, section_id)
);

-- DB-005: VRP output persistence
CREATE TABLE optimization.machine_rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id VARCHAR(32) NOT NULL,
    plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
    depot_origin VARCHAR(64),
    travel_start TIMESTAMPTZ NOT NULL,
    travel_end TIMESTAMPTZ NOT NULL,
    solver_run_id UUID NOT NULL REFERENCES optimization.solver_runs(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_roster_window CHECK (travel_end > travel_start)
);
CREATE INDEX idx_machine_rosters_plan ON optimization.machine_rosters (plan_id);

-- RES-02: COA outbox (PENDING_TRANSMISSION without touching the FSM states:
-- plan stays AUTHORIZED_DRM / PROVISIONAL until the COA ack lands)
CREATE TABLE optimization.coa_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
    payload JSONB NOT NULL,
    state VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','ACKED','FAILED')),
    attempts SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acked_at TIMESTAMPTZ
);
CREATE INDEX idx_coa_outbox_state ON optimization.coa_outbox (state);

-- ============ AUDIT ============
CREATE TABLE audit.action_ledger (
    seq BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    payload_json JSONB NOT NULL,
    prev_seq BIGINT,
    prev_hash VARCHAR(64) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE, TRUNCATE ON audit.action_ledger FROM PUBLIC;
GRANT INSERT, SELECT ON audit.action_ledger TO ledger_writer;

-- Idempotency keys (APP-001) — append-style, proof-of-single-effect
CREATE TABLE audit.idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    endpoint VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ AUTH (RES-08) ============
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    role VARCHAR(24) NOT NULL CHECK (role IN ('SR_DOM','DRM','CONTROLLER','ENGINEER','AUDITOR','ADMIN','STATION_MASTER')),
    division VARCHAR(16) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
