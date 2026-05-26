# app/routes/chat.py

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import aiosqlite
from typing import List

from app.database import get_db
from app.models import (
    ChatCreate, ChatResponse, ChatUpdate,
    MessageCreate, MessageResponse,
    ChatRequest, ChatMessageResponse,
    SuccessResponse
)

# Import RAG service
from app.services.rag_service import get_rag_response, clear_chat_memory

router = APIRouter(prefix="/chat", tags=["Chat"])


# ======================================================
# 🔐 TEMP USER (Until Authentication Is Added)
# ======================================================
def get_current_user_id() -> str:
    """
    Temporary static user.
    Replace with JWT/Auth later.
    """
    return "internal_user"


# ========================================
# CHAT MANAGEMENT
# ========================================

@router.post("/create", response_model=ChatResponse)
async def create_chat(chat: ChatCreate, db: aiosqlite.Connection = Depends(get_db)):
    try:
        await db.execute(
            "INSERT INTO chats (id, title, pinned) VALUES (?, ?, ?)",
            (chat.id, chat.title, int(chat.pinned))
        )
        await db.commit()

        cursor = await db.execute(
            "SELECT * FROM chats WHERE id = ?", (chat.id,)
        )
        row = await cursor.fetchone()

        return ChatResponse(
            id=row["id"],
            title=row["title"],
            pinned=bool(row["pinned"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/list", response_model=List[ChatResponse])
async def list_chats(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM chats ORDER BY updated_at DESC"
    )
    rows = await cursor.fetchall()

    return [
        ChatResponse(
            id=row["id"],
            title=row["title"],
            pinned=bool(row["pinned"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )
        for row in rows
    ]


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(chat_id: str, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM chats WHERE id = ?", (chat_id,)
    )
    row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Chat not found")

    return ChatResponse(
        id=row["id"],
        title=row["title"],
        pinned=bool(row["pinned"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )


@router.put("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: str,
    chat_update: ChatUpdate,
    db: aiosqlite.Connection = Depends(get_db)
):
    updates = []
    params = []

    if chat_update.title is not None:
        updates.append("title = ?")
        params.append(chat_update.title)

    if chat_update.pinned is not None:
        updates.append("pinned = ?")
        params.append(int(chat_update.pinned))

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(chat_id)

    query = f"UPDATE chats SET {', '.join(updates)} WHERE id = ?"
    await db.execute(query, params)
    await db.commit()

    return await get_chat(chat_id, db)


@router.delete("/{chat_id}", response_model=SuccessResponse)
async def delete_chat(chat_id: str, db: aiosqlite.Connection = Depends(get_db)):
    user_id = get_current_user_id()

    await db.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
    await db.commit()

    # 🔥 Clear Milvus memory scoped by user + chat
    await clear_chat_memory(user_id=user_id, chat_id=chat_id)

    return SuccessResponse(
        success=True,
        message="Chat deleted successfully"
    )


# ========================================
# MESSAGE MANAGEMENT
# ========================================

@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
async def get_chat_messages(
    chat_id: str,
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute(
        "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
        (chat_id,)
    )
    rows = await cursor.fetchall()

    return [
        MessageResponse(
            id=row["id"],
            chat_id=row["chat_id"],
            type=row["type"],
            content=row["content"],
            created_at=row["created_at"]
        )
        for row in rows
    ]


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatRequest,
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        chat_id = request.chat_id
        user_message = request.message
        user_id = get_current_user_id()

        user_msg_id = f"msg_{datetime.now().timestamp()}"
        bot_msg_id = f"msg_{datetime.now().timestamp() + 1}"

        print(f"\n📨 User: {user_id} | Chat: {chat_id}")
        print(f"📝 Question: {user_message[:80]}")

        # Save user message
        await db.execute(
            "INSERT INTO messages (id, chat_id, type, content) VALUES (?, ?, ?, ?)",
            (user_msg_id, chat_id, "user", user_message)
        )

        # 🔥 Multi-user + multi-chat safe call
        rag_response = await get_rag_response(
            question=user_message,
            user_id=user_id,
            chat_id=chat_id
        )

        if rag_response.get("status") == "success":
            bot_response = rag_response.get("answer", "I couldn't process that query.")
            print("✅ Response generated successfully")
        else:
            bot_response = f"Error: {rag_response.get('message', 'Unknown error')}"
            print("❌ RAG returned error")

        # Save bot message
        await db.execute(
            "INSERT INTO messages (id, chat_id, type, content) VALUES (?, ?, ?, ?)",
            (bot_msg_id, chat_id, "bot", bot_response)
        )

        await db.execute(
            "UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (chat_id,)
        )

        await db.commit()

        return ChatMessageResponse(
            message_id=bot_msg_id,
            content=bot_response,
            type="bot",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        print(f"❌ Chat error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message/save", response_model=SuccessResponse)
async def save_message(
    message: MessageCreate,
    db: aiosqlite.Connection = Depends(get_db)
):
    try:
        await db.execute(
            "INSERT INTO messages (id, chat_id, type, content) VALUES (?, ?, ?, ?)",
            (message.id, message.chat_id, message.type, message.content)
        )
        await db.commit()

        return SuccessResponse(
            success=True,
            message="Message saved successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========================================
# CLEAR MEMORY
# ========================================

@router.post("/{chat_id}/clear-memory")
async def clear_chat_session_memory(chat_id: str):
    try:
        user_id = get_current_user_id()
        result = await clear_chat_memory(user_id=user_id, chat_id=chat_id)
        return result
    except Exception as e:
        print(f"❌ Clear memory error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))