import os
import shutil
import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.models.template import Template
from app.models.dataset import Dataset
from app.services.doctor import doctor_service
from app.services.drift_monitor import drift_monitor_service

logger = logging.getLogger("app.api.v1.templates")

router = APIRouter()

# --- Pydantic Schemas ---
class TemplateRead(BaseModel):
    id: int
    name: str
    description: str
    sample_csv_path: str
    default_config_json: str

    class Config:
        from_attributes = True

class TemplateCloneResponse(BaseModel):
    status: str
    dataset_uuid: str
    dataset_name: str

# --- REST Endpoints ---

@router.get("/", response_model=List[TemplateRead])
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    GET route fetching all available system marketplace templates.
    """
    stmt = select(Template).order_by(Template.id.asc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/{template_id}/clone", response_model=TemplateCloneResponse)
async def clone_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    POST route cloning a dataset template directly into the target workspace ingestion stream.
    """
    # 1. Fetch template by ID
    stmt = select(Template).where(Template.id == template_id)
    res = await db.execute(stmt)
    template = res.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found in the marketplace catalog."
        )

    if not os.path.exists(template.sample_csv_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source template CSV file is missing on the server."
        )

    try:
        # 2. Copy the template CSV file to the workspace datasets folder
        workspace_dir = os.path.abspath(f"./storage/workspaces/{workspace_id}/datasets")
        os.makedirs(workspace_dir, exist_ok=True)
        
        file_uuid = str(uuid.uuid4())
        dest_filename = f"template_{file_uuid[:8]}_{os.path.basename(template.sample_csv_path)}"
        dest_path = os.path.join(workspace_dir, dest_filename)
        
        shutil.copy(template.sample_csv_path, dest_path)
        
        # 3. Profile dataset using Data Doctor
        profile = doctor_service.profile_dataset(dest_path)
        
        # 4. Save metadata dataset record
        db_dataset = Dataset(
            uuid=file_uuid,
            filename=dest_filename,
            storage_path=dest_path,
            file_size=os.path.getsize(dest_path),
            content_type="text/csv",
            row_count=profile["summary"].get("total_rows"),
            column_count=profile["summary"].get("total_columns"),
            health_score=profile["health_score"],
            health_report=profile,
            workspace_id=workspace_id,
            uploaded_by_id=current_user.id
        )
        db.add(db_dataset)
        await db.commit()
        await db.refresh(db_dataset)

        # 5. Run the statistical drift monitor
        try:
            df = doctor_service.load_dataframe(dest_path)
            await drift_monitor_service.evaluate_dataset_drift(
                workspace_id=workspace_id,
                upload_id=file_uuid,
                df=df,
                db=db
            )
        except Exception as drift_err:
            logger.error(f"Error evaluating dataset drift during template clone: {drift_err}")

        return TemplateCloneResponse(
            status="success",
            dataset_uuid=db_dataset.uuid,
            dataset_name=template.name
        )

    except Exception as e:
        logger.error(f"Failed to clone template {template.name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cloning failed: {str(e)}"
        )
