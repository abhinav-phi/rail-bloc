from apps.api.core.config import Settings


def test_default_redis_url_requires_password():
    settings = Settings()
    # Env (CI sets REDIS_URL with the CI hostname) may override the host, but the
    # password requirement must survive: a URL without credentials is a security
    # regression that must fail loudly.
    assert "rail_redis_password@" in settings.redis_url
    assert settings.redis_url.startswith("redis://:")
