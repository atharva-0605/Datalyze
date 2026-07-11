from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class AnalystChatSession(Base):
    __tablename__ = "analyst_chat_sessions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False) # "user" or "assistant"
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    chart_hint: Mapped[str] = mapped_column(String(50), nullable=True) # "bar", "line", "pie", "none"
    chart_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
