import io
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
from app.models.lead import Lead


@pytest.mark.asyncio
async def test_csv_preview_valid_rows(client: AsyncClient):
    """Test previewing valid CSV rows with standard and alternative headers."""
    csv_content = (
        "company_name,contact_name,email,website,source,raw_notes\n"
        "Alpha Systems,John Alpha,john@alphasystems.io,https://alphasystems.io,web,Notes 1\n"
        "Beta Cloud,Sarah Beta,sarah@betacloud.com,https://betacloud.com,referral,Notes 2\n"
    )
    files = {"file": ("leads.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    res = await client.post("/api/leads/import/preview", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 2
    assert data["valid_count"] == 2
    assert data["duplicate_count"] == 0
    assert data["error_count"] == 0
    assert len(data["rows"]) == 2
    assert data["rows"][0]["is_valid"] is True
    assert data["rows"][0]["company_name"] == "Alpha Systems"
    assert data["rows"][0]["email"] == "john@alphasystems.io"


@pytest.mark.asyncio
async def test_csv_preview_invalid_rows(client: AsyncClient):
    """Test previewing invalid CSV rows (missing required fields and malformed email)."""
    csv_content = (
        "Company Name,Contact Name,Email,Website,Source,Notes\n"
        ",Missing Company,missing@test.com,https://test.com,inbound,No company\n"
        "Missing Contact,,contact@test.com,https://test.com,inbound,No contact\n"
        "Missing Email,No Email,,https://test.com,inbound,No email\n"
        "Bad Email Corp,Bad Email,invalid-email-string,https://test.com,inbound,Malformed email\n"
    )
    files = {"file": ("invalid_leads.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    res = await client.post("/api/leads/import/preview", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 4
    assert data["valid_count"] == 0
    assert data["error_count"] == 4

    rows = data["rows"]
    assert rows[0]["is_valid"] is False
    assert any("Company name is required" in err for err in rows[0]["errors"])
    assert rows[1]["is_valid"] is False
    assert any("Contact name is required" in err for err in rows[1]["errors"])
    assert rows[2]["is_valid"] is False
    assert any("Email is required" in err for err in rows[2]["errors"])
    assert rows[3]["is_valid"] is False
    assert any("Invalid email syntax" in err for err in rows[3]["errors"])


@pytest.mark.asyncio
async def test_csv_preview_duplicates_within_batch_and_database(client: AsyncClient):
    """Test duplicate detection both within the same CSV batch and against existing DB leads."""
    # First, create an existing lead in the database
    init_res = await client.post(
        "/api/leads",
        json={
            "company_name": "Existing Corp",
            "contact_name": "Alice Existing",
            "email": "alice@existingcorp.com",
            "website": "https://existingcorp.com",
            "source": "manual",
        },
    )
    assert init_res.status_code == 201

    # Upload CSV that has:
    # 1. Lead that matches the database (Existing Corp)
    # 2. A new unique lead (Unique Corp)
    # 3. A repeated lead within this CSV (Unique Corp duplicate)
    csv_content = (
        "company_name,contact_name,email,website,source,raw_notes\n"
        "Existing Corp,Alice Existing,alice@existingcorp.com,https://existingcorp.com,csv,Already in DB\n"
        "Unique Corp,Bob Unique,bob@uniquecorp.io,https://uniquecorp.io,csv,New unique\n"
        "Unique Corp,Bob Unique,bob@uniquecorp.io,https://uniquecorp.io,csv,Duplicate in file\n"
    )
    files = {"file": ("duplicates.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    res = await client.post("/api/leads/import/preview", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 3
    assert data["valid_count"] == 1
    assert data["duplicate_count"] == 2

    # Row 1: DB duplicate
    assert data["rows"][0]["is_duplicate"] is True
    assert data["rows"][0]["is_valid"] is False
    assert any("Lead already exists in database" in err for err in data["rows"][0]["errors"])

    # Row 2: Valid unique lead
    assert data["rows"][1]["is_valid"] is True
    assert data["rows"][1]["is_duplicate"] is False

    # Row 3: Within-batch duplicate
    assert data["rows"][2]["is_duplicate"] is True
    assert data["rows"][2]["is_valid"] is False
    assert any("Repeated row within this CSV" in err for err in data["rows"][2]["errors"])


@pytest.mark.asyncio
async def test_csv_preview_empty_and_whitespace_files(client: AsyncClient):
    """Test previewing empty file and header-only CSV."""
    # Completely empty file
    files = {"file": ("empty.csv", io.BytesIO(b""), "text/csv")}
    res = await client.post("/api/leads/import/preview", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 0
    assert data["valid_count"] == 0
    assert len(data["rows"]) == 0

    # Header-only CSV
    header_only = "company_name,contact_name,email,website,source,raw_notes\n"
    files = {"file": ("headers_only.csv", io.BytesIO(header_only.encode("utf-8")), "text/csv")}
    res = await client.post("/api/leads/import/preview", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 0
    assert data["valid_count"] == 0
    assert len(data["rows"]) == 0


@pytest.mark.asyncio
async def test_synthetic_lead_qualification_test_pack_file(client: AsyncClient):
    """Test previewing the synthetic_lead_qualification_test_pack.csv test fixture."""
    with open("tests/fixtures/synthetic_lead_qualification_test_pack.csv", "rb") as f:
        file_bytes = f.read()

    files = {"file": ("synthetic_lead_qualification_test_pack.csv", io.BytesIO(file_bytes), "text/csv")}
    res = await client.post("/api/leads/import/preview", files=files)
    assert res.status_code == 200
    data = res.json()

    # The fixture has 8 rows:
    # 4 valid unique leads (Acme, CyberDynamics, Apex Logistics, Orbit Labs)
    # 1 duplicate within file (second Acme)
    # 3 invalid rows (missing company, missing contact, invalid email)
    assert data["total_rows"] == 8
    assert data["valid_count"] == 4
    assert data["duplicate_count"] == 1
    assert data["error_count"] == 3


@pytest.mark.asyncio
async def test_bulk_commit_and_selective_qualification(client: AsyncClient):
    """Test importing selected leads to DB and triggering qualification strictly on explicit request."""
    # 1. Commit 2 valid leads
    commit_payload = {
        "leads": [
            {
                "company_name": "Bulk Tech 1",
                "contact_name": "Alice One",
                "email": "alice@bulktech1.com",
                "website": "https://bulktech1.com",
                "source": "csv_import",
                "raw_notes": "Bulk import test notes",
            },
            {
                "company_name": "Bulk Tech 2",
                "contact_name": "Bob Two",
                "email": "bob@bulktech2.com",
                "website": "https://bulktech2.com",
                "source": "csv_import",
                "raw_notes": "Bulk import test notes 2",
            },
        ]
    }
    commit_res = await client.post("/api/leads/import/commit", json=commit_payload)
    assert commit_res.status_code == 200
    commit_data = commit_res.json()
    assert commit_data["imported_count"] == 2
    assert commit_data["failed_count"] == 0
    assert len(commit_data["leads"]) == 2

    lead_1_id = commit_data["leads"][0]["id"]
    lead_2_id = commit_data["leads"][1]["id"]
    # Check that lead_status is 'new' and no qualification has happened yet
    assert commit_data["leads"][0]["lead_status"] == "new"
    assert commit_data["leads"][1]["lead_status"] == "new"

    # 2. Trigger qualification ONLY when explicitly requested via bulk-qualify
    mock_run = AsyncMock()
    mock_run.id = "run-test-123"
    mock_run.status = "queued"
    mock_run.correlation_id = "corr-test-123"

    with patch("app.services.n8n_client.N8nClient.dispatch_qualification", return_value=mock_run) as mock_dispatch:
        qualify_res = await client.post(
            "/api/leads/bulk-qualify",
            json={"lead_ids": [lead_1_id, lead_2_id]},
        )
        assert qualify_res.status_code == 200
        qualify_data = qualify_res.json()
        assert qualify_data["total_dispatched"] == 2
        assert qualify_data["failed_count"] == 0
        assert len(qualify_data["runs"]) == 2
        assert mock_dispatch.call_count == 2


@pytest.mark.asyncio
async def test_csv_import_with_long_url_source_and_safe_clamping(client: AsyncClient):
    """Test that CSV rows with long URL sources (>100 chars) are accepted and previewed/committed safely."""
    long_source_url = "https://services.dha.gov.ae/sheryan/wps/portal/home/medical-directory/facility-details?facilityId=0001562"
    assert len(long_source_url) > 100

    csv_content = (
        "company_name,contact_name,email,website,source,raw_notes\n"
        f"Precision Clinic,Dr. Smith,smith@precisionclinic.ae,https://precisionclinic.ae,{long_source_url},Notes here\n"
    )
    files = {"file": ("long_url.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    preview_res = await client.post("/api/leads/import/preview", files=files)
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["total_rows"] == 1
    assert preview_data["valid_count"] == 1
    assert preview_data["rows"][0]["is_valid"] is True
    assert preview_data["rows"][0]["source"] == long_source_url

    # Commit payload should pass validation without 422
    commit_payload = {
        "leads": [
            {
                "company_name": "Precision Clinic",
                "contact_name": "Dr. Smith",
                "email": "smith@precisionclinic.ae",
                "website": "https://precisionclinic.ae",
                "source": long_source_url,
                "raw_notes": "Notes here",
            }
        ]
    }
    commit_res = await client.post("/api/leads/import/commit", json=commit_payload)
    assert commit_res.status_code == 200
    commit_data = commit_res.json()
    assert commit_data["imported_count"] == 1
    assert commit_data["failed_count"] == 0
    assert commit_data["leads"][0]["source"] == long_source_url

