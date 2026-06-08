import React from 'react';
import { HrEvaluationCycle, HrEvaluationSubmission, EvalRating } from '@/types';
import { RATING_LABELS, calcGap } from '../../../hr/services/evaluationService';

interface PortalEvalResultProps {
  cycle:   HrEvaluationCycle;
  self?:   HrEvaluationSubmission;
  leader?: HrEvaluationSubmission;
  onBack:  () => void;
  onEdit?: () => void; // available only when leader hasn't submitted yet
}

const RATING_COLOR: Record<EvalRating, string> = {
  excellent:         '#34C759',
  good:              '#0A84FF',
  meets:             '#FFA726',
  needs_improvement: '#FF375F',
};

// Same visual identity as HR EvalScoreCard
const ROLE_STYLE = {
  self: {
    accent:   '#0A84FF',
    barColor: '#0A84FF',
    bg:       'rgba(33,150,243,0.04)',
    border:   'rgba(33,150,243,0.2)',
    dot:      'bg-blue-400',
    label:    'Tự đánh giá (NV)',
  },
  leader: {
    accent:   '#FF9500',
    barColor: '#FF9500',
    bg:       'rgba(255,149,0,0.04)',
    border:   'rgba(255,149,0,0.2)',
    dot:      'bg-primary',
    label:    'Đánh giá của Leader',
  },
} as const;

function ScoreCol({ role, data }: { role: 'self' | 'leader'; data: HrEvaluationSubmission }) {
  const rs = ROLE_STYLE[role];
  const rc = RATING_COLOR[data.rating];

  return (
    <div
      className="flex-1 rounded-[20px] p-5 space-y-4"
      style={{ background: rs.bg, border: `1px solid ${rs.border}` }}
    >
      {/* Coloured header strip */}
      <div className="flex items-center gap-2 pb-3 border-b border-white/5">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${rs.dot}`} />
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: rs.accent }}>
          {rs.label}
        </p>
      </div>

      {/* Score + rating badge inline */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-neutral-light">{data.total_score.toFixed(2)}</span>
        <span className="text-xs text-neutral-medium">/5</span>
        <span
          className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ml-1"
          style={{ background: `${rc}20`, color: rc }}
        >
          {RATING_LABELS[data.rating]}
        </span>
      </div>

      {/* Groups breakdown with role-coloured bars */}
      <div className="space-y-3">
        {data.groups.map((g, i) => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-neutral-medium">{g.name}</span>
              <span className="text-xs font-black text-neutral-light">{g.group_avg.toFixed(1)}</span>
            </div>
            <div className="h-1 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(g.group_avg / 5) * 100}%`, background: rs.barColor }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Comments */}
      {data.comments && (
        <div className="pt-3 border-t border-white/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Nhận xét</p>
          <p className="text-xs text-neutral-medium leading-relaxed">{data.comments}</p>
        </div>
      )}

      {/* Đề xuất — highlighted block */}
      {data.recommended_action && (
        <div
          className="rounded-xl p-3 mt-1"
          style={{ background: `${rs.accent}14`, border: `1px solid ${rs.accent}35` }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm leading-none">📌</span>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: rs.accent }}>
              Đề xuất
            </p>
          </div>
          <p className="text-sm font-black text-neutral-light leading-snug">
            {data.recommended_action}
          </p>
        </div>
      )}
    </div>
  );
}

const PortalEvalResult: React.FC<PortalEvalResultProps> = ({ cycle, self, leader, onBack, onEdit }) => {
  const primary = leader ?? self;
  const gap     = self && leader ? calcGap(self, leader) : null;

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* Back + Edit row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-medium hover:text-neutral-light transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại
        </button>

        {onEdit && cycle.status === 'pending_leader' && !leader && (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/30 text-xs font-black uppercase tracking-wider text-primary hover:bg-primary/10 transition-all"
          >
            ✏️ Sửa lại
          </button>
        )}
      </div>

      {/* Header card — mirrors HR EvalCycleDetail header style */}
      {primary && (
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">
              Kỳ đánh giá
            </p>
            <h2 className="text-lg font-black text-neutral-light">{cycle.period_label}</h2>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-2 justify-end">
              <span className="text-4xl font-black text-neutral-light">{primary.total_score.toFixed(2)}</span>
              <span className="text-base text-neutral-medium">/5</span>
            </div>
            <span
              className="inline-block text-xs font-black uppercase px-3 py-1 rounded-lg mt-2"
              style={{
                background: `${RATING_COLOR[primary.rating]}20`,
                color:       RATING_COLOR[primary.rating],
              }}
            >
              {RATING_LABELS[primary.rating]}
            </span>
          </div>
        </div>
      )}

      {/* Side-by-side comparison columns */}
      <div className="flex flex-col md:flex-row gap-4">
        {self   && <ScoreCol role="self"   data={self} />}
        {leader && <ScoreCol role="leader" data={leader} />}
      </div>

      {/* Gap alert */}
      {gap !== null && gap > 1.0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-orange-500/30 bg-orange-500/5">
          <span>⚠️</span>
          <p className="text-xs font-black text-orange-400">
            Chênh lệch điểm {gap.toFixed(2)} — HR sẽ tổ chức buổi trao đổi 1-on-1 với bạn.
          </p>
        </div>
      )}
    </div>
  );
};

export default PortalEvalResult;
