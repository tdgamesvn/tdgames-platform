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

// Score visual config — each level has distinct color + label
const SCORE_CONFIG: Record<number, { color: string; label: string; bg: string }> = {
  1: { color: '#FF375F', bg: 'rgba(255,55,95,0.15)',   label: 'Chưa đạt' },
  2: { color: '#FF9500', bg: 'rgba(255,149,0,0.15)',   label: 'Cần cải thiện' },
  3: { color: '#0A84FF', bg: 'rgba(10,132,255,0.15)',  label: 'Đạt' },
  4: { color: '#30D158', bg: 'rgba(48,209,88,0.15)',   label: 'Tốt' },
  5: { color: '#34C759', bg: 'rgba(52,199,89,0.2)',    label: 'Xuất sắc' },
};

const RATING_COLOR: Record<string, string> = {
  excellent:         '#34C759',
  good:              '#0A84FF',
  meets:             '#FFA726',
  needs_improvement: '#FF375F',
};

const PortalEvalForm: React.FC<PortalEvalFormProps> = ({ cycle, userId, onSubmitted, onBack, onToast }) => {
  const groupsConfig = useMemo(() => getGroupsConfig(cycle.period_type), [cycle.period_type]);

  const [scores, setScores]           = useState<number[][]>(() => groupsConfig.map(g => g.criteria.map(() => 0)));
  const [comments, setComments]       = useState('');
  const [recommended, setRecommended] = useState('');
  const [saving, setSaving]           = useState(false);
  // All groups open by default for desktop
  const [openGroups, setOpenGroups]   = useState<Set<number>>(() => new Set(groupsConfig.map((_, i) => i)));

  const toggleGroup = (idx: number) =>
    setOpenGroups(prev => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s; });

  const setScore = (gIdx: number, cIdx: number, val: number) => {
    setScores(prev => { const next = prev.map(r => [...r]); next[gIdx][cIdx] = val; return next; });
    // Auto-open next group when current group is complete
    const newScores = scores.map((row, gi) => gi === gIdx ? row.map((v, ci) => ci === cIdx ? val : v) : [...row]);
    const groupDone = newScores[gIdx].every(s => s > 0);
    if (groupDone && gIdx < groupsConfig.length - 1) {
      setOpenGroups(prev => { const s = new Set(prev); s.add(gIdx + 1); return s; });
    }
  };

  const groups: EvalGroup[] = groupsConfig.map((gc, gi) => ({
    name: gc.name, weight: gc.weight, scores: scores[gi],
    group_avg: scores[gi].every(s => s > 0) ? calcGroupAvg(scores[gi]) : 0,
  }));

  const allFilled     = groups.every((_, gi) => scores[gi].every(s => s > 0));
  const doneCount     = groups.filter((_, gi) => scores[gi].every(s => s > 0)).length;
  const totalCriteria = groupsConfig.reduce((a, g) => a + g.criteria.length, 0);
  const filledCriteria = scores.reduce((a, row) => a + row.filter(s => s > 0).length, 0);
  const previewScore  = allFilled ? calcTotalScore(groups) : null;
  const previewRating = previewScore !== null ? calcRating(previewScore) : null;

  const handleSubmit = async () => {
    if (!allFilled)       { onToast('Vui lòng đánh giá đủ tất cả tiêu chí', 'error'); return; }
    if (!comments.trim()) { onToast('Vui lòng nhập nhận xét chung', 'error'); return; }
    setSaving(true);
    try {
      await submitEvaluation({
        cycle_id: cycle.id, evaluator_role: 'self', evaluator_user_id: userId,
        groups, comments: comments.trim(), recommended_action: recommended.trim(),
      });
      onToast('Đã gửi tự đánh giá thành công', 'success');
      onSubmitted();
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-medium hover:text-neutral-light transition-all">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Quay lại
      </button>

      {/* Header */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-wider text-neutral-light">✏️ Tự đánh giá</h2>
        <p className="text-sm text-neutral-medium mt-1">{cycle.period_label}</p>
      </div>

      {/* Score scale legend */}
      <div className="flex gap-2 p-3 rounded-2xl border border-white/5 bg-surface">
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-medium mr-1 self-center">Thang điểm:</span>
        {[1,2,3,4,5].map(n => (
          <div key={n} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-1 justify-center"
            style={{ background: SCORE_CONFIG[n].bg, border: `1px solid ${SCORE_CONFIG[n].color}30` }}>
            <span className="text-sm font-black" style={{ color: SCORE_CONFIG[n].color }}>{n}</span>
            <span className="text-[9px] font-bold hidden md:block" style={{ color: SCORE_CONFIG[n].color }}>{SCORE_CONFIG[n].label}</span>
          </div>
        ))}
      </div>

      {/* Sticky progress + score preview */}
      <div className="sticky top-4 z-10 p-4 rounded-[20px] border border-primary/10 bg-surface space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Tiến độ</p>
            <p className="text-sm font-black text-neutral-light mt-0.5">{filledCriteria}/{totalCriteria} tiêu chí · {doneCount}/{groups.length} nhóm</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Điểm dự kiến</p>
            <div className="flex items-baseline gap-1.5 justify-end mt-0.5">
              <span className="text-2xl font-black text-neutral-light">{previewScore !== null ? previewScore.toFixed(2) : '—'}</span>
              <span className="text-xs text-neutral-medium">/5</span>
              {previewRating && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ml-1"
                  style={{ background: `${RATING_COLOR[previewRating]}20`, color: RATING_COLOR[previewRating] }}>
                  {RATING_LABELS[previewRating]}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(filledCriteria / totalCriteria) * 100}%`, background: 'linear-gradient(90deg, #FF9500, #FF6B00)' }} />
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {groupsConfig.map((gc, gIdx) => {
          const groupScores    = scores[gIdx];
          const groupFilled    = groupScores.filter(s => s > 0).length;
          const groupDone      = groupFilled === gc.criteria.length;
          const isOpen         = openGroups.has(gIdx);
          const groupAvgVal    = groupDone ? calcGroupAvg(groupScores) : null;

          return (
            <div key={gIdx} className={`rounded-[20px] overflow-hidden transition-all ${
              groupDone ? 'border border-status-success/30' : isOpen ? 'border border-primary/25' : 'border border-white/8'
            } bg-surface`}>
              {/* Group header */}
              <button onClick={() => toggleGroup(gIdx)}
                className="w-full flex justify-between items-center px-5 py-4 text-left gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Done indicator */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                    groupDone ? 'bg-status-success/20 text-status-success' : 'bg-white/5 text-neutral-medium'
                  }`}>
                    {groupDone ? '✓' : gIdx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-neutral-light">{gc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-bold uppercase text-neutral-medium">Trọng số {gc.weight}%</span>
                      <span className="text-[9px] text-neutral-medium">·</span>
                      <span className={`text-[9px] font-bold ${groupDone ? 'text-status-success' : 'text-neutral-medium'}`}>
                        {groupFilled}/{gc.criteria.length} tiêu chí
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {groupAvgVal !== null && (
                    <span className="text-sm font-black text-status-success">{groupAvgVal.toFixed(1)}</span>
                  )}
                  <svg className={`w-4 h-4 text-neutral-medium transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Criteria */}
              {isOpen && (
                <div className="border-t border-white/5 divide-y divide-white/5">
                  {gc.criteria.map((criterion, cIdx) => {
                    const val = groupScores[cIdx];
                    const sc  = val > 0 ? SCORE_CONFIG[val] : null;
                    return (
                      <div key={cIdx} className="px-5 py-4">
                        {/* Criterion info */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-black text-neutral-light">{criterion.label}</p>
                            <p className="text-xs text-neutral-medium mt-0.5">{criterion.hint}</p>
                          </div>
                          {sc && (
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg shrink-0"
                              style={{ background: sc.bg, color: sc.color }}>
                              {val} — {sc.label}
                            </span>
                          )}
                        </div>
                        {/* Score buttons */}
                        <div className="flex gap-2">
                          {[1,2,3,4,5].map(n => {
                            const cfg = SCORE_CONFIG[n];
                            const active = val === n;
                            return (
                              <button key={n} onClick={() => setScore(gIdx, cIdx, n)}
                                className="flex-1 flex flex-col items-center py-2.5 rounded-xl border transition-all gap-0.5"
                                style={{
                                  background:  active ? cfg.bg : 'rgba(255,255,255,0.03)',
                                  borderColor: active ? `${cfg.color}60` : 'rgba(255,255,255,0.08)',
                                  color:       active ? cfg.color : '#9D9C9D',
                                }}>
                                <span className="text-base font-black leading-none">{n}</span>
                                <span className="text-[9px] font-bold uppercase leading-none hidden sm:block">{cfg.label}</span>
                              </button>
                            );
                          })}
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
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">
          Nhận xét chung <span className="text-red-400">*</span>
        </label>
        <textarea rows={4} value={comments} onChange={e => setComments(e.target.value)}
          placeholder="Chia sẻ thành tựu nổi bật trong kỳ này, điều bạn học được, và những gì muốn cải thiện..."
          className="w-full bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 transition-all resize-none" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Đề xuất / Kỳ vọng bản thân</label>
        <textarea rows={2} value={recommended} onChange={e => setRecommended(e.target.value)}
          placeholder="VD: Muốn được đào tạo thêm về X, muốn trao đổi về lộ trình thăng tiến..."
          className="w-full bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 transition-all resize-none" />
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={saving || !allFilled}
        className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50"
        style={{
          background: allFilled ? 'linear-gradient(135deg, #FF9500, #FF6B00)' : 'rgba(255,255,255,0.05)',
          color:      allFilled ? '#000' : '#9D9C9D',
          cursor:     (saving || !allFilled) ? 'not-allowed' : 'pointer',
        }}>
        {saving ? 'Đang gửi...' : allFilled
          ? '✓ Gửi tự đánh giá'
          : `Còn ${totalCriteria - filledCriteria} tiêu chí chưa điền`}
      </button>
    </div>
  );
};

export default PortalEvalForm;
