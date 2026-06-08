import React from 'react';
import { HrEvaluationSubmission, EvalRating } from '@/types';
import { RATING_LABELS, calcGap } from '../../services/evaluationService';

interface EvalScoreCardProps {
  self?: HrEvaluationSubmission;
  leader?: HrEvaluationSubmission;
}

const RATING_COLOR: Record<EvalRating, { bg: string; text: string; border: string }> = {
  excellent:          { bg: 'rgba(76,175,80,0.12)',  text: '#4CAF50', border: 'rgba(76,175,80,0.3)' },
  good:               { bg: 'rgba(255,149,0,0.12)',  text: '#FF9500', border: 'rgba(255,149,0,0.3)' },
  meets:              { bg: 'rgba(33,150,243,0.12)', text: '#2196F3', border: 'rgba(33,150,243,0.3)' },
  needs_improvement:  { bg: 'rgba(244,67,54,0.12)',  text: '#F44336', border: 'rgba(244,67,54,0.3)' },
};

function RatingBadge({ rating }: { rating: EvalRating }) {
  const c = RATING_COLOR[rating];
  return (
    <span style={{
      fontSize: '9px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
      textTransform: 'uppercase' as const, letterSpacing: '0.08em',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {RATING_LABELS[rating]}
    </span>
  );
}

function ScoreCol({ label, sub }: { label: HrEvaluationSubmission; sub: string }) {
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '12px', padding: '16px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9D9C9D', marginBottom: '6px' }}>
          {sub}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>
            {label.total_score.toFixed(2)}
          </span>
          <span style={{ fontSize: '12px', color: '#9D9C9D' }}>/5</span>
          <RatingBadge rating={label.rating} />
        </div>
      </div>

      {/* Groups breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {label.groups.map((g, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#9D9C9D', fontWeight: 600 }}>
                {g.name}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#F2F2F2' }}>
                {g.group_avg.toFixed(1)}
              </span>
            </div>
            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                width: `${(g.group_avg / 5) * 100}%`,
                background: '#FF9500',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Comments */}
      {label.comments && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9D9C9D', marginBottom: '4px' }}>
            Nhận xét
          </p>
          <p style={{ fontSize: '12px', color: '#9D9C9D', lineHeight: '1.5' }}>{label.comments}</p>
        </div>
      )}

      {/* Recommended action */}
      {label.recommended_action && (
        <div style={{ marginTop: '8px' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9D9C9D', marginBottom: '4px' }}>
            Đề xuất
          </p>
          <p style={{ fontSize: '12px', color: '#F2F2F2', fontWeight: 600 }}>{label.recommended_action}</p>
        </div>
      )}
    </div>
  );
}

const EvalScoreCard: React.FC<EvalScoreCardProps> = ({ self, leader }) => {
  if (!self && !leader) return null;

  const gap = self && leader ? calcGap(self, leader) : null;
  const gapHigh = gap !== null && gap > 1.0;

  return (
    <div>
      {/* Gap alert */}
      {gapHigh && (
        <div style={{
          background: 'rgba(255,167,38,0.08)', border: '1px solid rgba(255,167,38,0.25)',
          borderRadius: '10px', padding: '10px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 800, color: '#FFA726', margin: 0 }}>
              Chênh lệch điểm: {gap!.toFixed(2)} — cần trao đổi 1-on-1
            </p>
            <p style={{ fontSize: '11px', color: '#9D9C9D', margin: 0, marginTop: '2px' }}>
              Khi tự đánh giá và leader đánh giá chênh &gt; 1.0 điểm, cần có buổi trao đổi trực tiếp.
            </p>
          </div>
        </div>
      )}

      {/* Side-by-side columns */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {self   && <ScoreCol label={self}   sub="Tự đánh giá (NV)" />}
        {leader && <ScoreCol label={leader} sub="Đánh giá của Leader" />}
      </div>
    </div>
  );
};

export default EvalScoreCard;
