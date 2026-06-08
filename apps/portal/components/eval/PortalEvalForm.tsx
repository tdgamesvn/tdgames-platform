import React, { useState, useMemo } from 'react';
import { HrEvaluationCycle, EvalGroup } from '@/types';
import {
  getGroupsConfig, calcTotalScore, calcRating, calcGroupAvg,
  submitEvaluation, RATING_LABELS,
} from '../../../hr/services/evaluationService';

interface PortalEvalFormProps {
  cycle: HrEvaluationCycle;
  userId: string;
  onSubmitted: () => void;
  onBack: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Chưa đạt',
  2: 'Cần cải thiện',
  3: 'Đạt yêu cầu',
  4: 'Tốt',
  5: 'Xuất sắc',
};

const PortalEvalForm: React.FC<PortalEvalFormProps> = ({ cycle, userId, onSubmitted, onBack, onToast }) => {
  const groupsConfig = useMemo(() => getGroupsConfig(cycle.period_type), [cycle.period_type]);

  // scores[groupIdx][criterionIdx] = 0 (unset) | 1-5
  const [scores, setScores] = useState<number[][]>(
    () => groupsConfig.map(g => g.criteria.map(() => 0))
  );
  const [comments, setComments] = useState('');
  const [recommended, setRecommended] = useState('');
  const [saving, setSaving] = useState(false);
  const [openGroup, setOpenGroup] = useState<number>(0);

  const setScore = (gIdx: number, cIdx: number, val: number) => {
    setScores(prev => {
      const next = prev.map(row => [...row]);
      next[gIdx][cIdx] = val;
      return next;
    });
  };

  // Build EvalGroup[] from current scores
  const groups: EvalGroup[] = groupsConfig.map((gc, gIdx) => {
    const filledScores = scores[gIdx].filter(s => s > 0);
    return {
      name: gc.name,
      weight: gc.weight,
      scores: scores[gIdx],
      group_avg: filledScores.length === gc.criteria.length
        ? calcGroupAvg(scores[gIdx])
        : 0,
    };
  });

  const allFilled = groups.every((g, gIdx) => scores[gIdx].every(s => s > 0));
  const previewScore = allFilled ? calcTotalScore(groups) : null;
  const previewRating = previewScore !== null ? calcRating(previewScore) : null;

  const RATING_COLOR_TEXT: Record<string, string> = {
    excellent: '#4CAF50',
    good: '#FF9500',
    meets: '#2196F3',
    needs_improvement: '#F44336',
  };

  const handleSubmit = async () => {
    if (!allFilled) { onToast('Vui lòng đánh giá đủ tất cả tiêu chí', 'error'); return; }
    if (!comments.trim()) { onToast('Vui lòng nhập nhận xét chung', 'error'); return; }

    setSaving(true);
    try {
      await submitEvaluation({
        cycle_id: cycle.id,
        evaluator_role: 'self',
        evaluator_user_id: userId,
        groups,
        comments: comments.trim(),
        recommended_action: recommended.trim(),
      });
      onToast('Đã gửi tự đánh giá thành công', 'success');
      onSubmitted();
    } catch (e: any) {
      onToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputBase: React.CSSProperties = {
    width: '100%', background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '10px 14px', color: '#F2F2F2', fontSize: '13px',
    fontWeight: 500, outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box',
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 800, color: '#9D9C9D', display: 'flex', alignItems: 'center', gap: '6px', padding: 0, marginBottom: '20px' }}>
        ← Quay lại
      </button>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: 0 }}>
          ✏️ Tự đánh giá
        </h2>
        <p style={{ fontSize: '13px', color: '#9D9C9D', marginTop: '4px' }}>
          {cycle.period_label} — thang điểm 1–5 cho mỗi tiêu chí
        </p>
      </div>

      {/* Sticky score preview */}
      <div style={{
        position: 'sticky', top: '16px', zIndex: 10,
        background: 'rgba(22,22,22,0.95)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backdropFilter: 'blur(8px)',
      }}>
        <div>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9D9C9D', margin: 0 }}>
            Điểm dự kiến
          </p>
          <p style={{ fontSize: '22px', fontWeight: 900, color: '#fff', margin: 0 }}>
            {previewScore !== null ? previewScore.toFixed(2) : '—'}
            <span style={{ fontSize: '13px', color: '#9D9C9D', marginLeft: '4px' }}>/5</span>
          </p>
        </div>
        {previewRating && (
          <span style={{
            fontSize: '11px', fontWeight: 800, padding: '5px 14px', borderRadius: '8px',
            textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            color: RATING_COLOR_TEXT[previewRating],
            background: `${RATING_COLOR_TEXT[previewRating]}18`,
            border: `1px solid ${RATING_COLOR_TEXT[previewRating]}40`,
          }}>
            {RATING_LABELS[previewRating]}
          </span>
        )}
        <p style={{ fontSize: '11px', color: '#9D9C9D', margin: 0 }}>
          {groups.filter((_, gi) => scores[gi].every(s => s > 0)).length}/{groups.length} nhóm hoàn tất
        </p>
      </div>

      {/* Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {groupsConfig.map((gc, gIdx) => {
          const groupDone = scores[gIdx].every(s => s > 0);
          const isOpen = openGroup === gIdx;
          const groupAvg = groupDone ? calcGroupAvg(scores[gIdx]) : null;

          return (
            <div key={gIdx} style={{
              background: 'rgba(255,255,255,0.02)', border: `1px solid ${isOpen ? 'rgba(255,149,0,0.25)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.2s',
            }}>
              {/* Group header */}
              <button
                onClick={() => setOpenGroup(isOpen ? -1 : gIdx)}
                style={{
                  width: '100%', padding: '14px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#F2F2F2' }}>{gc.name}</span>
                  <span style={{ fontSize: '10px', color: '#9D9C9D', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: '5px' }}>
                    {gc.weight}%
                  </span>
                  {groupDone && (
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#4CAF50' }}>✓ {groupAvg!.toFixed(1)}</span>
                  )}
                </div>
                <span style={{ color: '#9D9C9D', fontSize: '14px' }}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Criteria */}
              {isOpen && (
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {gc.criteria.map((criterion, cIdx) => {
                    const val = scores[gIdx][cIdx];
                    return (
                      <div key={cIdx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#F2F2F2', margin: 0 }}>{criterion.label}</p>
                            <p style={{ fontSize: '11px', color: '#9D9C9D', margin: '2px 0 0' }}>{criterion.hint}</p>
                          </div>
                          {val > 0 && (
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#FF9500', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                              {val} — {SCORE_LABELS[val]}
                            </span>
                          )}
                        </div>
                        {/* Score buttons 1-5 */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              onClick={() => setScore(gIdx, cIdx, n)}
                              style={{
                                flex: 1, padding: '8px 4px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 800, border: '1px solid',
                                borderColor: val === n ? '#FF9500' : 'rgba(255,255,255,0.1)',
                                background: val === n ? 'rgba(255,149,0,0.18)' : 'rgba(255,255,255,0.03)',
                                color: val === n ? '#FF9500' : '#9D9C9D',
                                transition: 'all 0.12s',
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comments */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9D9C9D', display: 'block', marginBottom: '6px' }}>
          Nhận xét chung *
        </label>
        <textarea
          rows={4}
          value={comments}
          onChange={e => setComments(e.target.value)}
          placeholder="Mô tả thành tựu nổi bật, những điều bạn học được và muốn cải thiện..."
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9D9C9D', display: 'block', marginBottom: '6px' }}>
          Đề xuất / kỳ vọng bản thân
        </label>
        <textarea
          rows={2}
          value={recommended}
          onChange={e => setRecommended(e.target.value)}
          placeholder="VD: Muốn được trao đổi thêm về lộ trình thăng tiến..."
          style={inputBase}
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving || !allFilled}
        style={{
          width: '100%', padding: '14px', borderRadius: '10px', cursor: (saving || !allFilled) ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: 900, border: 'none',
          background: allFilled ? '#FF9500' : 'rgba(255,255,255,0.06)',
          color: allFilled ? '#000' : '#9D9C9D',
          opacity: saving ? 0.7 : 1,
          transition: 'all 0.2s',
        }}
      >
        {saving ? 'Đang gửi...' : allFilled ? '✓ Gửi tự đánh giá' : `Chưa điền đủ (${groups.filter((_, gi) => scores[gi].every(s => s > 0)).length}/${groups.length} nhóm)`}
      </button>
    </div>
  );
};

export default PortalEvalForm;
