from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.models.widget import Widget
from app.schemas.widget import WidgetRead, WidgetCreate, WidgetUpdate

router = APIRouter()

@router.get("/", response_model=List[WidgetRead])
async def list_widgets(
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all widgets belonging to the active tenant workspace."""
    result = await db.execute(
        select(Widget).where(Widget.workspace_id == workspace_id)
    )
    return result.scalars().all()

@router.post("/", response_model=WidgetRead, status_code=status.HTTP_201_CREATED)
async def create_widget(
    payload: WidgetCreate,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new widget in the active tenant workspace context."""
    db_widget = Widget(
        title=payload.title,
        type=payload.type,
        xAxisColumn=payload.xAxisColumn,
        yAxisColumn=payload.yAxisColumn,
        xAxisKey=payload.xAxisKey,
        yAxisKey=payload.yAxisKey,
        showLabels=payload.showLabels,
        showGrid=payload.showGrid,
        smooth=payload.smooth,
        colorPalette=payload.colorPalette,
        workspace_id=workspace_id
    )
    db.add(db_widget)
    await db.commit()
    await db.refresh(db_widget)
    return db_widget

@router.get("/{widget_uuid}", response_model=WidgetRead)
async def get_widget(
    widget_uuid: str,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Gets details of a specific widget scoped to active tenant workspace."""
    result = await db.execute(
        select(Widget).where(
            Widget.uuid == widget_uuid,
            Widget.workspace_id == workspace_id
        )
    )
    widget = result.scalars().first()
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found or unauthorized access."
        )
    return widget

@router.put("/{widget_uuid}", response_model=WidgetRead)
async def update_widget(
    widget_uuid: str,
    payload: WidgetUpdate,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Updates an existing widget scoped to active tenant workspace."""
    result = await db.execute(
        select(Widget).where(
            Widget.uuid == widget_uuid,
            Widget.workspace_id == workspace_id
        )
    )
    widget = result.scalars().first()
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found or unauthorized access."
        )
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(widget, key, value)
        
    db.add(widget)
    await db.commit()
    await db.refresh(widget)
    return widget

@router.delete("/{widget_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_widget(
    widget_uuid: str,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a widget scoped to active tenant workspace."""
    result = await db.execute(
        select(Widget).where(
            Widget.uuid == widget_uuid,
            Widget.workspace_id == workspace_id
        )
    )
    widget = result.scalars().first()
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found or unauthorized access."
        )
        
    await db.delete(widget)
    await db.commit()
    return
