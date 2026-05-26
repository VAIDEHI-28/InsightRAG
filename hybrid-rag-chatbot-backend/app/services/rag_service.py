# app/services/rag_service.py

import os
import sys
import asyncio
from typing import List, Dict, Any

# =================================================
# Add 'models' folder to Python path
# =================================================
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
project_root = os.path.dirname(app_dir)
models_path = os.path.join(project_root, "models")

if models_path not in sys.path:
    sys.path.insert(0, models_path)

# =================================================
# Import Model Layer (SESSION BASED)
# =================================================
try:
    from models.app import (
        initialize_model,
        process_query,
        release_session
    )

    from models.rag.vectorstore import VectorStore
    from models.rag.embeddings import embed
    from models.llm.llm_client import generate

except ImportError as e:
    raise ImportError(f"❌ Could not import model layer properly.\n{e}")


# =================================================
# Hybrid RAG Service (MULTI-USER SAFE)
# =================================================
class HybridRAGService:

    def __init__(self):
        self.vectorstore = None
        print("🧠 GPT-Style Chat Memory System Ready (Multi-User Mode)")

    # =================================================
    # PROCESS QUERY
    # =================================================
    async def process_query(
        self,
        question: str,
        user_id: str,
        chat_id: str
    ) -> Dict[str, Any]:

        try:

            # 1️⃣ Ensure Milvus Initialized
            if self.vectorstore is None:
                temp_embedding = embed([question])[0]
                dim = len(temp_embedding)
                self.vectorstore = VectorStore(dim)

            # 2️⃣ Retrieve Chat Semantic Memory (FIXED)
            query_embedding = embed([question])[0]

            memory_chunks = self.vectorstore.search(
                query_embedding=query_embedding,
                user_id=user_id,      # ✅ FIXED
                chat_id=chat_id,
                k=3
            )

            context_text = "\n".join(
                [chunk["text"] for chunk in memory_chunks]
            ) if memory_chunks else ""

            # 3️⃣ GPT-STYLE QUERY REWRITING
            rewritten_question = question

            if context_text:
                rewrite_prompt = f"""
You are a query rewriting engine.

Rules:
- Make the question fully self-contained.
- Resolve pronouns.
- Use conversation context only if needed.
- DO NOT answer.
- Output ONLY rewritten question.

Conversation context:
{context_text}

Current question:
{question}

Rewritten standalone question:
"""

                rewritten_question = await asyncio.to_thread(
                    generate,
                    rewrite_prompt
                )

                rewritten_question = rewritten_question.strip()

            # 4️⃣ Call Analytics Layer (SESSION SAFE)
            result = await asyncio.to_thread(
                process_query,
                rewritten_question,
                user_id,
                chat_id
            )

            # 5️⃣ Store Conversation in Milvus (FIXED)
            try:
                answer_text = result.get("answer", "")

                memory_text = f"""
User: {question}
Assistant: {answer_text}
"""

                memory_embedding = embed([memory_text])[0]

                self.vectorstore.insert(
                    embeddings=[memory_embedding],
                    texts=[memory_text],
                    user_id=user_id,      # ✅ FIXED
                    chat_id=chat_id,
                    file_id="chat_memory",
                    metadata_list=[{
                        "doc_type": "conversation",
                        "source": "chat"
                    }]
                )

            except Exception as memory_error:
                print(f"⚠️ Memory store failed: {memory_error}")

            return result

        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }

    # =================================================
    # REBUILD SYSTEM (SESSION BASED)
    # =================================================
    async def rebuild(
        self,
        file_paths: List[str],
        user_id: str,
        chat_id: str
    ) -> Dict[str, Any]:

        try:

            await asyncio.to_thread(
                release_session,
                user_id,
                chat_id
            )

            result = await asyncio.to_thread(
                initialize_model,
                file_paths,
                user_id,
                chat_id
            )

            return result

        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }

    # =================================================
    # CLEAR CHAT MEMORY
    # =================================================
    async def clear(
        self,
        user_id: str,
        chat_id: str
    ) -> Dict[str, Any]:

        try:
            if self.vectorstore:
                self.vectorstore.delete_by_chat(user_id, chat_id)  # ✅ FIXED

            return {
                "status": "success",
                "message": f"Memory cleared for user {user_id}, chat {chat_id}"
            }

        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }


# =================================================
# Singleton Instance
# =================================================
rag_service = HybridRAGService()


# =================================================
# Public API
# =================================================
async def get_rag_response(question: str, user_id: str, chat_id: str):
    return await rag_service.process_query(question, user_id, chat_id)


async def rebuild_rag_system(file_paths: List[str], user_id: str, chat_id: str):
    return await rag_service.rebuild(file_paths, user_id, chat_id)


async def clear_chat_memory(user_id: str, chat_id: str):
    return await rag_service.clear(user_id, chat_id)

def is_initialized():
    return rag_service.initialized


def get_system_status():
    return rag_service.get_status()


def release_all_resources():
    release_resources()