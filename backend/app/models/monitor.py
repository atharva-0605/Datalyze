from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class DatasetFingerprint(Base):
    __tablename__ = "dataset_fingerprints"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    upload_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    column_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mean_value: Mapped[float] = mapped_column(Float, nullable=True)
    std_dev_value: Mapped[float] = mapped_column(Float, nullable=True)
    cardinality: Mapped[int] = mapped_column(Integer, nullable=False)
    drift_status: Mapped[str] = mapped_column(String(50), nullable=False) # "STABLE", "WARNING", "DRIFTED"
    p_value: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
