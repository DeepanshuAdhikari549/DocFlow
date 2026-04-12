# DocFlow — Async Document Processing Workflow System

A full-stack application for uploading documents, processing them asynchronously via Celery workers, and tracking real-time progress using Redis Pub/Sub.

**GitHub Repository:** [https://github.com/DeepanshuAdhikari549/DocFlow](https://github.com/DeepanshuAdhikari549/DocFlow)

---

## 🏗️ Architecture Overview

The system is designed with a decoupled, event-driven architecture to ensure the request-response cycle is never blocked by heavy processing.

```
[ Browser ] 
     │
     ├── (1) HTTP POST /upload  ──► [ FastAPI ] ──► [ PostgreSQL ] (Create Job)
     │                                 │
     │                           (2) .delay() ──► [ Redis Broker ]
     │                                                     │
[ Dashboard ]                                       [ Celery Worker ]
     │                                            (Processing logic)
     │                                                     │
     ├── (3) SSE /progress/stream ◄── [ Redis Pub/Sub ] ◄──┘ (Status Events)
```

### Key Components:
- **FastAPI:** Handles synchronous API requests and dispatches tasks.
- **PostgreSQL:** Persistent storage for document metadata and extracted results.
- **Celery:** Asynchronous task worker for handling the document processing pipeline.
- **Redis:** Serves dual-purpose as the Celery message broker and the real-time Pub/Sub layer for progress events.
- **SSE (Server-Sent Events):** Provides a persistent connection from server to client to stream progress updates directly from Redis Pub/Sub.

---

## 🚀 Setup & Run Steps

### Option A: Running with Docker (Recommended)
This is the fastest way to get all services (Postgres, Redis, Backend, Worker, Frontend) running with a single command.

**Prerequisites:** Docker Desktop installed.

```bash
# Clone the repository
git clone https://github.com/DeepanshuAdhikari549/DocFlow.git
cd DocFlow

# Build and start all services
docker compose up --build

# Access the application:
# Frontend:  http://localhost:5173
# API Docs:  http://localhost:8000/docs
```

### Option B: Manual Setup (Local Development)
**Prerequisites:** Python 3.11+, Node.js 18+, Redis, and PostgreSQL.

1. **Database:** Create a database named `docflow` owned by `docuser`.
2. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate # Windows: .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   # Ensure .env is configured correctly
   python -m uvicorn app.main:app --reload
   ```
3. **Worker:** (In a new terminal)
   ```bash
   cd backend
   source venv/bin/activate
   celery -A app.worker.celery_app worker --loglevel=info
   ```
4. **Frontend:** (In a new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## ✨ Features
- **Multi-file Upload:** Batch upload support with validation.
- **Real-time Tracking:** Visual progress bar updated via Redis Pub/Sub events.
- **Document Pipeline:** 7-stage simulated extraction (Parsing -> Extraction -> Storage).
- **CRUD Operations:** Support for Listing, Filtering, Searching, and **Deleting** documents.
- **Review Workflow:** Edit extracted fields and **Finalize** documents to lock data.
- **Exporting:** Download finalized data as **JSON** or **CSV**.
- **Resilience:** Idempotent retry mechanism for failed processing jobs.
- **Timezone Aware:** UI displays "time ago" relative to the user's local clock.

---

## 📝 Assumptions, Tradeoffs & Limitations

### Assumptions:
- **Simulated Logic:** As per the assignment guidelines, the actual text extraction is simulated with logic that gauges word/page counts based on file size.
- **Public Access:** The system assumes a trusted environment (no Auth implemented as it was a bonus feature).

### Tradeoffs:
- **SQLite vs Postgres:** Locally, the app uses SQLite for ease of setup; however, the Docker configuration is fully production-ready with PostgreSQL.
- **SSE vs WebSockets:** SSE was chosen for progress tracking as it is lighter-weight and unidirectional, which perfectly fits the "worker-to-browser" event flow.
- **Local Storage:** Files are stored on the local filesystem. In a distributed cloud environment, this would be replaced by an S3 bucket.

### Limitations:
- **No OCR:** Does not physically "read" text from images/PDFs (mocked extraction).
- **Memory Broker:** When running without Redis locally, it falls back to an in-memory broker (FakeRedis), though real Redis is required for the full async experience.
- **Pagination:** The dashboard displays the last 50 documents; full pagination is not implemented in this version.

---

## 🧪 Testing Samples
I have included a `samples/` directory in the root:
- `samples/sample_invoice.txt` & `sample_report.txt`: Use these for demo uploads.
- `samples/exports/`: Contains example JSON output of a finalized document.

---

## 🤖 AI Tool Usage Note
AI tools (Antigravity/Gemini) were utilized to accelerate development, specifically for boilerplate setup, UI styling refinements, and bug debugging. All core architectural decisions and Redis Pub/Sub integration logic were manually designed.
