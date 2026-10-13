from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.outreach_draft import (
    OutreachDraftResponse,
    ApprovalDecisionRequest,
    DraftUpdateRequest,
)
from app.services.approval_service import ApprovalService
from app.core.security import get_current_user_role

router = APIRouter(prefix="/approvals", tags=["Human Approvals"])


@router.get("", response_model=List[OutreachDraftResponse])
async def list_approvals(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    drafts = await ApprovalService.list_drafts(db, status=status)
    res_items = []
    for draft in drafts:
        resp = OutreachDraftResponse.model_validate(draft)
        if draft.lead:
            resp.lead_company_name = draft.lead.company_name
            resp.lead_contact_name = draft.lead.contact_name
            resp.lead_email = draft.lead.email
        res_items.append(resp)
    return res_items


@router.get("/{draft_id}", response_model=OutreachDraftResponse)
async def get_draft(
    draft_id: str,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    draft = await ApprovalService.get_draft(db, draft_id)
    resp = OutreachDraftResponse.model_validate(draft)
    if draft.lead:
        resp.lead_company_name = draft.lead.company_name
        resp.lead_contact_name = draft.lead.contact_name
        resp.lead_email = draft.lead.email
    return resp


@router.post("/{draft_id}/decision", response_model=OutreachDraftResponse)
async def decide_approval(
    draft_id: str,
    payload: ApprovalDecisionRequest,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    draft = await ApprovalService.decide_draft(
        db, draft_id=draft_id, decision=payload.decision, reviewer=payload.reviewer or "Reviewer"
    )
    resp = OutreachDraftResponse.model_validate(draft)
    if draft.lead:
        resp.lead_company_name = draft.lead.company_name
        resp.lead_contact_name = draft.lead.contact_name
        resp.lead_email = draft.lead.email
    return resp


@router.put("/{draft_id}", response_model=OutreachDraftResponse)
async def update_draft_content(
    draft_id: str,
    payload: DraftUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(get_current_user_role),
):
    draft = await ApprovalService.update_draft_content(
        db, draft_id=draft_id, new_content=payload.draft_content
    )
    resp = OutreachDraftResponse.model_validate(draft)
    if draft.lead:
        resp.lead_company_name = draft.lead.company_name
        resp.lead_contact_name = draft.lead.contact_name
        resp.lead_email = draft.lead.email
    return resp
