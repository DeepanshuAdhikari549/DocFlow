from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_tables
from .routers import documents

app = FastAPI(
    title="DocFlow — Async Document Processing API",
    description="Upload documents, process them asynchronously with Celery + Redis, track progress live.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/")
def root():
    return {"message": "DocFlow API is running", "docs": "/docs"}


from app.redis_client import redis_client
from app.config import settings

@app.get("/health")
def health():
    try:
        # Check Redis connectivity
        redis_client.ping()
        redis_status = "ok"
    except Exception as e:
        redis_status = f"error: {str(e)}"
    
    db_type = "postgresql" if "postgresql" in settings.DATABASE_URL else "sqlite"
    
    return {
        "status": "ok",
        "redis": redis_status,
        "database": db_type,
        "environment": "production" if not settings.USE_FAKE_REDIS else "development"
    }
