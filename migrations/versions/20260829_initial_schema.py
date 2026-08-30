"""Baseline schema — applies data/sql (single source of truth) when absent

Revision ID: 20260829_initial_schema
Revises: 
Create Date: 2026-08-29 00:00:00.000000
"""

from __future__ import annotations

<<<<<<< Updated upstream
from pathlib import Path

=======
import sqlalchemy as sa
>>>>>>> Stashed changes
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260829_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

_SQL_FILES = ("01_init_postgis.sql", "02_schema_ddl.sql", "03_ledger_triggers.sql")


def upgrade() -> None:
<<<<<<< Updated upstream
    # Fresh docker volumes build the schema via postgres initdb (data/sql is
    # mounted at docker-entrypoint-initdb.d) before this migration runs, and
    # databases that predate Alembic already carry the schema too. The DDL in
    # data/sql is not idempotent, so blindly re-running it here would abort the
    # migrate service on every one of those databases and wedge the whole
    # compose stack behind it. Apply data/sql only when the core objects are
    # missing (i.e. a database provisioned through Alembic alone); otherwise
    # this revision just stamps the start of the migration chain.
    already = op.get_bind().exec_driver_sql(
        "SELECT to_regclass('infrastructure.block_sections') IS NOT NULL"
    ).scalar()
    if already:
        return
    base = Path(__file__).resolve().parents[2] / "data" / "sql"
    for name in _SQL_FILES:
        op.get_bind().exec_driver_sql((base / name).read_text(encoding="utf-8"))
