import time
import json
import os
import random
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from .celery_app import celery_app
from app.redis_client import redis_client

# each worker process gets its own DB session
_connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
elif "postgresql" in settings.DATABASE_URL:
    _connect_args["sslmode"] = "require"

engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args)
WorkerSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def publish_event(document_id: str, event: str, progress: int, stage: str, message: str = ""):
    """Publish progress event via Redis Pub/Sub"""
    payload = json.dumps({
        "document_id": document_id,
        "event": event,
        "progress": progress,
        "stage": stage,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
    })
    channel = f"job:{document_id}"
    redis_client.publish(channel, payload)
    # also store latest state in Redis key so polling works too
    redis_client.setex(f"progress:{document_id}", 300, payload)


def update_doc_in_db(session, document_id: str, updates: dict):
    from app.models import Document
    doc = session.query(Document).filter(Document.id == document_id).first()
    if doc:
        for k, v in updates.items():
            setattr(doc, k, v)
        session.commit()
        session.refresh(doc)
    return doc


def extract_mock_data(filename: str, file_type: str, file_size: int) -> dict:
    """
    Simulate document field extraction.
    In a real system this would call an OCR / NLP pipeline.
    """
    categories = ["Invoice", "Contract", "Report", "Resume", "Letter", "Manual", "Other"]
    keywords_pool = [
        "agreement", "payment", "deadline", "review", "approval",
        "budget", "project", "delivery", "compliance", "audit",
    ]
    chosen_keywords = random.sample(keywords_pool, k=random.randint(3, 6))

    name_no_ext = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ").title()

    return {
        "title": name_no_ext or "Untitled Document",
        "category": random.choice(categories),
        "summary": f"This document ({filename}) was uploaded on {datetime.utcnow().strftime('%d %b %Y')}. "
                   f"It is a {file_type or 'unknown'} file of size {round(file_size / 1024, 1)} KB. "
                   f"Content has been parsed and structured fields have been extracted successfully.",
        "extracted_keywords": chosen_keywords,
        "file_metadata": {
            "filename": filename,
            "file_type": file_type,
            "file_size_bytes": file_size,
            "file_size_kb": round(file_size / 1024, 2),
        },
        "word_count": max(50, int(file_size / 15)),
        "page_count": max(1, int(file_size / 120000)),
        "language": "English",
        "confidence_score": round(random.uniform(0.82, 0.99), 2),
        "extracted_at": datetime.utcnow().isoformat(),
    }


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def process_document(self, document_id: str):
    print(f"Starting processing for document {document_id}")
    db = WorkerSession()
    try:
        from app.models import Document

        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return {"error": "Document not found"}

        # --- Stage 1: job started ---
        update_doc_in_db(db, document_id, {
            "status": "processing",
            "progress": 5,
            "current_stage": "job_started",
        })
        publish_event(document_id, "job_started", 5, "job_started", "Job picked up by worker")
        time.sleep(1)

        # --- Stage 2: parsing started ---
        update_doc_in_db(db, document_id, {"progress": 20, "current_stage": "document_parsing_started"})
        publish_event(document_id, "document_parsing_started", 20, "document_parsing_started", "Parsing document content...")
        time.sleep(2)

        # simulate occasional failure for demo (5% chance) — skip in retry
        if doc.retry_count == 0 and random.random() < 0.05:
            raise Exception("Simulated transient parse error")

        # --- Stage 3: parsing completed ---
        update_doc_in_db(db, document_id, {"progress": 45, "current_stage": "document_parsing_completed"})
        publish_event(document_id, "document_parsing_completed", 45, "document_parsing_completed", "Document parsed successfully")
        time.sleep(1.5)

        # --- Stage 4: extraction started ---
        update_doc_in_db(db, document_id, {"progress": 60, "current_stage": "field_extraction_started"})
        publish_event(document_id, "field_extraction_started", 60, "field_extraction_started", "Extracting structured fields...")
        time.sleep(2)

        # --- Stage 5: generate extracted data ---
        extracted = extract_mock_data(doc.original_filename, doc.file_type or "", doc.file_size or 0)

        update_doc_in_db(db, document_id, {"progress": 85, "current_stage": "field_extraction_completed"})
        publish_event(document_id, "field_extraction_completed", 85, "field_extraction_completed", "Fields extracted")
        time.sleep(1)

        # --- Stage 6: store result & complete ---
        update_doc_in_db(db, document_id, {
            "status": "completed",
            "progress": 100,
            "current_stage": "job_completed",
            "extracted_data": extracted,
            "error_message": None,
        })
        publish_event(document_id, "job_completed", 100, "job_completed", "Processing complete!")

        return {"status": "completed", "document_id": document_id}

    except Exception as exc:
        # update DB with failed state
        update_doc_in_db(db, document_id, {
            "status": "failed",
            "progress": 0,
            "current_stage": "job_failed",
            "error_message": str(exc),
        })
        publish_event(document_id, "job_failed", 0, "job_failed", f"Error: {str(exc)}")
        raise self.retry(exc=exc)

    finally:
        db.close()
