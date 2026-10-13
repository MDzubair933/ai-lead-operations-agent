import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { OutreachDraft } from '../../types';

interface DraftEditorModalProps {
  draft: OutreachDraft | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (draftId: string, updatedContent: string) => Promise<void>;
}

export const DraftEditorModal: React.FC<DraftEditorModalProps> = ({
  draft,
  isOpen,
  onClose,
  onSave,
}) => {
  const [content, setContent] = useState(draft?.draft_content || '');
  const [prevDraftId, setPrevDraftId] = useState(draft?.id);
  const [isSaving, setIsSaving] = useState(false);

  if (draft && draft.id !== prevDraftId) {
    setPrevDraftId(draft.id);
    setContent(draft.draft_content);
  }

  if (!isOpen || !draft) return null;

  const isApproved = draft.approval_status === 'approved';

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(draft.id, content);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl glass-modal rounded-xl p-6 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Edit Outreach Draft (v{draft.version})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {draft.lead_company_name} · <span className="uppercase font-mono">{draft.channel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if previously approved */}
        {isApproved && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Editing an approved draft resets status to Pending Approval and increments version.</span>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <label className="font-medium">Message Body</label>
            <span className="text-slate-400 font-mono">{content.length} characters</span>
          </div>

          <textarea
            rows={10}
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white leading-relaxed"
            placeholder="Type outreach content..."
          />
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save & Re-queue</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
