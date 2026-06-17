// apps/ai-agent/components/AgentSidebar.tsx
import React, { useState } from 'react';
import { AiAgent } from '../services/aiAgentService';

const SIDEBAR_KEY = 'ai-agent-sidebar-collapsed';

interface AgentSidebarProps {
  agents: AiAgent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
}

const AgentSidebar: React.FC<AgentSidebarProps> = ({ agents, selectedAgentId, onSelectAgent }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* ignore */ }
  };

  return (
    <aside
      className="flex flex-col shrink-0 border-r border-white/8 transition-all duration-200 overflow-hidden"
      style={{ width: collapsed ? 60 : 168, background: 'rgba(255,255,255,0.01)' }}
    >
      {/* Logo area */}
      <div className={`p-3 border-b border-white/5 flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)' }}
        >
          🤖
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 leading-tight">TD GAMES</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white leading-tight">AI AGENT</p>
          </div>
        )}
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {agents.map(a => {
          const isActive = a.id === selectedAgentId;
          return (
            <button
              key={a.id}
              onClick={() => onSelectAgent(a.id)}
              title={collapsed ? a.name : undefined}
              className={`w-full flex items-center transition-all rounded-xl ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'}`}
              style={isActive
                ? { background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }
                : { background: 'transparent', border: '1px solid transparent' }
              }
            >
              <span className="text-xl shrink-0">{a.avatar_emoji}</span>
              {!collapsed && (
                <>
                  <span className={`text-xs font-semibold truncate flex-1 text-left ${isActive ? 'text-white' : 'text-neutral-400'}`}>
                    {a.name.replace('Agent ', '')}
                  </span>
                  {!a.is_active && (
                    <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600 shrink-0">OFF</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Plan info (expanded only) */}
      {!collapsed && (
        <div className="p-3 border-t border-white/5">
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,149,0,0.03)', border: '1px solid rgba(255,149,0,0.08)' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">👑</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-primary">Enterprise Plan</span>
            </div>
            <p className="text-[9px] text-neutral-600">Hiệu lực đến 12/08/2026</p>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full bg-primary" style={{ width: '78%' }} />
            </div>
            <button
              className="w-full px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all"
              style={{ background: '#FF9500' }}
            >
              Nâng cấp gói
            </button>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="py-3 border-t border-white/5 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-600 hover:text-white transition-all"
      >
        {collapsed ? '▶' : <><span>◀</span><span>Thu gọn</span></>}
      </button>
    </aside>
  );
};

export default AgentSidebar;
