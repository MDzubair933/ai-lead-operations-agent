import React from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  AlertOctagon,
  ArrowRight,
  Building2,
  PlayCircle,
} from 'lucide-react';
import { DashboardMetrics, Lead, WorkflowRun, OutreachDraft } from '../../types';
import { KpiCard } from './KpiCard';
import { CategoryBadge, StatusBadge, RunStatusBadge } from '../common/Badge';

interface OverviewDashboardProps {
  metrics: DashboardMetrics;
  recentLeads: Lead[];
  recentRuns: WorkflowRun[];
  pendingDrafts: OutreachDraft[];
  onNavigateTab: (tab: string) => void;
  onSelectLead: (lead: Lead) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  metrics,
  recentLeads,
  recentRuns,
  onNavigateTab,
  onSelectLead,
}) => {
  const displayLeads = recentLeads.slice(0, 5);
  const displayRuns = recentRuns.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Overview
        </h1>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Leads"
          value={metrics.total_leads}
          subtext="Registry total"
          icon={Users}
          variant="blue"
        />
        <KpiCard
          title="Qualified Leads"
          value={metrics.qualified_leads}
          subtext="High & medium fit"
          icon={CheckCircle}
          variant="emerald"
        />
        <KpiCard
          title="Awaiting Review"
          value={metrics.leads_awaiting_review}
          subtext="Drafts pending approval"
          icon={Clock}
          variant="amber"
        />
        <KpiCard
          title="Failed Executions"
          value={metrics.failed_executions}
          subtext="Attention required"
          icon={AlertOctagon}
          variant="rose"
        />
      </div>

      {/* Two-Column Section: Recent Leads & Recent Execution Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Ingested Leads */}
        <div className="glass-card rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <span>Recent Leads</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('leads')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {displayLeads.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>No leads recorded yet.</p>
                <p className="text-slate-400 mt-0.5">Import CSV to begin.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-1">
                {displayLeads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => onSelectLead(lead)}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {lead.company_name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {lead.contact_name} {lead.email ? `• ${lead.email}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={lead.lead_status} />
                      <CategoryBadge category={lead.qualification_category} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Execution Runs */}
        <div className="glass-card rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-slate-500" />
                <span>Recent Execution Runs</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('runs')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {displayRuns.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>No execution runs recorded yet.</p>
                <p className="text-slate-400 mt-0.5">Dispatched qualifications will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-1">
                {displayRuns.map(run => (
                  <div
                    key={run.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {run.lead_company_name || run.lead_id}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Workflow: {run.workflow_type}</span>
                        <span>•</span>
                        <span>Attempt {run.attempt_count} of 2</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <RunStatusBadge status={run.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
