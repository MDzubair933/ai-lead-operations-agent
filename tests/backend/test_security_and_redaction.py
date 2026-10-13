import pytest
from httpx import AsyncClient
from app.core.logging import redact_sensitive_string


def test_secret_redaction_utility():
    """Test 14: Verifies that sensitive tokens, passwords, and secrets are scrubbed from logs."""
    sample_raw_log = (
        "Connecting with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID and "
        "api_key='sk-ant-api03-secret123456789' and postgresql://admin:SuperSecretPassword123@localhost:5432/db"
    )

    redacted = redact_sensitive_string(sample_raw_log)

    assert "SuperSecretPassword123" not in redacted
    assert "sk-ant-api03-secret123456789" not in redacted
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in redacted
    assert "[REDACTED]" in redacted
    assert "[REDACTED_TOKEN]" in redacted
    assert "[REDACTED_PASSWORD]" in redacted


@pytest.mark.asyncio
async def test_safe_error_envelope_format(client: AsyncClient):
    """Test 7 & 8: Verifies consistent safe error envelope without raw exceptions."""
    res = await client.get("/api/leads/non-existent-id")
    assert res.status_code == 404
    data = res.json()

    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    assert "correlation_id" in data["error"]
    # Check that raw python traceback is not present
    assert "Traceback (most recent call last)" not in str(data)


@pytest.mark.asyncio
async def test_health_check_endpoint(client: AsyncClient):
    """Test health and readiness endpoints."""
    res = await client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "database" in data
    assert "version" in data
