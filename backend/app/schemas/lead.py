from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


QualificationCategoryType = Literal["high", "medium", "low", "insufficient_data"]
LeadStatusType = Literal["new", "qualifying", "qualified", "disqualified", "review_ready", "archived"]
RecommendedActionType = Literal["research", "draft", "review", "skip"]


class LeadCreate(BaseModel):
    source: str = Field(..., min_length=1, max_length=500)
    company_name: str = Field(..., min_length=1, max_length=255)
    contact_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    website: Optional[str] = Field(default=None, max_length=1000)
    raw_notes: Optional[str] = Field(default=None, max_length=5000)


class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    company_name: str
    contact_name: str
    email: str
    website: Optional[str] = None
    normalized_identifiers: Dict[str, Any] = Field(default_factory=dict)
    lead_status: str
    qualification_score: Optional[int] = None
    qualification_category: Optional[str] = None
    qualification_reason: Optional[str] = None
    evidence: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    recommended_action: Optional[str] = None
    raw_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class StructuredQualificationOutput(BaseModel):
    """
    Schema strictly validating LLM and n8n qualification outputs.
    Ensures safe bounded scoring and verified evidence.
    """
    qualification: QualificationCategoryType
    score: int = Field(..., ge=0, le=100)
    reason: str = Field(..., min_length=5)
    evidence: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    recommended_next_action: RecommendedActionType
    outreach_draft: Optional[str] = None


class QualificationCallbackPayload(BaseModel):
    """Payload received from n8n qualification callback webhook."""
    correlation_id: str
    lead_id: str
    status: Literal["success", "failure"]
    qualification: Optional[StructuredQualificationOutput] = None
    error_code: Optional[str] = None
    error_summary: Optional[str] = None


class CsvLeadRowPreview(BaseModel):
    row_number: int
    company_name: str
    contact_name: str
    email: str
    website: Optional[str] = None
    source: str = "csv_import"
    raw_notes: Optional[str] = None
    is_valid: bool = True
    is_duplicate: bool = False
    errors: List[str] = Field(default_factory=list)


class CsvPreviewResponse(BaseModel):
    total_rows: int
    valid_count: int
    duplicate_count: int
    error_count: int
    rows: List[CsvLeadRowPreview]


class BulkLeadItem(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    contact_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    website: Optional[str] = Field(default=None, max_length=1000)
    source: str = Field(default="csv_import", min_length=1, max_length=500)
    raw_notes: Optional[str] = Field(default=None, max_length=5000)


class BulkLeadImportRequest(BaseModel):
    leads: List[BulkLeadItem]


class BulkLeadImportResponse(BaseModel):
    imported_count: int
    failed_count: int
    leads: List[LeadResponse]
    errors: List[str] = Field(default_factory=list)


class BulkQualifyRequest(BaseModel):
    lead_ids: List[str]


class BulkQualifyResponse(BaseModel):
    total_dispatched: int
    failed_count: int
    runs: List[Dict[str, Any]]
