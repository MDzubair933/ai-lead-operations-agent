# Known Limitations & Release Boundaries — Release 1.0.0

## 1. Explicit Architectural Boundaries

In accordance with strict production engineering standards, the following boundaries and intentional constraints apply to Release 1.0.0:

---

### 1. External Outreach Dispatching is Globally Locked
- **Current State**: Automated external dispatch (e.g. sending emails via SMTP/SendGrid or triggering LinkedIn messages) is disabled by design via the configuration setting `ENABLE_EXTERNAL_OUTREACH=false`.
- **Rationale**: Prevents accidental transmission of AI-generated messages to external parties during initial rollout.
- **Workflow**: Generated drafts enter the review queue in `pending_approval` state. Human approval records organizational readiness and legal review without initiating external socket connections.

---

### 2. Live n8n Instance Separation & Manual Import Model
- **Current State**: The existing live n8n instance operates untouched. Per project rules, live credentials, admin API keys, and deployment changes were never fabricated or injected into production.
- **Workflow**: An importable versioned workflow file is provided in [`n8n/workflows/lead_qualification_v1.json`](../n8n/workflows/lead_qualification_v1.json). Complete manual setup steps are documented in [`docs/N8N_SETUP.md`](./N8N_SETUP.md).

---

### 3. Dual Database Driver Mechanics
- **Production Target**: PostgreSQL 16+ using `postgresql+asyncpg://` with native JSONB, indexes, and Alembic migrations.
- **Local Development / Pytest**: SQLite using `sqlite+aiosqlite://` with JSON serialization.
- **Limitation**: While all queries and schemas are written using universal SQLAlchemy types, advanced PostgreSQL-specific full-text search operators (`to_tsvector`) are replaced with case-insensitive `ILIKE` queries in Release 1 to maintain seamless SQLite zero-dependency local development and test execution on Windows.

---

### 4. In-Memory Rate Limiting
- **Current State**: Rate limiting operates per-instance in application middleware.
- **Roadmap**: If deploying multi-replica FastAPI instances behind a load balancer, attach a shared Redis cluster (`redis-py` / `aioredis`) to synchronize token bucket rate limits across instances.
