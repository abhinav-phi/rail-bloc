from apps.api.core.config import Settings


def test_default_redis_url_requires_password():
    settings = Settings()
    assert settings.redis_url == "redis://:rail_redis_password@redis:6379/0"
