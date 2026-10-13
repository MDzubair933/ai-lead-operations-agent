import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Edit3,
  ShieldAlert,
  Building2,
  Check,
} from 'lucide-react';
import { OutreachDraft, ApprovalStatus } from '../../types';
import { ApprovalBadge } from '../common/Badge';
import { DraftEditorModal } from './DraftEditorModal';

interface ReviewQueueProps {
  drafts: OutreachDraft[];
  isLoading: boolean;
  onDecision: (draftId: string, decision: 'approved' | 'rejected') => Promise<void>;
  onUpdateDraft: (draftId: string, content: string) => Promise<void>;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({
  drafts,
  isLoading,
  onDecision,
  onUpdateDraft,
}) => {
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>('pending_approval');
  const [editingDraft, setEditingDraft] = useState<OutreachDraft | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredDrafts = drafts.filter(d => {
    if (filter === 'all') return true;
    return d.approval_status === filter;
  });

  const handleDecision = async (draftId: string, decision: 'approved' | 'rejected') => {
    try {
      setProcessingId(draftId);
      await onDecision(draftId, decision);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Review Queue
          </h1>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50/80 border border-amber-200/80 text-amber-800 text-xs font-medium backdrop-blur-xs self-start sm:self-auto">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>Approval Gate Active · External Dispatch Locked</span>
        </div>
      </div>

      {/* Filter Tabs Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 glass-card rounded-xl p-2.5">
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg">
          {(['pending_approval', 'approved', 'rejected', 'all'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                filter === tab
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-normal'
              }`}
            >
              {tab === 'pending_approval' && 'Pending Approval'}
              {tab === 'approved' && 'Approved'}
              {tab === 'rejected' && 'Rejected'}
              {tab === 'all' && 'All Drafts'}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 font-medium px-2">
          <span className="font-semibold text-slate-900">{filteredDrafts.length}</span> drafts
        </span>
      </div>

      {/* Drafts List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 glass-card rounded-xl">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <span className="text-xs">Loading queue...</span>
        </div>
      ) : filteredDrafts.length === 0 ? (
        <div className="p-12 text-center rounded-xl glass-card text-slate-500">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-800">No drafts awaiting review</p>
          <p className="text-xs text-slate-400 mt-1">
            {filter === 'all' ? 'No outreach drafts recorded.' : `No drafts with status '${filter}'.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDrafts.map(draft => (
            <div
              key={draft.id}
              className="p-5 rounded-xl glass-card space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">
                        {draft.lead_company_name || 'Target Lead'}
                      </span>
                      <ApprovalBadge status={draft.approval_status} />
                      <span className="text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                        v{draft.version}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{draft.lead_contact_name || 'Contact'}</span>
                      <span>•</span>
                      <span>{draft.lead_email || 'No email'}</span>
                      <span>•</span>
                      <span className="uppercase text-[10px] font-mono text-slate-600">
                        {draft.channel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status or decision info */}
                {draft.approval_status === 'approved' && draft.approved_by && (
                  <div className="text-xs text-emerald-700 flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    <span>Approved by {draft.approved_by} on {draft.approved_at ? new Date(draft.approved_at).toLocaleDateString() : ''}</span>
                  </div>
                )}
                {draft.approval_status === 'rejected' && (
                  <div className="text-xs text-red-700 flex items-center gap-1.5 font-medium">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rejected by Reviewer</span>
                  </div>
                )}
              </div>

              {/* Message Content Preview */}
              <div className="p-4 rounded-lg bg-white/70 border border-slate-200/80 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                {draft.draft_content}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setEditingDraft(draft)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Draft</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecision(draft.id, 'rejected')}
                    disabled={processingId === draft.id || draft.approval_status === 'rejected'}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision(draft.id, 'approved')}
                    disabled={processingId === draft.id || draft.approval_status === 'approved'}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Draft</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <DraftEditorModal
        draft={editingDraft}
        isOpen={Boolean(editingDraft)}
        onClose={() => setEditingDraft(null)}
        onSave={onUpdateDraft}
      />
    </div>
  );
};
