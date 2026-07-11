import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Datalyze AI"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "datalyze_ai_super_secret_jwt_sign_key_do_not_use_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./datalyze.db"
    
    # Storage
    STORAGE_DIR: str = "./storage"
    
    # Groq Cloud
    GROQ_API_KEY: str = "PASTE_YOUR_GROQ_KEY_HERE"

    # SMTP Configuration
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "digest@datalyze.ai"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure local storage directory exists
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
