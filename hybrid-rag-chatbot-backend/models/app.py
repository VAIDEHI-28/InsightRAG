# =================================================
# ENV
# =================================================
from dotenv import load_dotenv
load_dotenv()

import json
import os
from typing import List, Tuple, Dict

# =================================================
# Logging
# =================================================
from utils.logger import setup_logger
logger = setup_logger()
logger.info("Model Engine loaded (SESSION-based mode)")

# =================================================
# Core
# =================================================
from data.loader import load_excel_files
from schema.schema_builder import build_schema
from core.planner import Planner
from core.analytics_engine import AnalyticsEngine
from core.memory import ReferentialMemory
from llm.llm_client import generate

# =================================================
# RAG
# =================================================
from rag.schema_docs import build_schema_docs
from rag.dataset_summary import build_dataset_summary
from rag.embeddings import embed
from rag.vectorstore import VectorStore
from rag.retriever import Retriever


# =================================================
# SESSION STORAGE (MULTI-USER SAFE)
# =================================================
class AnalyticsSession:
    def __init__(
        self,
        df,
        schema,
        planner,
        engine,
        memory,
        retriever,
        vectorstore
    ):
        self.df = df
        self.schema = schema
        self.planner = planner
        self.engine = engine
        self.memory = memory
        self.retriever = retriever
        self.vectorstore = vectorstore
        self.initialized = True


# Key: (user_id, chat_id)
sessions: Dict[Tuple[str, str], AnalyticsSession] = {}


# =================================================
# INITIALIZE MODEL (PER SESSION)
# =================================================
def initialize_model(
    file_paths: List[str],
    user_id: str,
    chat_id: str
) -> dict:

    session_key = (user_id, chat_id)

    try:
        if not file_paths:
            release_session(user_id, chat_id)
            return {"status": "success", "rows": 0, "columns": 0}

        logger.info(f"Initializing model for user={user_id} chat={chat_id}")

        # Load planner prompt
        current_dir = os.path.dirname(os.path.abspath(__file__))
        prompt_path = os.path.join(current_dir, "prompts", "planner_prompt.txt")

        with open(prompt_path, "r", encoding="utf-8") as f:
            planner_prompt = f.read()

        # Load dataset
        df = load_excel_files(file_paths)
        schema = build_schema(df)

        planner = Planner(schema, planner_prompt)
        engine = AnalyticsEngine(df, schema)
        memory = ReferentialMemory()

        # =================================================
        # BUILD RAG SAFELY (SESSION SCOPED)
        # =================================================
        retriever = None
        vectorstore = None

        try:
            schema_docs = build_schema_docs(schema)
            dataset_doc = build_dataset_summary(df)

            rag_texts = []
            if schema_docs:
                rag_texts.extend(schema_docs)
            if dataset_doc:
                rag_texts.append(dataset_doc)

            if rag_texts:

                embeddings = embed(rag_texts)
                dim = len(embeddings[0])

                vectorstore = VectorStore(dim)

                vectorstore.insert(
                    embeddings=embeddings,
                    texts=rag_texts,
                    chat_id=chat_id,
                    file_id="system_init",
                    metadata_list=[
                        {"doc_type": "schema", "source": "system"}
                        for _ in rag_texts
                    ]
                )

                retriever = Retriever(vectorstore, embed)
                logger.info("RAG initialized successfully")

        except Exception as e:
            retriever = None
            logger.warning(f"RAG disabled: {e}")

        # Store session
        sessions[session_key] = AnalyticsSession(
            df,
            schema,
            planner,
            engine,
            memory,
            retriever,
            vectorstore
        )

        return {
            "status": "success",
            "rows": len(df),
            "columns": len(df.columns)
        }

    except Exception as e:
        logger.error(f"Initialization failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


# =================================================
# RELEASE SESSION (NOT GLOBAL)
# =================================================
def release_session(user_id: str, chat_id: str):

    session_key = (user_id, chat_id)

    logger.info(f"Releasing session user={user_id} chat={chat_id}")

    if session_key in sessions:

        session = sessions[session_key]

        if session.vectorstore:
            try:
                session.vectorstore.release()
            except Exception:
                pass

        del sessions[session_key]

    import gc
    gc.collect()


# =================================================
# PROCESS QUERY (PER SESSION)
# =================================================
def process_query(
    question: str,
    user_id: str,
    chat_id: str
) -> dict:

    session_key = (user_id, chat_id)

    if session_key not in sessions:
        return {
            "status": "error",
            "message": "Model not initialized for this session."
        }

    session = sessions[session_key]

    try:
        # Resolve using memory if possible
        if session.memory.can_resolve(question):
            resolved = session.memory.resolve(question)
            plan = resolved if resolved else session.planner.plan(question)
        else:
            plan = session.planner.plan(question)

        # Explain mode
        if plan.get("type") == "explain":

            answer = generate(f"""
You are a business analyst.

Previous question:
{session.memory.last_question}

Previous result:
{session.memory.last_result}

User follow-up:
{question}

Explain clearly.
""")

            return {
                "status": "success",
                "answer": answer,
                "plan": plan,
                "result": None
            }

        # Execute analytics
        if "steps" in plan:
            result = session.engine.run_pipeline(plan["steps"])
        else:
            result = session.engine.run(plan)

        if result is None:
            return {
                "status": "success",
                "answer": "No data found matching your criteria.",
                "plan": plan,
                "result": None
            }

        session.memory.store(question, plan, result)

        strict_prompt = f"""
You are a data-to-text formatter.

STRICT RULES:
- Use ONLY the data provided.
- DO NOT hallucinate.
- DO NOT modify numbers.
- Provide only final answer.

User Question:
{question}

Structured Result:
{json.dumps(result, indent=2)}

Generate professional answer.
"""

        final_answer = generate(strict_prompt)

        return {
            "status": "success",
            "answer": final_answer,
            "plan": plan,
            "result": result
        }

    except Exception as e:
        logger.error(f"Model error: {e}")
        return {
            "status": "error",
            "message": str(e)
        }