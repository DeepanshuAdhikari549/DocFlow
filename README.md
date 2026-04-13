# 🚀 DocFlow — Async Document Processing

DocFlow is a high-performance, full-stack document processing system. It allows users to upload multiple documents, process them asynchronously using Celery and Redis, and monitor progress in real-time through Server-Sent Events (SSE).

---

## 🌐 Live Demo

- **Frontend:** [https://doc-flow-amber.vercel.app](https://doc-flow-amber.vercel.app)
- **Backend API:** [https://docflow-1-zzs8.onrender.com](https://docflow-1-zzs8.onrender.com)

---

## 🧠 The Problem & Solution

In modern web apps, heavy tasks like OCR, PDF parsing, or data extraction shouldn't block the main thread. 

**DocFlow solves this by:**
- **Decoupled Architecture**: Fast API handles requests instantly while Celery handles the heavy lifting.
- **Real-time Feedback**: Using Redis Pub/Sub and SSE, the UI updates as soon as the worker finishes a stage.
- **Robust Storage**: Uploads are handled via `/tmp` fallbacks for serverless environments and persisted in a relational database.

---

## 🛠️ Tech Stack

### 🔹 Backend
- **FastAPI**: Modern, high-performance Python framework.
- **Celery**: Distributed task queue for asynchronous processing.
- **Redis**: ultra-fast message broker and progress cache.
- **PostgreSQL**: Production-grade relational storage.

### 🔹 Frontend
- **React 18**: Component-based UI with hooks for state management.
- **Vite**: Next-generation frontend tooling.
- **Tailwind CSS**: Utility-first styling for a sleek, responsive design.

### 🔹 Infrastructure
- **Vercel**: Global edge hosting for the frontend.
- **Render**: Managed hosting for the API and Workers.
- **Upstash**: Serverless Redis for global low-latency messaging.

---

## ✨ Features

- ✅ **Real-Time Tracking**: Watch documents progress from "Queued" to "Completed" live.
- ✅ **Batch Processing**: Upload multiple files simultaneously without slowdowns.
- ✅ **Interactive Review**: Edit extracted fields directly in the UI before finalizing.
- ✅ **Data Portability**: Export your processed results in **JSON** or **CSV** formats.
- ✅ **Modern UI**: Dark-mode inspired, responsive design with smooth transitions.

---

## 🚀 Local Development

### 1️⃣ Backend Setup
```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2️⃣ Worker Setup
```bash
# In a new terminal
cd backend
# Runs tasks if REDIS_URL is configured, or use USE_FAKE_REDIS=True for local testing
celery -A app.worker.celery_app worker --loglevel=info
```

### 3️⃣ Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
