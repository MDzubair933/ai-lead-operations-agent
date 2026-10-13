from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


ApprovalDecisionType = Literal["approved", "rejected"]


class OutreachDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    lead_id: str
    channel: str
    draft_content: str
    version: int
    approval_status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    lead_company_name: Optional[str] = None
    lead_contact_name: Optional[str] = None
    lead_email: Optional[str] = None


class ApprovalDecisionRequest(BaseModel):
    decision: ApprovalDecisionType
    reviewer: Optional[str] = Field(default="Operations Reviewer")


class DraftUpdateRequest(BaseModel):
    draft_content: str = Field(..., min_length=10, max_length=10000)
