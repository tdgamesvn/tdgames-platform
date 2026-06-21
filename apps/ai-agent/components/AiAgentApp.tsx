// apps/ai-agent/components/AiAgentApp.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppBackground from '@/components/AppBackground';
import { Navbar } from '@/components/Navbar';
import { AccountUser } from '@/types';
import {
  fetchAgent, fetchAllAgents, fetchAllInsights, fetchInsights, fetchRuns, fetchEpisodes,
  fetchAgentStats, fetchConversations, updateInsightStatus, triggerManualRun,
  AiAgent, AiInsight, AiRun, AiEpisode, AiConversation, AgentStats,
} from '../services/aiAgentService';
import { timeAgo, timeAgoShort, fmtDuration, AGENT_EMPTY_STATE } from '../utils';
import AgentSidebar from './AgentSidebar';
import FeedPanel from './FeedPanel';
import InsightsPanel from './InsightsPanel';
import RunsPanel from './RunsPanel';
import MemoryPanel from './MemoryPanel';
import ChatPanel from './ChatPanel';
import ConfigPanel from './ConfigPanel';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const POLL_INTERVAL = 30_000;

// Colored icon box for KPI cards
const KpiIcon: React.FC<{ emoji: string; color: string }> = ({ emoji, color }) => (
  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0"
    style={{ background: `${color}20` }}>
    <span>{emoji}</span>
  </div>
);

const AiAgentApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const [activeTab, setActiveTab]           = useState<string>(initialTab || 'insights');
  const [isFeedView, setIsFeedView]         = useState<boolean>(true);
  const [feedInsights, setFeedInsights]     = useState<AiInsight[]>([]);
  const [allAgents, setAllAgents]           = useState<AiAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('chro');
  const [agent, setAgent]                   = useState<AiAgent | null>(null);
  const [stats, setStats]                   = useState<AgentStats | null>(null);
  const [insights, setInsights]             = useState<AiInsight[]>([]);
  const [runs, setRuns]                     = useState<AiRun[]>([]);
  const [episodes, setEpisodes]             = useState<AiEpisode[]>([]);
  const [conversations, setConversations]   = useState<AiConversation[]>([]);
  const [loading, setLoading]               = useState(true);
  const [agentSwitching, setAgentSwitching] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [insightFilter, setInsightFilter]   = useState<'all' | 'new' | 'action_required'>('all');
  const [lastUpdatedAt, setLastUpdatedAt]   = useState<number>(Date.now());
  const [, setTick]                         = useState(0);
  const isFirstLoad                         = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      if (isFirstLoad.current) setLoading(true); else setAgentSwitching(true);
    }
    if (isFeedView) {
      const [agents, allIns] = await Promise.all([fetchAllAgents(), fetchAllInsights()]);
      setAllAgents(agents); setFeedInsights(allIns);
    } else {
      const [agents, ag, st, ins, rns, eps, convs] = await Promise.all([
        fetchAllAgents(), fetchAgent(selectedAgentId), fetchAgentStats(selectedAgentId),
        fetchInsights(selectedAgentId), fetchRuns(selectedAgentId),
        fetchEpisodes(selectedAgentId), fetchConversations(selectedAgentId),
      ]);
      setAllAgents(agents); setAgent(ag); setStats(st);
      setInsights(ins); setRuns(rns); setEpisodes(eps); setConversations(convs);
    }
    setLastUpdatedAt(Date.now());
    isFirstLoad.current = false;
    setLoading(false); setAgentSwitching(false);
  }, [selectedAgentId, isFeedView]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(() => { if (!document.hidden) load(true); }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const ticker = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const switchAgent = (id: string) => {
    setIsFeedView(false);
    setSelectedAgentId(id);
    setInsightFilter('all');
  };

  const switchToFeed = () => {
    setIsFeedView(true);
    setSelectedAgentId('');
  };

  const handleTrigger = async () => {
    setTriggerLoading(true);
    const res = await triggerManualRun(selectedAgentId);
    if (res.ok) {
      setToast({ msg: 'Agent đang chạy phân tích...', type: 'success' });
      setTimeout(load, 5000);
    } else {
      setToast({ msg: `Lỗi: ${res.error?.slice(0, 100)}`, type: 'error' });
    }
    setTriggerLoading(false);
  };

  const handleInsightAction = async (id: string, action: 'reviewed' | 'dismissed') => {
    const ok = await updateInsightStatus(id, action, currentUser.id);
    if (ok) {
      setInsights(prev => prev.map(i => i.id === id ? { ...i, status: action } : i));
      setFeedInsights(prev => prev.map(i => i.id === id ? { ...i, status: action } : i));
      setToast({ msg: action === 'reviewed' ? 'Đã đánh dấu xem xét' : 'Đã bỏ qua', type: 'success' });
    }
  };

  const filteredInsights = insights.filter(i => {
    if (insightFilter === 'all') return true;
    if (insightFilter === 'new') return i.status === 'new';
    if (insightFilter === 'action_required') return i.type === 'action_required';
    return true;
  });

  const hasNoData = runs.length === 0 && insights.length === 0 && episodes.length === 0;

  // KPI week delta
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const thisWeekRuns = runs.filter(r => now - new Date(r.created_at).getTime() < WEEK).length;
  const lastWeekRuns = runs.filter(r => { const age = now - new Date(r.created_at).getTime(); return age >= WEEK && age < 2 * WEEK; }).length;
  const runsDelta = lastWeekRuns > 0 ? Math.round(((thisWeekRuns - lastWeekRuns) / lastWeekRuns) * 100) : null;

  const tabs = { insights: 'Insights', runs: 'Lịch sử chạy', memory: 'Bộ nhớ', chat: 'Chat', config: 'Cài đặt' };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fadeInUp">
          <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
            toast.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}

      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab={activeTab}
        accessibleTabs={Object.keys(tabs)}
        onTabChange={setActiveTab}
        onLogout={onBack}
        onBack={onBack}
        appName="AI Agent"
        tabLabels={tabs}
      />

      {/* Mobile agent bar — horizontal scroll, hidden on lg+ */}
      {allAgents.length > 0 && (
        <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-white/8 overflow-x-auto shrink-0 relative z-10"
          style={{ background: 'rgba(255,255,255,0.01)' }}>
          {/* Feed pill — always first */}
          <button
            onClick={switchToFeed}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 transition-all"
            style={isFeedView
              ? { background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.3)' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            <span className="text-base">📋</span>
            <span className={`text-[11px] font-semibold whitespace-nowrap ${isFeedView ? 'text-white' : 'text-neutral-400'}`}>
              Feed
            </span>
          </button>
          {allAgents.map(a => {
            const isActive = !isFeedView && a.id === selectedAgentId;
            return (
              <button
                key={a.id}
                onClick={() => switchAgent(a.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 transition-all"
                style={isActive
                  ? { background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.3)' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                <span className="text-base">{a.avatar_emoji}</span>
                <span className={`text-[11px] font-semibold whitespace-nowrap ${isActive ? 'text-white' : 'text-neutral-400'}`}>
                  {a.name.replace('Agent ', '')}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2-column body */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* Left sidebar — hidden on mobile/tablet, shown on lg+ */}
        <AgentSidebar
          agents={allAgents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={switchAgent}
          isFeedView={isFeedView}
          onSelectFeed={switchToFeed}
        />

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-5">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : isFeedView ? (
            <FeedPanel
              insights={feedInsights}
              allAgents={allAgents}
              onAction={handleInsightAction}
            />
          ) : (
            <>
              {/* ═══ AgentHeader — Hero Card ═══ */}
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(255,149,0,0.07) 0%, rgba(255,255,255,0.02) 55%)', border: '1px solid rgba(255,149,0,0.18)' }}>
                {/* Orange top accent line */}
                <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #FF9500 0%, rgba(255,149,0,0.2) 60%, transparent 100%)' }} />
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar with glow */}
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.3)', boxShadow: '0 0 24px rgba(255,149,0,0.18)' }}>
                        {agent?.avatar_emoji || '🤖'}
                      </div>
                      {agent?.is_active && (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 animate-pulse"
                          style={{ borderColor: '#0F0F0F', boxShadow: '0 0 8px rgba(76,175,80,0.7)' }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-lg font-black text-white tracking-tight">{agent?.name || 'AI Agent'}</h1>
                        {agent?.is_active && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider"
                            style={{ background: 'rgba(76,175,80,0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.2)' }}>
                            ● Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-medium">
                        {agent?.role_title || 'AI Assistant'}
                        <span className="mx-1.5 text-white/20">•</span>
                        <span className="font-mono text-[11px] text-white/40">{agent?.model}</span>
                      </p>
                      {agent?.personality && (
                        <p className="text-[11px] text-neutral-600 mt-1 line-clamp-1 max-w-md leading-relaxed">{agent.personality}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-semibold text-neutral-700 hidden sm:block">
                      sync {timeAgoShort(lastUpdatedAt)}
                    </span>
                    <button
                      onClick={handleTrigger}
                      disabled={triggerLoading}
                      className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)', boxShadow: triggerLoading ? 'none' : '0 4px 16px rgba(255,149,0,0.35)' }}
                    >
                      {triggerLoading ? '⟳ Đang chạy...' : '▶ Chạy phân tích'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Agent switching spinner */}
              {agentSwitching ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="ml-3 text-xs text-neutral-medium">Đang tải dữ liệu agent...</span>
                </div>
              ) : (
                <>
                  {/* ═══ KPI Strip ═══ */}
                  {stats && !hasNoData && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {[
                        {
                          label: 'Tổng lần chạy', icon: '▶', iconColor: '#2196F3',
                          value: stats.totalRuns, sub: `${stats.completedRuns} thành công`,
                          delta: runsDelta !== null ? `${runsDelta >= 0 ? '↑' : '↓'}${Math.abs(runsDelta)}% so với tuần trước` : '—',
                          deltaPos: runsDelta !== null ? runsDelta >= 0 : null,
                        },
                        {
                          label: 'Insights tạo', icon: '💡', iconColor: '#FF9500',
                          value: stats.totalInsights, sub: undefined,
                          delta: '—', deltaPos: null,
                        },
                        {
                          label: 'Chưa xem', icon: '👁', iconColor: stats.newInsights > 0 ? '#F44336' : '#4CAF50',
                          value: stats.newInsights, sub: undefined,
                          delta: stats.newInsights > 0 ? 'Cần xem xét' : 'Không có mới',
                          deltaPos: stats.newInsights === 0,
                        },
                        {
                          label: 'Lần chạy cuối', icon: '🕐', iconColor: '#4CAF50',
                          value: stats.lastRunAt ? timeAgo(stats.lastRunAt) : '—',
                          sub: undefined, isText: true, delta: undefined, deltaPos: null,
                        },
                        {
                          label: 'TB thời gian', icon: '⚡', iconColor: '#AF52DE',
                          value: fmtDuration(stats.avgDurationMs),
                          sub: undefined, isText: true, delta: undefined, deltaPos: null,
                        },
                      ].map((kpi, i) => (
                        <div key={i} className="rounded-2xl border border-white/8 overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.025)' }}>
                          {/* Top color accent */}
                          <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${kpi.iconColor}, transparent)` }} />
                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{kpi.label}</p>
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0"
                                style={{ background: `${kpi.iconColor}18` }}>
                                <span>{kpi.icon}</span>
                              </div>
                            </div>
                            <p className={`${kpi.isText ? 'text-base' : 'text-[26px] leading-none'} font-black text-white`}>{kpi.value}</p>
                            {kpi.sub && <p className="text-[10px] text-neutral-600">{kpi.sub}</p>}
                            {kpi.delta !== undefined && (
                              <p className={`text-[10px] font-semibold ${kpi.deltaPos === true ? 'text-green-400' : kpi.deltaPos === false ? 'text-red-400' : 'text-neutral-600'}`}>
                                {kpi.delta}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ═══ Tab content ═══ */}
                  {activeTab === 'insights' && (
                    <InsightsPanel
                      key={selectedAgentId}
                      insights={filteredInsights}
                      filter={insightFilter}
                      onFilterChange={setInsightFilter}
                      onAction={handleInsightAction}
                      agentEmoji={agent?.avatar_emoji || AGENT_EMPTY_STATE[selectedAgentId]?.emoji || '🤖'}
                      agentName={agent?.name || 'Agent'}
                      onTrigger={handleTrigger}
                      triggerLoading={triggerLoading}
                      hasNoData={hasNoData}
                    />
                  )}
                  {activeTab === 'runs' && (
                    <RunsPanel
                      runs={runs}
                      agentEmoji={agent?.avatar_emoji || AGENT_EMPTY_STATE[selectedAgentId]?.emoji || '🤖'}
                      agentName={agent?.name || 'Agent'}
                      onTrigger={handleTrigger}
                      triggerLoading={triggerLoading}
                    />
                  )}
                  {activeTab === 'memory' && <MemoryPanel episodes={episodes} />}
                  {activeTab === 'chat' && (
                    <ChatPanel
                      conversations={conversations}
                      setConversations={setConversations}
                      agentId={selectedAgentId}
                      agentEmoji={agent?.avatar_emoji || AGENT_EMPTY_STATE[selectedAgentId]?.emoji || '🤖'}
                      agentName={agent?.name || 'Agent'}
                    />
                  )}
                  {activeTab === 'config' && agent && (
                    <ConfigPanel
                      agent={agent}
                      onSaved={(updated) => {
                        setAgent(updated);
                        setToast({ msg: 'Đã lưu cấu hình agent', type: 'success' });
                      }}
                      onError={() => setToast({ msg: 'Lưu thất bại, thử lại', type: 'error' })}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>

      </div>
    </div>
  );
};

export default AiAgentApp;
