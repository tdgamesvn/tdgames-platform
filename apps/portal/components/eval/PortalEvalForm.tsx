import React, { useState, useMemo } from 'react';
import { HrEvaluationCycle, EvalGroup } from '@/types';
import {
  getGroupsConfig, calcTotalScore, calcRating, calcGroupAvg,
  submitEvaluation, RATING_LABELS,
} from '../../../hr/services/evaluationService';

interface PortalEvalFormProps {
  cycle:       HrEvaluationCycle;
  userId:      string;
  onSubmitted: () => void;
  onBack:      () => void;
  onToast:     (msg: string, type: 'success' | 'error') => void;
}

const SCORE_LABELS: Record<number, string> = { 1: 'Chưa đạt', 2: 'Cần cải thiện', 3: 'Đạt', 4: 'Tốt', 5: 'Xuất sắc' };
const RATING_COLOR: Record<string, string> = {
  excellent: '#34C759', good: '#FF9500', meets: '#0A84FF', needs_improvement: '#FF375F',
};

const PortalEvalForm: React.FC<PortalEvalFormProps> = ({ cycle, userId, onSubmitted, onBack, onToast }) => {
  const groupsConfig = useMemo(() => getGroupsConfig(cycle.period_type), [cycle.period_type]);

  const [scores, setScores]       = useState<number[][]>(() => groupsConfig.map(g => g.criteria.map(() => 0)));
  const [comments, setComments]   = useState('');
  const [recommended, setRecommended] = useState('');
  const [saving, setSaving]       = useState(false);
  const [openGroup, setOpenGroup] = useState<number>(0);

  const setScore = (gIdx: number, cIdx: number, val: number) => {
    setScores(prev => { const next = prev.map(r => [...r]); next[gIdx][cIdx] = val; return next; });
  };

  const groups: EvalGroup[] = groupsConfig.map((gc, gIdx) => ({
    name: gc.name, weight: gc.weight, scores: scores[gIdx],
    group_avg: scores[gIdx].every(s => s > 0) ? calcGroupAvg(scores[gIdx]) : 0,
  }));

  const allFilled     = groups.every((_, gi) => scores[gi].every(s => s > 0));
  const doneCount     = groups.filter((_, gi) => scores[gi].every(s => s > 0)).length;
  const previewScore  = allFilled ? calcTotalScore(groups) : null;
  const previewRating = previewScore !== null ? calcRating(previewScore) : null;

  const handleSubmit = async () => {
    if (!allFilled)        { onToast('Vui lòng đánh giá đủ tất cả tiêu chí', 'error'); return; }
    if (!comments.trim())  { onToast('Vui lòng nhập nhận xét chung', 'error'); return; }
    setSaving(true);
    try {
      await submitEvaluation({ cycle_id: cycle.id, evaluator_role: 'self', evaluator_user_id: userId, groups, comments: comments.trim(), recommended_action: recommended.trim() });
      onToast('Đã gửi tự đánh giá thành công', 'success');
      onSubmitted();
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="animate-fadeInUp space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-medium hover:text-neutral-light transition-all">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Quay lại
      </button>

      {/* Header */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-wider text-neutral-light">✏️ Tự đánh giá</h2>
        <p className="text-sm text-neutral-medium mt-1">{cycle.period_label} — thang điểm 1–5</p>
      </div>

      {/* Sticky score preview */}
      <div className="sticky top-4 z-10 flex justify-between items-center p-4 rounded-[20px] border border-primary/10 bg-surface">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Điểm dự kiến</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-2xl font-black text-neutral-light">{previewScore !== null ? previewScore.toFixed(2) : '—'}</span>
            <span className="text-xs text-neutral-medium">/5</span>
          </div>
        </div>
        {previewRating && (
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg" style={{ background: `${RATING_COLOR[previewRating]}20`, color: RATING_COLOR[previewRating] }}>
            {RATING_LABELS[previewRating]}
          </span>
        )}
        <p className="text-xs text-neutral-medium">{doneCount}/{groups.length} nhóm</p>
      </div>

      {/* Groups */}
      <div className="space-y-3">
        {groupsConfig.map((gc, gIdx) => {
          const groupDone = scores[gIdx].every(s => s > 0);
          const isOpen    = openGroup === gIdx;
          return (
            <div key={gIdx} className={`rounded-[20px] border transition-all overflow-hidden ${isOpen ? 'border-primary/30' : 'border-white/8'} bg-surface`}>
              {/* Group header */}
              <button
                onClick={() => setOpenGroup(isOpen ? -1 : gIdx)}
                className="w-full flex justify-between items-center px-5 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-neutral-light">{gc.name}</span>
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg bg-white/5 text-neutral-medium">{gc.weight}%</span>
                  {groupDone && <span className="text-[9px] font-black text-status-success">✓ {calcGroupAvg(scores[gIdx]).toFixed(1)}</span>}
                </div>
                <svg className={`w-4 h-4 text-neutral-medium transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Criteria */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-5 border-t border-white/5">
                  {gc.criteria.map((criterion, cIdx) => {
                    const val = scores[gIdx][cIdx];
                    return (
                      <div key={cIdx} className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sm font-black text-neutral-light">{criterion.label}</p>
                            <p className="text-xs text-neutral-medium mt-0.5">{criterion.hint}</p>
                          </div>
                          {val > 0 && (
                            <span className="text-xs font-black text-primary shrink-0 ml-4">{val} — {SCORE_LABELS[val]}</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {[1,2,3,4,5].map(n => (
                            <button
                              key={n}
                              onClick={() => setScore(gIdx, cIdx, n)}
                              className={`flex-1 py-2 rounded-xl text-sm font-black border transition-all ${
                                val === n
                                  ? 'border-primary/50 bg-primary/15 text-primary'
                                  : 'border-white/10 text-neutral-medium hover:bg-white/5'
                              }`}
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
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Nhận xét chung *</label>
        <textarea
          rows={4}
          value={comments}
          onChange={e => setComments(e.target.value)}
          placeholder="Thành tựu nổi bật, điều học được, muốn cải thiện..."
          className="w-full bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 transition-all resize-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Đề xuất / kỳ vọng bản thân</label>
        <textarea
          rows={2}
          value={recommended}
          onChange={e => setRecommended(e.target.value)}
          placeholder="VD: Muốn trao đổi thêm về lộ trình thăng tiến..."
          className="w-full bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 transition-all resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving || !allFilled}
        className={`w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50 ${
          allFilled ? 'text-black hover:opacity-90' : 'text-neutral-medium border border-white/10'
        }`}
        style={allFilled ? { background: 'linear-gradient(135deg, #FF9500, #FF6B00)' } : { background: 'rgba(255,255,255,0.03)' }}
      >
        {saving ? 'Đang gửi...' : allFilled ? '✓ Gửi tự đánh giá' : `Chưa điền đủ (${doneCount}/${groups.length} nhóm)`}
      </button>
    </div>
  );
};

export default PortalEvalForm;
