import React from 'react';
import { HrEvaluationSubmission, EvalRating } from '@/types';
import { RATING_LABELS, calcGap } from '../../services/evaluationService';

interface EvalScoreCardProps {
  self?:   HrEvaluationSubmission;
  leader?: HrEvaluationSubmission;
}

const RATING_COLOR: Record<EvalRating, string> = {
  excellent:         '#34C759',
  good:              '#FF9500',
  meets:             '#0A84FF',
  needs_improvement: '#FF375F',
};

function ScoreCol({ sub, data }: { sub: string; data: HrEvaluationSubmission }) {
  const rc = RATING_COLOR[data.rating];
  return (
    <div className="flex-1 rounded-[20px] border border-white/8 p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
      {/* Header */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">{sub}</p>
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
      </div>

      {/* Groups */}
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
                style={{ width: `${(g.group_avg / 5) * 100}%`, background: '#FF9500' }}
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
            <p className="text-xs font-black text-orange-400">Chênh lệch điểm: {gap.toFixed(2)} — cần trao đổi 1-on-1</p>
            <p className="text-xs text-neutral-medium mt-0.5">Khi tự đánh giá và leader chênh &gt; 1.0 điểm, cần có buổi trao đổi trực tiếp.</p>
          </div>
        </div>
      )}

      {/* Side-by-side */}
      <div className="flex gap-4">
        {self   && <ScoreCol data={self}   sub="Tự đánh giá (NV)" />}
        {leader && <ScoreCol data={leader} sub="Đánh giá của Leader" />}
      </div>
    </div>
  );
};

export default EvalScoreCard;
