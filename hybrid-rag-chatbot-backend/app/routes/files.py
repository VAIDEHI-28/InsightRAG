# app/routes/files.py

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from pathlib import Path
import aiosqlite
from datetime import datetime
import shutil
import uuid
import os
import gc
import time
from typing import Optional

from app.database import get_db
from app.models import (
    CategoryFileUploadResponse,
    FileListResponse,
    FileListItem,
    FileCategory
)

from app.services.rag_service import rebuild_rag_system

router = APIRouter(prefix="/files", tags=["Files"])

UPLOAD_DIR = Path(__file__).parent.parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ========================================
# HELPER: FORCE DELETE FILE
# ========================================
def force_delete_file(file_path: Path, max_attempts: int = 5) -> bool:
    if not file_path.exists():
        print(f"⚠️ File doesn't exist: {file_path}")
        return True

    print(f"🗑️ Attempting to delete: {file_path.name}")

    for attempt in range(max_attempts):
        try:
            gc.collect()
            time.sleep(0.3)

            os.remove(file_path)
            print(f"✅ File deleted successfully")
            return True

        except PermissionError as e:
            print(f"⚠️ Attempt {attempt + 1}/{max_attempts}: File locked - {e}")

            if attempt < max_attempts - 1:
                time.sleep(1)

    return False


# ========================================
# UPLOAD FILE WITH CATEGORY (USER + CHAT ISOLATED)
# ========================================
@router.post("/upload-category", response_model=CategoryFileUploadResponse)
async def upload_file_with_category(
    file: UploadFile = File(...),
    category: FileCategory = Form(...),
    chat_id: str = Form(...),
    description: Optional[str] = Form(None),
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        print(f"\n{'='*60}")
        print(f"📤 Upload request received for Chat ID: {chat_id}")
        print(f"{'='*60}\n")

        # 🔐 TEMP USER (Until authentication is implemented)
        user_id = "internal_user"

        # Validate chat exists
        cursor = await db.execute(
            "SELECT id FROM chats WHERE id = ?",
            (chat_id,)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Chat not found")

        allowed_extensions = [".xlsx", ".xls", ".csv"]
        file_ext = Path(file.filename).suffix.lower()

        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )

        # Create chat-specific directory
        chat_upload_dir = UPLOAD_DIR / chat_id
        chat_upload_dir.mkdir(parents=True, exist_ok=True)

        file_id = str(uuid.uuid4())
        unique_filename = f"{file_id}_{file.filename}"
        file_path = chat_upload_dir / unique_filename

        print(f"📁 Saving file to: {file_path}")

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = file_path.stat().st_size

        # Save file metadata in SQLite
        await db.execute(
            """INSERT INTO uploaded_files
            (id, chat_id, filename, original_filename, file_path, file_size, file_type, category, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                file_id,
                chat_id,
                unique_filename,
                file.filename,
                str(file_path),
                file_size,
                file_ext,
                category.value,
                description
            )
        )
        await db.commit()

        print(f"✅ File uploaded: {file.filename}")
        print(f"📊 Category: {category.value}")
        print(f"📦 Size: {file_size} bytes")

        # ========================================
        # 🔥 Rebuild RAG ONLY for this user + chat
        # ========================================
        print("\n🔄 Triggering per-user + per-chat RAG rebuild...")

        cursor = await db.execute(
            "SELECT file_path FROM uploaded_files WHERE chat_id = ?",
            (chat_id,)
        )
        rows = await cursor.fetchall()
        chat_files = [row["file_path"] for row in rows]

        print(f"📂 Found {len(chat_files)} file(s) for this chat")

        rebuild_result = await rebuild_rag_system(
            file_paths=chat_files,
            user_id=user_id,
            chat_id=chat_id
        )

        if rebuild_result.get("status") == "success":
            print(f"✅ RAG rebuilt for User: {user_id} | Chat: {chat_id}")
        else:
            print(f"⚠️ RAG rebuild warning: {rebuild_result.get('message')}")

        print(f"\n{'='*60}\n")

        return CategoryFileUploadResponse(
            file_id=file_id,
            filename=unique_filename,
            original_filename=file.filename,
            file_size=file_size,
            file_type=file_ext,
            category=category,
            uploaded_at=datetime.now().isoformat(),
            description=description
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# LIST FILES BY CHAT + CATEGORY
# ========================================
@router.get("/list/{chat_id}/{category}", response_model=FileListResponse)
async def list_files_by_category(
    chat_id: str,
    category: FileCategory,
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        print(f"\n📂 Listing files for Chat {chat_id} | Category: {category.value}")

        cursor = await db.execute(
            "SELECT * FROM uploaded_files WHERE chat_id = ? AND category = ? ORDER BY uploaded_at DESC",
            (chat_id, category.value)
        )
        rows = await cursor.fetchall()

        print(f"📊 Found {len(rows)} file(s)")

        files = [
            FileListItem(
                file_id=row["id"],
                filename=row["filename"],
                original_filename=row["original_filename"],
                file_size=row["file_size"],
                file_type=row["file_type"],
                category=FileCategory(row["category"]),
                uploaded_at=row["uploaded_at"],
                description=row["description"]
            )
            for row in rows
        ]

        return FileListResponse(
            files=files,
            total=len(files),
            category=category
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))