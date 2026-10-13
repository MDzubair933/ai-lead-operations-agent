import React from 'react';
import {
  X,
  ExternalLink,
  Mail,
  User,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Play,
  Clock,
} from 'lucide-react';
import { Lead } from '../../types';
import { CategoryBadge, StatusBadge } from '../common/Badge';

interface LeadDetailModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onQualify: (leadId: string) => Promise<void>;
  isQualifying: boolean;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  isOpen,
  onClose,
  onQualify,
  isQualifying,
}) => {
  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto glass-modal rounded-xl p-6 text-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{lead.company_name}</h2>
              <StatusBadge status={lead.lead_status} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ingested {new Date(lead.created_at).toLocaleString()}
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

        {/* Content Body */}
        <div className="mt-5 space-y-5">
          {/* Primary Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-700">Contact:</span>
                <span>{lead.contact_name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-700">Email:</span>
                <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                  {lead.email}
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-700">Website:</span>
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline truncate max-w-xs"
                  >
                    {lead.website}
                  </a>
                ) : (
                  <span className="text-slate-400 italic">None provided</span>
                )}
              </div>
            </div>

            <div className="space-y-2.5 border-t md:border-t-0 md:border-l border-slate-200 pt-2.5 md:pt-0 md:pl-4">
              <div className="text-xs">
                <span className="font-medium text-slate-600">Source Channel:</span>{' '}
                <span className="text-slate-800 font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                  {lead.source}
                </span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-slate-600">Normalized Domain:</span>{' '}
                <span className="text-slate-800 font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                  {lead.normalized_identifiers.domain || 'N/A'}
                </span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-slate-600">Last Modified:</span>{' '}
                <span className="text-slate-500">{new Date(lead.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Raw notes */}
          {lead.raw_notes && (
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-800">Inbound Notes</span>
                <span className="text-[10px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  Raw Lead Notes
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded border border-slate-200 whitespace-pre-wrap">
                {lead.raw_notes}
              </p>
            </div>
          )}

          {/* AI Qualification Panel */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">AI Qualification Outcome</h3>
              </div>
              <div className="flex items-center gap-2">
                <CategoryBadge category={lead.qualification_category} />
                {lead.qualification_score !== null && lead.qualification_score !== undefined && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-mono">
                    <span>Score:</span>
                    <span>{lead.qualification_score}/100</span>
                  </div>
                )}
              </div>
            </div>

            {lead.qualification_reason ? (
              <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-900">Analysis Summary: </span>
                {lead.qualification_reason}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                This lead has not yet been processed by the n8n AI Qualification workflow.
              </p>
            )}

            {/* Evidence & Missing Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Evidence */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified Evidence ({lead.evidence.length})</span>
                </div>
                {lead.evidence.length > 0 ? (
                  <ul className="space-y-1.5 text-xs">
                    {lead.evidence.map((item, idx) => (
                      <li
                        key={idx}
                        className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] leading-tight"
                      >
                        ✓ {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">No structured evidence verified yet.</p>
                )}
              </div>

              {/* Missing Information */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Data Gaps ({lead.missing_information.length})</span>
                </div>
                {lead.missing_information.length > 0 ? (
                  <ul className="space-y-1.5 text-xs">
                    {lead.missing_information.map((item, idx) => (
                      <li
                        key={idx}
                        className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-tight"
                      >
                        ⚠ {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">No critical missing data identified.</p>
                )}
              </div>
            </div>

            {/* Recommended Next Action */}
            {lead.recommended_action && (
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Recommended Next Step:</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold uppercase tracking-wider text-[11px] border border-slate-200">
                  {lead.recommended_action}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>ID: {lead.id.slice(0, 8)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isQualifying && lead.lead_status !== 'qualifying') {
                  onQualify(lead.id);
                }
              }}
              disabled={isQualifying || lead.lead_status === 'qualifying'}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isQualifying || lead.lead_status === 'qualifying' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  <span>Qualifying...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Qualification</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
