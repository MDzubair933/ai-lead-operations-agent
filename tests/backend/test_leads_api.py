import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_valid_lead_intake(client: AsyncClient):
    """Test 1: Valid lead intake returns 201 with normalized domain and new status."""
    payload = {
        "source": "website_inbound",
        "company_name": "Apex Enterprise",
        "contact_name": "John Miller",
        "email": "j.miller@apexenterprise.com",
        "website": "https://apexenterprise.com",
        "raw_notes": "Seeking automated lead qualification for high volume pipeline.",
    }
    res = await client.post("/api/leads", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["company_name"] == "Apex Enterprise"
    assert data["email"] == "j.miller@apexenterprise.com"
    assert data["lead_status"] == "new"
    assert data["normalized_identifiers"]["domain"] == "apexenterprise.com"
    assert "id" in data


@pytest.mark.asyncio
async def test_missing_required_fields(client: AsyncClient):
    """Test 2: Missing required company name or contact returns 422 with sanitized details."""
    payload = {
        "source": "website_inbound",
        "email": "test@valid.com",
    }
    res = await client.post("/api/leads", json=payload)
    assert res.status_code == 422
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_FAILED"
    assert len(data["error"]["details"]) > 0


@pytest.mark.asyncio
async def test_invalid_email_format(client: AsyncClient):
    """Test 3: Malformed email returns 422 validation error."""
    payload = {
        "source": "website_inbound",
        "company_name": "Valid Corp",
        "contact_name": "Jane Doe",
        "email": "not-an-email-address",
    }
    res = await client.post("/api/leads", json=payload)
    assert res.status_code == 422
    data = res.json()
    assert data["error"]["code"] == "VALIDATION_FAILED"


@pytest.mark.asyncio
async def test_duplicate_lead_submission(client: AsyncClient):
    """Test 4 & 13: Submitting duplicate lead triggers idempotency protection (409 Conflict)."""
    payload = {
        "source": "website_inbound",
        "company_name": "Dedupe Logistics",
        "contact_name": "Marcus Vance",
        "email": "marcus@dedupe.io",
    }
    # First submission
    res1 = await client.post("/api/leads", json=payload)
    assert res1.status_code == 201

    # Second submission with identical normalized identifiers
    res2 = await client.post("/api/leads", json=payload)
    assert res2.status_code == 409
    data = res2.json()
    assert data["error"]["code"] == "DUPLICATE_RESOURCE"
    assert "already exists in registry" in data["error"]["message"]


@pytest.mark.asyncio
async def test_get_lead_by_id(client: AsyncClient):
    """Test retrieving existing and non-existing leads."""
    # Create lead
    payload = {
        "source": "website_inbound",
        "company_name": "Lookup Corp",
        "contact_name": "Alice Smith",
        "email": "alice@lookup.com",
    }
    create_res = await client.post("/api/leads", json=payload)
    lead_id = create_res.json()["id"]

    # Success lookup
    get_res = await client.get(f"/api/leads/{lead_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == lead_id

    # Not found lookup
    not_found_res = await client.get("/api/leads/non-existent-uuid")
    assert not_found_res.status_code == 404
    assert not_found_res.json()["error"]["code"] == "NOT_FOUND"
