from sqlalchemy import String, Integer, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class AnomalyExplanation(Base):
    __tablename__ = "anomaly_explanations"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    upload_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    column_name: Mapped[str] = mapped_column(String(255), nullable=False)
    explanation_text: Mapped[str] = mapped_column(Text, nullable=False)
    chart_data: Mapped[dict] = mapped_column(JSON, nullable=True)
