import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { CsvPreviewResponse, Lead } from '../../types';
import { api } from '../../api/client';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (leads: Lead[]) => void;
  onQualifySuccess?: (leadIds: string[]) => void;
}

type ModalStep = 'upload' | 'preview' | 'completed' | 'qualifying' | 'qualified';

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onQualifySuccess,
}) => {
  const [step, setStep] = useState<ModalStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<CsvPreviewResponse | null>(null);
  const [selectedRowNumbers, setSelectedRowNumbers] = useState<Set<number>>(new Set());
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [importResultLeads, setImportResultLeads] = useState<Lead[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isQualifyingSelected, setIsQualifyingSelected] = useState(false);
  const [qualifySummary, setQualifySummary] = useState<{ total: number; failed: number } | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setIsLoadingPreview(false);
    setPreviewData(null);
    setSelectedRowNumbers(new Set());
    setIsSubmittingImport(false);
    setImportResultLeads([]);
    setImportErrors([]);
    setIsQualifyingSelected(false);
    setQualifySummary(null);
    setGeneralError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    await processFile(droppedFile);
  };

  const processFile = async (chosenFile: File) => {
    if (!chosenFile.name.toLowerCase().endsWith('.csv')) {
      setGeneralError('Please select a valid CSV file (.csv).');
      return;
    }

    setFile(chosenFile);
    setGeneralError(null);
    setIsLoadingPreview(true);

    try {
      const preview = await api.previewCsvImport(chosenFile);
      setPreviewData(preview);
      // By default select all valid non-duplicate rows
      const validNumbers = new Set(
        preview.rows.filter(r => r.is_valid && !r.is_duplicate).map(r => r.row_number)
      );
      setSelectedRowNumbers(validNumbers);
      setStep('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse CSV file.';
      setGeneralError(msg);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleToggleRow = (rowNumber: number) => {
    const next = new Set(selectedRowNumbers);
    if (next.has(rowNumber)) {
      next.delete(rowNumber);
    } else {
      next.add(rowNumber);
    }
    setSelectedRowNumbers(next);
  };

  const handleToggleSelectAll = () => {
    if (!previewData) return;
    const validRows = previewData.rows.filter(r => r.is_valid && !r.is_duplicate);
    if (selectedRowNumbers.size === validRows.length) {
      setSelectedRowNumbers(new Set());
    } else {
      setSelectedRowNumbers(new Set(validRows.map(r => r.row_number)));
    }
  };

  const handleImportSelected = async () => {
    if (!previewData || selectedRowNumbers.size === 0) return;

    setIsSubmittingImport(true);
    setGeneralError(null);

    const leadsToImport = previewData.rows
      .filter(r => selectedRowNumbers.has(r.row_number))
      .map(r => ({
        company_name: r.company_name.trim().slice(0, 255),
        contact_name: r.contact_name.trim().slice(0, 255),
        email: r.email.trim(),
        website: r.website?.trim() ? r.website.trim().slice(0, 1000) : null,
        source: (r.source || 'csv_import').trim().slice(0, 500),
        raw_notes: r.raw_notes?.trim() ? r.raw_notes.trim().slice(0, 5000) : null,
      }));

    try {
      const res = await api.commitCsvImport(leadsToImport);
      setImportResultLeads(res.leads);
      setImportErrors(res.errors || []);
      onImportSuccess(res.leads);
      setStep('completed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import selected leads.';
      setGeneralError(msg);
    } finally {
      setIsSubmittingImport(false);
    }
  };

  const handleQualifyImportedLeads = async () => {
    if (importResultLeads.length === 0) return;

    setIsQualifyingSelected(true);
    setStep('qualifying');
    setGeneralError(null);

    const leadIds = importResultLeads.map(l => l.id);

    try {
      const res = await api.bulkQualifyLeads(leadIds);
      setQualifySummary({
        total: res.total_dispatched,
        failed: res.failed_count,
      });
      if (onQualifySuccess) {
        onQualifySuccess(leadIds);
      }
      setStep('qualified');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger bulk qualification.';
      setGeneralError(msg);
      setStep('completed');
    } finally {
      setIsQualifyingSelected(false);
    }
  };

  const validRowsCount = previewData?.rows.filter(r => r.is_valid && !r.is_duplicate).length || 0;
  const isAllValidSelected = validRowsCount > 0 && selectedRowNumbers.size === validRowsCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col glass-modal rounded-xl overflow-hidden text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">Import CSV</h2>
            <span className="px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Safeguards Active
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {generalError && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50 rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Standard CSV file up to 10MB
                  </p>
                </div>
              </div>

              {isLoadingPreview && (
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex items-center gap-3 text-xs text-blue-700">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Validating CSV structure and checking duplicate records...</span>
                </div>
              )}

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                <div className="font-semibold text-slate-800">Expected Column Headers</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono text-slate-700">
                  <div>• company_name</div>
                  <div>• contact_name</div>
                  <div>• email</div>
                  <div>• website (optional)</div>
                  <div>• source (optional)</div>
                  <div>• raw_notes (optional)</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview & Row Selection */}
          {step === 'preview' && previewData && (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>{file?.name}</span>
                </div>
                <span>{(file?.size ? (file.size / 1024).toFixed(1) : 0)} KB</span>
              </div>

              {/* Metrics Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Total Rows</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{previewData.total_rows}</div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-xs text-emerald-700 font-medium">Valid Rows</div>
                  <div className="text-xl font-bold text-emerald-800 mt-1">{previewData.valid_count}</div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-xs text-amber-700 font-medium">Duplicates</div>
                  <div className="text-xl font-bold text-amber-800 mt-1">{previewData.duplicate_count}</div>
                </div>

                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-xs text-red-700 font-medium">Errors</div>
                  <div className="text-xl font-bold text-red-800 mt-1">{previewData.error_count}</div>
                </div>
              </div>

              {/* Table of Preview Rows */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={isAllValidSelected}
                            onChange={handleToggleSelectAll}
                            disabled={validRowsCount === 0}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                          />
                        </th>
                        <th className="px-2 py-2 w-8 text-center">#</th>
                        <th className="px-3 py-2">Company</th>
                        <th className="px-3 py-2">Contact</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Validation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.rows.map(row => {
                        const isEligible = row.is_valid && !row.is_duplicate;
                        const isSelected = selectedRowNumbers.has(row.row_number);

                        return (
                          <tr
                            key={row.row_number}
                            className={`transition-colors ${
                              !isEligible
                                ? 'bg-slate-50/50 opacity-60'
                                : isSelected
                                ? 'bg-blue-50/40'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!isEligible}
                                onChange={() => handleToggleRow(row.row_number)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30"
                              />
                            </td>
                            <td className="px-2 py-2 text-center text-slate-400 font-mono text-[11px]">
                              {row.row_number}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {row.company_name || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.contact_name || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                              {row.email || '—'}
                            </td>
                            <td className="px-3 py-2">
                              {isEligible ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Ready to Import
                                </span>
                              ) : row.is_duplicate ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
                                  title={row.errors.join(', ')}
                                >
                                  Duplicate
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200"
                                  title={row.errors.join(', ')}
                                >
                                  {row.errors[0] || 'Error'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Completed / Staged */}
          {step === 'completed' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {importResultLeads.length} Leads Successfully Imported
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Leads have been normalized and saved to registry with status <code className="font-mono text-slate-700">new</code>.
                </p>
              </div>

              {importErrors.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-left text-xs text-amber-800 space-y-1">
                  <div className="font-semibold">Notice: Some rows were skipped</div>
                  {importErrors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Qualifying Progress */}
          {step === 'qualifying' && (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <h3 className="text-sm font-semibold text-slate-900">Dispatching Qualification Pipeline</h3>
              <p className="text-xs text-slate-500">
                Queuing workflow executions with self-hosted n8n engine...
              </p>
            </div>
          )}

          {/* Step 5: Qualified Summary */}
          {step === 'qualified' && qualifySummary && (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {qualifySummary.total} Qualification Workflows Dispatched
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Results will update in Leads Explorer and Review Queue as n8n completes evaluation.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/50">
          {step === 'preview' ? (
            <>
              <button
                type="button"
                onClick={resetState}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Choose Different File
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {selectedRowNumbers.size} of {validRowsCount} valid rows selected
                </span>
                <button
                  type="button"
                  onClick={handleImportSelected}
                  disabled={selectedRowNumbers.size === 0 || isSubmittingImport}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {isSubmittingImport ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <span>Import Selected ({selectedRowNumbers.size})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </>
          ) : step === 'completed' ? (
            <div className="w-full flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Close & View Leads
              </button>
              <button
                type="button"
                onClick={handleQualifyImportedLeads}
                disabled={isQualifyingSelected}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Qualify Selected ({importResultLeads.length})</span>
              </button>
            </div>
          ) : step === 'qualified' ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
