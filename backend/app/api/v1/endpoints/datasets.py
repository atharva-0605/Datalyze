import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.models.dataset import Dataset
from app.models.template import Template
from app.schemas.dataset import DatasetRead, DatasetHealResponse, NLPQueryRequest, NLPQueryResponse, AISummaryResponse, AnomalyExplanationRead
from app.services.ingestion import ingestion_service
from app.services.doctor import doctor_service
from app.services.nlp_engine import nlp_analysis_engine
from app.services.nlp_querying import nlp_querying_service

router = APIRouter()

@router.post("/upload", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    drop_duplicates: bool = False,
    fill_missing: bool = False,
    mappings: Optional[str] = Form(None),
    template_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Streams file from client, runs profiling via Data Doctor, and registers metadata in DB."""
    # 1. Stream file to local object storage simulation directory
    ingested = await ingestion_service.save_uploaded_file(file, workspace_id)
    
    # Apply column mappings if provided
    if mappings:
        try:
            import json
            mapping_dict = json.loads(mappings)
            if mapping_dict:
                df = doctor_service.load_dataframe(ingested["storage_path"])
                rename_map = {k: v for k, v in mapping_dict.items() if k in df.columns}
                if rename_map:
                    df = df.rename(columns=rename_map)
                    if ingested["storage_path"].endswith(('.xlsx', '.xls')):
                        df.to_excel(ingested["storage_path"], index=False)
                    else:
                        df.to_csv(ingested["storage_path"], index=False)
        except Exception as map_err:
            import logging
            logging.getLogger("app.api.v1.datasets").error(f"Error applying custom column mappings: {map_err}")

    # 2. Clean dataset conditionally and run Data Doctor Profile to extract health data and statistics
    try:
        doctor_service.clean_dataset(ingested["storage_path"], drop_duplicates, fill_missing)
        profile = doctor_service.profile_dataset(ingested["storage_path"])
    except Exception as e:
        # Prevent ingestion failure due to profiling quirks, register basic layout
        profile = {
            "health_score": 0.0,
            "summary": {
                "total_rows": 0, 
                "total_columns": 0, 
                "total_cells": 0, 
                "missing_cells": 0, 
                "missing_percentage": 0.0, 
                "duplicate_rows": 0, 
                "duplicate_percentage": 0.0
            },
            "columns": {},
            "suggested_actions": [f"Profiling failed: {str(e)}"]
        }

    # 3. Create Dataset metadata entry linked to workspace
    db_dataset = Dataset(
        filename=ingested["filename"],
        storage_path=ingested["storage_path"],
        file_size=ingested["file_size"],
        content_type=ingested["content_type"],
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

    # 4. Trigger statistical drift evaluation
    try:
        from app.services.drift_monitor import drift_monitor_service
        df_drift = doctor_service.load_dataframe(db_dataset.storage_path)
        await drift_monitor_service.evaluate_dataset_drift(
            workspace_id=workspace_id,
            upload_id=db_dataset.uuid,
            df=df_drift,
            db=db
        )
    except Exception as drift_err:
        import logging
        logging.getLogger("app.api.v1.datasets").error(f"Error evaluating dataset drift during upload: {drift_err}")

    # 5. Trigger Slack alert background task if health score < 70
    if profile["health_score"] < 70.0:
        try:
            import asyncio
            from app.api.v1.endpoints.integrations import trigger_slack_health_alert
            asyncio.create_task(trigger_slack_health_alert(
                workspace_id=workspace_id,
                filename=db_dataset.filename,
                health_score=profile["health_score"]
            ))
        except Exception as slack_err:
            import logging
            logging.getLogger("app.api.v1.datasets").error(f"Error launching Slack background alert task: {slack_err}")

    return db_dataset

@router.get("/", response_model=List[DatasetRead])
async def list_datasets(
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all registered datasets within user's workspace context."""
    result = await db.execute(
        select(Dataset).where(Dataset.workspace_id == workspace_id)
    )
    return result.scalars().all()

@router.get("/{dataset_uuid}", response_model=DatasetRead)
async def get_dataset(
    dataset_uuid: str,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Gets metadata and full profiling diagnostics report of a specific dataset."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == dataset_uuid,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Dataset not found in this workspace context."
        )
    return dataset

@router.post("/{dataset_uuid}/heal", response_model=DatasetHealResponse)
async def heal_dataset(
    dataset_uuid: str,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Runs automated healing (deduplication, missing value imputation, type coercion)."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == dataset_uuid,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Dataset not found."
        )
        
    try:
        healed_path, changes, new_profile = doctor_service.heal_dataset(dataset.storage_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to auto-heal dataset: {str(e)}"
        )
        
    # Write healed copy metadata to DB
    healed_filename = f"healed_{dataset.filename}"
    healed_dataset = Dataset(
        filename=healed_filename,
        storage_path=healed_path,
        file_size=0,
        content_type=dataset.content_type,
        row_count=new_profile["summary"].get("total_rows"),
        column_count=new_profile["summary"].get("total_columns"),
        health_score=new_profile["health_score"],
        health_report=new_profile,
        workspace_id=workspace_id,
        uploaded_by_id=current_user.id
    )
    
    if os.path.exists(healed_path):
        healed_dataset.file_size = os.path.getsize(healed_path)
        
    db.add(healed_dataset)
    await db.commit()
    await db.refresh(healed_dataset)
    
    return DatasetHealResponse(
        dataset_uuid=healed_dataset.uuid,
        original_health_score=dataset.health_score,
        new_health_score=healed_dataset.health_score,
        changes_made=changes,
        healed_filename=healed_filename
    )

@router.get("/{dataset_uuid}/ai-summary", response_model=AISummaryResponse)
async def get_dataset_ai_summary(
    dataset_uuid: str,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Generates an executive prose summary of the dataset diagnostics using Ollama."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == dataset_uuid,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found in this workspace context."
        )
        
    if not dataset.health_report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset profile is missing. Please run diagnostics first."
        )
        
    summary_prose = await doctor_service.generate_health_summary(dataset.health_report)
    return {"summary": summary_prose}

