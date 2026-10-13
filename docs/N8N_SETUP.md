# n8n Setup & Workflow Architecture Guide (Google Gemini Edition)

## 1. Overview & Infrastructure Boundary

The **AI Lead Operations Agent** integrates with an existing self-hosted n8n automation engine to provide AI-assisted lead scoring, prompt-injection defense, and human-in-the-loop review preparation powered by **Google Gemini** (`models/gemini-1.5-flash`).

### Existing Production Setup & Strict Safety Rules
- **Production n8n Instance**: `https://n8n.example.com`
- **AI Model Provider**: Google Gemini (`models/gemini-1.5-flash` via `@n8n/n8n-nodes-langchain.lmChatGoogleGemini`). No OpenAI API key or paid subscription is required.
- **Hostname Rule**: Always use your configured domain (`N8N_BASE_URL=https://n8n.example.com`).
- **Existing Workflows (Preserved & Untouched)**:
  - Existing CRM and outreach dispatching workflows must **never** be edited, renamed, replaced, deactivated, or deleted.
- **Existing Outreach Webhook Contract**:
  - `POST /webhook/dispatch-outreach` (URL: `https://n8n.example.com/webhook/dispatch-outreach`)
  - **STRICT CONTRACT PRESERVATION**: This contract belongs to existing outreach dispatcher workflows. The AI Lead Operations Agent does **not** touch or repurpose this endpoint.
- **Dedicated Qualification Webhook**:
  - Production Webhook URL: `https://n8n.example.com/webhook/lead-qualification`
  - Test Webhook URL: `https://n8n.example.com/webhook-test/lead-qualification`
  - Webhook Path: `lead-qualification` (registered by n8n under the `/webhook/` route prefix)
- **Workflow Export File**: [`n8n/workflows/lead_qualification_v1.json`](../n8n/workflows/lead_qualification_v1.json)

---

## 2. Step-by-Step Workflow Import Instructions

Follow these exact steps in your self-hosted n8n web interface:

1. **Log in to n8n**:
   - Open your browser and navigate to your n8n instance (`https://n8n.example.com`).
   - Sign in with your administrative credentials.

2. **Add Google Gemini Credential in n8n**:
   - In the left sidebar of n8n, click **Credentials**.
   - Click the **Add Credential** button in the top-right corner.
   - In the search bar, type `Google Gemini` (it appears as **Google Gemini(PaLM) Api** with credential type `googlePalmApi`).
   - Click to open the credential modal.
   - Paste your **Google Gemini API Key** (obtained from Google AI Studio).
     > **CRITICAL SECURITY NOTE**: Never hardcode this key in Git, project source code, `.env.example`, or documentation. It belongs exclusively inside your secure n8n credentials vault.
   - Set the credential name to `Google Gemini account` and click **Save**.

3. **Import the Workflow**:
   - In the left navigation menu, click **Workflows**.
   - In the top-right corner, click **Add Workflow** (or **+**).
   - Click the workflow options dropdown in the top-right (three vertical dots `⋮`).
   - Select **Import from File...**.
   - Browse to your local project and select `n8n/workflows/lead_qualification_v1.json`.
   - The workflow titled **"AI Lead Qualification & Human Approval v1"** will render on your canvas.

4. **Attach Credential to Google Gemini Node**:
   - On the canvas, locate the **Google Gemini Chat Model** sub-node connected to **AI Qualification (LLM Node)**.
   - Double-click the **Google Gemini Chat Model** node.
   - In the **Credential to connect with** dropdown, select your saved `Google Gemini account` credential.
   - Verify that **Model Name** is set to `models/gemini-1.5-flash` and **Temperature** is set to `0.2` for deterministic, grounded analysis.

5. **Verify Synchronous Execution Architecture**:
   - Notice that **Validate Qualification Output** connects directly to **Return Structured Response**.
   - Because your n8n instance runs on a remote server (`https://n8n.example.com`) while your development FastAPI backend runs on your local machine, n8n cannot call `127.0.0.1:8000`.
   - Instead, the workflow returns the completed qualification outcome **synchronously in the HTTP 200 webhook response**.
   - The FastAPI backend's `N8nClient.dispatch_qualification` immediately receives this response, stores the qualification score, creates a pending outreach draft for human approval, and completes the workflow run with zero localhost network errors.
   - The **Callback to FastAPI Service (Optional Async)** node is marked `disabled` on the canvas as an architectural reference for when a public, TLS-secured domain is provisioned for the backend.

6. **Save & Activate**:
   - Click **Save** in the top navigation bar.
   - Toggle the workflow switch in the top bar from **Inactive** to **Active** (green).
   > **IMPORTANT**: The production endpoint `https://n8n.example.com/webhook/lead-qualification` returns `HTTP 404 Not Found` if the workflow is left in the Inactive state!

---

## 3. Node Pipeline Architecture

