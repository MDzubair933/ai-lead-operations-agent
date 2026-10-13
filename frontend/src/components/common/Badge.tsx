import React from 'react';
import { QualificationCategory, LeadStatus, RunStatus, ApprovalStatus } from '../../types';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  dot = false,
}) => {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    purple: 'bg-purple-500',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 rounded-md font-medium border',
    md: 'text-xs px-2.5 py-1 rounded-md font-medium border',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`}></span>}
      {children}
    </span>
  );
};

export const CategoryBadge: React.FC<{ category?: QualificationCategory | null }> = ({ category }) => {
  if (!category) {
    return <Badge variant="default">Unrated</Badge>;
  }

  const map = {
    high: { variant: 'success' as const, label: 'High Priority', dot: true },
    medium: { variant: 'info' as const, label: 'Medium Fit', dot: true },
    low: { variant: 'default' as const, label: 'Low Fit', dot: false },
    insufficient_data: { variant: 'warning' as const, label: 'Needs Data', dot: true },
  };

  const config = map[category] || { variant: 'default' as const, label: category, dot: false };

  return <Badge variant={config.variant} dot={config.dot}>{config.label}</Badge>;
};

export const StatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => {
  const map: Record<LeadStatus, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; label: string; dot: boolean }> = {
    new: { variant: 'default', label: 'New', dot: false },
    qualifying: { variant: 'purple', label: 'Qualifying', dot: true },
    qualified: { variant: 'success', label: 'Qualified', dot: true },
    disqualified: { variant: 'default', label: 'Disqualified', dot: false },
    review_ready: { variant: 'info', label: 'Review Ready', dot: true },
    archived: { variant: 'default', label: 'Archived', dot: false },
  };

  const config = map[status] || { variant: 'default', label: status, dot: false };

  return <Badge variant={config.variant} dot={config.dot}>{config.label}</Badge>;
};

export const RunStatusBadge: React.FC<{ status: RunStatus }> = ({ status }) => {
  const map: Record<RunStatus, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string; dot: boolean }> = {
    pending: { variant: 'default', label: 'Queued', dot: false },
    running: { variant: 'info', label: 'Running', dot: true },
    completed: { variant: 'success', label: 'Completed', dot: true },
    failed: { variant: 'danger', label: 'Failed', dot: true },
    timed_out: { variant: 'warning', label: 'Timed Out', dot: true },
  };

  const config = map[status] || { variant: 'default', label: status, dot: false };

  return <Badge variant={config.variant} dot={config.dot}>{config.label}</Badge>;
};

export const ApprovalBadge: React.FC<{ status: ApprovalStatus }> = ({ status }) => {
  const map: Record<ApprovalStatus, { variant: 'default' | 'success' | 'warning' | 'danger'; label: string; dot: boolean }> = {
    draft: { variant: 'default', label: 'Draft', dot: false },
    pending_approval: { variant: 'warning', label: 'Pending Approval', dot: true },
    approved: { variant: 'success', label: 'Approved', dot: true },
    rejected: { variant: 'danger', label: 'Rejected', dot: false },
  };

  const config = map[status] || { variant: 'default', label: status, dot: false };

  return <Badge variant={config.variant} dot={config.dot}>{config.label}</Badge>;
};
