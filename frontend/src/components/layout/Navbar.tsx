import React from 'react';
import { Menu, X, ToggleLeft, ToggleRight } from 'lucide-react';

interface NavbarProps {
  isMockMode: boolean;
  onToggleMockMode: () => void;
  activeTab?: string;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isMockMode,
  onToggleMockMode,
  isMobileMenuOpen = false,
  onToggleMobileMenu,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-nav px-4 sm:px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <span className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
            Lead Operations Agent
          </span>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100/80 text-slate-600 border border-slate-200/80">
            Control Plane
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* System Health Indicators */}
        <div className="hidden lg:flex items-center gap-3.5 text-xs text-slate-600 border-r border-slate-200/80 pr-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Database</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>n8n Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span title="ENABLE_EXTERNAL_OUTREACH=false">Outreach Guard</span>
          </div>
        </div>

        {/* Environment / Fixture Mode Switcher */}
        <div className="flex items-center gap-2 pl-1 sm:pl-0">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-medium text-slate-800">
              {isMockMode ? 'Dev Fixture Mode' : 'Live API Connected'}
            </span>
            <span className="text-[10px] text-slate-500">
              {isMockMode ? 'Local Test Data' : 'FastAPI Backend'}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleMockMode}
            title={isMockMode ? 'Switch to Live API Mode' : 'Switch to Dev Fixture Mode'}
            className="p-1 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            aria-label="Toggle between Live API and Dev Fixture mode"
          >
            {isMockMode ? (
              <ToggleLeft className="w-6 h-6 text-amber-500" />
            ) : (
              <ToggleRight className="w-6 h-6 text-emerald-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
