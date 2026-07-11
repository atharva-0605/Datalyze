from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class CanvasComment(Base):
    __tablename__ = "canvas_comments"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    user_email: Mapped[str] = mapped_column(String(255), nullable=False)
    chart_id: Mapped[str] = mapped_column(String(100), nullable=True)
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    x_pos: Mapped[float] = mapped_column(Float, nullable=False)
    y_pos: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
