import React, { useState } from 'react';
import { AiRun } from '../services/aiAgentService';
import { timeAgo, fmtDuration, RUN_STATUS } from '../utils';

const RUN_TRUNCATE = 120;

interface RunsPanelProps {
  runs: AiRun[];
  agentEmoji: string;
  agentName: string;
  onTrigger: () => void;
  triggerLoading: boolean;
}

const RunsPanel: React.FC<RunsPanelProps> = ({ runs, agentEmoji, agentName, onTrigger, triggerLoading }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {runs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-2xl mb-3">{agentEmoji}</p>
          <p className="text-neutral-600 text-sm">{agentName} chưa có lần chạy nào</p>
          <p className="text-xs mt-1 text-neutral-700 mb-5">Nhấn nút bên dưới để chạy lần đầu</p>
          <button
            onClick={onTrigger}
            disabled={triggerLoading}
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}
          >
            {triggerLoading ? 'Đang chạy...' : '▶ Chạy phân tích ngay'}
          </button>
        </div>
      ) : (
        runs.map(run => {
          const sc = RUN_STATUS[run.status as keyof typeof RUN_STATUS] || RUN_STATUS.failed;
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
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: sc.color, boxShadow: run.status === 'running' ? `0 0 8px ${sc.color}` : 'none' }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${sc.color}20`, color: sc.color }}>
                        {sc.label}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600">{run.trigger_type}</span>
                      {canExpand && <span className="text-[9px] text-neutral-700">{isExpanded ? '▲' : '▼'}</span>}
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
                  <p className="text-[10px] text-neutral-600">{timeAgo(run.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default RunsPanel;
