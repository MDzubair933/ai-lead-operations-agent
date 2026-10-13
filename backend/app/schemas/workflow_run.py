from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class WorkflowRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    lead_id: str
    workflow_type: str
    status: str
    attempt_count: int
    correlation_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    safe_error_code: Optional[str] = None
    safe_error_summary: Optional[str] = None
    lead_company_name: Optional[str] = None


class RunDispatchResponse(BaseModel):
    run_id: str
    correlation_id: str
    status: str
    message: str


class RunRetryResponse(BaseModel):
    success: bool
    new_run_id: str
    correlation_id: str
    message: str
