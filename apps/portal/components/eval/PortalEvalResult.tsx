import React from 'react';
import { HrEvaluationCycle, HrEvaluationSubmission, EvalRating } from '@/types';
import { RATING_LABELS, calcGap } from '../../../hr/services/evaluationService';

interface PortalEvalResultProps {
  cycle: HrEvaluationCycle;
  self?: HrEvaluationSubmission;
  leader?: HrEvaluationSubmission;
  onBack: () => void;
}

const RATING_COLOR: Record<EvalRating, { bg: string; text: string; border: string }> = {
  excellent:         { bg: 'rgba(76,175,80,0.12)',  text: '#4CAF50', border: 'rgba(76,175,80,0.3)' },
  good:              { bg: 'rgba(255,149,0,0.12)',  text: '#FF9500', border: 'rgba(255,149,0,0.3)' },
  meets:             { bg: 'rgba(33,150,243,0.12)', text: '#2196F3', border: 'rgba(33,150,243,0.3)' },
  needs_improvement: { bg: 'rgba(244,67,54,0.12)',  text: '#F44336', border: 'rgba(244,67,54,0.3)' },
};

const PortalEvalResult: React.FC<PortalEvalResultProps> = ({ cycle, self, leader, onBack }) => {
  const primary = leader ?? self;
  const gap = self && leader ? calcGap(self, leader) : null;

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 800, color: '#9D9C9D', display: 'flex', alignItems: 'center', gap: '6px', padding: 0, marginBottom: '20px' }}
      >
        ← Quay lại
      </button>

      {/* Hero score */}
      {primary && (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '28px', marginBottom: '16px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9D9C9D', marginBottom: '8px' }}>
            {cycle.period_label}
          </p>

          {/* Big score */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px', marginBottom: '12px' }}>
            <span style={{ fontSize: '56px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
              {primary.total_score.toFixed(2)}
            </span>
            <span style={{ fontSize: '18px', color: '#9D9C9D' }}>/5</span>
          </div>

          {/* Rating badge */}
          {(() => {
            const c = RATING_COLOR[primary.rating];
            return (
              <span style={{
                fontSize: '13px', fontWeight: 800, padding: '6px 18px', borderRadius: '10px',
                textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
              }}>
                {RATING_LABELS[primary.rating]}
              </span>
            );
          })()}
        </div>
      )}

      {/* Comparison columns */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { sub: 'Tự đánh giá của bạn', data: self },
          { sub: 'Đánh giá của Leader', data: leader },
        ].filter(col => col.data).map(({ sub, data: d }) => (
          <div key={sub} style={{
            flex: '1 1 280px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px',
          }}>
            <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9D9C9D', marginBottom: '10px' }}>
              {sub}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#fff' }}>{d!.total_score.toFixed(2)}</span>
              <span style={{ fontSize: '12px', color: '#9D9C9D' }}>/5</span>
            </div>

            {/* Groups */}
            {d!.groups.map((g, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '11px', color: '#9D9C9D' }}>{g.name}</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#F2F2F2' }}>{g.group_avg.toFixed(1)}</span>
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: '100%', borderRadius: '2px', width: `${(g.group_avg / 5) * 100}%`, background: '#FF9500', transition: 'width 0.4s' }} />
                </div>
              </div>
            ))}

            {d!.comments && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9D9C9D', marginBottom: '4px' }}>Nhận xét</p>
                <p style={{ fontSize: '12px', color: '#9D9C9D', lineHeight: 1.5 }}>{d!.comments}</p>
              </div>
            )}
            {d!.recommended_action && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9D9C9D', marginBottom: '4px' }}>Đề xuất</p>
                <p style={{ fontSize: '12px', color: '#F2F2F2', fontWeight: 600 }}>{d!.recommended_action}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Gap notice */}
      {gap !== null && gap > 1.0 && (
        <div style={{ background: 'rgba(255,167,38,0.07)', border: '1px solid rgba(255,167,38,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⚠️</span>
          <p style={{ fontSize: '12px', color: '#FFA726', margin: 0, fontWeight: 700 }}>
            Chênh lệch điểm {gap.toFixed(2)} — HR sẽ tổ chức buổi trao đổi 1-on-1 với bạn.
          </p>
        </div>
      )}
    </div>
  );
};

export default PortalEvalResult;
