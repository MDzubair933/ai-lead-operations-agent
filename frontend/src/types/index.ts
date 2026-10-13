export type LeadStatus =
  | 'new'
  | 'qualifying'
  | 'qualified'
  | 'disqualified'
  | 'review_ready'
  | 'archived';

export type QualificationCategory =
  | 'high'
  | 'medium'
  | 'low'
  | 'insufficient_data';

export type RecommendedAction =
  | 'research'
  | 'draft'
  | 'review'
  | 'skip';

export type RunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timed_out';

export type ApprovalStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

export interface Lead {
  id: string;
  source: string;
  company_name: string;
  contact_name: string;
  email: string;
  website?: string | null;
  normalized_identifiers: {
    domain?: string;
    clean_email?: string;
    phone?: string;
  };
  lead_status: LeadStatus;
  qualification_score?: number | null;
  qualification_category?: QualificationCategory | null;
  qualification_reason?: string | null;
  evidence: string[];
  missing_information: string[];
  recommended_action?: RecommendedAction | null;
  raw_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  lead_id: string;
  lead_company_name?: string;
  workflow_type: string;
  status: RunStatus;
  attempt_count: number;
  correlation_id: string;
  started_at: string;
  completed_at?: string | null;
  safe_error_code?: string | null;
  safe_error_summary?: string | null;
}

export interface OutreachDraft {
  id: string;
  lead_id: string;
  lead_company_name?: string;
  lead_contact_name?: string;
  lead_email?: string;
  channel: 'email' | 'linkedin' | 'manual';
  draft_content: string;
  version: number;
  approval_status: ApprovalStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  sanitized_metadata: Record<string, unknown>;
}

export interface DashboardMetrics {
  total_leads: number;
  qualified_leads: number;
  leads_awaiting_review: number;
  failed_executions: number;
  avg_qualification_score: number;
}

export interface IntegrationHealth {
  service: string;
  status: 'operational' | 'degraded' | 'offline' | 'unverified';
  latency_ms?: number;
  message: string;
  last_checked: string;
}

export interface SystemConfigStatus {
  app_env: string;
  api_version: string;
  database_type: string;
  n8n_base_url: string;
  n8n_qualification_webhook: string;
  external_outreach_enabled: boolean;
  rate_limit_enabled: boolean;
  secret_redaction_active: boolean;
}

export interface CsvLeadRowPreview {
  row_number: number;
  company_name: string;
  contact_name: string;
  email: string;
  website?: string | null;
  source: string;
  raw_notes?: string | null;
  is_valid: boolean;
  is_duplicate: boolean;
  errors: string[];
}

export interface CsvPreviewResponse {
  total_rows: number;
  valid_count: number;
  duplicate_count: number;
  error_count: number;
  rows: CsvLeadRowPreview[];
}

export interface BulkLeadImportResponse {
  imported_count: number;
  failed_count: number;
  leads: Lead[];
  errors: string[];
}

export interface BulkQualifyResponse {
  total_dispatched: number;
  failed_count: number;
  runs: Array<{
    lead_id: string;
    company_name?: string;
    run_id?: string;
    status: string;
    correlation_id?: string;
    error?: string;
  }>;
}

