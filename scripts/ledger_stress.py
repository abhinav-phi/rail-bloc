"""Ledger concurrency stress: N processes x M inserts through separate connections.
Verifies the advisory-locked seal trigger keeps prev_seq/prev_hash strictly linear."""
import multiprocessing as mp

from sqlalchemy import create_engine, text

DSN = "postgresql+psycopg2://rail_admin:rail_secure_password@localhost:5432/railbloc_db"


def worker(n):
    eng = create_engine(DSN)
    for _i in range(5):
        with eng.begin() as c:
            c.execute(text(
                "SELECT audit.append_event('T_STRESS', :a, CAST(:p AS jsonb))"),
                {"a": f"p{n}", "p": "{}"})
    eng.dispose()


if __name__ == "__main__":
    base = None
    eng = create_engine(DSN)
    with eng.begin() as c:
        base = c.execute(text("SELECT coalesce(max(seq),0) FROM audit.action_ledger")).scalar()
    ps = [mp.Process(target=worker, args=(i,)) for i in range(8)]
    [p.start() for p in ps]
    [p.join() for p in ps]
    with eng.begin() as c:
        rows = c.execute(text(
            """SELECT seq, prev_seq FROM audit.action_ledger
               WHERE seq > :b AND event_type='T_STRESS' ORDER BY seq"""), {"b": base}).fetchall()
        dup = c.execute(text(
            """SELECT count(*) FROM (
                 SELECT prev_seq FROM audit.action_ledger WHERE seq > :b AND event_type='T_STRESS'
                 GROUP BY prev_seq HAVING count(*)>1) d"""), {"b": base}).scalar()
        ok = c.execute(text("SELECT chain_ok FROM audit.verify_ledger()")).scalar()
    print(f"rows={len(rows)} duplicate_prev={dup} chain_ok={ok}")
