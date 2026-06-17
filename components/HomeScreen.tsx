import React, { useState, useEffect } from 'react';
import { AccountUser } from '@/types';
import { APPS, AppConfig } from '@/config/apps';
import { fetchTotalNewInsights } from '@/apps/ai-agent/services/aiAgentService';

interface HomeScreenProps {
  currentUser: AccountUser;
  onSelectApp: (appId: string) => void;
  onLogout: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ currentUser, onSelectApp, onLogout }) => {
  const [hoveredApp, setHoveredApp] = useState<string | null>(null);
  const [agentBadge, setAgentBadge] = useState<number>(0);

  useEffect(() => {
    if (currentUser.role === 'admin') {
      fetchTotalNewInsights().then(setAgentBadge);
    }
  }, [currentUser.role]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      {/* Background glow blobs – matching login screen */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full blur-[120px] opacity-20" style={{ width: '700px', height: '700px', background: 'radial-gradient(circle, #FF9500 0%, transparent 70%)', top: '-250px', left: '-200px' }} />
        <div className="absolute rounded-full blur-[100px] opacity-10" style={{ width: '500px', height: '500px', background: 'radial-gradient(circle, #FF6B00 0%, transparent 70%)', bottom: '-150px', right: '-150px' }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(#FF9500 1px, transparent 1px), linear-gradient(90deg, #FF9500 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      {/* Top bar */}
      <header className="relative z-10 h-16 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <img src="https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/logo_td.png" alt="Logo" className="w-8 h-8 object-contain" />
          <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">TD GAMES Platform</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end leading-none">
            <span className="text-[11px] font-black uppercase tracking-widest text-white">{currentUser.username}</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-0.5 ${currentUser.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-400'}`}>{currentUser.role}</span>
          </div>
          <button onClick={onLogout} title="Logout" className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all hover:scale-110">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-24">
        {/* Greeting */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
            TD Games
          </h1>
          <p className="text-white/30 text-sm font-bold uppercase tracking-[0.3em]">
            Enterprise Management Platform
          </p>
        </div>

        {/* App Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-3xl w-full">
          {APPS.filter(app => !app.roles || app.roles.includes(currentUser.role)).map((app) => (
            <AppCard
              key={app.id}
              app={app}
              isHovered={hoveredApp === app.id}
              onHover={setHoveredApp}
              onClick={() => onSelectApp(app.id)}
              badgeCount={app.id === 'ai-agent' ? agentBadge : 0}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center">
        <p className="text-white/10 text-[9px] font-black uppercase tracking-[0.5em]">
          TD Games • Enterprise Platform • v3.0
        </p>
      </footer>
    </div>
  );
};

// ── App Card Component ────────────────────────────────────────
interface AppCardProps {
  app: AppConfig;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
  badgeCount?: number;
}

const AppCard: React.FC<AppCardProps> = ({ app, isHovered, onHover, onClick, badgeCount = 0 }) => (
  <button
    onClick={onClick}
    onMouseEnter={() => onHover(app.id)}
    onMouseLeave={() => onHover(null)}
    className="group flex flex-col items-center gap-4 p-8 rounded-[28px] border transition-all duration-300 hover:scale-[1.04] active:scale-[0.98] cursor-pointer"
    style={{
      backgroundColor: isHovered ? `${app.color}08` : 'rgba(255,255,255,0.02)',
      borderColor: isHovered ? `${app.color}30` : 'rgba(255,255,255,0.04)',
      boxShadow: isHovered ? `0 20px 60px ${app.color}15, 0 0 0 1px ${app.color}10` : 'none',
    }}
  >
    {/* Icon + badge wrapper */}
    <div className="relative">
      <div
        className="w-20 h-20 rounded-[22px] flex items-center justify-center text-4xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
        style={{
          background: app.gradient,
          boxShadow: isHovered ? `0 12px 32px ${app.color}40` : `0 4px 12px ${app.color}20`,
        }}
      >
        {app.icon}
      </div>
      {/* Notification badge */}
      {badgeCount > 0 && (
        <div
          className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-black text-white"
          style={{ background: '#F44336', boxShadow: '0 2px 8px rgba(244,67,54,0.5)' }}
        >
          {badgeCount > 9 ? '9+' : badgeCount}
        </div>
      )}
    </div>

    {/* Name */}
    <div className="text-center">
      <h3 className="text-white text-sm font-black uppercase tracking-wider mb-1">
        {app.name}
      </h3>
      <p className="text-white/30 text-[10px] font-bold leading-relaxed">
        {app.description}
      </p>
    </div>
  </button>
);

export default HomeScreen;
