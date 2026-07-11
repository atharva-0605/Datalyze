from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Dict, Any
import io
import pandas as pd

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.services.schema_mapper import schema_mapper_service

router = APIRouter()

@router.post("/preview-headers")
async def preview_headers_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
):
    """
    POST route to extract headers from a CSV or Excel file.
    """
    filename = file.filename.lower()
    content = await file.read()
    
    try:
        if filename.endswith(".csv"):
            # Load first few rows as CSV to get headers
            df = pd.read_csv(io.BytesIO(content), nrows=2)
            headers = df.columns.tolist()
        elif filename.endswith((".xlsx", ".xls")):
            # Load first sheet headers safely
            df = pd.read_excel(io.BytesIO(content), nrows=2, engine="openpyxl")
            headers = df.columns.tolist()
        elif filename.endswith(".json"):
            df = pd.read_json(io.BytesIO(content), nrows=2)
            headers = df.columns.tolist()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload CSV, Excel, or JSON."
            )
        # Convert all headers to strings
        headers = [str(h) for h in headers]
        return {"status": "success", "headers": headers}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse spreadsheet headers: {str(e)}"
        )

class SchemaAnalyzeRequest(BaseModel):
    uploaded_columns: List[str]
    target_columns: List[str]

class SchemaConfirmItem(BaseModel):
    detected_header: str
    mapped_header: str
    confidence_score: float

class SchemaConfirmRequest(BaseModel):
    mappings: List[SchemaConfirmItem]

@router.post("/analyze")
async def analyze_schema_endpoint(
    payload: SchemaAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    POST route returning suggestions for custom headers.
    """
    try:
        suggestions = await schema_mapper_service.analyze_incoming_schema(
            workspace_id=workspace_id,
            uploaded_columns=payload.uploaded_columns,
            target_columns=payload.target_columns,
            db=db
        )
        return {"status": "success", "suggestions": suggestions}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze uploaded column schemas: {str(e)}"
        )

@router.post("/confirm")
async def confirm_schema_endpoint(
    payload: SchemaConfirmRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    POST route saving confirmed mappings to the self-learning database cache.
    """
    try:
        raw_list = [item.model_dump() for item in payload.mappings]
        await schema_mapper_service.confirm_mappings(
            workspace_id=workspace_id,
            mappings_list=raw_list,
            db=db
        )
        return {"status": "success", "message": "Mappings saved successfully to database."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm schema mapping matrices: {str(e)}"
        )
