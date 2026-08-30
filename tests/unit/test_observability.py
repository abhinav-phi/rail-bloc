import hashlib

from fastapi.testclient import TestClient
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.core.security import hash_pw
from apps.api.main import app


def test_metrics_endpoint_exposes_runtime_metrics():
    client = TestClient(app)
    response = client.get('/metrics')

    assert response.status_code == 200
    assert 'railbloc_requests_total' in response.text
    assert 'railbloc_outbox_pending' in response.text


def test_login_route_has_rate_limit_guard():
    assert hasattr(app.state, 'limiter')
    assert isinstance(app.state.limiter, Limiter)
    assert app.state.limiter._key_func is get_remote_address


def test_cors_middleware_does_not_allow_credentials_with_wildcard_origin():
    cors_middleware = next(
        middleware for middleware in app.user_middleware if middleware.cls.__name__ == 'CORSMiddleware'
    )
    assert cors_middleware.kwargs.get('allow_credentials') is False
    assert cors_middleware.kwargs.get('allow_origins') == ['*']


def test_password_hash_uses_unique_user_salt_and_current_pbkdf2_strength():
    salt_a = 'a' * 32
    salt_b = 'b' * 32
    password = 'railbloc'

    digest_a = hash_pw(password, salt_a)
    digest_b = hash_pw(password, salt_b)

    assert digest_a != digest_b
    assert digest_a == hashlib.pbkdf2_hmac('sha256', password.encode(), salt_a.encode(), 600_000).hex()
    assert digest_b == hashlib.pbkdf2_hmac('sha256', password.encode(), salt_b.encode(), 600_000).hex()
