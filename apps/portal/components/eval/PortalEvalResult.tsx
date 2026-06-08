import React from 'react';
import { HrEvaluationCycle, HrEvaluationSubmission, EvalRating } from '@/types';
import { RATING_LABELS, calcGap } from '../../../hr/services/evaluationService';

interface PortalEvalResultProps {
  cycle:   HrEvaluationCycle;
  self?:   HrEvaluationSubmission;
  leader?: HrEvaluationSubmission;
  onBack:  () => void;
}

const RATING_COLOR: Record<EvalRating, string> = {
  excellent:         '#34C759',
  good:              '#FF9500',
  meets:             '#0A84FF',
  needs_improvement: '#FF375F',
};

const PortalEvalResult: React.FC<PortalEvalResultProps> = ({ cycle, self, leader, onBack }) => {
  const primary = leader ?? self;
  const gap = self && leader ? calcGap(self, leader) : null;

  return (
    <div className="animate-fadeInUp space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-medium hover:text-neutral-light transition-all">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Quay lại
      </button>

      {/* Hero score */}
      {primary && (
        <div className="p-7 rounded-[20px] border border-primary/10 bg-surface text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-3">{cycle.period_label}</p>
          <div className="flex items-baseline justify-center gap-2 mb-4">
            <span className="text-5xl font-black text-neutral-light">{primary.total_score.toFixed(2)}</span>
            <span className="text-lg text-neutral-medium">/5</span>
          </div>
          <span
            className="text-xs font-black uppercase px-3 py-1 rounded-lg"
            style={{ background: `${RATING_COLOR[primary.rating]}20`, color: RATING_COLOR[primary.rating] }}
          >
            {RATING_LABELS[primary.rating]}
          </span>
        </div>
      )}

      {/* Comparison columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([
          { sub: 'Tự đánh giá của bạn', data: self },
          { sub: 'Đánh giá của Leader', data: leader },
        ] as { sub: string; data?: HrEvaluationSubmission }[])
          .filter(col => col.data)
          .map(({ sub, data: d }) => (
            <div key={sub} className="rounded-[20px] border border-white/8 p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">{sub}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-neutral-light">{d!.total_score.toFixed(2)}</span>
                  <span className="text-xs text-neutral-medium">/5</span>
                </div>
              </div>

              <div className="space-y-3">
                {d!.groups.map((g, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-neutral-medium">{g.name}</span>
                      <span className="text-xs font-black text-neutral-light">{g.group_avg.toFixed(1)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(g.group_avg / 5) * 100}%`, background: '#FF9500' }} />
                    </div>
                  </div>
                ))}
              </div>

              {d!.comments && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Nhận xét</p>
                  <p className="text-xs text-neutral-medium leading-relaxed">{d!.comments}</p>
                </div>
              )}
              {d!.recommended_action && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Đề xuất</p>
                  <p className="text-xs font-semibold text-neutral-light">{d!.recommended_action}</p>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Gap notice */}
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
