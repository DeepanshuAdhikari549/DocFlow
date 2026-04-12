# 🚀 DocFlow — Async Document Processing

DocFlow is a full-stack document processing system that allows users to upload documents, process them in the background, and track progress in real-time.

It uses FastAPI, Celery, Redis, and React to provide a smooth and scalable experience.

---

## 🌐 Live Demo

👉 Frontend: https://doc-flow-five-delta.vercel.app  
👉 Backend API: https://docflow-api.onrender.com/docs  

---

## 🧠 What Problem It Solves

In many applications, document processing takes time (like OCR or data extraction).  
If handled directly, users have to wait, which leads to a poor experience.

DocFlow solves this by:
- Running processing in the background  
- Showing real-time progress updates  
- Allowing users to review and export results  

---

## 🛠️ Tech Stack

### 🔹 Backend
- FastAPI — Fast and async API handling  
- Celery — Background task processing  
- Redis — Message broker + real-time communication  
- SQLite — Lightweight database (can switch to PostgreSQL)

### 🔹 Frontend
- React — UI development  
- Vite — Fast build tool  
- Tailwind CSS — Styling  

### 🔹 Deployment
- Vercel — Frontend hosting  
- Render — Backend + Worker hosting  
- Redis Cloud — Managed Redis  

---

## ⚙️ How It Works (Simple Flow)

1. User uploads document  
2. FastAPI receives file and creates a job  
3. Celery worker processes the document  
4. Redis sends progress updates  
5. Frontend receives updates using SSE  
6. User reviews and exports the result  

---

## ✨ Features

- ✅ Real-time progress tracking  
- ✅ Background document processing  
- ✅ Batch upload support  
- ✅ Editable extracted data  
- ✅ Export as JSON / CSV  
- ✅ Clean and responsive UI  

---

## 🚀 Run Locally

### 1️⃣ Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload
