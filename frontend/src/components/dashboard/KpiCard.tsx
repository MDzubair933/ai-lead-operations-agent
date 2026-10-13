import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
  trend?: {
    label: string;
    positive?: boolean;
  };
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'blue',
  trend,
}) => {
  const iconColors = {
    blue: 'text-blue-600 bg-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    rose: 'text-red-600 bg-red-50',
    purple: 'text-purple-600 bg-purple-50',
  };

  return (
    <div className="glass-card rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-slate-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        <div className={`p-2 rounded-lg ${iconColors[variant]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold text-slate-900 tracking-tight">
          {value !== null && value !== undefined ? value : '—'}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
          {subtext && <span>{subtext}</span>}
          {trend && (
            <span
              className={`font-medium ${
                trend.positive ? 'text-emerald-600' : 'text-slate-500'
              }`}
            >
              {trend.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
