import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./docflow.db?timeout=30"
    REDIS_URL: str = "redis://localhost:6379/0"
    UPLOAD_DIR: str = "./uploads"
    USE_FAKE_REDIS: bool = True
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    class Config:
        # From backend/app/config.py, go up to backend/ folder
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


settings = Settings()
