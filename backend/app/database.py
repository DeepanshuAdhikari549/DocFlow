from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

_connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
elif settings.DATABASE_URL.startswith("postgresql"):
    _connect_args["sslmode"] = "require"

try:
    engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args)
    # Test connection
    with engine.connect() as conn:
        print("✅ Database connected successfully")
except Exception as e:
    print(f"⚠️ Database connection failed: {e}. App will start but DB features may fail.")
    # Fallback to sqlite so the app doesn't crash on start
    engine = create_engine("sqlite:///./fallback.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
