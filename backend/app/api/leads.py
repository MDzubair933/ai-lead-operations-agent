from typing import Optional
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.lead import (
    LeadCreate,
    LeadResponse,
    CsvPreviewResponse,
    BulkLeadImportRequest,
    BulkLeadImportResponse,
    BulkQualifyRequest,
    BulkQualifyResponse,
)
from app.schemas.workflow_run import RunDispatchResponse
from app.schemas.common import PaginatedResponse
from app.services.lead_service import LeadService
from app.services.n8n_client import N8nClient
from app.core.security import get_current_user_role

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.get("", response_model=PaginatedResponse[LeadResponse])
async def list_leads(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    items, total = await LeadService.list_leads(
        db, search=search, status=status, category=category, page=page, page_size=page_size
    )
    return PaginatedResponse(
        items=[LeadResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=LeadResponse, status_code=201)
async def create_lead(
    data: LeadCreate,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    lead = await LeadService.create_lead(db, data)
    return LeadResponse.model_validate(lead)


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    lead = await LeadService.get_lead(db, lead_id)
    return LeadResponse.model_validate(lead)


@router.post("/{lead_id}/qualify", response_model=RunDispatchResponse)
async def qualify_lead(
    lead_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    lead = await LeadService.get_lead(db, lead_id)
    correlation_id = getattr(request.state, "correlation_id", None)
    run = await N8nClient.dispatch_qualification(db, lead, correlation_id)
    return RunDispatchResponse(
        run_id=run.id,
        correlation_id=run.correlation_id,
        status=run.status,
        message="Lead qualification job successfully queued for n8n processing.",
    )


@router.post("/import/preview", response_model=CsvPreviewResponse)
async def preview_csv_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    content_bytes = await file.read()
    try:
        csv_text = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        csv_text = content_bytes.decode("latin-1", errors="replace")

    return await LeadService.parse_and_preview_csv(db, csv_text)


@router.post("/import/commit", response_model=BulkLeadImportResponse)
async def commit_csv_import(
    payload: BulkLeadImportRequest,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    created_leads, errors = await LeadService.bulk_import_leads(db, payload.leads)
    return BulkLeadImportResponse(
        imported_count=len(created_leads),
        failed_count=len(errors),
        leads=[LeadResponse.model_validate(lead) for lead in created_leads],
        errors=errors,
    )


@router.post("/bulk-qualify", response_model=BulkQualifyResponse)
async def bulk_qualify_leads(
    payload: BulkQualifyRequest,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    total_dispatched, failed_count, runs = await LeadService.bulk_qualify_leads(db, payload.lead_ids)
    return BulkQualifyResponse(
        total_dispatched=total_dispatched,
        failed_count=failed_count,
        runs=runs,
    )

