from sqlalchemy import String, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Template(Base):
    __tablename__ = "templates"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    sample_csv_path: Mapped[str] = mapped_column(String(500), nullable=False)
    default_config_json: Mapped[str] = mapped_column(Text, nullable=False) # JSON configuration string
