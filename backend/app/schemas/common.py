from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str
    correlation_id: str
    details: List[Any] = []


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int


class HealthResponse(BaseModel):
    status: str
    database: str
    n8n: str
    version: str


class ConfigStatusResponse(BaseModel):
    app_env: str
    api_version: str
    database_type: str
    n8n_base_url: str
    n8n_qualification_webhook: str
    external_outreach_enabled: bool
    rate_limit_enabled: bool
    secret_redaction_active: bool
