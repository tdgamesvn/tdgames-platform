// apps/ai-agent/components/InsightsPanel.tsx
import React, { useState, useEffect } from 'react';
import { AiInsight } from '../services/aiAgentService';
import { TYPE_CONFIG, STATUS_CONFIG, fmtDate } from '../utils';

const BODY_TRUNCATE = 150;
const ITEMS_PER_PAGE = 10;

interface InsightsPanelProps {
  insights: AiInsight[];
  filter: 'all' | 'new' | 'action_required';
  onFilterChange: (f: 'all' | 'new' | 'action_required') => void;
  onAction: (id: string, action: 'reviewed' | 'dismissed') => void;
  agentEmoji: string;
  agentName: string;
  onTrigger: () => void;
  triggerLoading: boolean;
  hasNoData: boolean;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({
  insights, filter, onFilterChange, onAction,
  agentEmoji, agentName, onTrigger, triggerLoading, hasNoData,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [filter]);

  if (hasNoData) {
    return (
      <div className="text-center py-16">
        <p className="text-2xl mb-3">{agentEmoji}</p>
        <p className="text-neutral-500 text-sm font-semibold mb-1">{agentName} chưa có dữ liệu</p>
        <p className="text-xs text-neutral-700 mb-6">Chạy phân tích để bắt đầu nhận insights</p>
        <button onClick={onTrigger} disabled={triggerLoading}
          className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
          style={{ background: '#FF9500' }}>
          {triggerLoading ? 'Đang chạy...' : '▶ Chạy phân tích ngay'}
        </button>
      </div>
    );
  }

  const sorted = [...insights].sort((a, b) => {
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return sortOrder === 'newest' ? diff : -diff;
  });

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Filter bar + sort */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all' as const,            label: 'Tất cả' },
          { key: 'new' as const,            label: 'Chưa xem' },
          { key: 'action_required' as const, label: 'Cần xử lý' },
        ]).map(f => (
          <button key={f.key} onClick={() => onFilterChange(f.key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              filter === f.key
                ? 'text-white bg-primary/20 border border-primary/30'
                : 'text-neutral-400 border border-white/10 hover:text-white hover:border-white/20'
            }`}>
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={sortOrder}
            onChange={e => { setSortOrder(e.target.value as 'newest' | 'oldest'); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 outline-none transition-colors"
            style={{ background: '#1a1a1a' }}
          >
            <option value="newest">Mới nhất ▼</option>
            <option value="oldest">Cũ nhất ▲</option>
          </select>
          <button
            disabled
            title="Bộ lọc nâng cao (sắp có)"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-600 border border-white/8 cursor-not-allowed opacity-40"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* List */}
      {paginated.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-2xl mb-3">{agentEmoji}</p>
          <p className="text-neutral-600 text-sm">{agentName} chưa có insight nào</p>
          <p className="text-xs mt-1 text-neutral-700">Chạy agent để phân tích dữ liệu</p>
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

            return (
              <div key={insight.id}
                className="rounded-2xl border overflow-hidden transition-all hover:border-white/15"
                style={{
                  background:  insight.status === 'new' ? 'rgba(255,149,0,0.025)' : 'rgba(255,255,255,0.02)',
                  borderColor: insight.status === 'new' ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.08)',
                }}>
                <div className="flex">
                  {/* Left color stripe — instantly shows type */}
                  <div className="w-[3px] shrink-0 rounded-l-2xl"
                    style={{ background: `linear-gradient(180deg, ${typeConf.color}, ${typeConf.color}44)` }} />

                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider"
                            style={{ background: `${typeConf.color}18`, color: typeConf.color, border: `1px solid ${typeConf.color}30` }}>
                            {typeConf.icon} {typeConf.label}
                          </span>
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider"
                            style={{ background: `${statusConf.color}15`, color: statusConf.color }}>
                            {statusConf.label}
                          </span>
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

export default InsightsPanel;
