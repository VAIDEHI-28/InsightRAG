import logging
import os

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

def setup_logger():
    logger = logging.getLogger("HybridRAG")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        file_handler = logging.FileHandler("logs/app.log")
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s"
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger
