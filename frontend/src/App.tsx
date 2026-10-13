import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { LeadsTable } from './components/leads/LeadsTable';
import { LeadDetailModal } from './components/leads/LeadDetailModal';
import { AddLeadModal } from './components/leads/AddLeadModal';
import { CsvImportModal } from './components/leads/CsvImportModal';
import { ReviewQueue } from './components/approvals/ReviewQueue';
import { ExecutionList } from './components/runs/ExecutionList';
import { SystemHealth } from './components/settings/SystemHealth';
import {
  Lead,
  WorkflowRun,
  OutreachDraft,
  DashboardMetrics,
  IntegrationHealth,
  SystemConfigStatus,
  LeadStatus,
  QualificationCategory,
} from './types';
import { api, getMockMode, setMockMode } from './api/client';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMockMode, setIsMockModeState] = useState(getMockMode());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  // Data states
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_leads: 0,
    qualified_leads: 0,
    leads_awaiting_review: 0,
    failed_executions: 0,
    avg_qualification_score: 0,
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [health, setHealth] = useState<IntegrationHealth[]>([]);
  const [config, setConfig] = useState<SystemConfigStatus | null>(null);

  // Modal states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isQualifying, setIsQualifying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Table filters
  const [tableFilters, setTableFilters] = useState<{
    search: string;
    status: LeadStatus | 'all';
    category: QualificationCategory | 'all';
    page: number;
    pageSize: number;
  }>({
    search: '',
    status: 'all',
    category: 'all',
    page: 1,
    pageSize: 10,
  });

  const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleToggleMockMode = () => {
    const next = !isMockMode;
    setIsMockModeState(next);
    setMockMode(next);
    showToast(
      next
        ? 'Switched to Development Fixture Mode (offline testing)'
        : 'Switched to Live API Mode (connecting to FastAPI backend)',
      'info'
    );
  };

  const refreshAllData = useCallback(async () => {
    try {
      const [m, l, r, d, h, c] = await Promise.all([
        api.getMetrics(),
        api.getLeads(tableFilters),
        api.getRuns(),
        api.getApprovals(),
        api.getHealth(),
        api.getConfigStatus(),
      ]);
      setMetrics(m);
      setLeads(l.items);
      setTotalLeads(l.total);
      setRuns(r.items);
      setDrafts(d);
      setHealth(h);
      setConfig(c);
    } catch (err: unknown) {
      console.warn('Backend currently offline or proxy connecting, fallback active:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tableFilters]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (isMounted) {
        await refreshAllData();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [refreshAllData, isMockMode]);

  const pendingLeadsRef = useRef<Set<string>>(new Set());

  // Lead qualification trigger
  const handleQualifyLead = async (leadId: string) => {
    if (pendingLeadsRef.current.has(leadId)) {
      return;
    }
    pendingLeadsRef.current.add(leadId);
    setIsQualifying(true);
    try {
      const res = await api.qualifyLead(leadId);
      showToast(
        `Dispatched qualification run to n8n (Correlation ID: ${res.correlation_id})`,
        'success'
      );
      await refreshAllData();
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, lead_status: 'qualifying' });
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to trigger qualification', 'warning');
    } finally {
      pendingLeadsRef.current.delete(leadId);
      setIsQualifying(false);
    }
  };

  // Bulk qualify leads
  const handleBulkQualify = async (leadIds: string[]) => {
    try {
      const res = await api.bulkQualifyLeads(leadIds);
      showToast(
        `Dispatched ${res.total_dispatched} leads to AI qualification pipeline.`,
        'success'
      );
      await refreshAllData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Bulk qualification dispatch failed', 'warning');
    }
  };

  // Intake new lead
  const handleCreateLead = async (leadData: {
    source: string;
    company_name: string;
    contact_name: string;
    email: string;
    website?: string;
    raw_notes?: string;
  }) => {
    const created = await api.createLead(leadData);
    showToast(`Lead for ${created.company_name} ingested and normalized successfully.`, 'success');
    await refreshAllData();
  };

  // Review decision
  const handleApprovalDecision = async (draftId: string, decision: 'approved' | 'rejected') => {
    await api.submitApprovalDecision(draftId, decision);
    showToast(
      decision === 'approved'
        ? 'Draft approved and marked verified for outreach.'
        : 'Draft rejected and returned for review.',
      decision === 'approved' ? 'success' : 'info'
    );
    await refreshAllData();
  };

  // Draft update
  const handleUpdateDraft = async (draftId: string, content: string) => {
    await api.updateDraft(draftId, content);
    showToast('Draft edited. Approval invalidated per security policy (PENDING_APPROVAL).', 'warning');
    await refreshAllData();
  };

  // Run retry
  const handleRetryRun = async (runId: string) => {
    await api.retryRun(runId);
    showToast(`Safe retry initiated for execution run ${runId}`, 'success');
    await refreshAllData();
  };

  const pendingApprovalsCount = drafts.filter(d => d.approval_status === 'pending_approval').length;
  const failedRunsCount = runs.filter(r => r.status === 'failed').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-white/90 border-emerald-200 text-emerald-800'
                : toast.type === 'warning'
                ? 'bg-white/90 border-amber-200 text-amber-800'
                : 'bg-white/90 border-blue-200 text-blue-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        isMockMode={isMockMode}
        onToggleMockMode={handleToggleMockMode}
        activeTab={activeTab}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingApprovalsCount={pendingApprovalsCount}
          failedRunsCount={failedRunsCount}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Pane */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {activeTab === 'dashboard' && (
              <OverviewDashboard
                metrics={metrics}
                recentLeads={leads}
                recentRuns={runs}
                pendingDrafts={drafts}
                onNavigateTab={setActiveTab}
                onSelectLead={lead => {
                  setSelectedLead(lead);
                  setIsDetailOpen(true);
                }}
              />
            )}

            {activeTab === 'leads' && (
              <LeadsTable
                leads={leads}
                total={totalLeads}
                isLoading={isLoading}
                onSelectLead={lead => {
                  setSelectedLead(lead);
                  setIsDetailOpen(true);
                }}
                onQualifyLead={handleQualifyLead}
                onBulkQualifyLeads={handleBulkQualify}
                onOpenAddModal={() => setIsAddOpen(true)}
                onOpenCsvImportModal={() => setIsCsvImportOpen(true)}
                filters={tableFilters}
                onFilterChange={newFilters =>
                  setTableFilters(prev => ({ ...prev, ...newFilters }))
                }
              />
            )}

            {activeTab === 'approvals' && (
              <ReviewQueue
                drafts={drafts}
                isLoading={isLoading}
                onDecision={handleApprovalDecision}
                onUpdateDraft={handleUpdateDraft}
              />
            )}

            {activeTab === 'runs' && (
              <ExecutionList
                runs={runs}
                isLoading={isLoading}
                onRetry={handleRetryRun}
                onRefresh={refreshAllData}
              />
            )}

            {activeTab === 'settings' && (
              <SystemHealth
                health={health}
                config={config}
                isLoading={isLoading}
              />
            )}
          </div>
        </main>
      </div>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedLead(null);
        }}
        onQualify={handleQualifyLead}
        isQualifying={isQualifying}
      />

      {/* Intake Lead Modal */}
      <AddLeadModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleCreateLead}
      />

      {/* CSV Bulk Import Modal */}
      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        onImportSuccess={async importedLeads => {
          showToast(`Successfully staged ${importedLeads.length} leads with status 'new'.`, 'success');
          await refreshAllData();
        }}
        onQualifySuccess={async leadIds => {
          showToast(`Dispatched ${leadIds.length} leads to qualification pipeline.`, 'success');
          await refreshAllData();
        }}
      />
    </div>
  );
}

export default App;
