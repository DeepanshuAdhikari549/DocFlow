import os
from .config import settings

# --- SAFE STARTUP ---
try:
    _upload_dir = getattr(settings, "UPLOAD_DIR", "/tmp/uploads")
    os.makedirs(_upload_dir, exist_ok=True)
    print(f"✅ Upload directory ready at: {_upload_dir}")
except Exception as e:
    print(f"⚠️ Directory fallback: {e}")

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
    print("🚀 App starting up...")
    try:
        create_tables()
        print("✅ Database tables checked")
    except Exception as e:
        print(f"⚠️ Database sync failed (continuing anyway): {e}")


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
