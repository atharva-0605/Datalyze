import os
import json
import logging
import urllib.request
import smtplib
from email.mime.text import MIMEText
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.models.integration import Integration
from app.models.insight import Insight

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

# --- Background Worker Tasks ---

async def trigger_slack_health_alert(workspace_id: int, filename: str, health_score: float):
    """
    Background worker: Posts data quality warnings to Slack if dataset health score falls below 70.
    """
    async with AsyncSessionLocal() as db:
        try:
            stmt = select(Integration).where(
                Integration.workspace_id == workspace_id,
                Integration.type == "SLACK",
                Integration.is_active == 1
            )
            res = await db.execute(stmt)
            integration = res.scalars().first()
            
            if not integration:
                return

            config = json.loads(integration.config_json)
            webhook_url = config.get("webhook_url")
            if not webhook_url:
                return

            # Construct Slack block payload
            payload = {
                "text": f"⚠️ *Datalyze AI Alert: Data Quality Warning!*\n"
                        f"Dataset *{filename}* was ingested in workspace context with a low health profile.\n"
                        f"• *Health Score:* {health_score}/100\n"
                        f"• *Action Required:* Review diagnostics and apply Data Doctor healing rules."
            }
            
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                webhook_url,
                data=data,
                headers={"Content-Type": "application/json"}
            )
            
            # Executing request (using local timeout in case of sandbox offline boundaries)
            with urllib.request.urlopen(req, timeout=5) as response:
                logger.info(f"Slack webhook alert posted. Status: {response.status}")
        except Exception as e:
            logger.error(f"Failed to transmit Slack webhook background warning: {e}")

async def run_email_digest_worker(workspace_id: int, recipient_email: str, frequency: str):
    """
    Background worker: Gathers trailing executive insights and dispatches them via SMTP connection simulation.
    """
    async with AsyncSessionLocal() as db:
        try:
            # 1. Fetch trailing insights
            stmt = select(Insight).where(
                Insight.workspace_id == workspace_id
            ).order_by(Insight.created_at.desc()).limit(5)
            res = await db.execute(stmt)
            insights = res.scalars().all()

            if not insights:
                logger.info("No insights found to generate email digest.")
                return

            # 2. Package text summary
            content_lines = [f"Datalyze AI Analytics Executive Digest - {frequency} Report\n", "="*50, ""]
            for idx, ins in enumerate(insights):
                content_lines.append(f"[{idx+1}] Source: {ins.source_type} | Date: {ins.created_at}")
                content_lines.append(f"Insight: {ins.narrative_text}\n")
            
            content_lines.append("\nThank you,\nYour Datalyze AI Analyst Team")
            email_body = "\n".join(content_lines)

            # 3. Simulate SMTP transmission and write to storage simulation file
            os.makedirs("./storage/emails", exist_ok=True)
            log_path = os.path.abspath(f"./storage/emails/digest_ws_{workspace_id}_{int(datetime.now().timestamp())}.txt")
            with open(log_path, "w") as f:
                f.write(f"To: {recipient_email}\n")
                f.write(f"Subject: Datalyze AI - {frequency} Analytics Digest\n\n")
                f.write(email_body)
            
            logger.info(f"Email digest simulated and written locally to: {log_path}")

            # Try SMTP connection
            try:
                msg = MIMEText(email_body)
                msg["Subject"] = f"Datalyze AI - {frequency} Analytics Digest"
                msg["From"] = settings.SMTP_FROM
                msg["To"] = recipient_email
                
                # Standalone connection hook
                smtp_client = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    smtp_client.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp_client.send_message(msg)
                smtp_client.quit()
                logger.info(f"Email digest successfully dispatched to {recipient_email} via SMTP.")
            except Exception as smtp_err:
                logger.error(f"Real SMTP delivery failed: {smtp_err}. Logged to filesystem: {os.path.basename(log_path)}")

        except Exception as e:
            logger.error(f"Failed to execute background email digest worker: {e}")

# --- REST Routes ---

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
    if payload.type.upper() == "SLACK":
        webhook_url = config_data.get("webhook_url")
        if webhook_url:
            try:
                ping_payload = {"text": "Datalyze AI Slack Integration handshake test. Webhook validated successfully."}
                ping_data = json.dumps(ping_payload).encode("utf-8")
                ping_req = urllib.request.Request(
                    webhook_url,
                    data=ping_data,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(ping_req, timeout=5) as response:
                    if response.status == 200:
                        config_data["connected"] = True
                    else:
                        config_data["connected"] = False
            except Exception as ping_err:
                logger.warning(f"Slack webhook handshake diagnostic ping failed: {ping_err}")
                config_data["connected"] = False

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

@router.post("/trigger-digest")
async def trigger_digest_immediately(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    POST route triggering the background email digest worker immediately for active configuration.
    """
    stmt = select(Integration).where(
        Integration.workspace_id == workspace_id,
        Integration.type == "EMAIL",
        Integration.is_active == 1
    )
    res = await db.execute(stmt)
    integration = res.scalars().first()

    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active EMAIL integration is not configured in this workspace context."
        )

    config = json.loads(integration.config_json)
    recipient = config.get("recipient_email")
    frequency = config.get("frequency", "Weekly")

    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipient email not configured."
        )

    # Dispatch to background task
    background_tasks.add_task(run_email_digest_worker, workspace_id, recipient, frequency)
    return {"status": "success", "message": "Email digest task dispatched to background worker."}
