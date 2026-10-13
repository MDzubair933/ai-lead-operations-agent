import { Lead, WorkflowRun, OutreachDraft, DashboardMetrics, IntegrationHealth, SystemConfigStatus } from '../types';

export const IS_SAMPLE_FIXTURE_LABEL = "DEVELOPMENT FIXTURE — NOT PRODUCTION DATA";

export const SAMPLE_LEADS: Lead[] = [
  {
    id: "lead-dev-001",
    source: "website_inbound",
    company_name: "Vertex Cloud Logistics",
    contact_name: "Elena Rostova",
    email: "elena@vertexcloud.io",
    website: "https://vertexcloud.io",
    normalized_identifiers: {
      domain: "vertexcloud.io",
      clean_email: "elena@vertexcloud.io",
    },
    lead_status: "review_ready",
    qualification_score: 92,
    qualification_category: "high",
    qualification_reason: "High fit: 250+ employees in supply chain, explicit requirement for automated dispatch routing, verified active domain and business email.",
    evidence: [
      "Custom company domain verified via MX records",
      "Explicit inquiry matching core operations automation capability",
      "Identified executive buyer persona (VP Operations)"
    ],
    missing_information: [
      "Target implementation timeline (Q3 vs Q4)"
    ],
    recommended_action: "review",
    raw_notes: "Looking to replace manual CSV uploads into dispatch queue. High priority for upcoming peak season.",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: "lead-dev-002",
    source: "api_partner",
    company_name: "Nexus BioHealth",
    contact_name: "Dr. Marcus Chen",
    email: "m.chen@nexusbio.org",
    website: "https://nexusbio.org",
    normalized_identifiers: {
      domain: "nexusbio.org",
      clean_email: "m.chen@nexusbio.org",
    },
    lead_status: "qualified",
    qualification_score: 78,
    qualification_category: "medium",
    qualification_reason: "Medium fit: Clinical trials lab looking for automated reporting. Moderate compliance overhead required.",
    evidence: [
      "Legitimate research non-profit domain",
      "Budget authorization established in intake notes"
    ],
    missing_information: [
      "HIPAA compliance requirements confirmation",
      "Volume of monthly inbound samples"
    ],
    recommended_action: "research",
    raw_notes: "Need guidance on HIPAA-ready data pipeline handling before proceeding to drafting.",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "lead-dev-003",
    source: "csv_import",
    company_name: "QuickDrop Mail",
    contact_name: "Alex Rivera",
    email: "alex1989@gmail.com",
    website: null,
    normalized_identifiers: {
      domain: "gmail.com",
      clean_email: "alex1989@gmail.com",
    },
    lead_status: "disqualified",
    qualification_score: 18,
    qualification_category: "low",
    qualification_reason: "Low fit: Generic freemail address, no company domain provided, budget indicated under minimum threshold.",
    evidence: [
      "Consumer email provider detected",
      "Lack of corporate identity"
    ],
    missing_information: [
      "Company website",
      "Business email",
      "Company size"
    ],
    recommended_action: "skip",
    raw_notes: "Personal side project inquiry.",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 20).toISOString(),
  },
  {
    id: "lead-dev-004",
    source: "website_inbound",
    company_name: "Aether Dynamics",
    contact_name: "Sophia Sterling",
    email: "s.sterling@aetherdyn.com",
    website: "https://aetherdyn.com",
    normalized_identifiers: {
      domain: "aetherdyn.com",
      clean_email: "s.sterling@aetherdyn.com",
    },
    lead_status: "qualifying",
    qualification_score: null,
    qualification_category: null,
    qualification_reason: "Undergoing asynchronous AI qualification in n8n engine.",
    evidence: [],
    missing_information: [],
    recommended_action: null,
    raw_notes: "Requested enterprise tier demo with CRM webhook synchronization.",
    created_at: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 0.5).toISOString(),
  }
];

