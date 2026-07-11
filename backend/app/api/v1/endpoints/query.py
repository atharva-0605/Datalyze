from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.services.chat_copilot import chat_copilot_service

router = APIRouter()

class ChatQueryRequest(BaseModel):
    session_id: str
    message: str

class ChatQueryResponse(BaseModel):
    answer_text: str
    data: List[Dict[str, Any]]
    chart_hint: str # "bar", "line", "pie", "none"

@router.post("/chat", response_model=ChatQueryResponse)
async def chat_with_analyst_copilot(
    payload: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    POST route representing the Conversational Analyst Copilot.
    Enforces strict tenant isolation matching workspace_id.
    """
    try:
        response = await chat_copilot_service.process_query(
            session_id=payload.session_id,
            workspace_id=workspace_id,
            user_message=payload.message,
            db=db
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate copilot analysis response: {str(e)}"
        )
