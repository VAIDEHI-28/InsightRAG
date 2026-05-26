# app/main.py

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Import database
from app.database import init_db

# Import RAG service functions
from app.services.rag_service import is_initialized

# Import routes
from app.routes import chat, files


# ========================================
# LIFESPAN CONTEXT MANAGER
# ========================================
@asynccontextmanager
async def lifespan(app: FastAPI):

    print("=" * 60)
    print("🚀 Starting ARG Supply Tech Chatbot API...")
    print("=" * 60)

    # Initialize database
    await init_db()
    print("✅ Database ready!")

    # ✅ Multi-user mode: No global rebuild
    print("🧠 Multi-user RAG mode enabled.")
    print("📌 RAG will initialize per user + per chat on file upload.")
    print("=" * 60)

    yield

    print("=" * 60)
    print("🛑 Shutting down ARG Supply Tech Chatbot API...")
    print("=" * 60)


# ========================================
# CREATE FASTAPI APP
# ========================================
app = FastAPI(
    title="ARG Supply Tech Chatbot",
    description="AI-powered analytics chatbot for supply chain data",
    version="2.0.0",
    lifespan=lifespan
)


# ========================================
# CORS MIDDLEWARE
# ========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================================
# ROUTES
# ========================================
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(files.router, prefix="/api", tags=["Files"])


# ========================================
# ROOT ENDPOINT
# ========================================
@app.get("/")
async def root():
    return {
        "status": "online",
        "message": "ARG Supply Tech Chatbot API",
        "version": "2.0.0",
        "rag_initialized": is_initialized(),
        "timestamp": datetime.now().isoformat(),
        "architecture": "Multi-user + Multi-chat isolated (Milvus scoped)"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "rag_initialized": is_initialized(),
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)