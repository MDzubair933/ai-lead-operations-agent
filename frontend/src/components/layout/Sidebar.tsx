import React from 'react';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  PlayCircle,
  Settings,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingApprovalsCount: number;
  failedRunsCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  pendingApprovalsCount,
  failedRunsCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'leads',
      label: 'Leads Explorer',
      icon: Users,
    },
    {
      id: 'approvals',
      label: 'Review Queue',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
      badgeVariant: 'warning',
    },
    {
      id: 'runs',
      label: 'Execution Runs',
      icon: PlayCircle,
      badge: failedRunsCount > 0 ? failedRunsCount : null,
      badgeVariant: 'danger',
    },
    {
      id: 'settings',
      label: 'Settings & Health',
      icon: Settings,
    },
  ];

  const handleItemClick = (id: string) => {
    onTabChange(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-4">
        <div>
          <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Operations
          </p>
          <nav className="mt-2 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm transition-all text-left ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        item.badgeVariant === 'danger'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Safety Notice Footer */}
      <div className="border-t border-slate-200/80 pt-3 text-[11px] text-slate-500 flex items-center gap-2 px-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="truncate">Outreach Guard Active</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar with Frosted Glass */}
      <aside className="hidden md:flex w-60 glass-sidebar flex-col justify-between shrink-0 p-3">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-64 max-w-[80vw] glass-modal p-4 flex flex-col z-10 shadow-2xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
