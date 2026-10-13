from fastapi import APIRouter, Depends
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.models.lead import Lead
from app.models.workflow_run import WorkflowRun
from app.models.outreach_draft import OutreachDraft
from app.schemas.common import HealthResponse, ConfigStatusResponse

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health", response_model=HealthResponse)
async def check_health(db: AsyncSession = Depends(get_db)):
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        database=db_status,
        n8n="configured",
        version="1.0.0",
    )


@router.get("/metrics")
async def get_metrics(db: AsyncSession = Depends(get_db)):
    total_leads = (await db.execute(select(func.count(Lead.id)))).scalar() or 0
    qualified_leads = (
        await db.execute(
            select(func.count(Lead.id)).where(
                Lead.lead_status.in_(["qualified", "review_ready"])
            )
        )
    ).scalar() or 0
    leads_awaiting_review = (
        await db.execute(
            select(func.count(OutreachDraft.id)).where(
                OutreachDraft.approval_status == "pending_approval"
            )
        )
    ).scalar() or 0
    failed_executions = (
        await db.execute(
            select(func.count(WorkflowRun.id)).where(
                WorkflowRun.status == "failed"
            )
        )
    ).scalar() or 0

    avg_score = (
        await db.execute(
            select(func.avg(Lead.qualification_score)).where(
                Lead.qualification_score.isnot(None)
            )
        )
    ).scalar() or 0.0

    return {
        "total_leads": total_leads,
        "qualified_leads": qualified_leads,
        "leads_awaiting_review": leads_awaiting_review,
        "failed_executions": failed_executions,
        "avg_qualification_score": round(float(avg_score), 1),
    }


@router.get("/config/status", response_model=ConfigStatusResponse)
async def get_config_status():
    """Returns non-secret operational configuration status."""
    db_type = "postgresql+asyncpg" if "postgres" in settings.DATABASE_URL else "sqlite+aiosqlite"
    return ConfigStatusResponse(
        app_env=settings.APP_ENV,
        api_version="v1.0.0",
        database_type=db_type,
        n8n_base_url=settings.N8N_BASE_URL,
        n8n_qualification_webhook=settings.N8N_QUALIFICATION_WEBHOOK_PATH,
        external_outreach_enabled=settings.ENABLE_EXTERNAL_OUTREACH,
        rate_limit_enabled=True,
        secret_redaction_active=True,
    )
