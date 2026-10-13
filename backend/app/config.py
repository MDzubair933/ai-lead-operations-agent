from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Application Environment
    APP_ENV: str = Field(default="development")
    DEBUG: bool = Field(default=False)
    API_HOST: str = Field(default="127.0.0.1")
    API_PORT: int = Field(default=8000)
    CORS_ORIGINS: str = Field(default="http://localhost:5173,http://127.0.0.1:5173")

    # Security & RBAC
    API_SECRET_KEY: str = Field(default="dev-secret-key-replace-in-production-at-least-32-chars")
    AUTH_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)
    WEBHOOK_HMAC_SECRET: str = Field(default="dev-hmac-secret-replace-in-production")

    # Persistence
    # Supports SQLite for local zero-dependency testing, and PostgreSQL in production
    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./lead_ops.db")

    # n8n Automation Engine Settings
    N8N_BASE_URL: str = Field(default="https://n8n.example.com")
    N8N_QUALIFICATION_WEBHOOK_PATH: str = Field(default="/webhook/lead-qualification")
    N8N_OUTREACH_WEBHOOK_PATH: str = Field(default="/webhook/dispatch-outreach")
    N8N_WEBHOOK_TIMEOUT_SECONDS: int = Field(default=45)
    N8N_MAX_RETRIES: int = Field(default=2)
    N8N_RETRY_BASE_DELAY_SECONDS: float = Field(default=2.0)
    N8N_RETRY_MAX_DELAY_SECONDS: float = Field(default=15.0)

    # External Outreach Guard (Strictly False by default in Release 1)
    ENABLE_EXTERNAL_OUTREACH: bool = Field(default=False)

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
