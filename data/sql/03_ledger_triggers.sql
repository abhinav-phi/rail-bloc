-- DB-001 hardened trigger: advisory-lock serialization, last-committed-row lookup,
-- explicit prev_seq (rollback-gap safe). REQUIRES pgcrypto (01_init).
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

CREATE TRIGGER trg_seal_ledger_entry
BEFORE INSERT ON audit.action_ledger
FOR EACH ROW EXECUTE FUNCTION audit.fn_seal_ledger_entry();

-- DB-001 guard: append-only enforced even for the table owner (REVOKE does not bind owner).
CREATE OR REPLACE FUNCTION audit.fn_block_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit.action_ledger is append-only: % is prohibited on sealed ledger rows', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_ledger_update BEFORE UPDATE ON audit.action_ledger
FOR EACH ROW EXECUTE FUNCTION audit.fn_block_ledger_mutation();
CREATE TRIGGER trg_block_ledger_delete BEFORE DELETE ON audit.action_ledger
FOR EACH ROW EXECUTE FUNCTION audit.fn_block_ledger_mutation();

-- FR-023: online verification. Runs in the caller's snapshot; the API calls it
-- inside a REPEATABLE READ transaction so a mid-write pass sees a consistent view.
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

-- Canonical write path (concurrency-correct). WHY THIS EXISTS: under READ COMMITTED,
-- an INSERT statement fixes its snapshot WHEN THE STATEMENT STARTS. If that statement
-- blocks on the advisory lock taken inside trg_seal_ledger_entry, the lock frees only
-- after the predecessor COMMITS — but the blocked statement still reads its older
-- snapshot and computes prev_seq/prev_hash from BEFORE the predecessor existed,
-- silently forking the chain under concurrent writers. Acquiring the lock in a
-- SEPARATE, EARLIER statement guarantees the subsequent INSERT statement's fresh
-- snapshot already contains every committed predecessor. All application writers MUST
-- go through audit.append_event(); the trigger remains as defense-in-depth.
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
