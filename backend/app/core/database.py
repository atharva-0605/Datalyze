import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

logger = logging.getLogger("app.core.database")

# Setup engine with fallback capability
connect_args = {}
database_url = settings.DATABASE_URL
if database_url.startswith("sqlite://"):
    database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")

if "sqlite" in database_url:
    connect_args = {"check_same_thread": False}

try:
    engine = create_async_engine(
        database_url,
        connect_args=connect_args,
        pool_pre_ping=True,
        echo=False,
    )
except Exception as e:
    logger.error(f"Error creating DB engine for {database_url}: {e}. Falling back to SQLite.")
    fallback_url = "sqlite+aiosqlite:///./datalyze_fallback.db"
    engine = create_async_engine(
        fallback_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
        echo=False,
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for obtaining an asynchronous database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
