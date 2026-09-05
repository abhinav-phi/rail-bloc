"""Regression tests for the pre-v1.1 password-hash upgrade path (S1 follow-up).

Every row that existed before the per-user-salt migration was hashed with the
fixed 'railbloc-salt' at 60k PBKDF2 iterations. The login fallback must recognize
that exact scheme (legacy_hash_pw) — hashing the candidate with the *new* 600k
count against the legacy salt can never match and would permanently lock out
every pre-migration user (found by the 2026-09-05 full-stack boot smoke test).
"""
from __future__ import annotations

import hashlib

from apps.api.core.security import hash_pw, legacy_hash_pw


def test_legacy_hash_matches_pre_migration_scheme():
    def old_scheme(pw: str) -> str:
        return hashlib.pbkdf2_hmac("sha256", pw.encode(), b"railbloc-salt", 60_000).hex()

    assert legacy_hash_pw("railbloc") == old_scheme("railbloc")
    assert legacy_hash_pw("hunter2") == old_scheme("hunter2")


def test_legacy_and_modern_hashes_differ():
    """A legacy-salted hash must never equal a 600k-iteration hash of the same
    password — proving the old fallback (hash_pw with b'railbloc-salt') was dead."""
    assert legacy_hash_pw("railbloc") != hash_pw("railbloc", b"railbloc-salt")
