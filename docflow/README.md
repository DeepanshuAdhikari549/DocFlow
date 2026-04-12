# DocFlow — Async Document Processing Workflow System

A full-stack application for uploading documents, processing them asynchronously via Celery workers, and tracking real-time progress using Redis Pub/Sub.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Python + FastAPI |
| Database | PostgreSQL |
| Task Queue | Celery |
| Broker / Pub-Sub | Redis |
| Containerisation | Docker + Docker Compose |

---

## Architecture Overview

```
Browser
  │
  ├── GET/POST /api/*  ──►  FastAPI (port 8000)
  │                              │
  │                              ├── PostgreSQL (state + results)
  │                              └── Redis (Celery broker + Pub/Sub)
  │                                        │
  │                              Celery Worker
  │                              (background processing)
  │                              publishes events → Redis channel job:{id}
  │
  └── SSE /api/documents/{id}/progress/stream
        subscribes to Redis Pub/Sub for live updates
```

### Processing Pipeline

Each uploaded document goes through 7 stages, each published as a Redis Pub/Sub event:

```
job_queued → job_started → document_parsing_started → document_parsing_completed
→ field_extraction_started → field_extraction_completed → job_completed / job_failed
```

---

## Running with Docker (Recommended — One Command)

### Prerequisites
- Docker Desktop installed and running

```bash
# Clone / unzip the project
cd docflow

# Build and start all services
docker compose up --build

# Open browser
# Frontend:  http://localhost:5173
# API docs:  http://localhost:8000/docs
```

To stop:
```bash
docker compose down
```

To wipe all data:
```bash
docker compose down -v
```

---

## Running Manually (Without Docker)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL running on port 5432
- Redis running on port 6379

### 1. PostgreSQL Setup

```sql
-- run in psql
CREATE USER docuser WITH PASSWORD 'docpass';
CREATE DATABASE docflow OWNER docuser;
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
# Edit .env if your DB/Redis settings differ

# Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start Celery Worker (new terminal)

```bash
cd backend
source venv/bin/activate        # Windows: venv\Scripts\activate

# Set env vars
export DATABASE_URL=postgresql://docuser:docpass@localhost:5432/docflow
export REDIS_URL=redis://localhost:6379/0

celery -A app.worker.celery_app worker --loglevel=info --concurrency=4
```

### 4. Frontend Setup (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/documents/upload | Upload one or more files |
| GET | /api/documents | List all documents (search, filter, sort) |
| GET | /api/documents/{id} | Get document details |
| GET | /api/documents/{id}/progress | Polling progress endpoint |
| GET | /api/documents/{id}/progress/stream | SSE live progress stream |
| POST | /api/documents/{id}/retry | Retry a failed job |
| PUT | /api/documents/{id}/review | Update reviewed/edited output |
| POST | /api/documents/{id}/finalize | Finalize a completed document |
| GET | /api/documents/{id}/export?format=json | Export as JSON |
| GET | /api/documents/{id}/export?format=csv | Export as CSV |

Full interactive docs: http://localhost:8000/docs

---

## Features

- Upload one or more documents simultaneously
- Background processing via Celery (NOT inside the request handler)
- Redis Pub/Sub publishes 7 progress events per job
- Live progress tracking via Server-Sent Events (SSE) + polling fallback
- Job dashboard with search, status filter, and sort
- Delete functionality (removes document from DB and physical file from disk)
- Document detail page with step-by-step pipeline visualization
- Inline editing of extracted fields before finalization
- One-click finalize to lock the reviewed output
- Export finalized records as JSON or CSV
- Retry support for failed jobs
- Timezone-aware UI (correctly calculates "time ago" regardless of server/client offset)

---

## Assumptions & Tradeoffs

- **Processing logic is simulated** — the assignment explicitly states this is acceptable. The async architecture (Celery + Redis Pub/Sub) is fully real.
- **Live updates** on the detail page use the SSE endpoint at `/progress/stream`.
- **No authentication** — implementing auth was listed as a bonus, not required.
- **Single-node Celery** — uses `concurrency=4` workers. In production this would be scaled horizontally.
- **File storage is local disk** — a production system would use S3 or similar object storage.

---

## Limitations

- No OCR / real text extraction (mocked as per assignment instructions)
- No file size enforcement on the backend (only frontend validation)
- No pagination on dashboard (limit 50, sufficient for demo)
- SSE streams disconnect on job completion (by design)

---

## Bonus Features Implemented

- Docker Compose setup (one-command startup)
- Nginx reverse proxy for frontend production build
- Idempotent retry handling with retry count tracking
- Redis key TTL for progress cache (5 minutes)

---

## Notes on AI Tool Usage

AI tools were used to assist with boilerplate code generation and debugging. All architecture decisions, system design, and core implementation logic were written and reviewed manually.
