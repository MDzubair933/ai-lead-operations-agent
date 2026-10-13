# n8n Qualification Workflow Specification

## Overview

This directory contains the production-ready n8n workflow for **AI Lead Qualification & Human Approval**.

- **Workflow File**: [`workflows/lead_qualification_v1.json`](./workflows/lead_qualification_v1.json)
- **Target Instance**: Self-hosted n8n instance
- **Existing Untouched Workflow**: `/webhook/dispatch-outreach` (DO NOT MODIFY OR DELETE)
- **New Webhook Path**: `/webhook/lead-qualification`

---

## Architecture of the Qualification Flow

```
[FastAPI /leads/{id}/qualify]
             │
             ▼ (POST /webhook/lead-qualification with X-Correlation-ID)
[1. Webhook Trigger]
             │
             ▼
[2. Input Validation & Prompt Defense] ──► [Respond 202 Accepted to FastAPI]
             │ (Strict XML Fence <untrusted_lead_data>)
             ▼
[3. AI Qualification Node (Configurable LLM: OpenAI / Anthropic / Gemini)]
             │ (Structured scoring rubric & evidence enforcement)
             ▼
[4. Structured Output Validator]
             │ (Validates score range 0-100, category enum, evidence array)
             ▼
[5. HTTP Request Callback]
             │ (POST /api/webhooks/n8n/qualification-callback with HMAC header)
             ▼
[FastAPI Updates Lead + Creates OutreachDraft in PENDING_APPROVAL state]
```

---

## Safe Manual Import Instructions

1. Log into your self-hosted n8n instance.
2. Go to **Workflows** → Click **Add Workflow** (top right).
3. Open the options menu (three dots) → select **Import from File...**.
4. Upload `workflows/lead_qualification_v1.json`.
5. Connect your configured LLM credential (e.g. OpenAI / Anthropic / Ollama / Gemini API key) to the **AI Qualification (LLM Node)**.
6. Verify the **Callback to FastAPI Service** URL:
   - For local testing: `http://127.0.0.1:8000/api/webhooks/n8n/qualification-callback`
   - For production deployment: `https://<YOUR_API_DOMAIN>/api/webhooks/n8n/qualification-callback`
7. Click **Save** and toggle the workflow to **Active**.

---

## Security Guarantees

1. **Isolation**: Completely separate webhook path. Does not intersect with or alter existing CRM outreach operations.
2. **Untrusted Data Isolation**: All inbound customer text, company names, and website notes are fenced in `<untrusted_lead_data>` to prevent prompt injection from taking over the agent.
3. **Zero Secret Leaks**: Credentials remain securely stored inside n8n's credential vault; never exported or returned in execution traces.
4. **Governed Output**: Leads are never automatically emailed. High-fit scores output a draft that enters the FastAPI database in `pending_approval` state for human review.
