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
    redis_client = fakeredis.FakeRedis(server=_fake_server)
    def get_redis(): return redis_client
else:
    import redis as _redis
    try:
        # Masked logging for debugging
        if "@" in settings.REDIS_URL:
            parts = settings.REDIS_URL.split("@")
            print(f"connecting to redis: {parts[0][:12]}...@{parts[1]}")
        
        # ssl_cert_reqs=None is often needed for Upstash
        redis_client = _redis.from_url(
            settings.REDIS_URL, 
            socket_timeout=5,
            ssl_cert_reqs=None
        )
        # Testing connection
        redis_client.ping()
        print("✅ Redis connected successfully")
    except Exception as e:
        print(f"⚠️ Redis connection failed: {e}. Falling back to Fakeredis.")
        import fakeredis
        redis_client = fakeredis.FakeRedis()

    def get_redis():
        return redis_client
