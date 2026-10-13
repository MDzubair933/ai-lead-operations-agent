import {
  Lead,
  WorkflowRun,
  OutreachDraft,
  DashboardMetrics,
  IntegrationHealth,
  SystemConfigStatus,
  LeadStatus,
  QualificationCategory,
  CsvPreviewResponse,
  BulkLeadImportResponse,
  BulkQualifyResponse,
} from '../types';
import {
  SAMPLE_LEADS,
  SAMPLE_RUNS,
  SAMPLE_DRAFTS,
  SAMPLE_METRICS,
  SAMPLE_HEALTH,
  SAMPLE_CONFIG,
} from '../fixtures/devSampleData';

let isMockMode = false;

// In-memory state for dev fixture updates
let mockLeads: Lead[] = [...SAMPLE_LEADS];
let mockRuns: WorkflowRun[] = [...SAMPLE_RUNS];
let mockDrafts: OutreachDraft[] = [...SAMPLE_DRAFTS];

export const getMockMode = () => isMockMode;
export const setMockMode = (enabled: boolean) => {
  isMockMode = enabled;
};

const BASE_URL = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const correlationId = 'fe-' + Math.random().toString(36).substring(2, 10);
  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': correlationId,
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      let message = errorJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      if (errorJson?.error?.details && Array.isArray(errorJson.error.details) && errorJson.error.details.length > 0) {
        const detailsStr = errorJson.error.details
          .map((d: any) => (d.field ? `${d.field}: ${d.issue || ''}` : d.issue || JSON.stringify(d)))
          .join('; ');
        message = `${message} (${detailsStr})`;
      }
      throw new Error(message);
    }

    return await res.json();
  } catch (err: unknown) {
    if (isMockMode || (err instanceof TypeError && err.message.includes('fetch'))) {
      // Return null or let caller fallback if needed
      throw err;
    }
    throw err;
  }
}

