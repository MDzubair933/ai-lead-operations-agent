from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings
from app.core.logging import logger

# SQLAlchemy Declarative Base
Base = declarative_base()

# Engine creation with connection pool tuning
engine_args = {
    "echo": settings.DEBUG,
    "future": True,
}

# If SQLite, handle threaded connection settings
if "sqlite" in settings.DATABASE_URL:
    engine_args["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL pooling parameters
    engine_args["pool_size"] = 10
    engine_args["max_overflow"] = 20
    engine_args["pool_pre_ping"] = True

engine = create_async_engine(settings.DATABASE_URL, **engine_args)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)
async_session_factory = AsyncSessionLocal



async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing database sessions per request with automatic rollback on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()


async def init_db() -> None:
    """Initializes tables for local development / testing."""
    logger.info("Initializing database schemas...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schemas verified.")
