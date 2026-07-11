import uuid
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Widget(Base):
    __tablename__ = "widgets"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    uuid: Mapped[str] = mapped_column(
        String(36), 
        default=lambda: str(uuid.uuid4()), 
        unique=True, 
        index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    xAxisColumn: Mapped[str] = mapped_column(String(255), nullable=True)
    yAxisColumn: Mapped[str] = mapped_column(String(255), nullable=True)
    xAxisKey: Mapped[str] = mapped_column(String(255), nullable=True)
    yAxisKey: Mapped[str] = mapped_column(String(255), nullable=True)
    
    showLabels: Mapped[bool] = mapped_column(Boolean, default=True)
    showGrid: Mapped[bool] = mapped_column(Boolean, default=True)
    smooth: Mapped[bool] = mapped_column(Boolean, default=False)
    colorPalette: Mapped[str] = mapped_column(String(50), default="blue")
    
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="widgets")
