import pytest
from unittest.mock import patch
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lead import Lead
from app.models.workflow_run import WorkflowRun
from app.models.outreach_draft import OutreachDraft
from app.services.n8n_client import N8nClient
from app.config import settings


@pytest.mark.asyncio
async def test_n8n_scenario_1_valid_lead_sync_success(test_db: AsyncSession):
    """Scenario 1: Valid lead intake returns synchronous successful qualification."""
    lead = Lead(
        id="lead-test-s1",
        source="website",
        company_name="Acme Solutions Ltd",
        contact_name="Sarah Connor",
        email="sarah@acmesolutions.com",
        website="https://acmesolutions.com",
        raw_notes="Looking for automated pipeline orchestration for 50 SDRs.",
        lead_status="new",
        idempotency_key="key-s1",
    )
    test_db.add(lead)
    await test_db.commit()

    mock_response = httpx.Response(
        status_code=200,
        json={
            "status": "success",
            "lead_id": lead.id,
            "correlation_id": "corr-s1",
            "qualification": {
                "qualification": "high",
                "score": 88,
                "reason": "Enterprise prospect with clear multi-seat outbound SDR demand.",
                "evidence": ["Mentioned 50 SDR team", "Verified B2B corporate domain"],
                "missing_information": ["Current CRM stack"],
                "recommended_next_action": "draft",
                "outreach_draft": "Hi Sarah, noticed Acme Solutions is scaling outbound operations..."
            }
        }
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        run = await N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-s1")

    await test_db.refresh(lead)
    await test_db.refresh(run)

    assert run.status == "completed"
    assert lead.lead_status == "review_ready"
    assert lead.qualification_score == 88
    assert lead.qualification_category == "high"

    # Verify draft was created with mandatory human approval pending
    draft_stmt = select(OutreachDraft).where(OutreachDraft.lead_id == lead.id)
    draft = (await test_db.execute(draft_stmt)).scalar_one_or_none()
    assert draft is not None
    assert draft.approval_status == "pending_approval"
    assert "scaling outbound operations" in draft.draft_content


@pytest.mark.asyncio
async def test_n8n_scenario_2_missing_required_fields(test_db: AsyncSession):
    """Scenario 2: Missing required fields rejected with HTTP 422."""
    lead = Lead(
        id="lead-test-s2",
        source="inbound",
        company_name="Incomplete Lead",
        contact_name="John Missing",
        email="user@example.com",
        lead_status="new",
        idempotency_key="key-s2",
    )
    test_db.add(lead)
    await test_db.commit()

    mock_response = httpx.Response(
        status_code=422,
        json={
            "status": "failure",
            "lead_id": lead.id,
            "correlation_id": "corr-s2",
            "error_code": "MISSING_REQUIRED_FIELDS",
            "error_summary": "Missing required intake fields: lead_id, company_name, and email are mandatory."
        }
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        run = await N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-s2")

    await test_db.refresh(run)
    assert run.status == "failed"
    assert run.safe_error_code == "MISSING_REQUIRED_FIELDS"
    assert "Missing required intake fields" in run.safe_error_summary


@pytest.mark.asyncio
async def test_n8n_scenario_3_invalid_payload_email(test_db: AsyncSession):
    """Scenario 3: Invalid email syntax safely rejected with error code."""
    lead = Lead(
        id="lead-test-s3",
        source="inbound",
        company_name="Bad Email Co",
        contact_name="Test User",
        email="not-an-email",
        lead_status="new",
        idempotency_key="key-s3",
    )
    test_db.add(lead)
    await test_db.commit()

    mock_response = httpx.Response(
        status_code=422,
        json={
            "status": "failure",
            "lead_id": lead.id,
            "correlation_id": "corr-s3",
            "error_code": "INVALID_EMAIL_FORMAT",
            "error_summary": "Malformed email address: \"not-an-email\""
        }
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        run = await N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-s3")

    await test_db.refresh(run)
    assert run.status == "failed"
    assert run.safe_error_code == "INVALID_EMAIL_FORMAT"


@pytest.mark.asyncio
async def test_n8n_scenario_4_invalid_ai_output(test_db: AsyncSession):
    """Scenario 4: Upstream LLM returns unparseable output, caught and reported safely."""
    lead = Lead(
        id="lead-test-s4",
        source="inbound",
        company_name="Parsing Edgecase Inc",
        contact_name="Alex Parser",
        email="edge@example.com",
        lead_status="new",
        idempotency_key="key-s4",
    )
    test_db.add(lead)
    await test_db.commit()

    mock_response = httpx.Response(
        status_code=200,
        json={
            "status": "failure",
            "lead_id": lead.id,
            "correlation_id": "corr-s4",
            "error_code": "INVALID_MODEL_OUTPUT",
            "error_summary": "Upstream AI model returned invalid or unparseable JSON."
        }
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        run = await N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-s4")

    await test_db.refresh(run)
    assert run.status == "failed"
    assert run.safe_error_code == "INVALID_MODEL_OUTPUT"


@pytest.mark.asyncio
async def test_n8n_scenario_5_upstream_processing_failure(test_db: AsyncSession):
    """Scenario 5: Upstream AI node execution error / unconfigured credentials."""
    lead = Lead(
        id="lead-test-s5",
        source="inbound",
        company_name="Cred Test Ltd",
        contact_name="Chris Credential",
        email="cred@example.com",
        lead_status="new",
        idempotency_key="key-s5",
    )
    test_db.add(lead)
    await test_db.commit()

    mock_response = httpx.Response(
        status_code=200,
        json={
            "status": "failure",
            "lead_id": lead.id,
            "correlation_id": "corr-s5",
            "error_code": "AI_MODEL_EXECUTION_FAILED",
            "error_summary": "Google Gemini model encountered an error."
        }
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response), patch("asyncio.sleep"):
        run = await N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-s5")

    await test_db.refresh(run)
    assert run.status == "failed"
    assert run.safe_error_code == "AI_MODEL_EXECUTION_FAILED"


@pytest.mark.asyncio
async def test_n8n_gemini_normalized_conversational_response(test_db: AsyncSession):
    """Verify that when n8n normalizes conversational Gemini output, backend stores valid result."""
    lead = Lead(
        id="lead-test-conv",
        source="website",
        company_name="Conversational Data Ltd",
        contact_name="Dr. Taylor",
        email="taylor@convdata.com",
        lead_status="new",
        idempotency_key="key-conv",
    )
    test_db.add(lead)
    await test_db.commit()

    # n8n's Validate Qualification Output normalized the conversational output to this:
    mock_response = httpx.Response(
        status_code=200,
        json={
            "status": "success",
            "lead_id": lead.id,
            "correlation_id": "corr-conv",
            "qualification": {
                "qualification": "high",
                "score": 89,
                "reason": "Strong corporate domain with immediate 50 SDR automation requirement.",
                "evidence": ["Mentioned 50 SDR team", "Corporate website verified"],
                "missing_information": [],
                "recommended_next_action": "draft",
                "outreach_draft": "Hi Dr. Taylor, noticed your team is scaling outbound operations..."
            }
        }
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        run = await N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-conv")

    await test_db.refresh(lead)
    await test_db.refresh(run)

    assert run.status == "completed"
    assert lead.lead_status == "review_ready"
    assert lead.qualification_score == 89
    assert lead.qualification_category == "high"


@pytest.mark.asyncio
async def test_n8n_http_404_diagnostic_handling(test_db: AsyncSession):
    """Explicitly verify HTTP 404 capture and actionable diagnostic messaging."""
    lead = Lead(
        id="lead-test-404",
        source="inbound",
        company_name="Missing Endpoint Co",
        contact_name="Pat Missing",
        email="miss@example.com",
        lead_status="new",
        idempotency_key="key-404",
    )
    test_db.add(lead)
    await test_db.commit()

    mock_response = httpx.Response(
        status_code=404,
        text="The requested webhook \"POST lead-qualification\" is not registered."
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        run = await N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-404")

    await test_db.refresh(run)
    assert run.status == "failed"
    assert run.safe_error_code == "HTTP_404_NOT_FOUND"
    assert "Webhook endpoint not found" in run.safe_error_summary
    assert "AI Lead Qualification & Human Approval v1" in run.safe_error_summary
    assert settings.N8N_BASE_URL in run.safe_error_summary


@pytest.mark.asyncio
async def test_outreach_webhook_contract_remains_untouched():
    """Verify that the existing outreach contract is completely untouched."""
    assert settings.N8N_OUTREACH_WEBHOOK_PATH == "/webhook/dispatch-outreach"
    assert settings.N8N_QUALIFICATION_WEBHOOK_PATH == "/webhook/lead-qualification"
    assert settings.N8N_QUALIFICATION_WEBHOOK_PATH != settings.N8N_OUTREACH_WEBHOOK_PATH


@pytest.mark.asyncio
async def test_duplicate_qualification_prevention(test_db: AsyncSession):
    """Verify that calling dispatch_qualification for a lead already qualifying returns active run without sending duplicate HTTP calls."""
    lead = Lead(
        id="lead-test-dup",
        source="inbound",
        company_name="Duplicate Guard Corp",
        contact_name="Dana Guard",
        email="dana@dupguard.com",
        lead_status="new",
        idempotency_key="key-dup-01",
    )
    test_db.add(lead)
    await test_db.commit()

    # Pre-existing active run
    existing_run = WorkflowRun(
        id="run-active-01",
        lead_id=lead.id,
        workflow_type="qualification",
        status="running",
        attempt_count=1,
        correlation_id="corr-active-01",
    )
    test_db.add(existing_run)
    lead.lead_status = "qualifying"
    await test_db.commit()

    with patch("httpx.AsyncClient.post") as mock_post:
        result_run = await N8nClient.dispatch_qualification(test_db, lead)
        # Verify httpx.AsyncClient.post was NEVER called
        assert mock_post.call_count == 0
        assert result_run.id == "run-active-01"
        assert result_run.status == "running"


@pytest.mark.asyncio
async def test_timeout_handling_resets_lead_status(test_db: AsyncSession):
    """Verify that an upstream timeout (httpx.TimeoutException) sets UPSTREAM_TIMEOUT and resets lead status to 'new'."""
    lead = Lead(
        id="lead-test-timeout",
        source="inbound",
        company_name="Slow Upstream Inc",
        contact_name="Sam Slow",
        email="sam@slowupstream.com",
        lead_status="new",
        idempotency_key="key-timeout-01",
    )
    test_db.add(lead)
    await test_db.commit()

    with patch("httpx.AsyncClient.post", side_effect=httpx.ReadTimeout("Read timed out")), patch("asyncio.sleep"):
        run = await N8nClient.dispatch_qualification(test_db, lead)

    await test_db.refresh(lead)
    await test_db.refresh(run)

    assert run.status == "failed"
    assert run.safe_error_code == "UPSTREAM_TIMEOUT"
    assert "timeout threshold" in run.safe_error_summary
    assert lead.lead_status == "new"  # Verified lead not stuck in qualifying!


@pytest.mark.asyncio
async def test_http_500_resets_lead_status(test_db: AsyncSession):
    """Verify that an upstream HTTP 500 sets safe error code and resets lead status to 'new'."""
    lead = Lead(
        id="lead-test-500",
        source="inbound",
        company_name="Failing Workflow Co",
        contact_name="Frank Fail",
        email="frank@failingco.com",
        lead_status="new",
        idempotency_key="key-500-01",
    )
    test_db.add(lead)
    await test_db.commit()

    mock_response = httpx.Response(
        status_code=500,
        json={"message": "Error in workflow"}
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response), patch("asyncio.sleep"):
        run = await N8nClient.dispatch_qualification(test_db, lead)

    await test_db.refresh(lead)
    await test_db.refresh(run)

    assert run.status == "failed"
    assert run.safe_error_code == "HTTP_500"
    assert lead.lead_status == "new"  # Verified lead not stuck in qualifying!


@pytest.mark.asyncio
async def test_transient_gemini_503_recovers_on_bounded_retry(test_db: AsyncSession):
    """Verify that a transient Gemini 503 / model error on attempt 1 recovers safely on attempt 2."""
    lead = Lead(
        id="lead-test-transient-503",
        source="inbound",
        company_name="Retry Success Inc",
        contact_name="Alex Retry",
        email="alex@retrysuccess.com",
        lead_status="new",
        idempotency_key="key-transient-01",
    )
    test_db.add(lead)
    await test_db.commit()

    # Attempt 1: Gemini 503 / high demand failure
    fail_response = httpx.Response(
        status_code=200,
        json={
            "status": "failure",
            "lead_id": lead.id,
            "correlation_id": "corr-transient-01",
            "error_code": "AI_MODEL_EXECUTION_FAILED",
            "error_summary": "Google Gemini model encountered an error."
        }
    )

    # Attempt 2: Successful structured response
    success_response = httpx.Response(
        status_code=200,
        json={
            "status": "success",
            "lead_id": lead.id,
            "correlation_id": "corr-transient-01",
            "qualification": {
                "qualification": "high",
                "score": 92,
                "reason": "Enterprise lead requiring operations orchestration.",
                "evidence": ["B2B enterprise domain"],
                "missing_information": [],
                "recommended_next_action": "draft",
                "outreach_draft": "Hi Alex, glad to connect regarding operations orchestration..."
            }
        }
    )

    with patch("httpx.AsyncClient.post", side_effect=[fail_response, success_response]) as mock_post, \
         patch("asyncio.sleep") as mock_sleep:
        run = await N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-transient-01")

    await test_db.refresh(lead)
    await test_db.refresh(run)

    # Verified: exactly 2 attempts dispatched
    assert mock_post.call_count == 2
    assert mock_sleep.call_count == 1
    # Verified: single WorkflowRun completed on attempt 2 without creating failed duplicate records
    assert run.status == "completed"
    assert run.attempt_count == 2
    assert run.correlation_id == "corr-transient-01"
    assert lead.lead_status == "review_ready"
    assert lead.qualification_score == 92


@pytest.mark.asyncio
async def test_retry_after_header_respected(test_db: AsyncSession):
    """Verify that when n8n/Gemini responds with 429 and Retry-After, delay respects the header."""
    from app.services.n8n_client import calculate_backoff_delay
    res_with_header = httpx.Response(
        status_code=429,
        headers={"retry-after": "5"},
        json={"error_code": "RATE_LIMIT_EXCEEDED"}
    )
    delay = calculate_backoff_delay(attempt=1, response=res_with_header)
    assert 5.0 <= delay <= 5.6  # 5s + jitter (0.1 - 0.5)


@pytest.mark.asyncio
async def test_maximum_2_attempts_on_exhausted_retries(test_db: AsyncSession):
    """Verify that transient failures execute at most 2 model attempts (1 initial + 1 retry)."""
    lead = Lead(
        id="lead-test-max-2",
        source="inbound",
        company_name="Max Two Attempts Co",
        contact_name="Pat Max",
        email="pat@maxtwo.com",
        lead_status="new",
        idempotency_key="key-max-02",
    )
    test_db.add(lead)
    await test_db.commit()

    fail_503 = httpx.Response(
        status_code=200,
        json={
            "status": "failure",
            "lead_id": lead.id,
            "correlation_id": "corr-max-2",
            "error_code": "AI_MODEL_EXECUTION_FAILED",
            "error_summary": "Google Gemini model encountered an error."
        }
    )

    with patch("httpx.AsyncClient.post", return_value=fail_503) as mock_post, \
         patch("asyncio.sleep") as mock_sleep:
        run = await N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-max-2")

    await test_db.refresh(lead)
    await test_db.refresh(run)

    # Exactly 2 total attempts made (1 initial + 1 retry)
    assert mock_post.call_count == 2
    assert mock_sleep.call_count == 1
    assert run.attempt_count == 2
    assert run.status == "failed"
    assert run.safe_error_code == "AI_MODEL_EXECUTION_FAILED"
    # Lead safely restored to retryable 'new' state
    assert lead.lead_status == "new"


@pytest.mark.asyncio
async def test_permanent_errors_never_retried(test_db: AsyncSession):
    """Verify that permanent errors (e.g. 401 Unauthorized, 422 Validation) are never retried."""
    lead = Lead(
        id="lead-test-no-retry-perm",
        source="inbound",
        company_name="No Retry Co",
        contact_name="No Retry",
        email="noretry@example.com",
        lead_status="new",
        idempotency_key="key-perm-01",
    )
    test_db.add(lead)
    await test_db.commit()

    # 401 Unauthorized
    res_401 = httpx.Response(status_code=401, json={"error_code": "UNAUTHORIZED"})

    with patch("httpx.AsyncClient.post", return_value=res_401) as mock_post, \
         patch("asyncio.sleep") as mock_sleep:
        run = await N8nClient.dispatch_qualification(test_db, lead)

    assert mock_post.call_count == 1
    assert mock_sleep.call_count == 0
    assert run.attempt_count == 1
    assert run.status == "failed"
    assert lead.lead_status == "new"


@pytest.mark.asyncio
async def test_concurrent_qualification_deduplication(test_db: AsyncSession):
    """Verify that concurrent qualification calls for the same lead return active run without double execution."""
    import asyncio
    lead = Lead(
        id="lead-test-concurrent",
        source="inbound",
        company_name="Concurrent Race Co",
        contact_name="Casey Race",
        email="casey@concurrentrace.com",
        lead_status="new",
        idempotency_key="key-concurrent-01",
    )
    test_db.add(lead)
    await test_db.commit()

    success_resp = httpx.Response(
        status_code=200,
        json={
            "status": "success",
            "lead_id": lead.id,
            "correlation_id": "corr-conc-1",
            "qualification": {
                "qualification": "high",
                "score": 90,
                "reason": "Enterprise prospect verified.",
                "evidence": ["Domain verified"],
                "missing_information": [],
                "recommended_next_action": "draft",
                "outreach_draft": "Hello Casey..."
            }
        }
    )

    with patch("httpx.AsyncClient.post", return_value=success_resp) as mock_post:
        # Simulate two concurrent dispatch calls
        run1, run2 = await asyncio.gather(
            N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-conc-1"),
            N8nClient.dispatch_qualification(test_db, lead, correlation_id="corr-conc-2"),
        )

    # Only 1 set of HTTP calls executed
    assert mock_post.call_count == 1
    # Both calls returned the same run ID
    assert run1.id == run2.id


