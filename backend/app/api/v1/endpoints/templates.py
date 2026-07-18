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
    Synchronizes disk template files into the database catalog first.
    """
    templates_dir = "storage/templates"
    if not os.path.exists(templates_dir):
        templates_dir = "backend/storage/templates"

    TEMPLATES_METADATA = {
        "student_productivity.csv": {
            "name": "Student Productivity Template",
            "description": "Deploys a high-density performance-velocity layout designed to track student milestone time allocation, productivity metrics, and focus velocity streaks.",
            "default_config_json": '{"growthRate": 0.15, "attritionRate": 0.05, "targetSector": "Productivity"}'
        },
        "food_delivery.csv": {
            "name": "Food Delivery Operations Template",
            "description": "Deploys a wide-pane logistics overview layout designed to expose fulfillment bottlenecks and regional volume trends.",
            "default_config_json": '{"growthRate": 0.10, "attritionRate": 0.03, "targetSector": "Logistics"}'
        },
        "security_auditor.csv": {
            "name": "Security Auditor Compliance Template",
            "description": "Deploys a data-heavy risk and validation auditing board layout designed to highlight system discrepancies.",
            "default_config_json": '{"growthRate": 0.18, "attritionRate": 0.12, "targetSector": "Compliance"}'
        },
        "retail_sales_demo.csv": {
            "name": "Retail Sales Demo Template",
            "description": "Deploys a balanced financial monitoring suite mapping regional fiscal streams.",
            "default_config_json": '{"growthRate": 0.22, "attritionRate": 0.07, "targetSector": "Commercial Revenue"}'
        },
        "saas_churn_demo.csv": {
            "name": "SaaS Enterprise Churn Metrics Template",
            "description": "Analyze monthly recurring revenue (MRR) structures, customer lifetime value (LTV) anomalies, churn velocity factors, and cohort retention distributions across contract tiers.",
            "default_config_json": '{"growthRate": 0.25, "attritionRate": 0.08, "targetSector": "SaaS Enterprise"}'
        }
    }

    try:
        if os.path.exists(templates_dir):
            # Fetch existing
            res = await db.execute(select(Template))
            existing_records = res.scalars().all()
            existing_paths = {os.path.basename(t.sample_csv_path) for t in existing_records}
            
            # Scan files and insert missing
            files = os.listdir(templates_dir)
            changed = False
            for file in files:
                if file.endswith(".csv") and file in TEMPLATES_METADATA:
                    if file not in existing_paths:
                        meta = TEMPLATES_METADATA[file]
                        db_template = Template(
                            name=meta["name"],
                            description=meta["description"],
                            sample_csv_path=os.path.join("storage/templates", file),
                            default_config_json=meta["default_config_json"]
                        )
                        db.add(db_template)
                        changed = True
            if changed:
                await db.commit()
    except Exception as e:
        logger.error(f"Failed to synchronize templates from disk to DB: {e}")

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