```
[Webhook Trigger: POST /lead-qualification]
                  │
                  ▼
[Validate Input & Check Required Fields (Code Node)]
                  │
                  ├──────────────────────────────► [Check Validation State: False]
                  │                                               │
                  ▼                                               ▼
[Check Validation State: True]                        [Return Failure Response (422)]
                  │
                  ▼
[Normalize Lead Data & Prompt Injection Defense (Code Node)]
                  │
                  ▼
[AI Qualification (LangChain LLM Node)] ◄── [Google Gemini Chat Model]
                  │
                  ▼
[Validate Qualification Output & JSON Parser (Code Node)]
                  │
                  ▼
[Return Structured Response (200)]  ──► (Synchronously received by FastAPI backend)
                  │
                  ░ (Disabled Reference Node)
                  ▼
[Callback to FastAPI Service (Optional Async)]
```

### Defense-in-Depth Security Features:
1. **Prompt Injection Defense**: In `Normalize Lead Data`, all untrusted customer input (`raw_notes`, `contact_name`, `website`) is stripped of prompt escape markers, backticks, and wrapped inside `<untrusted_lead_data>` XML fences.
2. **System Prompt Hardening**: The Gemini system prompt strictly instructs the model to ignore any commands inside `<untrusted_lead_data>` and enforce a 0-100 rubric.
3. **Structured Output Sanitization**: In `Validate Qualification Output`, JavaScript code automatically strips markdown code fences (````json ... ````), isolates JSON objects even if accompanied by conversational text, clamps scores between 0 and 100, and verifies category enums.
4. **Human-in-the-Loop Safeguard**: Any qualified lead with an outreach draft is persisted with `approval_status="pending_approval"`. The system **never** sends an outbound email or message automatically (`ENABLE_EXTERNAL_OUTREACH=false`).
5. **Resilient Failure Reporting**: If Gemini produces unparseable JSON or encounters an unconfigured credential, the workflow captures it cleanly and returns `INVALID_MODEL_OUTPUT` or `AI_MODEL_EXECUTION_FAILED` without hanging.

---

## 4. Backend Callback & Execution Architecture Analysis

### Local vs. Remote Execution Reality
- **n8n Host**: `https://n8n.example.com` (remote cloud server).
- **FastAPI Backend (Local Dev)**: Windows desktop on `http://127.0.0.1:8000`.
- **The Localhost Problem**: In n8n on a remote server, making an HTTP request to `http://127.0.0.1:8000` attempts to connect to the remote server itself, NOT your Windows computer. This results in connection refused or 10-second timeout errors.

### The Solution: First-Class Synchronous Webhook Response
The FastAPI backend (`backend/app/services/n8n_client.py`) already features native, first-class synchronous response processing:
```python
async with httpx.AsyncClient(timeout=settings.N8N_WEBHOOK_TIMEOUT_SECONDS) as client:
    res = await client.post(webhook_url, json=payload, headers=headers)
    ...
    if res_json.get("status") == "success" and res_json.get("qualification"):
        # Immediately parses qualification, writes to DB, creates pending draft,
        # and marks WorkflowRun as completed!
```
- By routing `Validate Qualification Output` directly to `Return Structured Response`, n8n delivers the full qualification output in the POST response body.
- Communication is **100% outbound** from your local machine to n8n (`Backend -> n8n -> Synchronous Response`).
- No public IP, dynamic DNS, ngrok tunnel, or exposed ports are needed on your local Windows system.

### Asynchronous Callback Mode (Future Production Requirement)
If an asynchronous callback architecture is required in a multi-tenant cloud environment:
- The backend callback route exists at `POST /api/webhooks/n8n/qualification-callback`.
- It requires an `X-Webhook-Signature` HMAC SHA-256 header.
- **Current Blocker for Async Mode**: Until the FastAPI backend is deployed to a publicly reachable domain with HTTPS (e.g., `https://api.example.com`) or connected via a secured reverse tunnel, remote n8n cannot call the backend asynchronously. The synchronous response is the primary, working integration.

---

## 5. Request & Response Schemas

### A. Webhook Intake Request (FastAPI -> n8n)
- **Method**: `POST`
- **URL**: `https://n8n.example.com/webhook/lead-qualification`
- **Headers**:
  ```http
  Content-Type: application/json
  X-Correlation-ID: corr-3f89b910-c081-42cb-b1b6-d245970c798c
  X-Webhook-Secret: <WEBHOOK_HMAC_SECRET>
  ```
- **Body**:
  ```json
  {
    "correlation_id": "corr-3f89b910-c081-42cb-b1b6-d245970c798c",
    "lead_id": "lead-0193139f-864c-7033-90d5-12000e35fbb2",
    "source": "website_contact_form",
    "company_name": "Apex Logistics Group",
    "contact_name": "Marcus Vance",
    "email": "m.vance@apexlogistics.com",
    "website": "https://apexlogistics.com",
    "raw_notes": "We run 120 freight dispatchers and need automated lead triage and SDR drafting.",
    "timestamp": "2026-10-13T09:40:00Z"
  }
  ```

