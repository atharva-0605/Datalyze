from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.monitor import DatasetFingerprint
from app.models.workspace import Workspace

router = APIRouter()

class DriftLogResponse(BaseModel):
    id: int
    upload_id: str
    column_name: str
    mean_value: Optional[float] = None
    std_dev_value: Optional[float] = None
    cardinality: int
    drift_status: str # "STABLE", "WARNING", "DRIFTED"
    p_value: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/workspace/{workspace_id}/drift-history", response_model=List[DriftLogResponse])
async def get_workspace_drift_history(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    GET route returning chronological dataset profile metrics and drift status logs.
    Enforces workspace environment tenancy isolation checking.
    """
    # Verify if user has access to this workspace (either as owner or member)
    stmt = select(Workspace).where(
        (Workspace.id == workspace_id) &
        ((Workspace.owner_id == current_user.id) | (current_user.workspace_id == workspace_id))
    )
    result = await db.execute(stmt)
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Lateral query access blocked. Workspace credentials mismatch."
        )

    stmt = select(DatasetFingerprint).where(
        DatasetFingerprint.workspace_id == workspace_id
    ).order_by(DatasetFingerprint.created_at.desc())
    
    res = await db.execute(stmt)
    return res.scalars().all()
