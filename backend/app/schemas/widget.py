from typing import Optional
from pydantic import BaseModel, ConfigDict

class WidgetBase(BaseModel):
    title: str
    type: str
    xAxisColumn: Optional[str] = None
    yAxisColumn: Optional[str] = None
    xAxisKey: Optional[str] = None
    yAxisKey: Optional[str] = None
    showLabels: Optional[bool] = True
    showGrid: Optional[bool] = True
    smooth: Optional[bool] = False
    colorPalette: Optional[str] = "blue"

class WidgetCreate(WidgetBase):
    pass

class WidgetUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    xAxisColumn: Optional[str] = None
    yAxisColumn: Optional[str] = None
    xAxisKey: Optional[str] = None
    yAxisKey: Optional[str] = None
    showLabels: Optional[bool] = None
    showGrid: Optional[bool] = None
    smooth: Optional[bool] = None
    colorPalette: Optional[str] = None

class WidgetRead(WidgetBase):
    id: int
    uuid: str
    workspace_id: int

    model_config = ConfigDict(from_attributes=True)
