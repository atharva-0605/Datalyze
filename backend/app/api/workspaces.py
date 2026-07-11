from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.models.workspace import Workspace
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceUpdate(BaseModel):
    name: str

class WorkspaceInvite(BaseModel):
    email: str
    role: str

@router.get("/", response_model=List[Dict[str, Any]])
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all workspaces owned by the current user or where the user is a member."""
    result = await db.execute(
        select(Workspace).where(
            (Workspace.owner_id == current_user.id) |
            (Workspace.id == current_user.workspace_id)
        )
    )
    workspaces = result.scalars().all()
    return [{"id": w.id, "name": w.name} for w in workspaces]

@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new workspace owned by the current user."""
    db_workspace = Workspace(name=payload.name, owner_id=current_user.id)
    db.add(db_workspace)
    await db.commit()
    await db.refresh(db_workspace)
    
    # Associate creator to workspace membership
    current_user.workspace_id = db_workspace.id
    await db.commit()
    
    return {"id": db_workspace.id, "name": db_workspace.name}

@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a workspace owned by the current user and cascades cleanup."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found."
        )
        
    if workspace.owner_id != current_user.id and workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted. You are neither the owner nor a member of this workspace."
        )
    
    await db.delete(workspace)
    await db.commit()
    return

@router.put("/{workspace_id}", response_model=Dict[str, Any])
async def update_workspace(
    workspace_id: int,
    payload: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Updates a workspace name owned by the current user."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found."
        )
        
    if workspace.owner_id != current_user.id and workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted. You are neither the owner nor a member of this workspace."
        )
    
    workspace.name = payload.name
    await db.commit()
    await db.refresh(workspace)
    return {"id": workspace.id, "name": workspace.name}

@router.get("/{workspace_id}/members", response_model=List[Dict[str, Any]])
async def list_workspace_members(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all user members belonging to a workspace owned or accessed by the current user."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found."
        )
        
    if workspace.owner_id != current_user.id and workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace not found or unauthorized to access members."
        )
    
    # Fetch members of the workspace
    members_result = await db.execute(
        select(User).where(User.workspace_id == workspace_id)
    )
    members = members_result.scalars().all()
    return [{"id": u.id, "email": u.email, "role": u.role} for u in members]

@router.post("/{workspace_id}/invites", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def invite_workspace_member(
    workspace_id: int,
    payload: WorkspaceInvite,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Invites a user to a workspace owned by the current user."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found."
        )
        
    if workspace.owner_id != current_user.id and workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted. You are neither the owner nor a member of this workspace."
        )
    
    # Locate user to associate
    user_result = await db.execute(
        select(User).where(User.email == payload.email)
    )
    user_to_invite = user_result.scalars().first()
    if not user_to_invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email not found."
        )
        
    # Associate user
    user_to_invite.workspace_id = workspace_id
    user_to_invite.role = payload.role
    await db.commit()
    
    return {"message": f"Successfully associated {payload.email} to workspace.", "user_id": user_to_invite.id}

@router.delete("/{workspace_id}/members/{user_id}", response_model=Dict[str, Any])
async def revoke_workspace_membership(
    workspace_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revokes a user's membership from a workspace owned by the current user."""
    # Verify ownership of workspace
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found."
        )
    if workspace.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted. You are not the owner of this workspace."
        )
        
    # Locate member to revoke
    member_result = await db.execute(
        select(User).where(User.id == user_id, User.workspace_id == workspace_id)
    )
    member = member_result.scalars().first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User membership not found in this workspace."
        )
        
    # De-associate user
    member.workspace_id = None
    await db.commit()
    return {"message": "Membership revoked successfully."}

