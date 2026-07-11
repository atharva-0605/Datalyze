from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import os

from app.core.database import get_db
from app.core.config import settings
from app.core.ai_engine import cloud_ai_engine

router = APIRouter()

@router.get("")
async def health_check(response: Response, db: AsyncSession = Depends(get_db)):
    """Liveness probe verifying database connectivity, local storage permissions, and AI Engine status."""
    # 1. Test Database
    db_status = "unhealthy"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        pass
        
    # 2. Test Local Disk Write permissions
    storage_status = "unhealthy"
    try:
        test_file = os.path.join(settings.STORAGE_DIR, ".health_test")
        with open(test_file, "w") as f:
            f.write("healthcheck")
        os.remove(test_file)
        storage_status = "healthy"
    except Exception:
        pass
        
    # 3. Check AI Cloud API Status
    ai_status = "offline"
    try:
        if await cloud_ai_engine.is_healthy():
            ai_status = "online"
    except Exception:
        pass
        
    # Standard health-check responses
    if db_status == "unhealthy" or storage_status == "unhealthy":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unhealthy",
            "database": db_status,
            "storage": storage_status,
            "ai_engine": ai_status,
            "ollama": ai_status  # Backwards compatibility fallback alias
        }
        
    return {
        "status": "healthy",
        "database": db_status,
        "storage": storage_status,
        "ai_engine": ai_status,
        "ollama": ai_status  # Backwards compatibility fallback alias
    }
