import jwt
import pytest
from fastapi import HTTPException

from apps.api.core.config import settings
from apps.api.core.security import create_token, decode_token, revoke_token


def test_access_tokens_include_jti_and_are_revocable():
    token = create_token("alice", "admin", "DLI")
    claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])

    assert "jti" in claims
    assert claims["sub"] == "alice"
    assert claims["role"] == "admin"
    assert claims["division"] == "DLI"

    revoke_token(token)
    with pytest.raises(HTTPException):
        decode_token(token)
