from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Integration(Base):
    __tablename__ = "integrations"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    type: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "SLACK", "EMAIL"
    config_json: Mapped[str] = mapped_column(Text, nullable=False) # JSON configuration parameters
    is_active: Mapped[int] = mapped_column(Integer, default=1, nullable=False) # 1 = active, 0 = inactive
