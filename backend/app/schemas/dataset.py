from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class DatasetBase(BaseModel):
    filename: str
    content_type: str
    file_size: int

class DatasetCreate(DatasetBase):
    storage_path: str
    workspace_id: int
    uploaded_by_id: Optional[int] = None

class DatasetRead(DatasetBase):
    id: int
    uuid: str
    storage_path: str
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    health_score: Optional[float] = None
    health_report: Optional[Dict[str, Any]] = None
    workspace_id: int
    uploaded_by_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DatasetHealResponse(BaseModel):
    dataset_uuid: str
    original_health_score: float
    new_health_score: float
    changes_made: Dict[str, Any]
    healed_filename: str

class NLPQueryRequest(BaseModel):
    question: str

class NLPFilter(BaseModel):
    column: str
    operator: str
    value: Any

class NLPQueryResponse(BaseModel):
    target_column: Optional[str] = None
    aggregation: str
    filters: list[NLPFilter]
    status: Optional[str] = None
    calculated_value: Optional[Any] = None
    matched_rows_count: Optional[int] = None
    error_message: Optional[str] = None

class AISummaryResponse(BaseModel):
    summary: str

class AnomalyExplanationRead(BaseModel):
    id: int
    workspace_id: int
    upload_id: str
    column_name: str
    explanation_text: str
    chart_data: Optional[Any] = None

    model_config = ConfigDict(from_attributes=True)