### B. Synchronous Successful Qualification Response (n8n -> FastAPI)
- **HTTP Status**: `200 OK`
- **Body**:
  ```json
  {
    "status": "success",
    "lead_id": "lead-0193139f-864c-7033-90d5-12000e35fbb2",
    "correlation_id": "corr-3f89b910-c081-42cb-b1b6-d245970c798c",
    "qualification": {
      "qualification": "high",
      "score": 92,
      "reason": "Large enterprise freight organization with 120 dispatchers and immediate automation requirements.",
      "evidence": [
        "Explicit dispatcher fleet size of 120",
        "Corporate verified freight domain",
        "Direct alignment with operations agent use case"
      ],
      "missing_information": [
        "Current TMS/CRM technology stack"
      ],
      "recommended_next_action": "draft",
      "outreach_draft": "Hi Marcus,\n\nNoticed Apex Logistics is coordinating across 120 freight dispatchers. When managing dispatch teams of that scale, manual qualification bottlenecks typically delay response time by 4-6 hours.\n\nOur AI operations agent automates inbound triage and prepares personalized drafts for your review before anything sends. Would you be open to reviewing how this fits into your dispatch workflow this Thursday?\n\nBest regards,\nLead Operations Team"
    }
  }
  ```

### C. Missing Required Fields Error Response (n8n -> FastAPI)
- **HTTP Status**: `422 Unprocessable Entity`
- **Body**:
  ```json
  {
    "is_valid": false,
    "status": "failure",
    "lead_id": "unknown",
    "correlation_id": "corr-missing-001",
    "error_code": "MISSING_REQUIRED_FIELDS",
    "error_summary": "Missing required intake fields: lead_id, company_name, and email are mandatory."
  }
  ```

---

## 6. Safe Offline Testing & Verification Procedure

Before triggering any executions against your production n8n server, test locally using the included verification tools:

### Step 1: Run the Node.js Workflow Validator
A zero-dependency Node.js validation script is provided in `scripts/validate_workflow.js`. It validates JSON syntax, verifies all 10 nodes including `Google Gemini Chat Model`, confirms synchronous connection topology, and executes the JavaScript code nodes against the 5 test scenarios:
```bash
node scripts/validate_workflow.js
```
Expected output:
```
✅ JSON is valid. Workflow Name: "AI Lead Qualification & Human Approval v1"
✅ Found 10 nodes.
✅ All required workflow nodes present, including Google Gemini Chat Model.
✅ Webhook node verified: POST /lead-qualification with responseMode="responseNode".
✅ Google Gemini node verified: type=@n8n/n8n-nodes-langchain.lmChatGoogleGemini, modelName=models/gemini-1.5-flash
✅ Synchronous response architecture verified: Validate Qualification Output -> Return Structured Response.

--- Running 5 Test Payload Scenarios ---
Scenario 1: Valid lead intake & qualification with Gemini markdown format -> PASS
Scenario 2: Missing required fields -> PASS (MISSING_REQUIRED_FIELDS)
Scenario 3: Invalid payload -> PASS (INVALID_EMAIL_FORMAT)
Scenario 4: Invalid AI output -> PASS (INVALID_MODEL_OUTPUT)
Scenario 5: Processing failure -> PASS (AI_MODEL_EXECUTION_FAILED)
```

### Step 2: Run Backend Integration Tests
Execute the pytest suite to verify how the FastAPI backend handles all responses, timeout failovers, and HTTP 404 diagnostics:
```bash
# In PowerShell:
$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m pytest tests/backend -q
```
All 20 tests will pass in under 2 seconds.

---

## 7. Troubleshooting HTTP 404 Errors

If you encounter `safe_error_code: "HTTP_404_NOT_FOUND"` during lead qualification dispatch:

### Cause 1: Workflow is Inactive in n8n
- **Symptom**: HTTP 404 with message `The requested webhook "POST lead-qualification" is not registered.`
- **Remedy**:
  1. Open your n8n instance (`https://n8n.example.com`).
  2. Open the workflow `AI Lead Qualification & Human Approval v1`.
  3. Ensure the switch in the top-right is toggled to **Active** (green).
  4. Save the workflow.

### Cause 2: Hostname Mismatch
- **Symptom**: Requests hitting an unconfigured domain.
- **Remedy**:
  - In your `.env` file, ensure:
    ```env
    N8N_BASE_URL=https://n8n.example.com
    N8N_QUALIFICATION_WEBHOOK_PATH=/webhook/lead-qualification
    ```
  - Restart the backend server.

---

## 8. How to Verify an Actual n8n Execution

After importing and activating the workflow:

1. **Open Executions View**:
   - In n8n, click **Executions** in the left sidebar (`https://n8n.example.com/executions`).
   - You will see a chronological list of all workflow runs.
2. **Inspect Execution Details**:
   - Click on any execution row for `AI Lead Qualification & Human Approval v1`.
   - Green checkmarks indicate successfully executed nodes.
   - Click **Google Gemini Chat Model** and **AI Qualification (LLM Node)** to inspect prompt and generated output.
3. **Inspect Database & UI**:
   - In the AI Lead Operations Agent dashboard (`http://localhost:5173`), navigate to **Workflows**.
   - Verify the run status displays **Completed** with green badge.
   - Navigate to **Review Queue** to review the generated outreach draft awaiting human approval.
