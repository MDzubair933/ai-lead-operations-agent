from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.outreach_draft import OutreachDraft
from app.models.lead import Lead
from app.core.errors import NotFoundError
from app.core.logging import logger


def utc_now():
    return datetime.now(timezone.utc)


class ApprovalService:
    @staticmethod
    async def list_drafts(
        db: AsyncSession,
        status: Optional[str] = None
    ) -> List[OutreachDraft]:
        stmt = (
            select(OutreachDraft)
            .options(selectinload(OutreachDraft.lead))
            .order_by(OutreachDraft.created_at.desc())
        )
        if status and status != "all":
            stmt = stmt.where(OutreachDraft.approval_status == status)

        res = await db.execute(stmt)
        drafts = res.scalars().all()
        return list(drafts)

    @staticmethod
    async def get_draft(db: AsyncSession, draft_id: str) -> OutreachDraft:
        stmt = (
            select(OutreachDraft)
            .options(selectinload(OutreachDraft.lead))
            .where(OutreachDraft.id == draft_id)
        )
        res = await db.execute(stmt)
        draft = res.scalar_one_or_none()
        if not draft:
            raise NotFoundError(f"Outreach draft with id '{draft_id}' not found.")
        return draft

    @staticmethod
    async def decide_draft(
        db: AsyncSession,
        draft_id: str,
        decision: str,
        reviewer: str = "Operations Reviewer"
    ) -> OutreachDraft:
        draft = await ApprovalService.get_draft(db, draft_id)
        draft.approval_status = decision
        if decision == "approved":
            draft.approved_by = reviewer
            draft.approved_at = utc_now()
        else:
            draft.approved_by = None
            draft.approved_at = None

        draft.updated_at = utc_now()
        await db.commit()
        await db.refresh(draft)

        logger.info(
            f"Draft {draft_id} approval state transitioned to {decision} by {reviewer}"
        )
        return draft

    @staticmethod
    async def update_draft_content(
        db: AsyncSession,
        draft_id: str,
        new_content: str
    ) -> OutreachDraft:
        """
        Updates draft content. Per security rules, modifying an approved draft
        invalidates its approval, resets state to PENDING_APPROVAL, and increments version.
        """
        draft = await ApprovalService.get_draft(db, draft_id)
        
        was_approved = draft.approval_status == "approved"
        draft.draft_content = new_content
        draft.version += 1
        draft.approval_status = "pending_approval"
        draft.approved_by = None
        draft.approved_at = None
        draft.updated_at = utc_now()

        await db.commit()
        await db.refresh(draft)

        if was_approved:
            logger.warning(
                f"Draft {draft_id} was previously approved; modifying content invalidated approval and reset to pending_approval."
            )
        return draft
