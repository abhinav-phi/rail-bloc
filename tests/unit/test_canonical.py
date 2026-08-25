from datetime import datetime, timezone

from packages.chronicle.canonical import canonical_plan_payload, content_hash

S = "sec"
T1 = datetime(2026, 1, 5, 1, 0, tzinfo=timezone.utc)
T2 = datetime(2026, 1, 5, 4, 0, tzinfo=timezone.utc)


def test_hash_deterministic_and_order_insensitive():
    h1 = content_hash(S, T1, T2, "d1", ["b", "a"])
    h2 = content_hash(S, T1, T2, "d1", ["a", "b"])
    assert h1 == h2


def test_payload_sorts_shadow_ids():
    p = canonical_plan_payload(S, T1, T2, "d1", ["z", "a", "m"])
    assert '"shadow_demand_ids":["a","m","z"]' in p


def test_any_mutation_changes_hash():
    base = (S, T1, T2, "d1", ["a"])
    variants = [
        ("s2", base[1], base[2], base[3], base[4]),
        (base[0], T1.replace(minute=30), base[2], base[3], base[4]),
        (base[0], base[1], T2.replace(hour=5), base[3], base[4]),
        (base[0], base[1], base[2], "d9", base[4]),
        (base[0], base[1], base[2], base[3], ["a", "b"]),
    ]
    hashes = {content_hash(*v) for v in variants}
    assert len(hashes) == len(variants)
    assert all(h != content_hash(*base) for h in hashes)


def test_naive_datetimes_treated_as_utc():
    naive = content_hash(S, T1.replace(tzinfo=None), T2.replace(tzinfo=None), "d1", ["a"])
    aware = content_hash(S, T1, T2, "d1", ["a"])
    assert naive == aware
