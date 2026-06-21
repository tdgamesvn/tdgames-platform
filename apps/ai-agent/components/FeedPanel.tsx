// apps/ai-agent/components/FeedPanel.tsx
import React, { useState, useEffect } from 'react';
import { AiAgent, AiInsight } from '../services/aiAgentService';
import { TYPE_CONFIG, STATUS_CONFIG, fmtDate } from '../utils';

const BODY_TRUNCATE = 150;
const ITEMS_PER_PAGE = 10;

interface FeedPanelProps {
  insights: AiInsight[];
  allAgents: AiAgent[];
  onAction: (id: string, action: 'reviewed' | 'dismissed') => void;
}

const FeedPanel: React.FC<FeedPanelProps> = ({ insights, allAgents, onAction }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'action_required' | 'new'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Build agent badge map from allAgents
  const agentMap = React.useMemo(() => {
    const m: Record<string, { emoji: string; name: string }> = {};
    for (const a of allAgents) {
      m[a.id] = { emoji: a.avatar_emoji, name: a.name.replace('Agent ', '') };
    }
    return m;
  }, [allAgents]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, agentFilter]);

  if (insights.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-2xl mb-3">📋</p>
        <p className="text-neutral-500 text-sm font-semibold mb-1">Chưa có insights nào</p>
        <p className="text-xs text-neutral-700">Chạy các agent để bắt đầu</p>
      </div>
    );
  }

  // Filter
  const filtered = insights.filter(i => {
    if (statusFilter === 'action_required' && i.type !== 'action_required') return false;
    if (statusFilter === 'new' && i.status !== 'new') return false;
    if (agentFilter !== 'all' && i.agent_id !== agentFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-base font-black uppercase tracking-wider text-white">📋 Feed tổng hợp</h2>
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider"
          style={{ background: 'rgba(255,149,0,0.12)', color: '#FF9500', border: '1px solid rgba(255,149,0,0.2)' }}>
          {insights.length} insights
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all' as const,             label: 'Tất cả' },
          { key: 'action_required' as const,  label: 'Cần xử lý' },
          { key: 'new' as const,              label: 'Chưa xem' },
        ]).map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              statusFilter === f.key
                ? 'text-white bg-primary/20 border border-primary/30'
                : 'text-neutral-400 border border-white/10 hover:text-white hover:border-white/20'
            }`}>
            {f.label}
          </button>
        ))}

        {/* Agent filter dropdown */}
        <div className="ml-auto">
          <select
            value={agentFilter}
            onChange={e => { setAgentFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 outline-none transition-colors"
            style={{ background: '#1a1a1a' }}
          >
            <option value="all">Tất cả agent</option>
            {allAgents.map(a => (
              <option key={a.id} value={a.id}>
                {a.avatar_emoji} {a.name.replace('Agent ', '')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty filtered state */}
      {paginated.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-600 text-sm">Không có insight nào khớp bộ lọc</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map(insight => {
            const typeConf   = TYPE_CONFIG[insight.type as keyof typeof TYPE_CONFIG]     ?? TYPE_CONFIG.info;
            const statusConf = STATUS_CONFIG[insight.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
            const isExpanded     = expandedId === insight.id;
            const bodyIsLong     = insight.body.length > BODY_TRUNCATE;
            const hasSuggestedAction = !!insight.suggested_action;
            const canExpand      = bodyIsLong || hasSuggestedAction;
            const agentInfo      = agentMap[insight.agent_id];

            return (
              <div key={insight.id}
                className="rounded-2xl border overflow-hidden transition-all hover:border-white/15"
                style={{
                  background:  insight.status === 'new' ? 'rgba(255,149,0,0.025)' : 'rgba(255,255,255,0.02)',
                  borderColor: insight.status === 'new' ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.08)',
                }}>
                <div className="flex">
                  {/* Left color stripe */}
                  <div className="w-[3px] shrink-0 rounded-l-2xl"
                    style={{ background: `linear-gradient(180deg, ${typeConf.color}, ${typeConf.color}44)` }} />

                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Badges row — type + status + agent badge */}
                        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider"
                            style={{ background: `${typeConf.color}18`, color: typeConf.color, border: `1px solid ${typeConf.color}30` }}>
                            {typeConf.icon} {typeConf.label}
                          </span>
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider"
                            style={{ background: `${statusConf.color}15`, color: statusConf.color }}>
                            {statusConf.label}
                          </span>
                          {/* Agent badge */}
                          {agentInfo && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider"
                              style={{ background: 'rgba(255,255,255,0.05)', color: '#9D9C9D', border: '1px solid rgba(255,255,255,0.08)' }}>
                              {agentInfo.emoji} {agentInfo.name}
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-neutral-700 ml-auto">P{insight.priority}</span>
                        </div>

                        {/* Title + body */}
                        <div className={canExpand ? 'cursor-pointer' : ''} onClick={() => { if (canExpand) setExpandedId(prev => prev === insight.id ? null : insight.id); }}>
                          <h3 className="text-sm font-black text-white mb-1.5 leading-snug">{insight.title}</h3>
                          <p className="text-xs text-neutral-medium leading-relaxed">
                            {!isExpanded && bodyIsLong ? insight.body.slice(0, BODY_TRUNCATE) + '...' : insight.body}
                          </p>
                          {canExpand && !isExpanded && (
                            <span className="text-[10px] text-primary/70 mt-1.5 inline-block font-semibold">Xem thêm →</span>
                          )}
                        </div>

                        {/* Suggested action (expanded) */}
                        {isExpanded && insight.suggested_action && (
                          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs border"
                            style={{ background: 'rgba(255,149,0,0.06)', borderColor: 'rgba(255,149,0,0.15)' }}>
                            <span className="text-primary shrink-0 mt-0.5">→</span>
                            <span className="text-primary/80 leading-relaxed">
                              <span className="font-black text-primary">Gợi ý: </span>
                              {insight.suggested_action}
                            </span>
                          </div>
                        )}

                        <p className="text-[10px] text-neutral-700 mt-2.5 font-medium">{fmtDate(insight.created_at)}</p>
                      </div>

                      {/* Action buttons */}
                      {insight.status === 'new' && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => onAction(insight.id, 'reviewed')}
                            title="Đánh dấu đã xem"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-green-400 border border-green-500/25 hover:bg-green-500/12 transition-all"
                          >
                            ✓
                          </button>
                          <button
                            disabled
                            title="Sắp có"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-neutral-700 border border-white/6 cursor-not-allowed"
                          >
                            ···
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button
            onClick={() => setCurrentPage(p => p - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 rounded-lg text-xs text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ←
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button key={page} onClick={() => setCurrentPage(page)}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                currentPage === page
                  ? 'text-white bg-primary/20 border border-primary/30'
                  : 'text-neutral-400 border border-white/10 hover:text-white hover:border-white/20'
              }`}>
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 rounded-lg text-xs text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
};

export default FeedPanel;
