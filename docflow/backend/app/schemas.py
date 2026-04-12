from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime


class DocumentBase(BaseModel):
    filename: str
    original_filename: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None


class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    status: str
    progress: int
    current_stage: str
    extracted_data: Optional[Dict[str, Any]] = None
    reviewed_data: Optional[Dict[str, Any]] = None
    is_finalized: bool
    error_message: Optional[str] = None
    retry_count: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class ReviewUpdateRequest(BaseModel):
    reviewed_data: Dict[str, Any]


class ProgressEvent(BaseModel):
    document_id: str
    event: str
    progress: int
    stage: str
    message: Optional[str] = None
