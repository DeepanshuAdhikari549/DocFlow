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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://docflow-frontend.vercel.app", 
        "https://docflow-1-3q7p.onrender.com"
    ],
    allow_credentials=True,
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


@app.get("/health")
def health():
    return {"status": "ok"}
