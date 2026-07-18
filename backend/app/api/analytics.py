from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.models.dataset import Dataset
from app.services.doctor import doctor_service
from app.services.ml_engine import ml_engine_service
from app.services.insights import ai_insight_narrator
import pandas as pd

router = APIRouter()

class ForecastRequest(BaseModel):
    dataset_uuid: str
    target_column: str
    horizon_days: int = 30
    what_if_growth: float = 0.0

class NarrateRequest(BaseModel):
    columns_metadata: Dict[str, Any]
    chart_data: Optional[List[Dict[str, Any]]] = None

@router.post("/forecast", response_model=Dict[str, Any])
async def get_forecast(
    payload: ForecastRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Receives dataset references and inputs, returns a calculated trend projection array alongside a what-if baseline."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == payload.dataset_uuid,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found in this workspace context."
        )
        
    try:
        df = doctor_service.load_dataframe(dataset.storage_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load dataset: {str(e)}"
        )
        
    if payload.target_column not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target column '{payload.target_column}' not found in dataset."
        )
        
    series = pd.to_numeric(df[payload.target_column], errors='coerce').dropna().tolist()
    if not series:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No valid numerical values in column '{payload.target_column}' for forecasting."
        )
        
    forecast_res = ml_engine_service.forecast_trend(
        historical_data=series,
        horizon_days=payload.horizon_days,
        what_if_growth=payload.what_if_growth
    )
    
    return {
        "projection": forecast_res["projection"],
        "what_if_baseline": forecast_res["what_if_baseline"],
        "slope": forecast_res["slope"],
        "intercept": forecast_res["intercept"]
    }

@router.post("/narrate", response_model=Dict[str, Any])
async def get_narrative(
    payload: NarrateRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Receives active chart metric values, returns a generated text string from our new narrative engine."""
    narrative = await ai_insight_narrator.generate_data_narrative(
        columns_metadata=payload.columns_metadata,
        chart_data=payload.chart_data
    )
    
    # Hook into narrative generation pathway to save directly to the insights table
    try:
        from app.models.insight import Insight
        from datetime import datetime, timezone
        
        # Search for existing insight matching the active workspace_id
        stmt = select(Insight).where(Insight.workspace_id == workspace_id).limit(1)
        res = await db.execute(stmt)
        db_insight = res.scalars().first()
        
        if db_insight:
            db_insight.narrative_text = narrative
            db_insight.source_type = "PREDICTIVE_CANVAS"
            db_insight.created_at = datetime.now(timezone.utc)
        else:
            db_insight = Insight(
                workspace_id=workspace_id,
                upload_id=None,
                narrative_text=narrative,
                source_type="PREDICTIVE_CANVAS"
            )
            db.add(db_insight)
        await db.commit()
    except Exception as save_err:
        import logging
        logging.getLogger("app.api.analytics").error(f"Failed to auto-save generated narrative insight: {save_err}")

    return {"narrative": narrative}

class ClusterRequest(BaseModel):
    dataset_uuid: str
    target_column: str
    k: int = 3

@router.post("/cluster", response_model=Dict[str, Any])
async def get_clusters(
    payload: ClusterRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Groups dataset rows into clusters and returns assignment labels."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == payload.dataset_uuid,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found in this workspace context."
        )
        
    try:
        df = doctor_service.load_dataframe(dataset.storage_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load dataset: {str(e)}"
        )
        
    if payload.target_column not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target column '{payload.target_column}' not found in dataset."
        )
        
    series = pd.to_numeric(df[payload.target_column], errors='coerce').dropna().tolist()
    if not series:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No valid numerical values in column '{payload.target_column}' for clustering."
        )
        
    cluster_res = ml_engine_service.kmeans_clustering(
        data_points=series,
        k=payload.k
    )
    
    return cluster_res

