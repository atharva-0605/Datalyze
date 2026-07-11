from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.user import UserRole

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str
    role: Optional[str] = UserRole.ANALYST.value
    workspace_name: Optional[str] = None
    workspace_id: Optional[int] = None

class UserRead(UserBase):
    id: int
    role: str
    is_active: bool
    workspace_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
