import React from 'react';
import {
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Server,
  Radio,
  Lock,
} from 'lucide-react';
import { IntegrationHealth, SystemConfigStatus } from '../../types';

interface SystemHealthProps {
  health: IntegrationHealth[];
  config: SystemConfigStatus | null;
  isLoading: boolean;
}

export const SystemHealth: React.FC<SystemHealthProps> = ({
  health,
  config,
  isLoading,
}) => {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Settings & Health
          </h1>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200 text-slate-700 text-xs font-medium self-start sm:self-auto">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Zero-Secret Architecture</span>
        </div>
      </div>

      {/* Integration Health Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-slate-600" />
          <span>Integration Health</span>
        </h2>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 glass-card rounded-xl text-xs">
            Checking service health...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {health.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl glass-card space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">{item.service}</span>
                  <div className="flex items-center gap-1.5">
                    {item.status === 'operational' ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Operational
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 border border-red-200 text-red-700 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        Degraded
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 font-mono leading-relaxed bg-slate-50/80 p-2.5 rounded border border-slate-200">
                  {item.message}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Latency: {item.latency_ms ?? 0}ms</span>
                  <span>Checked: {new Date(item.last_checked).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Non-secret Configuration Properties */}
      {config && (
        <div className="glass-card rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-slate-600" />
            <span>Operational Configuration</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-xs divide-y md:divide-y-0 divide-slate-100">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Environment Runtime:</span>
              <span className="font-mono text-slate-800 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {config.app_env}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">API Contract Version:</span>
              <span className="font-mono text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {config.api_version}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Database Driver:</span>
              <span className="font-mono text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {config.database_type}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">n8n Host Origin:</span>
              <span className="font-mono text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[200px]" title={config.n8n_base_url}>
                {config.n8n_base_url}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Qualification Webhook:</span>
              <span className="font-mono text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[200px]" title={config.n8n_qualification_webhook}>
                {config.n8n_qualification_webhook}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">External Outreach Gate:</span>
              <span className="font-semibold text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                LOCKED (SAFETY DEFAULT)
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Sensitive Log Redaction:</span>
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Active
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Rate Limiter / Token Bucket:</span>
              <span className="text-slate-700 font-medium">
                Enforced
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
