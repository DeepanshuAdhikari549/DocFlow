import os
from celery import Celery
from app.config import settings

# When running without a real Redis broker (local dev), use in-process eager execution.
# Tasks will run synchronously inside the FastAPI process — no separate worker needed.
_broker = "memory://" if settings.USE_FAKE_REDIS else settings.REDIS_URL
_backend = "cache+memory://" if settings.USE_FAKE_REDIS else settings.REDIS_URL

celery_app = Celery(
    "docflow",
    broker=_broker,
    backend=_backend,
    include=["app.worker.tasks"],
)

# To run on Render Free Tier, we enable "eager" mode.
# This makes tasks run inside the FastAPI process instead of needing a separate worker.
_is_free_tier = os.getenv("RENDER_FREE_TIER", "False").lower() == "true"

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Run tasks synchronously in the same process if on free tier or fake redis
    task_always_eager=settings.USE_FAKE_REDIS or _is_free_tier,
    task_eager_propagates=settings.USE_FAKE_REDIS or _is_free_tier,
)
