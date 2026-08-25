"""Does the advisory lock taken INSIDE the BEFORE-INSERT trigger block a concurrent
INSERT on another backend? slow writer holds ~3s inside its trigger; fast writer
starts 0.8s in and its INSERT must wait until slow commits."""
import multiprocessing as mp
import time

DSN = "host=localhost port=5432 dbname=railbloc_db user=rail_admin password=rail_secure_password"


def slow_writer():
    import psycopg2
    c = psycopg2.connect(DSN)
    cur = c.cursor()
    cur.execute("BEGIN")
    cur.execute("INSERT INTO audit.action_ledger (event_type, actor_id, payload_json) "
                "VALUES ('T_HOLD', 'slow', '{}'::jsonb)")
    print("slow: insert done, sleeping 3s before commit", flush=True)
    time.sleep(3)
    c.commit()
    print("slow: committed", flush=True)


def fast_writer(q):
    import psycopg2
    time.sleep(0.8)
    c = psycopg2.connect(DSN)
    cur = c.cursor()
    cur.execute("BEGIN")
    t0 = time.time()
    cur.execute("INSERT INTO audit.action_ledger (event_type, actor_id, payload_json) "
                "VALUES ('T_HOLD', 'fast', '{}'::jsonb)")
    waited = time.time() - t0
    c.commit()
    q.put(waited)


if __name__ == "__main__":
    q = mp.Queue()
    a = mp.Process(target=slow_writer)
    b = mp.Process(target=fast_writer, args=(q,))
    a.start(); b.start(); a.join(); b.join()
    w = q.get()
    print(f"fast INSERT waited {w:.2f}s (expect ≈2.2s if the trigger's lock blocks)")
