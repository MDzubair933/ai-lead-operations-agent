import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lead import Lead
from app.models.outreach_draft import OutreachDraft


@pytest.mark.asyncio
async def test_approval_and_rejection_lifecycle(client: AsyncClient, test_db: AsyncSession):
    """Test 10: Human approval queue state transitions (approve & reject)."""
    # Create lead and draft in test_db
    lead = Lead(
        id="lead-approval-01",
        source="website",
        company_name="Approval Corp",
        contact_name="Bob Leader",
        email="bob@approval.com",
        idempotency_key="key-approval-01",
    )
    draft = OutreachDraft(
        id="draft-approval-01",
        lead_id=lead.id,
        channel="email",
        draft_content="Hello Bob, would love to connect.",
        version=1,
        approval_status="pending_approval",
    )
    test_db.add(lead)
    test_db.add(draft)
    await test_db.commit()

    # Step 1: List approvals
    list_res = await client.get("/api/approvals")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Step 2: Approve draft
    decide_res = await client.post(
        f"/api/approvals/{draft.id}/decision",
        json={"decision": "approved", "reviewer": "op_specialist_mark"}
    )
    assert decide_res.status_code == 200
    approved_data = decide_res.json()
    assert approved_data["approval_status"] == "approved"
    assert approved_data["approved_by"] == "op_specialist_mark"
    assert approved_data["approved_at"] is not None

    # Step 3: Reject draft
    reject_res = await client.post(
        f"/api/approvals/{draft.id}/decision",
        json={"decision": "rejected", "reviewer": "op_specialist_mark"}
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["approval_status"] == "rejected"


@pytest.mark.asyncio
async def test_editing_approved_draft_invalidates_approval(client: AsyncClient, test_db: AsyncSession):
    """
    Test 11: Security Rule - Modifying an approved outreach draft
    must immediately invalidate its approval and reset state to pending_approval.
    """
    lead = Lead(
        id="lead-edit-01",
        source="website",
        company_name="Security Guard Inc",
        contact_name="Alice Security",
        email="alice@secguard.io",
        idempotency_key="key-edit-01",
    )
    draft = OutreachDraft(
        id="draft-edit-01",
        lead_id=lead.id,
        channel="email",
        draft_content="Original approved message body.",
        version=1,
        approval_status="approved",
        approved_by="prior_reviewer",
    )
    test_db.add(lead)
    test_db.add(draft)
    await test_db.commit()

    # Edit draft content
    edit_res = await client.put(
        f"/api/approvals/{draft.id}",
        json={"draft_content": "Modified message content with critical updates."}
    )
    assert edit_res.status_code == 200
    updated_data = edit_res.json()

    # Verify security invariant: Approval is invalidated!
    assert updated_data["approval_status"] == "pending_approval"
    assert updated_data["version"] == 2
    assert updated_data["approved_by"] is None
    assert updated_data["approved_at"] is None
    assert updated_data["draft_content"] == "Modified message content with critical updates."
