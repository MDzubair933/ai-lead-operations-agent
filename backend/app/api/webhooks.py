from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.lead import Lead
from app.models.workflow_run import WorkflowRun
from app.models.outreach_draft import OutreachDraft
from app.schemas.lead import QualificationCallbackPayload
from app.core.security import verify_webhook_signature
from app.core.errors import UnauthorizedError, NotFoundError, ValidationError
from app.core.logging import logger

router = APIRouter(prefix="/webhooks/n8n", tags=["n8n Webhook Callbacks"])


def utc_now():
    return datetime.now(timezone.utc)


@router.post("/qualification-callback")
async def qualification_callback(
    request: Request,
    payload: QualificationCallbackPayload,
    db: AsyncSession = Depends(get_db),
    x_webhook_signature: str = Header(None, alias="X-Webhook-Signature"),
):
    """
    Receives verified qualification outcomes from n8n qualification workflow.
    Requires HMAC signature matching shared secret.
    """
    body_bytes = await request.body()

    # Validate HMAC signature (allow dev override if configured)
    if not verify_webhook_signature(body_bytes, x_webhook_signature):
        # In dev mode, we log a warning if signature is absent or invalid, but allow dev testing
        from app.config import settings
        if settings.APP_ENV != "development":
            logger.warning(
                f"Unauthorized callback attempt from {request.client.host if request.client else 'unknown'}",
                extra={"correlation_id": payload.correlation_id}
            )
            raise UnauthorizedError("Invalid or missing HMAC signature header.")

    # Locate Lead
    lead_stmt = select(Lead).where(Lead.id == payload.lead_id)
    lead = (await db.execute(lead_stmt)).scalar_one_or_none()
    if not lead:
        raise NotFoundError(f"Lead '{payload.lead_id}' referenced in callback was not found.")

    # Locate WorkflowRun
    run_stmt = select(WorkflowRun).where(WorkflowRun.correlation_id == payload.correlation_id)
    run = (await db.execute(run_stmt)).scalar_one_or_none()

    if payload.status == "success" and payload.qualification:
        qual = payload.qualification

        lead.qualification_score = qual.score
        lead.qualification_category = qual.qualification
        lead.qualification_reason = qual.reason
        lead.evidence = qual.evidence
        lead.missing_information = qual.missing_information
        lead.recommended_action = qual.recommended_next_action

        # If outreach draft is produced, transition lead to review_ready
        if qual.outreach_draft and qual.outreach_draft.strip():
            lead.lead_status = "review_ready"
            # Persist outreach draft
            draft = OutreachDraft(
                lead_id=lead.id,
                channel="email",
                draft_content=qual.outreach_draft.strip(),
                version=1,
                approval_status="pending_approval",
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            db.add(draft)
        else:
            lead.lead_status = "qualified" if qual.qualification in ["high", "medium"] else "disqualified"

        if run:
            run.status = "completed"
            run.completed_at = utc_now()

    else:
        # Failure reporting
        lead.lead_status = "new"  # Revert to intake state so it can be retried
        if run:
            run.status = "failed"
            run.safe_error_code = payload.error_code or "AI_QUALIFICATION_FAILED"
            run.safe_error_summary = payload.error_summary or "The model failed schema validation or encountered an upstream timeout."
            run.completed_at = utc_now()

    lead.updated_at = utc_now()
    await db.commit()

    logger.info(
        f"Processed n8n qualification callback for lead {lead.id} ({payload.status})",
        extra={"correlation_id": payload.correlation_id}
    )

    return {
        "status": "acknowledged",
        "lead_id": lead.id,
        "correlation_id": payload.correlation_id,
    }
