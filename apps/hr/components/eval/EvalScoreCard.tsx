import React from 'react';
import { HrEvaluationSubmission, EvalRating } from '@/types';
import { RATING_LABELS, calcGap } from '../../services/evaluationService';

interface EvalScoreCardProps {
  self?:   HrEvaluationSubmission;
  leader?: HrEvaluationSubmission;
}

const RATING_COLOR: Record<EvalRating, string> = {
  excellent:         '#34C759',  // green   — Vượt kỳ vọng
  good:              '#0A84FF',  // blue    — Đạt yêu cầu
  meets:             '#FFA726',  // amber   — Cần cải thiện
  needs_improvement: '#FF375F',  // red     — Không đạt
};

// Visual identity per role
const ROLE_STYLE = {
  self: {
    accent:      '#0A84FF',
    barColor:    '#0A84FF',
    bg:          'rgba(33,150,243,0.04)',
    border:      'rgba(33,150,243,0.2)',
    dot:         'bg-blue-400',
    label:       'Tự đánh giá (NV)',
  },
  leader: {
    accent:      '#FF9500',
    barColor:    '#FF9500',
    bg:          'rgba(255,149,0,0.04)',
    border:      'rgba(255,149,0,0.2)',
    dot:         'bg-primary',
    label:       'Đánh giá của Leader',
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
        <p
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: rs.accent }}
        >
          {rs.label}
        </p>
      </div>

      {/* Score */}
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

      {/* Groups breakdown */}
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
      {data.recommended_action && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Đề xuất</p>
          <p className="text-xs font-semibold text-neutral-light">{data.recommended_action}</p>
        </div>
      )}
    </div>
  );
}

const EvalScoreCard: React.FC<EvalScoreCardProps> = ({ self, leader }) => {
  if (!self && !leader) return null;
  const gap = self && leader ? calcGap(self, leader) : null;

  return (
    <div className="space-y-4">
      {/* Gap alert */}
      {gap !== null && gap > 1.0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-orange-500/30 bg-orange-500/5">
          <span className="text-base mt-0.5">⚠️</span>
          <div>
            <p className="text-xs font-black text-orange-400">
              Chênh lệch điểm: {gap.toFixed(2)} — cần trao đổi 1-on-1
            </p>
            <p className="text-xs text-neutral-medium mt-0.5">
              Khi tự đánh giá và leader chênh &gt; 1.0 điểm, cần có buổi trao đổi trực tiếp.
            </p>
          </div>
        </div>
      )}

      {/* Side-by-side */}
      <div className="flex gap-4">
        {self   && <ScoreCol role="self"   data={self} />}
        {leader && <ScoreCol role="leader" data={leader} />}
      </div>
    </div>
  );
};

export default EvalScoreCard;
