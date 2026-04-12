from sqlalchemy.orm import Session
from sqlalchemy import or_
from . import models
from typing import Optional


def get_document(db: Session, document_id: str):
    return db.query(models.Document).filter(models.Document.id == document_id).first()


def get_documents(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
):
    query = db.query(models.Document)

    if status and status != "all":
        query = query.filter(models.Document.status == status)

    if search:
        query = query.filter(
            or_(
                models.Document.original_filename.ilike(f"%{search}%"),
                models.Document.file_type.ilike(f"%{search}%"),
            )
        )

    col = getattr(models.Document, sort_by, models.Document.created_at)
    if sort_order == "desc":
        query = query.order_by(col.desc())
    else:
        query = query.order_by(col.asc())

    total = query.count()
    docs = query.offset(skip).limit(limit).all()
    return docs, total


def create_document(db: Session, doc_data: dict):
    doc = models.Document(**doc_data)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def update_document(db: Session, document_id: str, update_data: dict):
    doc = get_document(db, document_id)
    if not doc:
        return None
    for key, value in update_data.items():
        setattr(doc, key, value)
    db.commit()
    db.refresh(doc)
    return doc


def delete_document(db: Session, document_id: str):
    doc = get_document(db, document_id)
    if doc:
        db.delete(doc)
        db.commit()
    return doc
