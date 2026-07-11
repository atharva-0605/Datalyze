import os
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.models.insight import Insight, Report
from app.models.dataset import Dataset
from app.services.report_generator import report_generator_service
from app.services.report_engine import report_engine_service

logger = logging.getLogger("app.api.v1.insights")

router = APIRouter()

# --- Pydantic Schemas ---
class InsightRead(BaseModel):
    id: int
    workspace_id: int
    upload_id: Optional[str] = None
    narrative_text: str
    source_type: str
    created_at: datetime

    class Config:
        from_attributes = True

class ReportRead(BaseModel):
    id: int
    workspace_id: int
    file_path: str
    created_at: datetime

    class Config:
        from_attributes = True

class GenerateReportRequest(BaseModel):
    format: str = "PPTX" # "PDF" or "PPTX"
    title: Optional[str] = "Executive Data Summary Report"
    selected_sections: Optional[List[str]] = None

# --- REST Endpoints ---

@router.get("/", response_model=List[InsightRead])
async def list_insights(
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all AI generated insights for the active workspace.
    """
    stmt = select(Insight).where(Insight.workspace_id == workspace_id).order_by(Insight.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/reports", response_model=List[ReportRead])
async def list_reports(
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all compiled reports logs for the active workspace.
    """
    stmt = select(Report).where(Report.workspace_id == workspace_id).order_by(Report.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{insight_id}", response_model=InsightRead)
async def get_insight_detail(
    insight_id: int,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches the detail matrix of a single insight record.
    """
    stmt = select(Insight).where(Insight.id == insight_id, Insight.workspace_id == workspace_id)
    res = await db.execute(stmt)
    insight = res.scalars().first()
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found in this workspace context."
        )
    return insight

@router.post("/generate-report")
async def generate_and_log_report(
    payload: GenerateReportRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Generates a PDF or PPTX slide deck, saves the details in the reports table, and returns the file download.
    """
    if payload.format.upper() == "PPTX":
        try:
            # Fallback to defaults if sections are omitted
            sections = payload.selected_sections or ["Data Health Scorecard", "What-If Simulation Projections", "Customer Segmentation Badges"]
            file_path = await report_generator_service.generate_executive_presentation(
                workspace_id=workspace_id,
                selected_sections=sections,
                db=db
            )
            if not os.path.exists(file_path):
                raise HTTPException(status_code=500, detail="Generated presentation file not found on server.")
            
            # Log the compiled report
            db_report = Report(workspace_id=workspace_id, file_path=file_path)
            db.add(db_report)
            await db.commit()
            
            return FileResponse(
                file_path,
                media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                filename=os.path.basename(file_path),
                headers={
                    "Content-Disposition": f"attachment; filename={os.path.basename(file_path)}",
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            )
        except Exception as e:
            logger.error(f"Failed to generate PPTX report: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate slide presentation: {str(e)}")
            
    elif payload.format.upper() == "PDF":
        # Pull the most recent dataset
        ds_stmt = select(Dataset).where(Dataset.workspace_id == workspace_id).order_by(Dataset.created_at.desc()).limit(1)
        ds_res = await db.execute(ds_stmt)
        dataset = ds_res.scalars().first()
        if not dataset:
            raise HTTPException(
                status_code=400,
                detail="No dataset uploaded yet. Ingest a dataset first to generate a PDF report."
            )
        if not dataset.health_report:
            raise HTTPException(
                status_code=400,
                detail="Dataset diagnostics not initialized. Please profile the dataset first."
            )
            
        try:
            workspace_reports_dir = os.path.abspath(
                os.path.join(os.path.dirname(dataset.storage_path), "..", "reports")
            )
            os.makedirs(workspace_reports_dir, exist_ok=True)
            
            output_filename = f"report_{dataset.uuid}_{int(datetime.now().timestamp())}.pdf"
            output_path = os.path.join(workspace_reports_dir, output_filename)
            
            html_content = report_engine_service.generate_report_html(
                dataset_metadata={
                    "filename": dataset.filename,
                    "file_size": dataset.file_size,
                    "workspace_id": workspace_id
                },
                profile_report=dataset.health_report,
                title=payload.title or "Executive Data Summary Report",
                custom_notes="Auto-generated workspace report log."
            )
            
            compiled_path = report_engine_service.compile_html_to_pdf(html_content, output_path)
            
            # Log the compiled report
            db_report = Report(workspace_id=workspace_id, file_path=compiled_path)
            db.add(db_report)
            await db.commit()
            
            if compiled_path.endswith(".html"):
                media_type = "text/html"
                download_name = f"report_{dataset.filename}.html"
            else:
                media_type = "application/pdf"
                download_name = f"report_{dataset.filename}.pdf"
                
            return FileResponse(
                compiled_path,
                media_type=media_type,
                filename=download_name,
                headers={
                    "Content-Disposition": f"attachment; filename={download_name}",
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            )
        except Exception as e:
            logger.error(f"Failed to generate PDF report: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to compile PDF report: {str(e)}")
            
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid report format. Supported formats are 'PDF' and 'PPTX'."
        )
