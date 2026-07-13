import React from 'react';
import { AccountUser } from '@/types';
import { hasRole, hasAnyRole, getUserRoles } from '@/utils/roleUtils';
import { ExchangeRateData } from '@/services/exchangeRateService';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  theme: string;
  currentUser: AccountUser;
  activeTab: string;
  accessibleTabs: Array<'edit' | 'preview' | 'history' | 'dashboard' | 'activity' | 'recurring' | 'tasks' | 'overview' | 'settings' | 'board' | string>;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  vcbRate?: ExchangeRateData | null;
  vcbRateLoading?: boolean;
  onBack?: () => void;
  appName?: string;
  tabLabels?: Record<string, string>;
  onHelp?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ theme, currentUser, activeTab, accessibleTabs, onTabChange, onLogout, vcbRate, vcbRateLoading, onBack, appName, tabLabels, onHelp }) => {
  return (
  <nav className={`sticky top-0 backdrop-blur-md border-b z-50 transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0F0F0F]/95 border-primary/10' : 'bg-white/95 border-gray-200 shadow-sm'}`}>
    {/* Row 1: Logo + controls */}
    <div className="h-14 md:h-20 flex items-center justify-between px-3 md:px-12">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} title="Back to Home" className={`p-2 -ml-2 mr-1 rounded-xl transition-all hover:scale-110 ${theme === 'dark' ? 'text-neutral-medium hover:text-primary hover:bg-primary/10' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        <img src="https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/logo_td.png" alt="Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
        <div className="hidden md:flex flex-col">
          <span className={`text-lg font-bold uppercase tracking-widest leading-none ${theme === 'dark' ? 'text-white' : 'text-black'}`}>TD Games {appName || 'Platform'}</span>
        </div>

        {/* VCB USD/VND Exchange Rate — desktop only */}
        {(vcbRate !== undefined || vcbRateLoading) && (
          <div className={`hidden md:flex items-center gap-2.5 ml-3 px-4 py-1.5 rounded-xl border ${theme === 'dark' ? 'bg-surface/60 border-primary/15' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-1">
              <span className="text-primary text-sm font-black">USD</span>
              <span className={`text-[10px] ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>→</span>
              <span className={`text-sm font-black ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>VND</span>
            </div>
            <div className={`w-px h-6 ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />
            {vcbRateLoading ? (
              <span className="animate-pulse text-xs text-neutral-medium">loading...</span>
            ) : vcbRate ? (
              <div className="flex flex-col items-end leading-none gap-0.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-cyan-400/70' : 'text-cyan-600'}`}>Mua</span>
                  <span className={`text-xs font-black tabular-nums ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
                    {vcbRate.buy.toLocaleString('vi-VN')}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>Bán</span>
                  <span className={`text-xs font-black tabular-nums ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {vcbRate.sell.toLocaleString('vi-VN')}
                  </span>
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>
                  {vcbRate.source || 'TCB'} • {(() => {
                    try {
                      const d = new Date(vcbRate.updated_at);
                      if (isNaN(d.getTime())) return vcbRate.updated_at;
                      return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
                    } catch { return vcbRate.updated_at; }
                  })()}
                </span>
              </div>
            ) : (
              <span className="text-neutral-medium text-xs">—</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Tabs — desktop: inline with controls */}
        <div className={`hidden md:flex gap-1 p-1 rounded-full border overflow-x-auto scrollbar-hide ${theme === 'dark' ? 'bg-surface border-white/5' : 'bg-gray-100 border-gray-200'}`}>
          {accessibleTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex-shrink-0 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-primary text-black shadow-btn-glow' : theme === 'dark' ? 'text-neutral-medium hover:text-white' : 'text-gray-500 hover:text-black'}`}
            >
               {tabLabels?.[tab] || tab}
            </button>
          ))}
        </div>

        {/* Help button */}
        {onHelp && (
          <button
            onClick={onHelp}
            title="Hướng dẫn sử dụng"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
              theme === 'dark'
                ? 'text-neutral-medium hover:text-white border-white/10 hover:border-white/25 hover:bg-white/5'
                : 'text-gray-400 hover:text-black border-gray-200 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <span>?</span>
            <span className="hidden lg:inline">Trợ giúp</span>
          </button>
        )}

        {/* Notification Bell */}
        <NotificationBell userId={currentUser.id} theme={theme} />

        {/* Workspace Switcher */}
        {hasAnyRole(currentUser, ['admin', 'ke_toan', 'hr']) && (
          <WorkspaceSwitcher variant="compact" theme={theme} />
        )}

        {/* User info + Logout */}
        <div className="flex items-center gap-2 ml-2">
          <div className={`hidden md:flex flex-col items-end leading-none`}>
            <span className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{currentUser.username}</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-0.5 ${hasRole(currentUser, 'admin')
              ? 'bg-primary/20 text-primary'
              : 'bg-blue-500/20 text-blue-400'
              }`}>{getUserRoles(currentUser).join(' + ')}</span>
          </div>
          <button
            onClick={onLogout}
            title="Logout"
            className={`p-2 rounded-xl transition-all hover:scale-110 ${theme === 'dark'
              ? 'text-neutral-medium hover:text-status-error hover:bg-status-error/10'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    {/* Row 2: Tabs — mobile only, full width scrollable */}
    <div className={`md:hidden overflow-x-auto scrollbar-hide border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
      <div className="flex gap-0.5 px-3 py-1.5 min-w-min">
        {accessibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab ? 'bg-primary text-black' : theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}
          >
            {tabLabels?.[tab] || tab}
          </button>
        ))}
      </div>
    </div>
  </nav>
  );
};
