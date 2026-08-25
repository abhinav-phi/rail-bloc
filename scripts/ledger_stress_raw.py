"""Minimal repro: raw psycopg2, N independent PROCESSES, single INSERT per txn."""
import multiprocessing as mp
import sys

import psycopg2

DSN = "host=localhost port=5432 dbname=railbloc_db user=rail_admin password=rail_secure_password"


def worker(n):
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    for _ in range(4):
        cur.execute("BEGIN")
        cur.execute(
            "INSERT INTO audit.action_ledger (event_type, actor_id, payload_json) "
            "VALUES ('T_RAW', %s, '{}'::jsonb)", (f"w{n}",))
        conn.commit()
    conn.close()


if __name__ == "__main__":
    base_conn = psycopg2.connect(DSN)
    cur = base_conn.cursor()
    cur.execute("SELECT coalesce(max(seq),0) FROM audit.action_ledger")
    base = cur.fetchone()[0]
    base_conn.commit()
    base_conn.close()

    ps = [mp.Process(target=worker, args=(i,)) for i in range(6)]
    [p.start() for p in ps]
    [p.join() for p in ps]

    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute("""SELECT prev_seq, array_agg(seq ORDER BY seq) FROM audit.action_ledger
                   WHERE event_type='T_RAW' AND seq>%s GROUP BY prev_seq HAVING count(*)>1""", (base,))
    dups = cur.fetchall()
    cur.execute("SELECT chain_ok FROM audit.verify_ledger()")
    ok = cur.fetchone()[0]
    print(f"dups={dups} chain_ok={ok}")
