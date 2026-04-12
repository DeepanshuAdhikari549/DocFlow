from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, JSON
from sqlalchemy.sql import func
from .database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=True)
    file_size = Column(Integer, nullable=True)
    file_path = Column(String(500), nullable=True)

    # job state
    status = Column(String(50), default="queued")  # queued | processing | completed | failed | finalized
    progress = Column(Integer, default=0)           # 0-100
    current_stage = Column(String(100), default="job_queued")

    # results
    extracted_data = Column(JSON, nullable=True)
    reviewed_data = Column(JSON, nullable=True)
    is_finalized = Column(Boolean, default=False)

    # meta
    error_message = Column(Text, nullable=True)
    celery_task_id = Column(String(255), nullable=True)
    retry_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