@router.post("/{dataset_uuid}/nlp-query", response_model=NLPQueryResponse)
async def query_dataset_nlp(
    dataset_uuid: str,
    payload: NLPQueryRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Translates user plain-English questions into structured query intents using local Ollama LLM."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == dataset_uuid,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found in this workspace context."
        )
        
    if not dataset.health_report or "columns" not in dataset.health_report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset columns metadata is missing. Cannot translate query."
        )
        
    try:
        df = doctor_service.load_dataframe(dataset.storage_path)
        nlp_response = await nlp_querying_service.process_chat_query(
            user_question=payload.question,
            df=df,
            dataset_metadata=dataset.health_report
        )
        return nlp_response
    except Exception as e:
        return {
            "target_column": None,
            "aggregation": "NONE",
            "filters": [],
            "status": "error",
            "calculated_value": None,
            "matched_rows_count": 0,
            "error_message": f"NLP query execution failed: {str(e)}"
        }

@router.get("/{dataset_uuid}/records", response_model=List[Dict[str, Any]])
async def get_dataset_records(
    dataset_uuid: str,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves top 100 rows from the dataset file in storage."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == dataset_uuid,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found in this workspace context."
        )
        
    if not os.path.exists(dataset.storage_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset storage file not found."
        )
        
    try:
        df = doctor_service.load_dataframe(dataset.storage_path)
        import pandas as pd
        import numpy as np
        # Convert NaN/NaT to None for standard JSON serialization
        df_clean = df.replace({np.nan: None, pd.NA: None, pd.NaT: None})
        records = df_clean.head(100).to_dict(orient="records")
        return records
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load records from dataset file: {str(e)}"
        )

@router.get("/{dataset_id}/download-healed")
async def download_healed_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Fetches the dataset entry from SQLite database and streams the cleaned document back to the client."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == dataset_id,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or unauthorized access."
        )

    if not os.path.exists(dataset.storage_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cleaned dataset file not found in storage."
        )

    return FileResponse(
        path=dataset.storage_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"healed_{dataset.filename}",
        headers={"Content-Disposition": f"attachment; filename=healed_{dataset.filename}"}
    )

@router.get("/{dataset_uuid}/anomaly-explanations", response_model=AnomalyExplanationRead)
async def get_anomaly_explanation(
    dataset_uuid: str,
    column_name: str,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves statistical correlation explanation and category frequency mappings
    for anomalies flagged in a given dataset column, enforcing workspace separation bounds.
    """
    # 1. Fetch dataset, validating workspace ownership
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == dataset_uuid,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or access unauthorized."
        )

    # 2. Check if the explanation already exists in database
    from app.models.anomaly import AnomalyExplanation
    from app.services.root_cause_engine import root_cause_engine_service
    stmt = select(AnomalyExplanation).where(
        AnomalyExplanation.workspace_id == workspace_id,
        AnomalyExplanation.upload_id == dataset_uuid,
        AnomalyExplanation.column_name == column_name
    )
    res = await db.execute(stmt)
    explanation = res.scalars().first()
    if explanation:
        return explanation

    # 3. If missing, load the original dataset to calculate correlation clusters
    try:
        df = doctor_service.load_dataframe(dataset.storage_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load dataset: {str(e)}"
        )

    # 4. Trigger the Root-Cause Detective Engine
    try:
        explanation = await root_cause_engine_service.analyze_anomaly_root_cause(
            df=df,
            workspace_id=workspace_id,
            upload_id=dataset_uuid,
            column_name=column_name,
            db=db
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process root-cause analysis: {str(e)}"
        )

    return explanation