export const SAMPLE_RUNS: WorkflowRun[] = [
  {
    id: "run-dev-001",
    lead_id: "lead-dev-001",
    lead_company_name: "Vertex Cloud Logistics",
    workflow_type: "qualification",
    status: "completed",
    attempt_count: 1,
    correlation_id: "corr-8f12a-vertex-001",
    started_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 1.48).toISOString(),
    safe_error_code: null,
    safe_error_summary: null,
  },
  {
    id: "run-dev-002",
    lead_id: "lead-dev-004",
    lead_company_name: "Aether Dynamics",
    workflow_type: "qualification",
    status: "running",
    attempt_count: 1,
    correlation_id: "corr-11b9c-aether-004",
    started_at: new Date(Date.now() - 3600000 * 0.2).toISOString(),
    completed_at: null,
    safe_error_code: null,
    safe_error_summary: null,
  },
  {
    id: "run-dev-003",
    lead_id: "lead-dev-003",
    lead_company_name: "QuickDrop Mail",
    workflow_type: "qualification",
    status: "failed",
    attempt_count: 2,
    correlation_id: "corr-77e4d-quickdrop-003",
    started_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 7.9).toISOString(),
    safe_error_code: "RATE_LIMIT_BACKOFF_EXCEEDED",
    safe_error_summary: "Upstream LLM provider returned 429 Too Many Requests; backoff threshold reached after 2 retries.",
  }
];

export const SAMPLE_DRAFTS: OutreachDraft[] = [
  {
    id: "draft-dev-001",
    lead_id: "lead-dev-001",
    lead_company_name: "Vertex Cloud Logistics",
    lead_contact_name: "Elena Rostova",
    lead_email: "elena@vertexcloud.io",
    channel: "email",
    draft_content: `Hi Elena,

Noticed Vertex Cloud Logistics' focus on scaling dispatch routing efficiency. Given your current manual CSV upload workflow, our automated operations pipeline could eliminate roughly 14 hours of weekly data transfer latency.

Would you be open to a 10-minute technical review next Tuesday at 2 PM to explore our secure intake integration?

Best regards,
Lead Operations Team`,
    version: 1,
    approval_status: "pending_approval",
    approved_by: null,
    approved_at: null,
    sent_at: null,
    created_at: new Date(Date.now() - 3600000 * 1.4).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1.4).toISOString(),
  },
  {
    id: "draft-dev-002",
    lead_id: "lead-dev-002",
    lead_company_name: "Nexus BioHealth",
    lead_contact_name: "Dr. Marcus Chen",
    lead_email: "m.chen@nexusbio.org",
    channel: "email",
    draft_content: `Dear Dr. Chen,

Following up on your clinical reporting workflow inquiry for Nexus BioHealth. We have prepared an overview detailing our compliance architecture and zero-retention data pipeline.

Please let us know if your research informatics committee would like to review the architecture brief.

Warm regards,
Informatics Solutions`,
    version: 1,
    approval_status: "approved",
    approved_by: "op_lead_sarah",
    approved_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    sent_at: null,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  }
];

export const SAMPLE_METRICS: DashboardMetrics = {
  total_leads: 4,
  qualified_leads: 2,
  leads_awaiting_review: 1,
  failed_executions: 1,
  avg_qualification_score: 62.6,
};

export const SAMPLE_HEALTH: IntegrationHealth[] = [
  {
    service: "FastAPI Backend Service",
    status: "operational",
    latency_ms: 12,
    message: "Health and readiness probe 200 OK",
    last_checked: new Date().toISOString(),
  },
  {
    service: "PostgreSQL Database Engine",
    status: "operational",
    latency_ms: 8,
    message: "Connection pool active (Dual engine: SQLite fallback ready)",
    last_checked: new Date().toISOString(),
  },
  {
    service: "Self-Hosted n8n Engine",
    status: "operational",
    latency_ms: 64,
    message: "https://n8n.example.com (Existing CRM workflows untouched)",
    last_checked: new Date().toISOString(),
  },
  {
    service: "AI Qualification Webhook",
    status: "operational",
    latency_ms: 55,
    message: "/webhook/lead-qualification contract active",
    last_checked: new Date().toISOString(),
  }
];

export const SAMPLE_CONFIG: SystemConfigStatus = {
  app_env: "development",
  api_version: "v1.0.0",
  database_type: "sqlite+aiosqlite (dual postgres-ready)",
  n8n_base_url: "https://n8n.example.com",
  n8n_qualification_webhook: "/webhook/lead-qualification",
  external_outreach_enabled: false,
  rate_limit_enabled: true,
  secret_redaction_active: true,
};
