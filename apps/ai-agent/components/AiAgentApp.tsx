import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppBackground from '@/components/AppBackground';
import { Navbar } from '@/components/Navbar';
import { AccountUser } from '@/types';
import {
  fetchAgent, fetchAllAgents, fetchInsights, fetchRuns, fetchEpisodes, fetchAgentStats,
  fetchConversations, sendChatMessage,
  updateInsightStatus, triggerManualRun, updateAgent,
  AiAgent, AiInsight, AiRun, AiEpisode, AiConversation, AgentStats,
} from '../services/aiAgentService';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────
const POLL_INTERVAL = 30_000; // 30 seconds

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
};

const timeAgoShort = (ts: number) => {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return 'vừa xong';
  if (secs < 60) return `${secs}s trước`;
  const mins = Math.floor(secs / 60);
  return `${mins}m trước`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const fmtDuration = (ms: number | null) => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const TYPE_CONFIG = {
  info: { label: 'Info', color: '#2196F3', icon: 'ℹ️' },
  warning: { label: 'Cảnh báo', color: '#FFA726', icon: '⚠️' },
  action_required: { label: 'Cần xử lý', color: '#F44336', icon: '🔴' },
} as const;

const STATUS_CONFIG = {
  new: { label: 'Mới', color: '#FF9500' },
  reviewed: { label: 'Đã xem', color: '#4CAF50' },
  dismissed: { label: 'Bỏ qua', color: '#9D9C9D' },
} as const;

const RUN_STATUS = {
  running: { label: 'Đang chạy', color: '#2196F3' },
  completed: { label: 'Hoàn thành', color: '#4CAF50' },
  failed: { label: 'Lỗi', color: '#F44336' },
} as const;

// Agent empty state prompts
const AGENT_EMPTY_STATE: Record<string, { emoji: string; prompt: string }> = {
  cfo: { emoji: '💰', prompt: 'Chạy phân tích để nhận insights về tài chính doanh nghiệp' },
  ceo: { emoji: '👔', prompt: 'Chạy phân tích để nhận insights tổng quan điều hành' },
  cto: { emoji: '⚙️', prompt: 'Chạy phân tích để nhận insights về hạ tầng kỹ thuật' },
  chro: { emoji: '👥', prompt: 'Chạy phân tích để nhận insights về nhân sự' },
};

// ═══════════════════════════════════════════════════════════════
// ── Main App ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const AiAgentApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'insights');
  const [allAgents, setAllAgents] = useState<AiAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('chro');
  const [agent, setAgent] = useState<AiAgent | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [runs, setRuns] = useState<AiRun[]>([]);
  const [episodes, setEpisodes] = useState<AiEpisode[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentSwitching, setAgentSwitching] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [insightFilter, setInsightFilter] = useState<'all' | 'new' | 'action_required'>('all');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
  const [, setTick] = useState(0); // force re-render for "last updated" text
  const isFirstLoad = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      if (isFirstLoad.current) {
        setLoading(true);
      } else {
        setAgentSwitching(true);
      }
    }
    const [agents, ag, st, ins, rns, eps, convs] = await Promise.all([
      fetchAllAgents(), fetchAgent(selectedAgentId), fetchAgentStats(selectedAgentId),
      fetchInsights(selectedAgentId), fetchRuns(selectedAgentId), fetchEpisodes(selectedAgentId),
      fetchConversations(selectedAgentId),
    ]);
    setAllAgents(agents);
    setAgent(ag);
    setStats(st);
    setInsights(ins);
    setRuns(rns);
    setEpisodes(eps);
    setConversations(convs);
    setLastUpdatedAt(Date.now());
    isFirstLoad.current = false;
    setLoading(false);
    setAgentSwitching(false);
  }, [selectedAgentId]);

  useEffect(() => { load(); }, [load]);

  // ── Auto-refresh polling (30s, only when tab visible) ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        load(true); // silent refresh
      }
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  // ── Tick timer to update "last updated X ago" text ──
  useEffect(() => {
    const ticker = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(ticker);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const switchAgent = (id: string) => {
    setSelectedAgentId(id);
    setInsightFilter('all');
  };

  const handleTrigger = async () => {
    setTriggerLoading(true);
    const res = await triggerManualRun(selectedAgentId);
    if (res.ok) {
      setToast({ msg: 'Agent đang chạy phân tích...', type: 'success' });
      // Reload after a delay to show results
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
      setToast({ msg: action === 'reviewed' ? 'Đã đánh dấu xem xét' : 'Đã bỏ qua', type: 'success' });
    }
  };

  const filteredInsights = insights.filter(i => {
    if (insightFilter === 'all') return true;
    if (insightFilter === 'new') return i.status === 'new';
    if (insightFilter === 'action_required') return i.type === 'action_required';
    return true;
  });

  // Check if this agent has no data at all (empty state)
  const hasNoData = runs.length === 0 && insights.length === 0 && episodes.length === 0;

  const tabs = {
    insights: 'Insights',
    runs: 'Lịch sử chạy',
    memory: 'Bộ nhớ',
    chat: 'Chat',
    config: 'Cài đặt',
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fadeInUp">
          <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
            toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
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

      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full relative z-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ═══ Agent Selector ═══ */}
            {allAgents.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {allAgents.map(a => (
                  <button
                    key={a.id}
                    onClick={() => switchAgent(a.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
                      selectedAgentId === a.id
                        ? 'text-white border border-primary/40'
                        : 'text-neutral-400 border border-white/8 hover:text-white hover:border-white/20'
                    }`}
                    style={selectedAgentId === a.id ? { background: 'rgba(255,149,0,0.1)' } : { background: 'rgba(255,255,255,0.02)' }}
                  >
                    <span className="text-base">{a.avatar_emoji}</span>
                    <span>{a.name.replace('Agent ', '')}</span>
                    {!a.is_active && <span className="text-[8px] text-neutral-600 ml-1">OFF</span>}
                  </button>
                ))}
              </div>
            )}

            {/* ═══ Header + Agent Profile ═══ */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)' }}>
                  {agent?.avatar_emoji || '🤖'}
                </div>
                <div>
                  <h1 className="text-lg font-black text-white">{agent?.name || 'AI Agent'}</h1>
                  <p className="text-xs text-neutral-medium">
                    {agent?.role_title || 'AI Assistant'} • Model: <span className="text-white/60 font-mono">{agent?.model}</span>
                    <span className="text-neutral-700 ml-3">• cập nhật {timeAgoShort(lastUpdatedAt)}</span>
                  </p>
                </div>
                {agent?.is_active && (
                  <span className="ml-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">Active</span>
                  </span>
                )}
              </div>
              <button
                onClick={handleTrigger}
                disabled={triggerLoading}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                style={{ background: '#FF9500' }}
              >
                {triggerLoading ? 'Đang chạy...' : '▶ Chạy phân tích ngay'}
              </button>
            </div>

            {/* ═══ Agent switching spinner ═══ */}
            {agentSwitching && (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="ml-3 text-xs text-neutral-medium">Đang tải dữ liệu agent...</span>
              </div>
            )}

            {/* ═══ Empty state for agent with no data ═══ */}
            {!agentSwitching && hasNoData ? (
              <div className="text-center py-16 text-neutral-700 text-sm">
                <p className="text-3xl mb-3">
                  {agent?.avatar_emoji || AGENT_EMPTY_STATE[selectedAgentId]?.emoji || '🤖'}
                </p>
                <p className="text-neutral-600 text-sm">
                  {agent?.name || 'Agent'} chưa có dữ liệu
                </p>
                <p className="text-xs mt-1 text-neutral-700">
                  {AGENT_EMPTY_STATE[selectedAgentId]?.prompt || 'Chạy phân tích để bắt đầu nhận insights'}
                </p>
                <button
                  onClick={handleTrigger}
                  disabled={triggerLoading}
                  className="mt-5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                  style={{ background: '#FF9500' }}
                >
                  {triggerLoading ? 'Đang chạy...' : '▶ Chạy phân tích ngay'}
                </button>
              </div>
            ) : !agentSwitching && (
              <>
                {/* ═══ KPI Strip ═══ */}
                {stats && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: 'Tổng lần chạy', value: stats.totalRuns, sub: `${stats.completedRuns} thành công` },
                      { label: 'Insights tạo', value: stats.totalInsights },
                      { label: 'Chưa xem', value: stats.newInsights, highlight: stats.newInsights > 0 },
                      { label: 'Lần chạy cuối', value: stats.lastRunAt ? timeAgo(stats.lastRunAt) : '—', small: true },
                      { label: 'TB thời gian', value: fmtDuration(stats.avgDurationMs), small: true },
                    ].map((kpi, i) => (
                      <div key={i} className="rounded-2xl border border-white/8 p-4 space-y-1"
                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{kpi.label}</p>
                        <p className={`${kpi.small ? 'text-sm' : 'text-2xl'} font-black ${kpi.highlight ? 'text-primary' : 'text-white'}`}>
                          {kpi.value}
                        </p>
                        {kpi.sub && <p className="text-[10px] text-neutral-600">{kpi.sub}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* ═══ Tab Content ═══ */}
                {activeTab === 'insights' && (
                  <InsightsPanel
                    insights={filteredInsights}
                    filter={insightFilter}
                    onFilterChange={setInsightFilter}
                    onAction={handleInsightAction}
                    agentEmoji={agent?.avatar_emoji || AGENT_EMPTY_STATE[selectedAgentId]?.emoji || '🤖'}
                    agentName={agent?.name || 'Agent'}
                  />
                )}

                {activeTab === 'runs' && (
                  <RunsPanel
                    runs={runs}
                    agentEmoji={agent?.avatar_emoji || AGENT_EMPTY_STATE[selectedAgentId]?.emoji || '🤖'}
                    agentName={agent?.name || 'Agent'}
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
          </div>
        )}
      </main>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ── Insights Panel ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const BODY_TRUNCATE = 150;

const InsightsPanel: React.FC<{
  insights: AiInsight[];
  filter: string;
  onFilterChange: (f: 'all' | 'new' | 'action_required') => void;
  onAction: (id: string, action: 'reviewed' | 'dismissed') => void;
  agentEmoji: string;
  agentName: string;
}> = ({ insights, filter, onFilterChange, onAction, agentEmoji, agentName }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {[
          { key: 'all' as const, label: 'Tất cả' },
          { key: 'new' as const, label: 'Chưa xem' },
          { key: 'action_required' as const, label: 'Cần xử lý' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              filter === f.key
                ? 'text-white bg-primary/20 border border-primary/30'
                : 'text-neutral-400 border border-white/10 hover:text-white hover:border-white/20'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Insight list */}
      {insights.length === 0 ? (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">{agentEmoji}</p>
          <p className="text-neutral-600 text-sm">{agentName} chưa có insight nào</p>
          <p className="text-xs mt-1 text-neutral-700">Chạy agent để phân tích dữ liệu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map(insight => {
            const typeConf   = TYPE_CONFIG[insight.type   as keyof typeof TYPE_CONFIG]   ?? TYPE_CONFIG.info;
            const statusConf = STATUS_CONFIG[insight.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
            const isExpanded = expandedId === insight.id;
            const bodyIsLong = insight.body.length > BODY_TRUNCATE;
            const hasSuggestedAction = !!insight.suggested_action;
            const showTruncated = !isExpanded && bodyIsLong;

            return (
              <div
                key={insight.id}
                className="rounded-2xl border p-5 transition-all"
                style={{
                  background: insight.status === 'new' ? 'rgba(255,149,0,0.03)' : 'rgba(255,255,255,0.02)',
                  borderColor: insight.status === 'new' ? 'rgba(255,149,0,0.12)' : 'rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Top badges */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${typeConf.color}20`, color: typeConf.color }}>
                        {typeConf.icon} {typeConf.label}
                      </span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${statusConf.color}20`, color: statusConf.color }}>
                        {statusConf.label}
                      </span>
                      <span className="text-[9px] font-bold text-neutral-600">
                        P{insight.priority}
                      </span>
                    </div>
                    {/* Title & body — clickable to expand */}
                    <div
                      className={`${bodyIsLong || hasSuggestedAction ? 'cursor-pointer' : ''}`}
                      onClick={() => { if (bodyIsLong || hasSuggestedAction) toggleExpand(insight.id); }}
                    >
                      <h3 className="text-sm font-semibold text-white mb-1">{insight.title}</h3>
                      <p className="text-xs text-neutral-medium leading-relaxed">
                        {showTruncated ? insight.body.slice(0, BODY_TRUNCATE) + '...' : insight.body}
                      </p>
                      {(bodyIsLong || hasSuggestedAction) && !isExpanded && (
                        <span className="text-[10px] text-primary/60 mt-1 inline-block">Xem thêm</span>
                      )}
                    </div>
                    {/* Suggested action: shown only when expanded */}
                    {isExpanded && insight.suggested_action && (
                      <div className="mt-3 px-3 py-2 rounded-xl text-xs text-primary/80 border border-primary/10"
                        style={{ background: 'rgba(255,149,0,0.05)' }}>
                        <span className="font-semibold">Goi y:</span> {insight.suggested_action}
                      </div>
                    )}
                    <p className="text-[10px] text-neutral-700 mt-2">{fmtDate(insight.created_at)}</p>
                  </div>

                  {/* Actions */}
                  {insight.status === 'new' && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => onAction(insight.id, 'reviewed')}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider
                          text-green-400 border border-green-500/20 hover:bg-green-500/10 transition-all"
                      >
                        ✓ Xem
                      </button>
                      <button
                        onClick={() => onAction(insight.id, 'dismissed')}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider
                          text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
                      >
                        ✕ Bỏ qua
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ── Runs Panel ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const RUN_TRUNCATE = 120;

const RunsPanel: React.FC<{ runs: AiRun[]; agentEmoji: string; agentName: string }> = ({ runs, agentEmoji, agentName }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {runs.length === 0 ? (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">{agentEmoji}</p>
          <p className="text-neutral-600 text-sm">{agentName} chưa có lần chạy nào</p>
          <p className="text-xs mt-1 text-neutral-700">Nhấn "Chạy phân tích ngay" để bắt đầu</p>
        </div>
      ) : (
        runs.map(run => {
          const sc = RUN_STATUS[run.status] || RUN_STATUS.failed;
          const isExpanded = expandedId === run.id;
          const summaryIsLong = !!run.summary && run.summary.length > RUN_TRUNCATE;
          const errorIsLong = !!run.error && run.error.length > RUN_TRUNCATE;
          const canExpand = summaryIsLong || errorIsLong;

          return (
            <div
              key={run.id}
              className={`rounded-2xl border border-white/8 p-4 transition-all ${canExpand ? 'cursor-pointer hover:border-white/15' : ''}`}
              style={{ background: 'rgba(255,255,255,0.02)' }}
              onClick={() => { if (canExpand) setExpandedId(prev => prev === run.id ? null : run.id); }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Status dot */}
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: sc.color, boxShadow: run.status === 'running' ? `0 0 8px ${sc.color}` : 'none' }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${sc.color}20`, color: sc.color }}>
                        {sc.label}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600">
                        {run.trigger_type}
                      </span>
                      {canExpand && (
                        <span className="text-[9px] text-neutral-700">{isExpanded ? '▲' : '▼'}</span>
                      )}
                    </div>
                    {run.summary && (
                      <p className={`text-xs text-neutral-medium mt-1 ${isExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
                        {isExpanded ? run.summary : run.summary.slice(0, RUN_TRUNCATE) + (summaryIsLong ? '...' : '')}
                      </p>
                    )}
                    {run.error && (
                      <p className={`text-xs text-red-400/80 mt-1 ${isExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
                        {isExpanded ? run.error : run.error.slice(0, RUN_TRUNCATE) + (errorIsLong ? '...' : '')}
                      </p>
                    )}
                  </div>
                </div>
                {/* Right side stats */}
                <div className="flex items-center gap-4 shrink-0 text-right">
                  {run.insights_created > 0 && (
                    <div>
                      <p className="text-xs font-black text-primary">{run.insights_created}</p>
                      <p className="text-[9px] text-neutral-600 uppercase">insights</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-white font-mono">{fmtDuration(run.duration_ms)}</p>
                    <p className="text-[9px] text-neutral-600 uppercase">duration</p>
                  </div>
                  {(run.tokens_input > 0 || run.tokens_output > 0) && (
                    <div className="hidden md:block">
                      <p className="text-xs font-mono text-white/60">{(run.tokens_input + run.tokens_output).toLocaleString()}</p>
                      <p className="text-[9px] text-neutral-600 uppercase">tokens</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-neutral-600">{timeAgo(run.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ── Memory Panel ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const MemoryPanel: React.FC<{ episodes: AiEpisode[] }> = ({ episodes }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-base font-black text-white uppercase tracking-wider">🧠 Bộ nhớ Agent</span>
      <span className="text-[9px] font-bold text-neutral-600 uppercase">{episodes.length} sự kiện gần nhất</span>
    </div>
    {episodes.length === 0 ? (
      <div className="text-center py-16 text-neutral-700 text-sm">
        <p className="text-3xl mb-3">🧠</p>
        <p className="text-neutral-600 text-sm">Agent chưa có ký ức nào</p>
      </div>
    ) : (
      <div className="relative pl-6">
        {/* Timeline line */}
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/10" />
        {episodes.map((ep, i) => (
          <div key={ep.id} className="relative pb-4">
            {/* Timeline dot */}
            <div className="absolute -left-3.5 top-1.5 w-3 h-3 rounded-full border-2 border-white/20"
              style={{ background: i === 0 ? '#FF9500' : '#1a1a1a' }} />
            <div className="rounded-xl border border-white/8 p-3 ml-2"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">
                  {ep.event_type}
                </span>
                <span className="text-[9px] text-neutral-600">{fmtDate(ep.created_at)}</span>
                <span className="text-[9px] font-bold text-neutral-700">imp:{ep.importance}</span>
              </div>
              <p className="text-xs text-neutral-medium leading-relaxed">{ep.summary}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// ── Chat Panel ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const CHANNEL_CONFIG = {
  app: { label: 'APP', color: '#FF9500' },
  telegram: { label: 'TELEGRAM', color: '#2196F3' },
} as const;

const chatDateKey = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const chatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const ChatPanel: React.FC<{
  conversations: AiConversation[];
  setConversations: React.Dispatch<React.SetStateAction<AiConversation[]>>;
  agentId: string;
  agentEmoji: string;
  agentName: string;
}> = ({ conversations, setConversations, agentId, agentEmoji, agentName }) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll when conversations change or sending state changes
  useEffect(() => {
    scrollToBottom();
  }, [conversations, sending, scrollToBottom]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setInput('');
    setSending(true);

    // Optimistically add user message
    const userMsg: AiConversation = {
      id: `temp-${Date.now()}`,
      agent_id: agentId,
      channel: 'app',
      role: 'user',
      content: trimmed,
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };
    setConversations(prev => [...prev, userMsg]);

    const res = await sendChatMessage(agentId, trimmed);

    if (res.ok && res.reply) {
      const assistantMsg: AiConversation = {
        id: `temp-reply-${Date.now()}`,
        agent_id: agentId,
        channel: 'app',
        role: 'assistant',
        content: res.reply,
        tokens_used: 0,
        created_at: new Date().toISOString(),
      };
      setConversations(prev => [...prev, assistantMsg]);
    } else if (!res.ok) {
      // Show error as a system-like message
      const errMsg: AiConversation = {
        id: `temp-err-${Date.now()}`,
        agent_id: agentId,
        channel: 'app',
        role: 'assistant',
        content: `[Loi] ${res.error?.slice(0, 200) || 'Khong nhan duoc phan hoi tu agent'}`,
        tokens_used: 0,
        created_at: new Date().toISOString(),
      };
      setConversations(prev => [...prev, errMsg]);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date for date separators
  let lastDateKey = '';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {conversations.length === 0 ? (
          <div className="text-center py-16 text-neutral-700 text-sm">
            <p className="text-3xl mb-3">{agentEmoji}</p>
            <p className="text-neutral-600 text-sm">Chua co cuoc tro chuyen nao voi {agentName}</p>
            <p className="text-xs mt-1 text-neutral-700">Gui tin nhan de bat dau chat</p>
          </div>
        ) : (
          conversations.map(msg => {
            const dateKey = chatDateKey(msg.created_at);
            const showDateSep = dateKey !== lastDateKey;
            lastDateKey = dateKey;
            const isUser = msg.role === 'user';
            const chConf = CHANNEL_CONFIG[msg.channel] || CHANNEL_CONFIG.app;

            return (
              <React.Fragment key={msg.id}>
                {/* Date separator */}
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700">
                      {dateKey}
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}

                {/* Message */}
                <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
                  {/* Agent avatar (left side for assistant) */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-1"
                      style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.15)' }}>
                      {agentEmoji}
                    </div>
                  )}

                  <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Channel badge + timestamp */}
                    <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${chConf.color}20`, color: chConf.color }}>
                        {chConf.label}
                      </span>
                      <span className="text-[10px] text-neutral-700">{chatTime(msg.created_at)}</span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={`rounded-2xl border p-3 ${isUser ? 'border-primary/20' : 'border-white/8'}`}
                      style={{
                        background: isUser ? 'rgba(255,149,0,0.05)' : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <p className="text-sm text-white whitespace-pre-wrap leading-relaxed break-words">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-1"
              style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.15)' }}>
              {agentEmoji}
            </div>
            <div className="rounded-2xl border border-white/8 p-3"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-td-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-td-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-td-pulse" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="pt-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Nhan tin cho ${agentName}...`}
            disabled={sending}
            className="flex-1 px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors disabled:opacity-50"
            style={{ background: '#1a1a1a' }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}
          >
            {sending ? 'Dang gui...' : 'Gui'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ── Config Panel ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const ConfigPanel: React.FC<{
  agent: AiAgent;
  onSaved: (updated: AiAgent) => void;
  onError: () => void;
}> = ({ agent, onSaved, onError }) => {
  const [form, setForm] = useState({
    name: agent.name,
    avatar_emoji: agent.avatar_emoji,
    role_title: agent.role_title,
    model: agent.model,
    temperature: agent.temperature,
    personality: agent.personality,
    is_active: agent.is_active,
  });
  const [saving, setSaving] = useState(false);

  // Sync form when agent changes (e.g. switching agents)
  React.useEffect(() => {
    setForm({
      name: agent.name,
      avatar_emoji: agent.avatar_emoji,
      role_title: agent.role_title,
      model: agent.model,
      temperature: agent.temperature,
      personality: agent.personality,
      is_active: agent.is_active,
    });
  }, [agent.id]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateAgent(agent.id, form);
    setSaving(false);
    if (ok) {
      onSaved({ ...agent, ...form });
    } else {
      onError();
    }
  };

  const fieldClass = "w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-primary/50 transition-colors";
  const fieldStyle = { background: '#1a1a1a' };
  const labelClass = "text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1.5 block";

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base font-black text-white uppercase tracking-wider">⚙️ Cấu hình Agent</span>
      </div>

      <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className={labelClass}>Trạng thái</p>
            <p className="text-xs text-neutral-600">Agent có được chạy theo lịch không</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            className={`relative w-12 h-6 rounded-full transition-all duration-200 ${form.is_active ? 'bg-primary' : 'bg-white/10'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${form.is_active ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="h-px bg-white/5" />

        {/* Avatar + Name row */}
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <label className={labelClass}>Emoji</label>
            <input
              type="text"
              value={form.avatar_emoji}
              onChange={e => setForm(f => ({ ...f, avatar_emoji: e.target.value }))}
              className={fieldClass}
              style={fieldStyle}
              maxLength={4}
            />
          </div>
          <div>
            <label className={labelClass}>Tên Agent</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={fieldClass}
              style={fieldStyle}
            />
          </div>
        </div>

        {/* Role title */}
        <div>
          <label className={labelClass}>Chức danh</label>
          <input
            type="text"
            value={form.role_title}
            onChange={e => setForm(f => ({ ...f, role_title: e.target.value }))}
            className={fieldClass}
            style={fieldStyle}
          />
        </div>

        {/* Model + Temperature row */}
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div>
            <label className={labelClass}>Model</label>
            <input
              type="text"
              value={form.model}
              onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              className={fieldClass}
              style={fieldStyle}
              placeholder="cx/gpt-5.5"
            />
          </div>
          <div>
            <label className={labelClass}>Temperature</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={form.temperature}
              onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) || 0 }))}
              className={fieldClass}
              style={fieldStyle}
            />
          </div>
        </div>

        {/* Personality */}
        <div>
          <label className={labelClass}>Personality / System Prompt thêm</label>
          <textarea
            value={form.personality}
            onChange={e => setForm(f => ({ ...f, personality: e.target.value }))}
            rows={5}
            className={`${fieldClass} resize-none`}
            style={fieldStyle}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
        style={{ background: '#FF9500' }}
      >
        {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
      </button>
    </div>
  );
};

export default AiAgentApp;