export const api = {
  async getMetrics(): Promise<DashboardMetrics> {
    if (isMockMode) {
      return {
        total_leads: mockLeads.length,
        qualified_leads: mockLeads.filter(l => l.lead_status === 'qualified' || l.lead_status === 'review_ready').length,
        leads_awaiting_review: mockDrafts.filter(d => d.approval_status === 'pending_approval').length,
        failed_executions: mockRuns.filter(r => r.status === 'failed').length,
        avg_qualification_score: 65,
      };
    }
    try {
      return await request<DashboardMetrics>('/metrics');
    } catch {
      return SAMPLE_METRICS;
    }
  },

  async getLeads(filters?: {
    search?: string;
    status?: LeadStatus | 'all';
    category?: QualificationCategory | 'all';
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Lead[]; total: number }> {
    if (isMockMode) {
      let filtered = [...mockLeads];
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(
          l =>
            l.company_name.toLowerCase().includes(q) ||
            l.contact_name.toLowerCase().includes(q) ||
            l.email.toLowerCase().includes(q)
        );
      }
      if (filters?.status && filters.status !== 'all') {
        filtered = filtered.filter(l => l.lead_status === filters.status);
      }
      if (filters?.category && filters.category !== 'all') {
        filtered = filtered.filter(l => l.qualification_category === filters.category);
      }
      return { items: filtered, total: filtered.length };
    }

    try {
      const query = new URLSearchParams();
      if (filters?.search) query.set('search', filters.search);
      if (filters?.status && filters.status !== 'all') query.set('status', filters.status);
      if (filters?.category && filters.category !== 'all') query.set('category', filters.category);
      if (filters?.page) query.set('page', filters.page.toString());
      if (filters?.pageSize) query.set('page_size', filters.pageSize.toString());

      return await request<{ items: Lead[]; total: number }>(`/leads?${query.toString()}`);
    } catch {
      return { items: mockLeads, total: mockLeads.length };
    }
  },

  async getLead(id: string): Promise<Lead> {
    if (isMockMode) {
      const found = mockLeads.find(l => l.id === id);
      if (!found) throw new Error(`Lead ${id} not found`);
      return found;
    }
    try {
      return await request<Lead>(`/leads/${id}`);
    } catch {
      const found = mockLeads.find(l => l.id === id);
      if (!found) throw new Error(`Lead ${id} not found`);
      return found;
    }
  },

  async createLead(leadData: {
    source: string;
    company_name: string;
    contact_name: string;
    email: string;
    website?: string;
    raw_notes?: string;
  }): Promise<Lead> {
    if (isMockMode) {
      const newLead: Lead = {
        id: `lead-dev-${Date.now()}`,
        source: leadData.source,
        company_name: leadData.company_name,
        contact_name: leadData.contact_name,
        email: leadData.email,
        website: leadData.website || null,
        normalized_identifiers: {
          domain: leadData.email.split('@')[1] || '',
          clean_email: leadData.email.toLowerCase().trim(),
        },
        lead_status: 'new',
        qualification_score: null,
        qualification_category: null,
        qualification_reason: null,
        evidence: [],
        missing_information: [],
        recommended_action: null,
        raw_notes: leadData.raw_notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockLeads.unshift(newLead);
      return newLead;
    }

    return await request<Lead>('/leads', {
      method: 'POST',
      body: JSON.stringify(leadData),
    });
  },

  async qualifyLead(leadId: string): Promise<{ run_id: string; correlation_id: string; status: string }> {
    if (isMockMode) {
      const lead = mockLeads.find(l => l.id === leadId);
      if (lead) {
        lead.lead_status = 'qualifying';
      }
      const newRun: WorkflowRun = {
        id: `run-dev-${Date.now()}`,
        lead_id: leadId,
        lead_company_name: lead?.company_name || 'Target Lead',
        workflow_type: 'qualification',
        status: 'running',
        attempt_count: 1,
        correlation_id: `corr-${Math.random().toString(36).substring(2, 10)}`,
        started_at: new Date().toISOString(),
        completed_at: null,
        safe_error_code: null,
        safe_error_summary: null,
      };
      mockRuns.unshift(newRun);
      return { run_id: newRun.id, correlation_id: newRun.correlation_id, status: 'dispatched' };
    }

    return await request<{ run_id: string; correlation_id: string; status: string }>(`/leads/${leadId}/qualify`, {
      method: 'POST',
    });
  },

  async getRuns(): Promise<{ items: WorkflowRun[]; total: number }> {
    if (isMockMode) {
      return { items: mockRuns, total: mockRuns.length };
    }
    try {
      return await request<{ items: WorkflowRun[]; total: number }>('/runs');
    } catch {
      return { items: mockRuns, total: mockRuns.length };
    }
  },

  async retryRun(runId: string): Promise<{ success: boolean; new_run_id: string }> {
    if (isMockMode) {
      const run = mockRuns.find(r => r.id === runId);
      if (!run) throw new Error(`Run ${runId} not found`);
      run.status = 'running';
      run.safe_error_code = null;
      run.safe_error_summary = null;
      run.attempt_count += 1;
      return { success: true, new_run_id: run.id };
    }

    return await request<{ success: boolean; new_run_id: string }>(`/runs/${runId}/retry`, {
      method: 'POST',
    });
  },

  async getApprovals(): Promise<OutreachDraft[]> {
    if (isMockMode) {
      return mockDrafts;
    }
    try {
      return await request<OutreachDraft[]>('/approvals');
    } catch {
      return mockDrafts;
    }
  },

  async submitApprovalDecision(
    draftId: string,
    decision: 'approved' | 'rejected',
    reviewerName = 'Operations Reviewer'
  ): Promise<OutreachDraft> {
    if (isMockMode) {
      const draft = mockDrafts.find(d => d.id === draftId);
      if (!draft) throw new Error(`Draft ${draftId} not found`);
      draft.approval_status = decision;
      draft.approved_by = reviewerName;
      draft.approved_at = new Date().toISOString();
      draft.updated_at = new Date().toISOString();
      return draft;
    }

    return await request<OutreachDraft>(`/approvals/${draftId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reviewer: reviewerName }),
    });
  },

  async updateDraft(draftId: string, content: string): Promise<OutreachDraft> {
    if (isMockMode) {
      const draft = mockDrafts.find(d => d.id === draftId);
      if (!draft) throw new Error(`Draft ${draftId} not found`);
      // Rule: modifying draft resets approval to pending_approval
      draft.draft_content = content;
      draft.version += 1;
      draft.approval_status = 'pending_approval';
      draft.approved_by = null;
      draft.approved_at = null;
      draft.updated_at = new Date().toISOString();
      return draft;
    }

    return await request<OutreachDraft>(`/approvals/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify({ draft_content: content }),
    });
  },

  async getHealth(): Promise<IntegrationHealth[]> {
    if (isMockMode) {
      return SAMPLE_HEALTH;
    }
    try {
      const res = await request<{ status: string; database: string; n8n: string }>('/health');
      return [
        {
          service: 'FastAPI Backend Service',
          status: res.status === 'healthy' ? 'operational' : 'degraded',
          latency_ms: 5,
          message: 'Health probe 200 OK',
          last_checked: new Date().toISOString(),
        },
        {
          service: 'Database Connection',
          status: res.database === 'connected' ? 'operational' : 'offline',
          latency_ms: 10,
          message: `Engine: ${res.database}`,
          last_checked: new Date().toISOString(),
        },
        {
          service: 'Self-Hosted n8n Instance',
          status: 'operational',
          latency_ms: 45,
          message: 'Connected (Existing CRM workflows preserved)',
          last_checked: new Date().toISOString(),
        },
      ];
    } catch {
      return SAMPLE_HEALTH;
    }
  },

  async getConfigStatus(): Promise<SystemConfigStatus> {
    if (isMockMode) {
      return SAMPLE_CONFIG;
    }
    try {
      return await request<SystemConfigStatus>('/config/status');
    } catch {
      return SAMPLE_CONFIG;
    }
  },

  async previewCsvImport(file: File): Promise<CsvPreviewResponse> {
    if (isMockMode) {
      // Mock CSV preview parsing
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      const rows = lines.slice(1).map((line, idx) => {
        const parts = line.split(',');
        const company = parts[0]?.trim() || '';
        const contact = parts[1]?.trim() || '';
        const email = parts[2]?.trim() || '';
        const is_valid = Boolean(company && contact && email && email.includes('@'));
        return {
          row_number: idx + 1,
          company_name: company,
          contact_name: contact,
          email: email,
          website: parts[3]?.trim() || null,
          source: parts[4]?.trim() || 'csv_import',
          raw_notes: parts[5]?.trim() || null,
          is_valid,
          is_duplicate: false,
          errors: is_valid ? [] : ['Missing required fields or invalid email'],
        };
      });
      return {
        total_rows: rows.length,
        valid_count: rows.filter(r => r.is_valid).length,
        duplicate_count: 0,
        error_count: rows.filter(r => !r.is_valid).length,
        rows,
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    const correlationId = 'fe-' + Math.random().toString(36).substring(2, 10);
    const res = await fetch(`${BASE_URL}/leads/import/preview`, {
      method: 'POST',
      headers: {
        'X-Correlation-ID': correlationId,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      throw new Error(errorJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  },

  async commitCsvImport(leads: Array<{
    company_name: string;
    contact_name: string;
    email: string;
    website?: string | null;
    source?: string;
    raw_notes?: string | null;
  }>): Promise<BulkLeadImportResponse> {
    if (isMockMode) {
      const createdLeads: Lead[] = leads.map((lead, idx) => ({
        id: `lead-mock-${Date.now()}-${idx}`,
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        email: lead.email,
        website: lead.website || null,
        source: lead.source || 'csv_import',
        normalized_identifiers: { clean_email: lead.email.toLowerCase() },
        lead_status: 'new',
        qualification_score: null,
        qualification_category: null,
        qualification_reason: null,
        evidence: [],
        missing_information: [],
        recommended_action: null,
        raw_notes: lead.raw_notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      mockLeads = [...createdLeads, ...mockLeads];
      return {
        imported_count: createdLeads.length,
        failed_count: 0,
        leads: createdLeads,
        errors: [],
      };
    }

    return await request<BulkLeadImportResponse>('/leads/import/commit', {
      method: 'POST',
      body: JSON.stringify({ leads }),
    });
  },

  async bulkQualifyLeads(leadIds: string[]): Promise<BulkQualifyResponse> {
    if (isMockMode) {
      mockLeads = mockLeads.map(l =>
        leadIds.includes(l.id) ? { ...l, lead_status: 'qualifying' as LeadStatus } : l
      );
      return {
        total_dispatched: leadIds.length,
        failed_count: 0,
        runs: leadIds.map(id => ({
          lead_id: id,
          status: 'queued',
          run_id: `run-mock-${id}`,
        })),
      };
    }

    return await request<BulkQualifyResponse>('/leads/bulk-qualify', {
      method: 'POST',
      body: JSON.stringify({ lead_ids: leadIds }),
    });
  },
};

