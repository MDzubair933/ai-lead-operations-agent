from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.workflow_run import WorkflowRun
from app.models.lead import Lead
from app.schemas.workflow_run import WorkflowRunResponse, RunRetryResponse
from app.schemas.common import PaginatedResponse
from app.core.errors import NotFoundError, AppException
from app.core.security import get_current_user_role
from app.services.n8n_client import N8nClient
from app.config import settings

router = APIRouter(prefix="/runs", tags=["Workflow Runs"])


@router.get("", response_model=PaginatedResponse[WorkflowRunResponse])
async def list_runs(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    stmt = select(WorkflowRun).options(selectinload(WorkflowRun.lead)).order_by(WorkflowRun.started_at.desc())
    if status and status != "all":
        stmt = stmt.where(WorkflowRun.status == status)

    count_stmt = select(func.count(WorkflowRun.id))
    if status and status != "all":
        count_stmt = count_stmt.where(WorkflowRun.status == status)

    total = (await db.execute(count_stmt)).scalar() or 0
    items = (await db.execute(stmt.offset((page - 1) * page_size).limit(page_size))).scalars().all()

    res_items = []
    for item in items:
        resp = WorkflowRunResponse.model_validate(item)
        if item.lead:
            resp.lead_company_name = item.lead.company_name
        res_items.append(resp)

    return PaginatedResponse(
        items=res_items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{run_id}", response_model=WorkflowRunResponse)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    stmt = select(WorkflowRun).options(selectinload(WorkflowRun.lead)).where(WorkflowRun.id == run_id)
    run = (await db.execute(stmt)).scalar_one_or_none()
    if not run:
        raise NotFoundError(f"Workflow run '{run_id}' not found.")

    resp = WorkflowRunResponse.model_validate(run)
    if run.lead:
        resp.lead_company_name = run.lead.company_name
    return resp


@router.post("/{run_id}/retry", response_model=RunRetryResponse)
async def retry_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    stmt = select(WorkflowRun).options(selectinload(WorkflowRun.lead)).where(WorkflowRun.id == run_id)
    run = (await db.execute(stmt)).scalar_one_or_none()
    if not run:
        raise NotFoundError(f"Workflow run '{run_id}' not found.")

    if run.status != "failed" and run.status != "timed_out":
        raise AppException(
            f"Run '{run_id}' is currently in '{run.status}' state and cannot be retried.",
            code="INVALID_STATE_FOR_RETRY",
            status_code=400,
        )

    if not run.lead:
        raise NotFoundError(f"Associated lead for run '{run_id}' was not found.")

    # Guard 1: Enforce maximum retry threshold
    current_attempt = run.attempt_count or 1
    if current_attempt >= settings.N8N_MAX_RETRIES:
        raise AppException(
            f"Maximum retry limit of {settings.N8N_MAX_RETRIES} attempts reached for run '{run_id}'.",
            code="MAX_RETRIES_EXCEEDED",
            status_code=400,
        )

    # Guard 2: Prevent concurrent retry if lead already has an in-flight qualification run
    active_stmt = select(WorkflowRun).where(
        WorkflowRun.lead_id == run.lead.id,
        WorkflowRun.workflow_type == "qualification",
        WorkflowRun.status.in_(["running", "pending"]),
    )
    active_run = (await db.execute(active_stmt)).scalars().first()
    if active_run:
        raise AppException(
            f"Lead '{run.lead.company_name}' is already being qualified by active run '{active_run.id}'.",
            code="QUALIFICATION_ALREADY_IN_PROGRESS",
            status_code=409,
        )

    # Execute safe retry with incremented attempt_count
    next_attempt = current_attempt + 1
    new_run = await N8nClient.dispatch_qualification(db, run.lead, attempt_count=next_attempt)
    return RunRetryResponse(
        success=True,
        new_run_id=new_run.id,
        correlation_id=new_run.correlation_id,
        message=f"Workflow execution re-dispatched safely to n8n (attempt {next_attempt}/{settings.N8N_MAX_RETRIES}).",
    )

