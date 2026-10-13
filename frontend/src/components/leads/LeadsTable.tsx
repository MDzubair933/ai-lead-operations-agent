import React, { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Upload,
  Check,
  X,
  Building2,
} from 'lucide-react';
import { Lead, LeadStatus, QualificationCategory } from '../../types';
import { CategoryBadge, StatusBadge } from '../common/Badge';

interface LeadsTableProps {
  leads: Lead[];
  total: number;
  isLoading: boolean;
  onSelectLead: (lead: Lead) => void;
  onQualifyLead: (leadId: string) => Promise<void>;
  onBulkQualifyLeads?: (leadIds: string[]) => Promise<void>;
  onOpenAddModal: () => void;
  onOpenCsvImportModal: () => void;
  filters: {
    search: string;
    status: LeadStatus | 'all';
    category: QualificationCategory | 'all';
    page: number;
    pageSize: number;
  };
  onFilterChange: (newFilters: Partial<LeadsTableProps['filters']>) => void;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  total,
  isLoading,
  onSelectLead,
  onQualifyLead,
  onBulkQualifyLeads,
  onOpenAddModal,
  onOpenCsvImportModal,
  filters,
  onFilterChange,
}) => {
  const pendingClickRef = useRef<Set<string>>(new Set());
  const [qualifyingIds, setQualifyingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkQualifying, setIsBulkQualifying] = useState(false);

  const handleQualifyClick = async (e: React.MouseEvent, leadId: string) => {
    e.stopPropagation();
    if (pendingClickRef.current.has(leadId) || qualifyingIds.has(leadId) || isBulkQualifying) {
      return;
    }
    pendingClickRef.current.add(leadId);
    setQualifyingIds(prev => new Set(prev).add(leadId));
    try {
      await onQualifyLead(leadId);
    } finally {
      pendingClickRef.current.delete(leadId);
      setQualifyingIds(prev => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  const handleToggleSelectLead = (leadId: string) => {
    const next = new Set(selectedIds);
    if (next.has(leadId)) {
      next.delete(leadId);
    } else {
      next.add(leadId);
    }
    setSelectedIds(next);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === leads.length && leads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const handleTriggerBulkQualify = async () => {
    if (!onBulkQualifyLeads || selectedIds.size === 0) return;
    setIsBulkQualifying(true);
    try {
      await onBulkQualifyLeads(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setIsBulkQualifying(false);
    }
  };

  const totalPages = Math.ceil(total / filters.pageSize) || 1;
  const isAllSelected = leads.length > 0 && selectedIds.size === leads.length;

  return (
    <div className="space-y-4">
      {/* Title & Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Leads
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenCsvImportModal}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/90 hover:bg-white text-slate-700 border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Intake Lead</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search company, contact, or email..."
            value={filters.search}
            onChange={e => onFilterChange({ search: e.target.value, page: 1 })}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50/80 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filters.status}
            onChange={e =>
              onFilterChange({
                status: e.target.value as LeadStatus | 'all',
                page: 1,
              })
            }
            className="px-2.5 py-1.5 rounded-lg bg-slate-50/80 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="qualifying">Qualifying</option>
            <option value="qualified">Qualified</option>
            <option value="review_ready">Review Ready</option>
            <option value="disqualified">Disqualified</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={filters.category}
            onChange={e =>
              onFilterChange({
                category: e.target.value as QualificationCategory | 'all',
                page: 1,
              })
            }
            className="px-2.5 py-1.5 rounded-lg bg-slate-50/80 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Fit</option>
            <option value="low">Low Fit</option>
            <option value="insufficient_data">Needs Data</option>
          </select>
        </div>
      </div>

      {/* Bulk Selection Notification Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-2.5 px-4 rounded-xl bg-blue-50/90 backdrop-blur-md border border-blue-200 text-xs text-blue-900 shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-600" />
            <span className="font-semibold">{selectedIds.size}</span>
            <span>lead{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>

          <div className="flex items-center gap-2">
            {onBulkQualifyLeads && (
              <button
                type="button"
                onClick={handleTriggerBulkQualify}
                disabled={isBulkQualifying}
                className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {isBulkQualifying ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>Qualify Selected</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-blue-100 transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    disabled={leads.length === 0}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="px-4 py-3 w-[34%] min-w-[260px]">Company & Contact</th>
                <th className="px-4 py-3 w-[16%] max-w-[160px]">Email</th>
                <th className="px-3 py-3 w-[10%] whitespace-nowrap">Status</th>
                <th className="px-3 py-3 w-[11%] whitespace-nowrap">AI Priority</th>
                <th className="px-3 py-3 w-[9%] whitespace-nowrap">Score</th>
                <th className="px-4 py-3 min-w-[160px]">Analysis Summary</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading leads...</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-800">No leads found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Adjust filters or import CSV.
                    </p>
                  </td>
                </tr>
              ) : (
                leads.map(lead => {
                  const isRowSelected = selectedIds.has(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isRowSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => handleToggleSelectLead(lead.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-3 min-w-[260px]">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {lead.company_name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {lead.contact_name}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600 max-w-[160px]">
                        <span className="truncate block" title={lead.email}>
                          {lead.email}
                        </span>
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        <StatusBadge status={lead.lead_status} />
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        <CategoryBadge category={lead.qualification_category} />
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        {lead.qualification_score !== null && lead.qualification_score !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${
                                  lead.qualification_score >= 80
                                    ? 'bg-emerald-500'
                                    : lead.qualification_score >= 50
                                    ? 'bg-blue-500'
                                    : 'bg-slate-400'
                                }`}
                                style={{ width: `${lead.qualification_score}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {lead.qualification_score}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-xs">
                        <p
                          className="text-[11px] text-slate-600 truncate"
                          title={lead.qualification_reason || ''}
                        >
                          {lead.qualification_reason || (
                            <span className="text-slate-400 italic">Pending qualification</span>
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={e => handleQualifyClick(e, lead.id)}
                            disabled={qualifyingIds.has(lead.id) || lead.lead_status === 'qualifying' || isBulkQualifying}
                            title={lead.lead_status === 'qualifying' ? "Qualification in progress" : "Trigger AI Qualification via n8n"}
                            className="px-2 py-1 rounded text-xs font-medium bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {qualifyingIds.has(lead.id) || lead.lead_status === 'qualifying' ? (
                              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Sparkles className="w-3 h-3 text-blue-600" />
                            )}
                            <span>{qualifyingIds.has(lead.id) || lead.lead_status === 'qualifying' ? 'Qualifying...' : 'Qualify'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectLead(lead)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-medium text-slate-900">{leads.length}</span> of{' '}
            <span className="font-medium text-slate-900">{total}</span> leads
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => onFilterChange({ page: filters.page - 1 })}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-medium text-slate-700">
              Page {filters.page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => onFilterChange({ page: filters.page + 1 })}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
