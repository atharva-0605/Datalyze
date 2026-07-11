from datetime import datetime
from pydantic import BaseModel, ConfigDict

class WorkspaceBase(BaseModel):
    name: str

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceRead(WorkspaceBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
