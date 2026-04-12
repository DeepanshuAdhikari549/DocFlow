from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./docflow.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    UPLOAD_DIR: str = "./uploads"
    USE_FAKE_REDIS: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
