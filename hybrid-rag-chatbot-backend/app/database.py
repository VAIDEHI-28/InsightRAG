# app/database.py
import aiosqlite
from pathlib import Path


# ========================================
# DATABASE PATH
# ========================================
DB_PATH = Path(__file__).parent.parent / "data" / "chat_history.db"

# Ensure data directory exists
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


# ========================================
# DATABASE CONNECTION DEPENDENCY
# ========================================
async def get_db():
    """Get database connection"""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row

    # 🔥 IMPORTANT: Enable foreign key constraints
    await db.execute("PRAGMA foreign_keys = ON;")

    try:
        yield db
    finally:
        await db.close()


# ========================================
# INITIALIZE DATABASE
# ========================================
async def init_db():
    """Initialize database tables"""
    async with aiosqlite.connect(DB_PATH) as db:

        # Enable foreign keys
        await db.execute("PRAGMA foreign_keys = ON;")

        # ----------------------------------------
        # CHATS TABLE
        # ----------------------------------------
        await db.execute("""
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                pinned INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ----------------------------------------
        # MESSAGES TABLE
        # ----------------------------------------
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('user', 'bot')),
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
            )
        """)

        # ----------------------------------------
        # LEGACY FILES TABLE (chat-linked)
        # ----------------------------------------
        await db.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                chat_id TEXT,
                filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                file_type TEXT,
                category TEXT CHECK(category IN ('purchase', 'hr', 'finance', 'other')),
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL
            )
        """)

        # ----------------------------------------
        # 🔥 NEW: CHAT-ISOLATED UPLOADED FILES TABLE
        # ----------------------------------------
        await db.execute("""
            CREATE TABLE IF NOT EXISTS uploaded_files (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_type TEXT NOT NULL,
                category TEXT NOT NULL CHECK(category IN ('purchase', 'hr', 'finance', 'other')),
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
            )
        """)

        # ----------------------------------------
        # PERFORMANCE INDEXES
        # ----------------------------------------
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_uploaded_files_chat 
            ON uploaded_files(chat_id)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_uploaded_files_category 
            ON uploaded_files(category)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_uploaded_files_chat_category 
            ON uploaded_files(chat_id, category)
        """)

        await db.commit()
        print("✅ Database initialized successfully with chat isolation!")


# ========================================
# CLOSE DATABASE (Not required for aiosqlite)
# ========================================
async def close_db():
    """Close database connection"""
    pass
