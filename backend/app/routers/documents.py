import os
import uuid
import json
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from .. import crud, schemas
from ..database import get_db
from ..config import settings
from ..worker.tasks import process_document
from ..redis_client import redis_client

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "application/json": ".json",
    "text/csv": ".csv",
}


# ── Upload ─────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=List[schemas.DocumentResponse], status_code=201)
async def upload_documents(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if not files:
        raise HTTPException(400, "No files provided")

    created_docs = []
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, f"File type {file.content_type} is not supported")

        doc_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1] or ".bin"
        safe_name = f"{doc_id}{ext}"
        file_path = os.path.join(settings.UPLOAD_DIR, safe_name)

        # save to disk
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        doc = crud.create_document(db, {
            "id": doc_id,
            "filename": safe_name,
            "original_filename": file.filename,
            "file_type": file.content_type,
            "file_size": len(content),
            "file_path": file_path,
            "status": "queued",
            "progress": 0,
            "current_stage": "job_queued",
        })

        # dispatch Celery task
        task = process_document.delay(doc_id)
        crud.update_document(db, doc_id, {"celery_task_id": task.id})
        db.refresh(doc)
        created_docs.append(doc)

    return created_docs


# ── List ───────────────────────────────────────────────────────────────────

@router.get("", response_model=schemas.DocumentListResponse)
def list_documents(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
):
    docs, total = crud.get_documents(db, skip=skip, limit=limit, status=status, search=search,
                                     sort_by=sort_by, sort_order=sort_order)
    return {"documents": docs, "total": total}


# ── Detail ─────────────────────────────────────────────────────────────────

@router.get("/{doc_id}", response_model=schemas.DocumentResponse)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = crud.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


# ── Progress (Redis Pub/Sub via SSE) ──────────────────────────────────────

@router.get("/{doc_id}/progress/stream")
def progress_stream(doc_id: str, db: Session = Depends(get_db)):
    """Server-Sent Events endpoint — subscribes to Redis Pub/Sub channel for live updates."""
    doc = crud.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    def event_generator():
        pubsub = redis_client.pubsub()
        channel = f"job:{doc_id}"
        pubsub.subscribe(channel)
        try:
            for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"data: {data}\n\n"
                    # stop streaming once job is done
                    try:
                        parsed = json.loads(data)
                        if parsed.get("event") in ("job_completed", "job_failed"):
                            break
                    except Exception:
                        pass
        finally:
            pubsub.unsubscribe(channel)
            pubsub.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                              headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Progress (polling fallback via Redis key) ─────────────────────────────

@router.get("/{doc_id}/progress")
def get_progress(doc_id: str, db: Session = Depends(get_db)):
    """Polling endpoint — returns latest progress from Redis or DB."""
    cached = redis_client.get(f"progress:{doc_id}")
    if cached:
        return JSONResponse(json.loads(cached))

    doc = crud.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    return {
        "document_id": doc_id,
        "event": doc.current_stage,
        "progress": doc.progress,
        "stage": doc.current_stage,
        "message": doc.error_message or "",
    }


# ── Retry failed job ───────────────────────────────────────────────────────

@router.post("/{doc_id}/retry", response_model=schemas.DocumentResponse)
def retry_document(doc_id: str, db: Session = Depends(get_db)):
    doc = crud.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status not in ("failed",):
        raise HTTPException(400, f"Cannot retry a job with status '{doc.status}'")

    crud.update_document(db, doc_id, {
        "status": "queued",
        "progress": 0,
        "current_stage": "job_queued",
        "error_message": None,
        "retry_count": doc.retry_count + 1,
    })
    task = process_document.delay(doc_id)
    crud.update_document(db, doc_id, {"celery_task_id": task.id})
    return crud.get_document(db, doc_id)


# ── Update reviewed data ───────────────────────────────────────────────────

@router.put("/{doc_id}/review", response_model=schemas.DocumentResponse)
def update_review(doc_id: str, body: schemas.ReviewUpdateRequest, db: Session = Depends(get_db)):
    doc = crud.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status not in ("completed", "finalized"):
        raise HTTPException(400, "Document must be completed before reviewing")

    updated = crud.update_document(db, doc_id, {"reviewed_data": body.reviewed_data})
    return updated


# ── Finalize ───────────────────────────────────────────────────────────────

@router.post("/{doc_id}/finalize", response_model=schemas.DocumentResponse)
def finalize_document(doc_id: str, db: Session = Depends(get_db)):
    doc = crud.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status not in ("completed",):
        raise HTTPException(400, "Only completed documents can be finalized")

    final_data = doc.reviewed_data if doc.reviewed_data else doc.extracted_data
    updated = crud.update_document(db, doc_id, {
        "status": "finalized",
        "is_finalized": True,
        "reviewed_data": final_data,
    })
    return updated


# ── Export ─────────────────────────────────────────────────────────────────

@router.get("/{doc_id}/export")
def export_document(
    doc_id: str,
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
):
    doc = crud.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.is_finalized:
        raise HTTPException(400, "Document must be finalized before export")

    export_data = doc.reviewed_data or doc.extracted_data or {}

    if format == "json":
        content = json.dumps({
            "id": doc.id,
            "original_filename": doc.original_filename,
            "status": doc.status,
            "finalized_at": doc.updated_at.isoformat() if doc.updated_at else None,
            "data": export_data,
        }, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{doc_id}.json"'},
        )

    # CSV export — flatten dict
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["field", "value"])

    def flatten(obj, prefix=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                flatten(v, f"{prefix}{k}.")
        elif isinstance(obj, list):
            writer.writerow([prefix.rstrip("."), ", ".join(str(x) for x in obj)])
        else:
            writer.writerow([prefix.rstrip("."), obj])

    flatten({"id": doc.id, "filename": doc.original_filename, **export_data})
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{doc_id}.csv"'},
    )


# ── Delete ─────────────────────────────────────────────────────────────────

@router.delete("/{doc_id}")
def delete_api_document(doc_id: str, db: Session = Depends(get_db)):
    doc = crud.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
        
    # Delete from filesystem if it exists
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    # Delete from DB
    crud.delete_document(db, doc_id)
    return {"status": "success", "message": "Document deleted"}

