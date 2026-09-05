"""Integration proof for the pre-v1.1 credential upgrade path: a user row stored
with the legacy 60k-iteration fixed-salt hash must be able to log in, and the
login must transparently re-salt the row to the hardened per-user scheme."""
from __future__ import annotations

from sqlalchemy import text

from apps.api.core.security import legacy_hash_pw


def test_legacy_hash_row_logs_in_and_resalts(client, engine):
    username = "legacy_pw_migration_user"
    legacy_hash = legacy_hash_pw("old-password-60k")
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO auth.users (username, salt, password_hash, role, division, full_name) "
            "VALUES (:u, 'railbloc-salt', :p, 'ENGINEER', 'DLI', 'Legacy Hash Row') "
            "ON CONFLICT (username) DO UPDATE SET salt = 'railbloc-salt', password_hash = :p"),
            {"u": username, "p": legacy_hash})

    r = client.post("/api/v1/auth/login",
                    json={"username": username, "password": "old-password-60k"})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]

    with engine.connect() as conn:
        salt, pw_hash = conn.execute(text(
            "SELECT salt, password_hash FROM auth.users WHERE username = :u"),
            {"u": username}).one()
    assert salt != "railbloc-salt", "row must be re-salted to a per-user salt on login"
    from apps.api.core.security import hash_pw
    assert pw_hash == hash_pw("old-password-60k", salt), "re-salted hash must verify"

    client.post("/api/v1/auth/login",
                json={"username": username, "password": "old-password-60k"})
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM auth.users WHERE username = :u"), {"u": username})


def test_wrong_password_on_legacy_row_rejected(client, engine):
    username = "legacy_pw_negative_user"
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO auth.users (username, salt, password_hash, role, division, full_name) "
            "VALUES (:u, 'railbloc-salt', :p, 'ENGINEER', 'DLI', 'Legacy Negative Row') "
            "ON CONFLICT (username) DO UPDATE SET salt = 'railbloc-salt', password_hash = :p"),
            {"u": username, "p": legacy_hash_pw("correct-horse")})

    r = client.post("/api/v1/auth/login", json={"username": username, "password": "wrong"})
    assert r.status_code == 401

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM auth.users WHERE username = :u"), {"u": username})
