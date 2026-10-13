import React, { useState, useRef } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { WorkflowRun } from '../../types';
import { RunStatusBadge } from '../common/Badge';

interface ExecutionListProps {
  runs: WorkflowRun[];
  isLoading: boolean;
  onRetry: (runId: string) => Promise<void>;
  onRefresh: () => void;
}

export const ExecutionList: React.FC<ExecutionListProps> = ({
  runs,
  isLoading,
  onRetry,
  onRefresh,
}) => {
  const pendingRetryRef = useRef<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const handleRetry = async (runId: string) => {
    if (pendingRetryRef.current.has(runId) || retryingIds.has(runId)) {
      return;
    }
    pendingRetryRef.current.add(runId);
    setRetryingIds(prev => new Set(prev).add(runId));
    try {
      await onRetry(runId);
    } finally {
      pendingRetryRef.current.delete(runId);
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const toggleExpand = (runId: string) => {
    setExpandedRunId(prev => (prev === runId ? null : runId));
  };

  return (
    <div className="space-y-4">
      {/* Page Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Execution Runs
          </h1>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 text-xs font-medium border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
          title="Refresh run statuses"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Execution & Correlation ID</th>
                <th className="px-4 py-3">Lead Target</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Diagnostics & Details</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading execution runs...</span>
                    </div>
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-800">No execution runs</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dispatched qualifications will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                runs.map(run => {
                  const isExpanded = expandedRunId === run.id;
                  const isRetrying = retryingIds.has(run.id);

                  return (
                    <React.Fragment key={run.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono text-slate-900 font-medium text-xs">
                            {run.id.slice(0, 8)}…{run.id.slice(-4)}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                            <span title={run.correlation_id}>
                              {run.correlation_id ? `${run.correlation_id.slice(0, 12)}…` : '—'}
                            </span>
                            {run.correlation_id && (
                              <button
                                type="button"
                                onClick={() => handleCopy(run.correlation_id, run.id)}
                                className="text-slate-400 hover:text-slate-700 transition-colors"
                                title="Copy full correlation ID"
                              >
                                {copiedId === run.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-medium text-slate-900">
                          {run.lead_company_name || run.lead_id}
                        </td>

                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200">
                            {run.workflow_type}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <RunStatusBadge status={run.status} />
                        </td>

                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {run.attempt_count} / 2
                        </td>

                        <td className="px-4 py-3 max-w-xs">
                          {run.safe_error_code ? (
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-mono text-[10px] font-semibold shrink-0">
                                {run.safe_error_code}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleExpand(run.id)}
                                className="text-[11px] text-slate-600 hover:text-blue-600 flex items-center gap-0.5"
                              >
                                <span>Details</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : run.status === 'completed' ? (
                            <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Succeeded</span>
                            </span>
                          ) : run.status === 'running' ? (
                            <span className="text-[11px] text-blue-700 flex items-center gap-1.5 font-medium">
                              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                              <span>In Progress</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Queued</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {run.status === 'failed' && (run.attempt_count || 1) < 2 ? (
                            <button
                              type="button"
                              onClick={() => handleRetry(run.id)}
                              disabled={isRetrying}
                              className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 text-xs font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                              <span>Retry</span>
                            </button>
                          ) : run.status === 'failed' ? (
                            <span className="text-slate-400 text-[11px]">Max retries (2/2)</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Diagnostic Row */}
                      {isExpanded && run.safe_error_summary && (
                        <tr className="bg-slate-50/70 border-b border-slate-100">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                              <div className="font-semibold text-slate-800 flex items-center gap-2">
                                <span>Safe Diagnostic Summary</span>
                                <span className="font-mono text-[10px] text-slate-500">({run.safe_error_code})</span>
                              </div>
                              <p className="text-slate-600 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                                {run.safe_error_summary}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
