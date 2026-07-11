import os
import logging
from logging.handlers import RotatingFileHandler

# Define absolute paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOG_DIR = os.path.join(BASE_DIR, "storage", "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "audit.log")

# Setup logger
audit_logger = logging.getLogger("audit_logger")
audit_logger.setLevel(logging.INFO)

# Prevent duplicate handlers
if not audit_logger.handlers:
    handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=5 * 1024 * 1024, # 5MB
        backupCount=3,
        encoding="utf-8"
    )
    formatter = logging.Formatter("%(message)s")
    handler.setFormatter(formatter)
    audit_logger.addHandler(handler)

def log_audit_event(user_email: str, action: str, workspace_id: int, status_code: int):
    """Formats and writes a structured audit log event."""
    from datetime import datetime, timezone
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    log_string = f"[{timestamp}] | USER: {user_email} | ACTION: {action} | WORKSPACE: {workspace_id} | STATUS: {status_code}"
    audit_logger.info(log_string)
