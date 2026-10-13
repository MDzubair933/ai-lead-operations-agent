import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (leadData: {
    source: string;
    company_name: string;
    contact_name: string;
    email: string;
    website?: string;
    raw_notes?: string;
  }) => Promise<void>;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    source: 'website_inbound',
    company_name: '',
    contact_name: '',
    email: '',
    website: '',
    raw_notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.company_name.trim()) {
      setError('Company name is required');
      return;
    }
    if (!formData.contact_name.trim()) {
      setError('Contact name is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      setError('A valid business email address is required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        source: formData.source,
        company_name: formData.company_name.trim(),
        contact_name: formData.contact_name.trim(),
        email: formData.email.trim().toLowerCase(),
        website: formData.website.trim() || undefined,
        raw_notes: formData.raw_notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg glass-modal rounded-xl p-6 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">Intake New Lead</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Source</label>
              <select
                value={formData.source}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
                className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              >
                <option value="website_inbound">Website Inbound</option>
                <option value="partner_referral">Partner Referral</option>
                <option value="conference_lead">Conference Lead</option>
                <option value="csv_import">CSV Import</option>
                <option value="manual_intake">Manual Intake</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                placeholder="Acme Corp"
                value={formData.company_name}
                onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact Name *</label>
              <input
                type="text"
                required
                placeholder="Jane Doe"
                value={formData.contact_name}
                onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Work Email *</label>
              <input
                type="email"
                required
                placeholder="jane@acme.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Website URL</label>
            <input
              type="url"
              placeholder="https://acme.com"
              value={formData.website}
              onChange={e => setFormData({ ...formData, website: e.target.value })}
              className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Inbound Notes / Request</label>
            <textarea
              rows={3}
              placeholder="Details about client needs, company size, timeline..."
              value={formData.raw_notes}
              onChange={e => setFormData({ ...formData, raw_notes: e.target.value })}
              className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors leading-relaxed"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Lead</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
