"""DB-001 — ledger append-only enforcement, rollback-gap safety, chain integrity."""
from __future__ import annotations

import json

from sqlalchemy import text


def test_update_and_delete_blocked_by_guard_triggers(engine):
    """Guard triggers must raise even for the table owner/superuser (DB-001).
    Each mutation runs in its own transaction so an aborted tx cannot mask the second check."""
    with engine.begin() as c:
        seq = c.execute(text(
            "INSERT INTO audit.action_ledger (event_type, actor_id, payload_json) "
            "VALUES ('T_GUARD','test','{}'::jsonb) RETURNING seq")).scalar()
    for stmt in (
        "UPDATE audit.action_ledger SET actor_id='evil' WHERE seq = :s",
        "DELETE FROM audit.action_ledger WHERE seq = :s",
    ):
        raised = False
        try:
            with engine.begin() as c:
                c.execute(text(stmt), {"s": seq})
        except Exception:
            raised = True
        assert raised, f"guard trigger did not block: {stmt}"


def test_chain_unbroken_after_rollback_gap(engine):
    """DB-001: a rolled-back insert must not brick the chain (BIGSERIAL gap)."""
    # Roll back an insert (leaves a BIGSERIAL gap).
    with engine.connect() as c:
        c.execute(text(
            "INSERT INTO audit.action_ledger (event_type, actor_id, payload_json) "
            "VALUES ('T_ROLLBACK','test','{}'::jsonb)"))
        c.rollback()
    # Then commit a real entry and verify the chain.
    with engine.begin() as c:
        c.execute(text(
            "SELECT audit.append_event('T_AFTER_ROLLBACK','test',CAST(:p AS jsonb))"),
            {"p": json.dumps({"ok": True})})
        row = c.execute(text("SELECT n_total, n_verified, chain_ok FROM audit.verify_ledger()")).one()
    assert row.chain_ok
    assert row.n_verified == row.n_total


def test_concurrent_writers_keep_single_chain(engine):
    """audit.append_event takes the advisory lock in its own statement BEFORE the
    INSERT, so every sealing statement's snapshot contains all committed
    predecessors — N concurrent connections must form one unbroken chain."""
    import threading

    from sqlalchemy import text as t

    errors = []

    def worker(i):
        try:
            with engine.begin() as c:
                c.execute(t("SELECT audit.append_event('T_CONCURRENT', 'w'||:i, CAST(:p AS jsonb))"),
                          {"i": i, "p": json.dumps({"w": i})})
        except Exception as e:  # pragma: no cover
            errors.append(e)

    with engine.begin() as c:
        base = c.execute(t("SELECT coalesce(max(seq),0) FROM audit.action_ledger")).scalar()
    threads = [threading.Thread(target=worker, args=(i,)) for i in range(6)]
    [th.start() for th in threads]
    [th.join() for th in threads]
    assert not errors
    with engine.begin() as c:
        rows = c.execute(t(
            """SELECT seq, prev_seq FROM audit.action_ledger
               WHERE event_type='T_CONCURRENT' AND seq > :b ORDER BY seq"""),
            {"b": base}).fetchall()
        ok = c.execute(t("SELECT chain_ok FROM audit.verify_ledger()")).scalar()
    assert len(rows) == 6
    assert ok
    seqs = [r[0] for r in rows]
    prevs = [r[1] for r in rows]
    assert len(set(prevs)) == len(prevs), f"duplicate predecessors: {list(zip(seqs, prevs, strict=False))}"
