# AI Lead Operations Agent

An enterprise-grade, secure, autonomous AI Lead Operations Agent and human-in-the-loop review control plane.

Designed specifically to operate alongside an existing self-hosted n8n automation engine without touching or modifying existing CRM workflows or webhooks (`/webhook/dispatch-outreach`).

---

## Key Highlights

- **Executive Operations Dashboard**: Built with React 19, TypeScript, Vite, Tailwind CSS, and Lucide Icons. Features real-time KPI metrics, filterable leads explorer, lead detail view with factual evidence breakdowns, and human review queue.
- **Secure FastAPI Service**: Implemented with Python, Pydantic v2 schemas, correlation ID propagation (`X-Correlation-ID`), structured JSON logging with sensitive token redaction, and safe error envelopes.
- **Governed Human Approval**: Controlled lifecycle (`DRAFT` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED`). Editing any approved outreach draft immediately invalidates approval and increments message versions.
- **Dual-Engine Persistence**: SQLAlchemy 2.0 Async targeting PostgreSQL in production with seamless fallback to async SQLite for zero-dependency local development and CI testing.
- **Untouched CRM Integration**: Leaves existing CRM webhooks intact. Targets a dedicated qualification webhook at `/webhook/lead-qualification` with HMAC-SHA256 authenticated callback loops.
- **Prompt Injection Hardening**: Wraps untrusted company text and lead inquiry data inside strict `<untrusted_lead_data>` XML fences with system instructions prohibiting user command execution.
- **100% Tested**: Comprehensive automated test suite passing unit, integration, validation, deduplication, and security tests.

---

## Directory Structure

```
ai-lead-operations-agent/
├── .env.example              # Environment variables template (no secrets)
├── docker-compose.yml        # Standalone application stack (PostgreSQL + API + SPA)
├── README.md                 # Project entry point
├── docs/                     # Full engineering documentation suite
│   ├── ARCHITECTURE.md       # Component boundaries & data flow diagrams
│   ├── IMPLEMENTATION_PLAN.md# Phased execution plan
│   ├── API_CONTRACTS.md      # REST & webhook JSON specifications
│   ├── N8N_SETUP.md          # n8n workflow import & credential guide
│   ├── SECURITY.md           # Threat modeling & secret redaction
│   ├── TESTING.md            # Automated test execution & test matrix
│   ├── DEPLOYMENT.md         # Production rollout & reverse proxy instructions
│   ├── OPERATIONS_RUNBOOK.md # Incident response & day-to-day operations
│   └── KNOWN_LIMITATIONS.md  # Explicit release boundaries & constraints
├── backend/                  # FastAPI Application Service
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Container definition
│   └── app/                  # Application code (core, models, schemas, api, services)
├── frontend/                 # React 19 + TypeScript + Vite SPA
│   ├── package.json          # Dependencies & scripts
│   ├── Dockerfile            # Multi-stage production Nginx container
│   └── src/                  # Components, fixtures, API client, design tokens
├── n8n/                      # n8n Automation Engine artifacts
│   ├── workflows/            # Importable lead_qualification_v1.json
│   └── README.md             # Node configuration & credential mapping
└── tests/                    # Automated testing suite
    └── backend/              # Pytest async unit & integration tests
```

---

## Quickstart (Local Development)

### 1. Prerequisites
- Python 3.12+
- Node.js 20+

### 2. Backend Setup
```bash
# Navigate to backend
cd backend

# Create virtual environment and install packages
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Run FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be live at `http://127.0.0.1:8000` with interactive OpenAPI docs at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup
```bash
# In a separate terminal
cd frontend

# Install dependencies and start Vite dev server
npm install
npm run dev
```

Open `http://localhost:5173` to access the Operations Dashboard.

### 4. Running Automated Tests
```bash
$env:PYTHONPATH="backend"
.\backend\.venv\Scripts\pytest -v tests/backend/
```

---

## Security Invariants

1. **Zero Secret Leakage**: No API keys, credentials, or webhook secrets are transmitted to the browser or stored in frontend bundles.
2. **Governed Outreach**: External transmission is strictly disabled in Release 1 (`ENABLE_EXTERNAL_OUTREACH=false`). Approval decisions represent legal and human readiness only.
3. **Idempotency Defense**: Inbound leads generate a deterministic SHA-256 idempotency key on normalized fields `(clean_email + normalized_company + domain)` to prevent duplicate ingestion storms.
