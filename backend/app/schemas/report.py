from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class ReportRequest(BaseModel):
    dataset_uuid: str
    title: Optional[str] = "Datalyze AI - Data Audit & Profiling Report"
    include_doctor_summary: bool = True
    include_ai_insights: bool = False
    custom_notes: Optional[str] = None

class ReportResponse(BaseModel):
    dataset_uuid: str
    generated_at: datetime
    report_name: str
    download_url: str
