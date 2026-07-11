import logging
from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.models.dataset import Dataset
from app.models.insight import Insight, Report
from app.models.canvas import CanvasComment

logger = logging.getLogger("app.api.v1.digest")

router = APIRouter()

# --- Pydantic Schemas ---
class DigestItem(BaseModel):
    text: str
    icon: str # "dataset", "insight", "report", "comment", "stable"

class DigestRead(BaseModel):
    status: str
    items: List[DigestItem]

# --- REST Endpoints ---

@router.get("/", response_model=DigestRead)
async def get_user_digest(
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    GET route querying and calculating workspace activity summaries since the user's last recorded login.
    Resets the user's last_login_at timestamp right before returning.
    """
    # 1. Fetch user last_login_at or fallback to 7 days ago
    last_login = current_user.last_login_at
    if last_login is None:
        last_login = datetime.now(timezone.utc) - timedelta(days=7)
    else:
        # Ensure last_login is timezone aware to prevent calculation errors
        if last_login.tzinfo is None:
            last_login = last_login.replace(tzinfo=timezone.utc)

    # 2. Count workspace activity metrics since last_login
    # New datasets count
    ds_stmt = select(func.count(Dataset.id)).where(
        Dataset.workspace_id == workspace_id,
        Dataset.created_at > last_login
    )
    ds_res = await db.execute(ds_stmt)
    datasets_count = ds_res.scalar() or 0

    # New insights count
    ins_stmt = select(func.count(Insight.id)).where(
        Insight.workspace_id == workspace_id,
        Insight.created_at > last_login
    )
    ins_res = await db.execute(ins_stmt)
    insights_count = ins_res.scalar() or 0

    # New reports count
    rep_stmt = select(func.count(Report.id)).where(
        Report.workspace_id == workspace_id,
        Report.created_at > last_login
    )
    rep_res = await db.execute(rep_stmt)
    reports_count = rep_res.scalar() or 0

    # New multiplayer comments count
    comment_stmt = select(func.count(CanvasComment.id)).where(
        CanvasComment.workspace_id == workspace_id,
        CanvasComment.created_at > last_login
    )
    comment_res = await db.execute(comment_stmt)
    comments_count = comment_res.scalar() or 0

    # 3. Compile deltas summary lists
    items = []
    
    if datasets_count > 0:
        items.append(DigestItem(
            text=f"{datasets_count} new dataset file(s) ingested into your workspace.",
            icon="dataset"
        ))
    if insights_count > 0:
        items.append(DigestItem(
            text=f"{insights_count} new AI narrative summary reports generated.",
            icon="insight"
        ))
    if reports_count > 0:
        items.append(DigestItem(
            text=f"{reports_count} executive corporate presentation slide decks compiled.",
            icon="report"
        ))
    if comments_count > 0:
        items.append(DigestItem(
            text=f"{comments_count} multiplayer comments left by teammates on the canvas.",
            icon="comment"
        ))

    # Add stable fallback if no modifications happened
    if not items:
        items.append(DigestItem(
            text="No structural changes occurred since your last visit. Workspace environment is stable.",
            icon="stable"
        ))

    # 4. Save and commit updated last_login_at timestamp
    # Use merge to safely bind current_user back to active db session if detached
    db_user = await db.merge(current_user)
    db_user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return DigestRead(status="success", items=items)
