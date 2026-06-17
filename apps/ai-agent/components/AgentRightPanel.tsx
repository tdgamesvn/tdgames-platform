// apps/ai-agent/components/AgentRightPanel.tsx
import React from 'react';
import { AiRun, AiInsight, AgentStats } from '../services/aiAgentService';

interface AgentRightPanelProps {
  runs: AiRun[];
  insights: AiInsight[];
  stats: AgentStats | null;
  onTabChange: (tab: string) => void;
  onTrigger: () => void;
}

// ── Sparkline: 7-day bar chart ──────────────────────────────────
const SparklineChart: React.FC<{ runs: AiRun[] }> = ({ runs }) => {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const counts = days.map(ds => runs.filter(r => r.created_at.slice(0, 10) === ds).length);
  const maxCount = Math.max(...counts, 1);
  const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const BAR_H = 40, BAR_W = 14, GAP = 5;
  const W = 7 * BAR_W + 6 * GAP;

  return (
    <svg width={W} height={BAR_H + 14} className="overflow-visible">
      {counts.map((count, i) => {
        const bh = Math.max(3, (count / maxCount) * BAR_H);
        const x = i * (BAR_W + GAP);
        const isToday = i === 6;
        return (
          <g key={i}>
            <rect x={x} y={BAR_H - bh} width={BAR_W} height={bh} rx={3}
              fill={isToday ? '#FF9500' : 'rgba(255,149,0,0.25)'} />
            <text x={x + BAR_W / 2} y={BAR_H + 12} textAnchor="middle"
              fill="rgba(157,156,157,0.6)" fontSize="7" fontWeight="700"
              fontFamily="Montserrat, sans-serif">
              {DAY_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Donut chart: insight types ──────────────────────────────────
const TYPE_COLORS: Record<string, { color: string; label: string }> = {
  warning:         { color: '#FF9500', label: 'Cảnh báo' },
  action_required: { color: '#F44336', label: 'Cần xử lý' },
  info:            { color: '#2196F3', label: 'Info' },
  other:           { color: '#444444', label: 'Khác' },
};

const DonutChart: React.FC<{ insights: AiInsight[] }> = ({ insights }) => {
  const total = insights.length;
  if (total === 0) return <p className="text-[10px] text-neutral-700 text-center py-3">Chưa có dữ liệu</p>;

  const counts: Record<string, number> = {
    warning: 0, action_required: 0, info: 0, other: 0,
  };
  insights.forEach(i => {
    if (i.type in counts) counts[i.type]++;
    else counts.other++;
  });

  const CX = 44, CY = 44, R = 30, SW = 10;
  const circ = 2 * Math.PI * R;
  let cum = 0;

  const arcs = Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([type, count]) => {
      const pct = count / total;
      const dash = pct * circ;
      const offset = -(cum * circ);
      cum += pct;
      return { type, count, dash, offset, pct };
    });

  return (
    <div className="flex items-center gap-3">
      <svg width={88} height={88} className="shrink-0">
        <g transform={`rotate(-90, ${CX}, ${CY})`}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
          {arcs.map(({ type, dash, offset }) => (
            <circle key={type} cx={CX} cy={CY} r={R} fill="none"
              stroke={TYPE_COLORS[type]?.color ?? '#444'}
              strokeWidth={SW}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={offset} />
          ))}
        </g>
        <text x={CX} y={CY - 4} textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="Montserrat, sans-serif">{total}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="rgba(157,156,157,0.6)" fontSize="7" fontWeight="700" fontFamily="Montserrat, sans-serif">TỔNG</text>
      </svg>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {arcs.map(({ type, count, pct }) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[type]?.color ?? '#444' }} />
            <span className="text-[9px] text-neutral-500 truncate flex-1">{TYPE_COLORS[type]?.label}</span>
            <span className="text-[9px] font-black text-neutral-400">{Math.round(pct * 100)}%</span>
            <span className="text-[9px] text-neutral-600">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────
const AgentRightPanel: React.FC<AgentRightPanelProps> = ({ runs, insights, onTabChange, onTrigger }) => {
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = runs.filter(r => now - new Date(r.created_at).getTime() < WEEK);
  const lastWeek = runs.filter(r => { const age = now - new Date(r.created_at).getTime(); return age >= WEEK && age < 2 * WEEK; });
  const weekDelta = lastWeek.length > 0 ? Math.round(((thisWeek.length - lastWeek.length) / lastWeek.length) * 100) : null;

  const recentRuns = runs.filter(r => r.status === 'completed' && r.summary).slice(0, 3);

  const CARD = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' };

  const quickActions = [
    { emoji: '📋', label: 'Tạo báo cáo',   sub: 'Báo cáo by Claude',    onClick: onTrigger },
    { emoji: '💬', label: 'Chat với AI',    sub: 'Đặt câu hỏi nhanh',   onClick: () => onTabChange('chat') },
    { emoji: '🧠', label: 'Bộ nhớ',         sub: 'Dữ liệu & Insights',   onClick: () => onTabChange('memory') },
    { emoji: '⚙️', label: 'Cài đặt Agent', sub: 'Điều hành AI',         onClick: () => onTabChange('config') },
  ];

  return (
    <aside className="w-60 shrink-0 border-l border-white/8 overflow-y-auto p-3 space-y-3"
      style={{ background: 'rgba(255,255,255,0.005)' }}>

      {/* 5a. Weekly overview */}
      <div className="rounded-2xl p-4 space-y-3" style={CARD}>
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">TỔNG QUAN TUẦN NÀY</p>
          <span className="text-[9px] text-neutral-700 border border-white/10 px-2 py-0.5 rounded-lg">Tuần này</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black text-white">{thisWeek.length}</span>
          {weekDelta !== null && (
            <span className={`text-[10px] font-semibold mb-1 ${weekDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {weekDelta >= 0 ? '+' : ''}{weekDelta}%
            </span>
          )}
        </div>
        <SparklineChart runs={runs} />
      </div>

      {/* 5b. Insight classification */}
      <div className="rounded-2xl p-4 space-y-3" style={CARD}>
        <p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">PHÂN LOẠI INSIGHTS</p>
        <DonutChart insights={insights} />
      </div>

      {/* 5c. Quick actions */}
      <div className="rounded-2xl p-4 space-y-3" style={CARD}>
        <p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">TRUY CẬP NHANH</p>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((a, i) => (
            <button key={i} onClick={a.onClick}
              className="rounded-xl p-2.5 text-left transition-all hover:border-white/15"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-lg mb-1">{a.emoji}</p>
              <p className="text-[9px] font-black text-white leading-tight">{a.label}</p>
              <p className="text-[8px] text-neutral-600 mt-0.5 leading-tight">{a.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 5d. Recent activity */}
      <div className="rounded-2xl p-4 space-y-3" style={CARD}>
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-wider text-neutral-600">HOẠT ĐỘNG GẦN ĐÂY</p>
          <button onClick={() => onTabChange('runs')} className="text-[9px] text-primary/60 hover:text-primary transition-all">
            Xem tất cả →
          </button>
        </div>
        {recentRuns.length === 0 ? (
          <p className="text-[10px] text-neutral-700 text-center py-2">Chưa có dữ liệu</p>
        ) : (
          <div className="space-y-2.5">
            {recentRuns.map(run => (
              <div key={run.id} className="flex items-start gap-2">
                <span className="text-sm shrink-0 mt-0.5">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-white truncate">
                    {(run.summary || '').split('\n')[0].slice(0, 50)}
                  </p>
                  <p className="text-[9px] text-neutral-600 mt-0.5">
                    Đã tạo bởi agent •{' '}
                    {new Date(run.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}{' '}
                    {new Date(run.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="text-neutral-700 text-sm shrink-0 mt-0.5">⬇</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default AgentRightPanel;
