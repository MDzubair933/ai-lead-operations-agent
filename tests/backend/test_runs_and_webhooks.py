import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lead import Lead
from app.models.workflow_run import WorkflowRun
from app.models.outreach_draft import OutreachDraft


@pytest.mark.asyncio
async def test_n8n_qualification_callback_success(client: AsyncClient, test_db: AsyncSession):
    """Test processing valid AI qualification callback from n8n."""
    lead = Lead(
        id="lead-cb-01",
        source="website",
        company_name="Callback Labs",
        contact_name="Dr. Aris",
        email="aris@cblabs.org",
        lead_status="qualifying",
        idempotency_key="key-cb-01",
    )
    run = WorkflowRun(
        id="run-cb-01",
        lead_id=lead.id,
        status="running",
        correlation_id="corr-cb-01",
    )
    test_db.add(lead)
    test_db.add(run)
    await test_db.commit()

    callback_payload = {
        "correlation_id": "corr-cb-01",
        "lead_id": lead.id,
        "status": "success",
        "qualification": {
            "qualification": "high",
            "score": 90,
            "reason": "Strong technical alignment and enterprise size.",
            "evidence": ["Verified custom domain", "Explicit infrastructure scale requirement"],
            "missing_information": ["Target timeline"],
            "recommended_next_action": "review",
            "outreach_draft": "Hi Dr. Aris, noted your team's workflow automation interest..."
        }
    }

    res = await client.post("/api/webhooks/n8n/qualification-callback", json=callback_payload)
    assert res.status_code == 200
    assert res.json()["status"] == "acknowledged"

    # Verify database state updates
    await test_db.refresh(lead)
    await test_db.refresh(run)
    assert lead.lead_status == "review_ready"
    assert lead.qualification_score == 90
    assert lead.qualification_category == "high"
    assert run.status == "completed"


@pytest.mark.asyncio
async def test_n8n_qualification_callback_failure_reporting(client: AsyncClient, test_db: AsyncSession):
    """Test 5 & 6: Upstream failure / timeout reporting in callback."""
    lead = Lead(
        id="lead-fail-01",
        source="website",
        company_name="Failover Corp",
        contact_name="Ted Failover",
        email="ted@failover.io",
        lead_status="qualifying",
        idempotency_key="key-fail-01",
    )
    run = WorkflowRun(
        id="run-fail-01",
        lead_id=lead.id,
        status="running",
        correlation_id="corr-fail-01",
    )
    test_db.add(lead)
    test_db.add(run)
    await test_db.commit()

    callback_payload = {
        "correlation_id": "corr-fail-01",
        "lead_id": lead.id,
        "status": "failure",
        "error_code": "LLM_PROVIDER_TIMEOUT",
        "error_summary": "Upstream model provider exceeded 30s deadline."
    }

    res = await client.post("/api/webhooks/n8n/qualification-callback", json=callback_payload)
    assert res.status_code == 200

    await test_db.refresh(lead)
    await test_db.refresh(run)
    assert run.status == "failed"
    assert run.safe_error_code == "LLM_PROVIDER_TIMEOUT"
    assert "exceeded 30s deadline" in run.safe_error_summary


@pytest.mark.asyncio
async def test_safe_retry_of_failed_run(client: AsyncClient, test_db: AsyncSession):
    """Test 12: Safe manual retry of an execution run that failed."""
    lead = Lead(
        id="lead-retry-01",
        source="website",
        company_name="Retryable Solutions",
        contact_name="Sam Retry",
        email="sam@retryable.com",
        lead_status="new",
        idempotency_key="key-retry-01",
    )
    run = WorkflowRun(
        id="run-retry-01",
        lead_id=lead.id,
        status="failed",
        safe_error_code="TIMEOUT",
        safe_error_summary="Transient timeout",
        correlation_id="corr-retry-01",
    )
    test_db.add(lead)
    test_db.add(run)
    await test_db.commit()

    # Retry endpoint
    retry_res = await client.post(f"/api/runs/{run.id}/retry")
    assert retry_res.status_code == 200
    data = retry_res.json()
    assert data["success"] is True
    assert "new_run_id" in data
    assert "correlation_id" in data


@pytest.mark.asyncio
async def test_retry_limit_exceeded_blocks_uncontrolled_retries(client: AsyncClient, test_db: AsyncSession):
    """Test that uncontrolled retries beyond N8N_MAX_RETRIES are blocked with HTTP 400."""
    lead = Lead(
        id="lead-retry-max",
        source="website",
        company_name="Max Retries Corp",
        contact_name="Max Power",
        email="max@maxcorp.com",
        lead_status="new",
        idempotency_key="key-retry-max",
    )
    run = WorkflowRun(
        id="run-retry-max",
        lead_id=lead.id,
        status="failed",
        attempt_count=3,
        safe_error_code="TIMEOUT",
        correlation_id="corr-retry-max",
    )
    test_db.add(lead)
    test_db.add(run)
    await test_db.commit()

    retry_res = await client.post(f"/api/runs/{run.id}/retry")
    assert retry_res.status_code == 400
    assert retry_res.json()["error"]["code"] == "MAX_RETRIES_EXCEEDED"

