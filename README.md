# DocFlow — Async Document Processing

DocFlow is a full-stack document intelligence system. It handles file uploads, runs background extraction pipelines via Celery, and streams real-time progress updates back to the browser using Redis Pub/Sub and Server-Sent Events (SSE).

## 🚀 Quick Start (Local Dev)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # On Linux/Mac: source venv/bin/activate
pip install -r requirements.txt

# Start the API
python -m uvicorn app.main:app --reload
```
*The API will be live at http://localhost:8000. You can view the interactive docs at `/docs`.*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The dashboard will be live at http://localhost:5173.*

---

## 🏗️ Architecture & Decisions

### Why this stack?
- **FastAPI:** Chosen for its high performance and built-in support for asynchronous request handling. It handles the initial file upload and hands off the heavy lifting to a worker immediately.
- **Celery + Redis:** Processing documents (mocked or real OCR) is time-consuming. Celery allows us to run these tasks in the background so the user is never stuck on a loading screen. Redis acts as the high-speed message broker between the API and the worker.
- **Server-Sent Events (SSE):** Instead of polling the database every second, we use Redis Pub/Sub to push updates to the UI. SSE was chosen over WebSockets because our updates are unidirectional (server-to-client), making it lighter and more resilient.
- **SQLite (Local):** For easy portability and setup, the project defaults to SQLite. It can be easily swapped for PostgreSQL in production (see `docker-compose.yml`).

### Core Pipeline
1. **Upload:** User sends files ⮕ API saves to disk ⮕ Job is queued in Celery.
2. **Process:** Worker picks up the job ⮕ Runs through 7 stages (Parsing, Extraction, etc.).
3. **Notify:** Worker publishes progress to a Redis channel ⮕ API picks up the event ⮕ Streams to Frontend via SSE.
4. **Finalize:** User reviews the extracted JSON ⮕ Edits if necessary ⮕ Finalizes the record.

## ✨ Key Features
- **Real-time Tracking:** See exactly what stage your document is in (Parsing vs. Extracting).
- **Batch Processing:** Upload multiple documents at once.
- **Review Workflow:** Extracted fields are editable before they are "locked" into the system.
- **Clean UI:** Built with React, Tailwind CSS, and Lucide icons for a professional dashboard experience.
- **Exports:** Download your finalized data as JSON or CSV.

## 📁 Project Structure
- `backend/app/main.py`: Entry point for the FastAPI application.
- `backend/app/worker/tasks.py`: Contains the document processing logic.
- `backend/app/routers/documents.py`: API endpoints for CRUD and SSE streaming.
- `frontend/src/pages/Dashboard.tsx`: Main document management interface.
- `frontend/src/components/ProgressTracker.tsx`: Visual progress bar and stage list.

---
Created for the technical assessment for the DocFlow position.
