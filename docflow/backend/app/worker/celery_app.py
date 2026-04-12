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

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Run tasks synchronously in the same process (no broker connections needed)
    task_always_eager=settings.USE_FAKE_REDIS,
    task_eager_propagates=settings.USE_FAKE_REDIS,
)