=======
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"))
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS \"postgis\";"))
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS \"btree_gist\";"))

    op.execute(sa.text("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ledger_writer') THEN CREATE ROLE ledger_writer NOLOGIN; END IF; END $$;"))

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS infrastructure;"))
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS demands;"))
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS operations;"))
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS optimization;"))
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS audit;"))
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS auth;"))

    op.execute(sa.text("""
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
            crossover_points JSONB DEFAULT '[]'::jsonb,
            track_geom GEOMETRY(LineString, 4326) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_section UNIQUE (division, section_code)
        );
    """))
    op.execute(sa.text("CREATE INDEX idx_block_sections_geom ON infrastructure.block_sections USING GIST (track_geom);"))
    op.execute(sa.text("CREATE INDEX idx_block_sections_active ON infrastructure.block_sections (is_active);"))

    op.execute(sa.text("""
        CREATE TABLE infrastructure.ohe_feeding_sections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            feeding_section_code VARCHAR(32) NOT NULL,
            division VARCHAR(16) NOT NULL,
            isolator_boundary_geom GEOMETRY(LineString, 4326) NOT NULL,
            substation_ref VARCHAR(64) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_feeding_section UNIQUE (division, feeding_section_code)
        );
    """))
    op.execute(sa.text("CREATE INDEX idx_ohe_feeding_geom ON infrastructure.ohe_feeding_sections USING GIST (isolator_boundary_geom);"))

    op.execute(sa.text("""
        CREATE TABLE infrastructure.section_feeding_map (
            section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
            feeding_section_id UUID NOT NULL REFERENCES infrastructure.ohe_feeding_sections(id) ON DELETE RESTRICT,
            PRIMARY KEY (section_id, feeding_section_id)
        );
    """))

    op.execute(sa.text("""
        CREATE TABLE infrastructure.machines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            machine_code VARCHAR(32) NOT NULL UNIQUE,
            machine_class VARCHAR(32) NOT NULL,
            depot_km NUMERIC(7,3) NOT NULL,
            transit_speed_kmph SMALLINT NOT NULL DEFAULT 40,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """))

    op.execute(sa.text("""
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
            urgency_source VARCHAR(16) NOT NULL DEFAULT 'INGEST_RAW' CHECK (urgency_source IN ('INGEST_RAW','ML_ESTIMATED')),
            source_ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            features JSONB NOT NULL DEFAULT '{}'::jsonb,
            machinery_req JSONB DEFAULT '[]'::jsonb,
            status VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
                'SUBMITTED','NORMALIZED','SCHEDULED_DRAFT','SENTINEL_PASSED','APPROVED_SR_DOM',
                'AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED','COMPLETED_FITNESS',
                'ARCHIVED_SEALED','CANCELLED','ESCALATED_OVERDUE')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT chk_deadline_order CHECK (latest_deadline >= earliest_start)
        );
    """))
    op.execute(sa.text("CREATE INDEX idx_demands_dept_status ON demands.block_demands (department, status);"))
    op.execute(sa.text("CREATE INDEX idx_demands_window_gist ON demands.block_demands USING GIST (tstzrange(earliest_start, latest_deadline));"))
    op.execute(sa.text("CREATE INDEX idx_demands_section ON demands.block_demands (section_id);"))
    op.execute(sa.text("CREATE INDEX idx_demands_section_status ON demands.block_demands (section_id, status);"))
    op.execute(sa.text("CREATE UNIQUE INDEX uq_demands_source_ref ON demands.block_demands (external_source, external_ref_id);"))

    op.execute(sa.text("""
        CREATE TABLE operations.train_paths (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            train_number VARCHAR(16) NOT NULL,
            train_type VARCHAR(24) NOT NULL CHECK (train_type IN ('VANDE_RAJDHANI','MAIL_EXP','PASSENGER','FREIGHT')),
            section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
            scheduled_entry TIMESTAMPTZ NOT NULL,
            scheduled_exit TIMESTAMPTZ NOT NULL,
            priority_rank SMALLINT NOT NULL DEFAULT 5 CHECK (priority_rank BETWEEN 1 AND 10),
            source VARCHAR(16) NOT NULL DEFAULT 'WTT' CHECK (source IN ('WTT','COA_LIVE','FOIS_FORECAST')),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT chk_train_window CHECK (scheduled_exit > scheduled_entry)
        );
    """))
    op.execute(sa.text("CREATE INDEX idx_train_paths_occupancy ON operations.train_paths (section_id, scheduled_entry, scheduled_exit);"))
    op.execute(sa.text("CREATE INDEX idx_train_paths_number ON operations.train_paths (train_number);"))
    op.execute(sa.text("CREATE UNIQUE INDEX uq_train_paths_upsert ON operations.train_paths (train_number, section_id, scheduled_entry);"))

    op.execute(sa.text("""
        CREATE TABLE operations.signal_acknowledgments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plan_id UUID NOT NULL,
            sm_actor VARCHAR(64), sm_acked_at TIMESTAMPTZ,
            controller_actor VARCHAR(64), controller_acked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """))
    op.execute(sa.text("CREATE UNIQUE INDEX uq_sigack_plan ON operations.signal_acknowledgments (plan_id);"))

    op.execute(sa.text("""
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
    """))
    op.execute(sa.text("CREATE INDEX idx_incidents_section ON operations.incidents (section_id, created_at DESC);"))

    op.execute(sa.text("""
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
    """))
    op.execute(sa.text("CREATE INDEX idx_weather_alerts_geom ON operations.weather_alerts USING GIST (impact_polygon);"))

    op.execute(sa.text("""
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
    """))

    op.execute(sa.text("""
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
            revision_no INT NOT NULL DEFAULT 1,
            supersedes_id UUID REFERENCES optimization.block_plans(id),
            content_hash CHAR(64) NOT NULL,
            sentinel_hash CHAR(64),
            decided_by VARCHAR(64), decided_at TIMESTAMPTZ,
            authorized_by VARCHAR(64), authorized_at TIMESTAMPTZ,
            approval_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' CHECK (approval_status IN (
                'DRAFT','SENTINEL_PASSED','APPROVED_SR_DOM','AUTHORIZED_DRM','TRANSMITTED_COA',
                'ACTIVE_GRANTED','COMPLETED_FITNESS','ARCHIVED_SEALED','SUPERSEDED',
                'SUPERSEDED_EMERGENCY','CANCELLED','FAILED_ESCALATE','PROVISIONAL')),
            incident_id UUID REFERENCES operations.incidents(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT chk_plan_window CHECK (end_time > start_time),
            CONSTRAINT chk_distinct_approvers CHECK (authorized_by IS NULL OR decided_by IS NULL OR decided_by <> authorized_by)
        );
    """))
    op.execute(sa.text("CREATE INDEX idx_block_plans_range ON optimization.block_plans (section_id, start_time, end_time);"))
    op.execute(sa.text("CREATE INDEX idx_block_plans_status ON optimization.block_plans (approval_status);"))
    op.execute(sa.text("CREATE INDEX idx_block_plans_incident ON optimization.block_plans (incident_id);"))
    op.execute(sa.text("ALTER TABLE optimization.block_plans ADD CONSTRAINT excl_active_overlap EXCLUDE USING gist (section_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE (approval_status IN ('AUTHORIZED_DRM','TRANSMITTED_COA','ACTIVE_GRANTED'));"))
    op.execute(sa.text("ALTER TABLE operations.signal_acknowledgments ADD CONSTRAINT fk_sigack_plan FOREIGN KEY (plan_id) REFERENCES optimization.block_plans(id) ON DELETE RESTRICT;"))

    op.execute(sa.text("""
        CREATE TABLE optimization.plan_shadow_demands (
            plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
            demand_id UUID NOT NULL REFERENCES demands.block_demands(id) ON DELETE RESTRICT,
            PRIMARY KEY (plan_id, demand_id)
        );
    """))

    op.execute(sa.text("""
        CREATE TABLE optimization.plan_sections (
            plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
            section_id UUID NOT NULL REFERENCES infrastructure.block_sections(id) ON DELETE RESTRICT,
            sequence_order SMALLINT NOT NULL DEFAULT 1,
            PRIMARY KEY (plan_id, section_id)
        );
    """))

    op.execute(sa.text("""
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
    """))
    op.execute(sa.text("CREATE INDEX idx_machine_rosters_plan ON optimization.machine_rosters (plan_id);"))

    op.execute(sa.text("""
        CREATE TABLE optimization.coa_outbox (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plan_id UUID NOT NULL REFERENCES optimization.block_plans(id) ON DELETE RESTRICT,
            payload JSONB NOT NULL,
            state VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','ACKED','FAILED')),
            attempts SMALLINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            acked_at TIMESTAMPTZ
        );
    """))
    op.execute(sa.text("CREATE INDEX idx_coa_outbox_state ON optimization.coa_outbox (state);"))

    op.execute(sa.text("""
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
    """))
    op.execute(sa.text("REVOKE UPDATE, DELETE, TRUNCATE ON audit.action_ledger FROM PUBLIC;"))
    op.execute(sa.text("GRANT INSERT, SELECT ON audit.action_ledger TO ledger_writer;"))

    op.execute(sa.text("""
        CREATE TABLE audit.idempotency_keys (
            key VARCHAR(128) PRIMARY KEY,
            endpoint VARCHAR(64) NOT NULL,
            actor_id VARCHAR(64) NOT NULL,
            response JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """))

    op.execute(sa.text("""
        CREATE TABLE auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(64) NOT NULL UNIQUE,
            salt VARCHAR(64) NOT NULL,
            password_hash VARCHAR(256) NOT NULL,
            role VARCHAR(24) NOT NULL CHECK (role IN ('SR_DOM','DRM','CONTROLLER','ENGINEER','AUDITOR','ADMIN','STATION_MASTER')),
            division VARCHAR(16) NOT NULL,
            full_name VARCHAR(128) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """))

    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION audit.fn_seal_ledger_entry()
        RETURNS TRIGGER AS $$
        DECLARE
            v_prev_seq BIGINT; v_prev_hash VARCHAR(64);
        BEGIN
            PERFORM pg_advisory_xact_lock(hashtext('audit_ledger'));
            SELECT seq, hash INTO v_prev_seq, v_prev_hash
            FROM audit.action_ledger ORDER BY seq DESC LIMIT 1;
            IF v_prev_seq IS NULL THEN
                v_prev_seq := 0;
                v_prev_hash := repeat('0', 64);
            END IF;
            NEW.prev_seq := v_prev_seq;
            NEW.prev_hash := v_prev_hash;
            NEW.hash := encode(digest(NEW.seq::text || NEW.event_type || NEW.actor_id || NEW.payload_json::text || v_prev_hash, 'sha256'), 'hex');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))

    op.execute(sa.text("""
        CREATE TRIGGER trg_seal_ledger_entry
        BEFORE INSERT ON audit.action_ledger
        FOR EACH ROW EXECUTE FUNCTION audit.fn_seal_ledger_entry();
    """))

    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION audit.fn_block_ledger_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'audit.action_ledger is append-only: % is prohibited on sealed ledger rows', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
    """))
    op.execute(sa.text("CREATE TRIGGER trg_block_ledger_update BEFORE UPDATE ON audit.action_ledger FOR EACH ROW EXECUTE FUNCTION audit.fn_block_ledger_mutation();"))
    op.execute(sa.text("CREATE TRIGGER trg_block_ledger_delete BEFORE DELETE ON audit.action_ledger FOR EACH ROW EXECUTE FUNCTION audit.fn_block_ledger_mutation();"))

    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION audit.verify_ledger()
        RETURNS TABLE(n_total BIGINT, n_verified BIGINT, first_broken_seq BIGINT, chain_ok BOOLEAN)
        LANGUAGE plpgsql STABLE AS $$
        DECLARE
            r RECORD; v_prev VARCHAR(64) := repeat('0',64); v_prev_seq BIGINT := 0;
            v_count BIGINT := 0; v_broken BIGINT := NULL;
        BEGIN
            FOR r IN SELECT * FROM audit.action_ledger ORDER BY seq LOOP
                IF r.prev_seq IS DISTINCT FROM v_prev_seq
                   OR r.prev_hash IS DISTINCT FROM v_prev
                   OR r.hash IS DISTINCT FROM encode(digest(r.seq::text || r.event_type || r.actor_id || r.payload_json::text || r.prev_hash,'sha256'),'hex')
                THEN
                    v_broken := r.seq; EXIT;
                END IF;
                v_prev := r.hash; v_prev_seq := r.seq; v_count := v_count + 1;
            END LOOP;
            RETURN QUERY SELECT (SELECT count(*)::BIGINT FROM audit.action_ledger), v_count, v_broken, v_broken IS NULL;
        END;
        $$;
    """))

    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION audit.append_event(p_type VARCHAR, p_actor VARCHAR, p_payload JSONB)
        RETURNS CHAR(64)
        LANGUAGE plpgsql VOLATILE AS $$
        DECLARE v_hash CHAR(64);
        BEGIN
            PERFORM pg_advisory_xact_lock(hashtext('audit_ledger'));
            INSERT INTO audit.action_ledger (event_type, actor_id, payload_json)
            VALUES (p_type, p_actor, p_payload)
            RETURNING hash INTO v_hash;
            RETURN v_hash;
        END;
        $$;
    """))
>>>>>>> Stashed changes


def downgrade() -> None:
    op.get_bind().exec_driver_sql(
        """
        DROP SCHEMA IF EXISTS auth CASCADE;
        DROP SCHEMA IF EXISTS audit CASCADE;
        DROP SCHEMA IF EXISTS optimization CASCADE;
        DROP SCHEMA IF EXISTS operations CASCADE;
        DROP SCHEMA IF EXISTS demands CASCADE;
        DROP SCHEMA IF EXISTS infrastructure CASCADE;
        DROP EXTENSION IF EXISTS "btree_gist";
        DROP EXTENSION IF EXISTS "postgis";
        DROP EXTENSION IF EXISTS "pgcrypto";
        """
    )
