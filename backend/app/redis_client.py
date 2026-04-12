"""
Shared Redis client.
When USE_FAKE_REDIS=true (local dev without a running Redis server),
returns a fakeredis instance backed by a single in-process FakeServer
so that all pub/sub and key operations share the same state.
"""
from app.config import settings

if settings.USE_FAKE_REDIS:
    import fakeredis
    _fake_server = fakeredis.FakeServer()

    def get_redis():
        return fakeredis.FakeRedis(server=_fake_server)

    redis_client = fakeredis.FakeRedis(server=_fake_server)
else:
    import redis as _redis
    redis_client = _redis.from_url(settings.REDIS_URL)

    def get_redis():
        return _redis.from_url(settings.REDIS_URL)
