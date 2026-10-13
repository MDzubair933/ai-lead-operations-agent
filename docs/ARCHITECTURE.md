# System Architecture — AI Lead Operations Agent

## 1. High-Level System Architecture

The AI Lead Operations Agent is architected with clear boundaries separating the presentation tier, business logic control plane, relational persistence, and asynchronous automation engine.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                            │
│  React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons            │
│  - Executive KPI Cards & Visual Status Indicators                      │
│  - Filterable Leads Table (Search, Score, Category, Status)            │
│  - Deep Lead Detail (Raw Inbound Data, Verified Evidence, Gaps)        │
│  - Human Review Queue (Draft Editor, Approve / Reject Actions)         │
│  - Execution Runs Monitor (Safe Errors, Correlation IDs, Safe Retry)   │
│  - Non-Secret Settings & Health Status Dashboard                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / JSON (Correlation ID Headers)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND SERVICE                         │
│  - Authentication & Role-Based Access Control (Admin, Operator, Read)  │
│  - Pydantic v2 Schema Validation & Safe Error Envelope                 │
│  - Correlation ID Middleware & Sensitive Data Log Redaction            │
│  - Rate Limiter & Idempotency Filter                                   │
│  - Safe Dispatcher to n8n Webhook                                      │
│  - Inbound n8n Callback Webhook with HMAC Signature Verification       │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│          PERSISTENCE LAYER           │  │       SELF-HOSTED N8N        │
│  SQLAlchemy 2.0 Async + Alembic      │  │ https://n8n.example.com     │
│  - Production Target: PostgreSQL     │  │                              │
│  - Local/Test Engine: SQLite Async   │  │ [EXISTING UNTOUCHED]:        │
│  - Strict JSON/JSONB compatibility   │  │   /webhook/dispatch-outreach │
│  - Schema: leads, workflow_runs,     │  │                              │
│    outreach_drafts, audit_events     │  │ [NEW QUALIFICATION FLOW]:    │
│                                      │  │   /webhook/lead-qualification│
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 2. Component Boundaries & Responsibilities

### 2.1 Frontend Application
- **Boundary**: Browser sandbox.
- **Responsibility**: Rendering UI, filtering, user interaction, human approval decisions, draft editing.
- **Security Constraint**: Has zero access to n8n webhook secrets, database credentials, or LLM API keys. Never makes direct network calls to n8n.

### 2.2 Backend Control Plane (FastAPI)
- **Boundary**: Private network / DMZ behind TLS reverse proxy.
- **Responsibility**: Ingestion, input normalization, SHA-256 idempotency calculation, correlation tracking, database persistence, webhook dispatching, HMAC callback validation, safe error wrapping.
- **Security Constraint**: Redacts sensitive authorization tokens from all structured logs.

### 2.3 Relational Persistence Layer
- **Production Engine**: PostgreSQL 16.
- **Development/Test Engine**: SQLite 3 via `aiosqlite`.
- **Responsibility**: ACID transactions, unique constraints on idempotency keys, foreign key cascading, structured JSON storage for evidence lists and missing information.

### 2.4 Self-Hosted n8n Automation Engine
- **Target Instance**: Self-hosted n8n instance (`https://n8n.example.com`)
- **Existing Webhook**: `/webhook/dispatch-outreach` — **Untouched & Preserved**.
- **New Qualification Webhook**: `/webhook/lead-qualification`.
- **Responsibility**: Asynchronous AI evaluation using configured LLMs, prompt injection defense, structured JSON schema enforcement, and cryptographically signed callback transmission.
