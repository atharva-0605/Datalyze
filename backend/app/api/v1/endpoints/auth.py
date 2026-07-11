from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.api.deps import get_current_user, RoleChecker
from app.models.user import User, UserRole
from app.models.workspace import Workspace
from app.schemas.user import UserCreate, UserRead
from app.schemas.auth import Token

router = APIRouter()

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Registers a new user and provisions/associates them with a workspace."""
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system."
        )

    # Resolve workspace (multi-tenant structure)
    workspace_id = None
    if user_in.workspace_id is not None:
        workspace_result = await db.execute(
            select(Workspace).where(Workspace.id == user_in.workspace_id)
        )
        workspace = workspace_result.scalars().first()
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workspace with ID {user_in.workspace_id} not found."
            )
        workspace_id = workspace.id

    hashed_pw = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_pw,
        role=user_in.role,
        workspace_id=workspace_id,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: AsyncSession = Depends(get_db)
):
    """OAuth2 password login, returns a JWT token."""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user account"
        )
        
    access_token = create_access_token(subject=user.email)
    return Token(access_token=access_token, token_type="bearer")

@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: User = Depends(get_current_user)):
    """Returns profile of currently authenticated user."""
    return current_user

@router.get("/admin-only", response_model=UserRead)
async def test_admin(
    current_user: User = Depends(RoleChecker([UserRole.ADMIN.value]))
):
    """Utility endpoint to test RBAC for Admin role only."""
    return current_user

@router.get("/manager-only", response_model=UserRead)
async def test_manager(
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN.value, UserRole.MANAGER.value])
    )
):
    """Utility endpoint to test RBAC for Admin or Manager roles."""
    return current_user
