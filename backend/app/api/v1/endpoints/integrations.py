import os
import json
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.models.integration import Integration

logger = logging.getLogger("app.api.v1.integrations")

router = APIRouter()

# --- Pydantic Schemas ---
class IntegrationRead(BaseModel):
    id: int
    workspace_id: int
    type: str
    config_json: str
    is_active: int

    class Config:
        from_attributes = True

class IntegrationSaveRequest(BaseModel):
    type: str
    config_json: str
    is_active: Optional[int] = 1

class DigestTriggerRequest(BaseModel):
    frequency: str


@router.post("/trigger-digest")
async def trigger_digest(payload: DigestTriggerRequest):
    print("--> [TRIGGER RECEIVED] Inside post/trigger-digest endpoint route handler!")
    
    frequency_type = payload.frequency.lower()
    
    if "daily" in frequency_type:
        subject = "Datalyze AI - Daily Executive Briefing"
        summary_text = "Daily Summary Update:\n- Your near-term data pipeline metrics are fully operational.\n- Automated validation loops completed successfully within the past 24 hours."
    elif "weekly" in frequency_type:
        subject = "Datalyze AI - Weekly Analytics Snapshot"
        summary_text = "Weekly Performance Briefing:\n- Structural database health flags remain stable.\n- Core processing throughput meets team operational standards for this week's data aggregation cycle."
    elif "monthly" in frequency_type:
        subject = "Datalyze AI - Monthly Executive Audit Report"
        summary_text = "Monthly System Audit Summary:\n- Long-term variance checks confirm all model tracking metrics match established bounds.\n- Systems are optimized for the upcoming monthly strategic overview."
    else:
        subject = "Datalyze AI - Executive Insights Digest"
        summary_text = f"Standard Workspace Update:\n- Active processing configuration: {payload.frequency}."
        
    recipient = "64atharvapawar@gmail.com"
    
    msg = MIMEMultipart()
    msg['From'] = settings.SMTP_FROM
    msg['To'] = recipient
    msg['Subject'] = subject
    msg.attach(MIMEText(summary_text, 'plain'))
    
    print(f"--> Attempting live SMTP connection to {settings.SMTP_HOST}:{settings.SMTP_PORT}...")
    
    try:
        # Open live SSL socket pipeline directly
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, int(settings.SMTP_PORT))
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, recipient, msg.as_string())
        server.quit()
        print("--> LIVE EMAIL SENT SUCCESSFULLY TO THE INBOX!")
        return {"status": "success", "message": "Email sent instantly!"}
    except Exception as e:
        print(f"--> CRITICAL SMTP FAILURE TRACE: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"SMTP Mailer Connection failed: {str(e)}"
        )


@router.get("/", response_model=List[IntegrationRead])
async def list_integrations(
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    GET route returning all configuration channels active in the workspace.
    """
    stmt = select(Integration).where(Integration.workspace_id == workspace_id)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/", response_model=IntegrationRead)
async def save_integration(
    payload: IntegrationSaveRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    POST route writing new configurations or updating existing ones.
    """
    stmt = select(Integration).where(
        Integration.workspace_id == workspace_id,
        Integration.type == payload.type.upper()
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()

    config_data = json.loads(payload.config_json)
    saved_config_json = json.dumps(config_data)

    if existing:
        existing.config_json = saved_config_json
        existing.is_active = payload.is_active if payload.is_active is not None else 1
        db_int = existing
    else:
        db_int = Integration(
            workspace_id=workspace_id,
            type=payload.type.upper(),
            config_json=saved_config_json,
            is_active=payload.is_active if payload.is_active is not None else 1
        )
        db.add(db_int)

    await db.commit()
    await db.refresh(db_int)
    return db_int

@router.post("/{integration_id}/toggle", response_model=IntegrationRead)
async def toggle_integration(
    integration_id: int,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    POST route enabling or disabling a specific integration route.
    """
    stmt = select(Integration).where(
        Integration.id == integration_id,
        Integration.workspace_id == workspace_id
    )
    res = await db.execute(stmt)
    integration = res.scalars().first()

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration configuration not found."
        )

    integration.is_active = 0 if integration.is_active == 1 else 1
    await db.commit()
    await db.refresh(integration)
    return integration
