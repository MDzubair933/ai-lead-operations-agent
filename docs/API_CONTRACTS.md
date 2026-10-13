# API Contracts & Data Specifications

All API responses are formatted in UTF-8 JSON. Every response includes the `X-Correlation-ID` response header to support end-to-end tracing across the frontend, FastAPI control plane, and n8n engine.

---

## 1. Standard Error Envelope

When any error occurs (4xx or 5xx), the service returns a standard sanitized envelope. Internal stack traces are scrubbed to prevent disclosure of underlying system details.

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The incoming payload failed schema validation.",
    "correlation_id": "corr-8f12a-vertex-001",
    "details": [
      {
        "field": "body.email",
        "issue": "value is not a valid email address"
      }
    ]
  }
}
```

### Standard Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Request body failed Pydantic schema validation |
| `NOT_FOUND` | 404 | Targeted resource UUID does not exist |
| `DUPLICATE_RESOURCE` | 409 | Lead idempotency collision detected |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token / HMAC signature |
| `FORBIDDEN` | 403 | Caller lacks required role for action |
| `INVALID_STATE_FOR_RETRY` | 400 | Execution run is not in a failed/timed-out state |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error, logged with correlation ID |

---

## 2. Lead Management Endpoints

### `GET /api/leads`
Query Parameters:
- `search` (optional string): Case-insensitive match on company, contact, or email
- `status` (optional string): `all | new | qualifying | qualified | review_ready | disqualified | archived`
- `category` (optional string): `all | high | medium | low | insufficient_data`
- `page` (integer, default: 1): Page number (1-indexed)
- `page_size` (integer, default: 10, max: 100): Items per page

Response (200 OK):
```json
{
  "items": [
    {
      "id": "99f36f4d-176b-4e1b-858a-a97eef9f2791",
      "source": "website_inbound",
      "company_name": "Apex Enterprise",
      "contact_name": "Marcus Vance",
      "email": "m.vance@apexlogistics.io",
      "website": "https://apexlogistics.io",
      "normalized_identifiers": {
        "domain": "apexlogistics.io",
        "clean_email": "m.vance@apexlogistics.io",
        "normalized_company": "apexenterprise"
      },
      "lead_status": "review_ready",
      "qualification_score": 85,
      "qualification_category": "high",
      "qualification_reason": "Enterprise size, clear budget signal, relevant industry match.",
      "evidence": [
        "Verified custom domain via MX records",
        "Explicit inquiry matching core operations automation capability"
      ],
      "missing_information": [
        "Target deployment timeframe"
      ],
      "recommended_action": "review",
      "raw_notes": "Interested in reducing fleet dispatch manual steps",
      "created_at": "2026-10-13T03:30:00Z",
      "updated_at": "2026-10-13T03:32:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10
}
```

### `POST /api/leads`
Headers:
- `Content-Type: application/json`
- `X-Correlation-ID: <Optional>`

Request Body:
```json
{
  "source": "website_inbound",
  "company_name": "Vertex Logistics",
  "contact_name": "Elena Rostova",
  "email": "elena@vertexcloud.io",
  "website": "https://vertexcloud.io",
  "raw_notes": "Looking to replace manual CSV uploads into dispatch queue."
}
```

Response (201 Created): Returns the created `Lead` object.

### `POST /api/leads/{lead_id}/qualify`
Dispatches qualification run to n8n qualification webhook.

Response (200 OK):
```json
{
  "run_id": "run-44b2-89cd",
  "correlation_id": "corr-uuid-456",
  "status": "running",
  "message": "Lead qualification job successfully queued for n8n processing."
}
```

---

## 3. Human Approval Review Queue

### `GET /api/approvals`
Query Parameters:
- `status` (optional string): `all | draft | pending_approval | approved | rejected`

Response (200 OK): Array of `OutreachDraft` objects with attached lead metadata.

### `POST /api/approvals/{draft_id}/decision`
Request Body:
```json
{
  "decision": "approved",
  "reviewer": "op_lead_sarah"
}
```

Response (200 OK): Updated draft with `approval_status: "approved"`, `approved_by: "op_lead_sarah"`, and `approved_at: ISO8601`.

### `PUT /api/approvals/{draft_id}`
Request Body:
```json
{
  "draft_content": "Updated outreach text..."
}
```

Response (200 OK):
- Increments `version` by 1.
- Resets `approval_status` to `pending_approval`.
- Clears `approved_by` and `approved_at`.

---

## 4. Execution Monitoring

### `GET /api/runs`
Query Parameters:
- `status` (optional string): `all | pending | running | completed | failed | timed_out`
- `page`: int
- `page_size`: int

Response (200 OK): Paginated list of `WorkflowRun` objects with safe error summaries.

### `POST /api/runs/{run_id}/retry`
Safely retries a failed workflow execution using a new correlation ID.

---

## 5. Inbound n8n Webhook Callback Contract

### `POST /api/webhooks/n8n/qualification-callback`
Headers:
- `Content-Type: application/json`
- `X-Correlation-ID: <correlation_id>`
- `X-Webhook-Signature: <HMAC_SHA256_HEX>`

Request Body:
```json
{
  "correlation_id": "corr-74b8849f-b98a-49a6-bc17-1f48625aa112",
  "lead_id": "99f36f4d-176b-4e1b-858a-a97eef9f2791",
  "status": "success",
  "qualification": {
    "qualification": "high",
    "score": 85,
    "reason": "Enterprise size, clear budget signal, relevant industry match.",
    "evidence": [
      "Verified custom domain",
      "Explicit mention of operations automation"
    ],
    "missing_information": [
      "Target deployment timeframe"
    ],
    "recommended_next_action": "review",
    "outreach_draft": "Hi Marcus, noted Apex's focus on fleet routing automation..."
  }
}
```

Response (200 OK):
```json
{
  "status": "acknowledged",
  "lead_id": "99f36f4d-176b-4e1b-858a-a97eef9f2791",
  "correlation_id": "corr-74b8849f-b98a-49a6-bc17-1f48625aa112"
}
```
