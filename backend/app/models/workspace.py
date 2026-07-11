from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Workspace(Base):
    __tablename__ = "workspaces"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="workspace",
        foreign_keys="[User.workspace_id]"
    )
    datasets: Mapped[list["Dataset"]] = relationship(
        "Dataset",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    widgets: Mapped[list["Widget"]] = relationship(
        "Widget",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
