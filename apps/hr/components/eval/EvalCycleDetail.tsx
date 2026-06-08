import React, { useEffect, useState, useMemo } from 'react';
import { HrEvaluationCycle, HrEvaluationSubmission, EvalGroup, AccountUser } from '@/types';
import {
  fetchSubmissions, markComplete1on1, deleteCycle, STATUS_LABELS,
  getGroupsConfig, calcTotalScore, calcRating, calcGroupAvg, submitEvaluation,
  RATING_LABELS,
} from '../../services/evaluationService';
import EvalScoreCard from './EvalScoreCard';

interface EvalCycleDetailProps {
  cycle:       HrEvaluationCycle;
  currentUser: AccountUser;
  onBack:      () => void;
  onRefresh:   () => void;
  onToast:     (msg: string, type: 'success' | 'error') => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending_self:   '#FFA726',
  pending_leader: '#0A84FF',
  pending_1on1:   '#FF9500',
  completed:      '#34C759',
};
const SCORE_CONFIG: Record<number, { color: string; bg: string; label: string }> = {
  1: { color: '#FF375F', bg: 'rgba(255,55,95,0.15)',  label: 'Chưa đạt' },
  2: { color: '#FF9500', bg: 'rgba(255,149,0,0.15)',  label: 'Cần cải thiện' },
  3: { color: '#0A84FF', bg: 'rgba(10,132,255,0.15)', label: 'Đạt' },
  4: { color: '#30D158', bg: 'rgba(48,209,88,0.15)',  label: 'Tốt' },
  5: { color: '#34C759', bg: 'rgba(52,199,89,0.2)',   label: 'Xuất sắc' },
};
// kept for backward compatibility
const SCORE_LABELS: Record<number, string> = {
  1: 'Chưa đạt', 2: 'Cần cải thiện', 3: 'Đạt', 4: 'Tốt', 5: 'Xuất sắc',
};
const RATING_COLOR: Record<string, string> = {
  excellent:         '#34C759',  // green  — Vượt kỳ vọng
  good:              '#0A84FF',  // blue   — Đạt yêu cầu
  meets:             '#FFA726',  // amber  — Cần cải thiện
  needs_improvement: '#FF375F',  // red    — Không đạt
};

const EvalCycleDetail: React.FC<EvalCycleDetailProps> = ({ cycle, currentUser, onBack, onRefresh, onToast }) => {
  const [submissions, setSubmissions]     = useState<HrEvaluationSubmission[]>([]);
  const [loading, setLoading]             = useState(true);
  const [marking, setMarking]             = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Leader form state
  const groupsConfig = useMemo(() => getGroupsConfig(cycle.period_type), [cycle.period_type]);
  const [scores, setScores]       = useState<number[][]>(() => groupsConfig.map(g => g.criteria.map(() => 0)));
  const [comments, setComments]   = useState('');
  const [recommended, setRecommended] = useState('');
  const [saving, setSaving]       = useState(false);
  const [openGroup, setOpenGroup] = useState<number>(0);

  const emp = cycle.employee;

  const load = async () => {
    setLoading(true);
    try { setSubmissions(await fetchSubmissions(cycle.id)); }
    catch (e: any) { onToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [cycle.id]);

  const selfSub   = submissions.find(s => s.evaluator_role === 'self');
  const leaderSub = submissions.find(s => s.evaluator_role === 'leader');
  const sc = STATUS_COLOR[cycle.status] ?? '#9D9C9D';

  // Show leader form: status = pending_leader AND no leader submission yet
  const showLeaderForm = cycle.status === 'pending_leader' && !leaderSub;

  // Leader form score helpers
  const setScore = (gIdx: number, cIdx: number, val: number) => {
    setScores(prev => { const next = prev.map(r => [...r]); next[gIdx][cIdx] = val; return next; });
  };
  const groups: EvalGroup[] = groupsConfig.map((gc, gi) => ({
    name: gc.name, weight: gc.weight, scores: scores[gi],
    group_avg: scores[gi].every(s => s > 0) ? calcGroupAvg(scores[gi]) : 0,
  }));
  const allFilled    = groups.every((_, gi) => scores[gi].every(s => s > 0));
  const doneCount    = groups.filter((_, gi) => scores[gi].every(s => s > 0)).length;
  const previewScore = allFilled ? calcTotalScore(groups) : null;
  const previewRating = previewScore !== null ? calcRating(previewScore) : null;

  const handleSubmitLeader = async () => {
    if (!allFilled)        { onToast('Vui lòng đánh giá đủ tất cả tiêu chí', 'error'); return; }
    if (!comments.trim())  { onToast('Vui lòng nhập nhận xét', 'error'); return; }
    setSaving(true);
    try {
      await submitEvaluation({
        cycle_id: cycle.id,
        evaluator_role: 'leader',
        evaluator_user_id: currentUser.id,
        groups, comments: comments.trim(),
        recommended_action: recommended.trim(),
      });
      onToast('Đã lưu đánh giá leader', 'success');
      onRefresh();
      await load();
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleMark1on1 = async () => {
    setMarking(true);
    try {
      await markComplete1on1(cycle.id);
      onToast('Đã đánh dấu hoàn thành 1-on-1', 'success');
      onRefresh(); onBack();
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setMarking(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCycle(cycle.id);
      onToast('Đã xóa kỳ đánh giá', 'success');
      onRefresh(); onBack();
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setDeleting(false); setConfirmDelete(false); }
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-medium hover:text-neutral-light transition-all">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Quay lại
      </button>

      {/* Header card */}
      <div className="flex flex-wrap justify-between items-start gap-4 p-5 rounded-[20px] border border-primary/10 bg-surface">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Kỳ đánh giá</p>
          <h2 className="text-lg font-black text-neutral-light">{cycle.period_label}</h2>
          {emp && <p className="text-sm text-neutral-medium mt-1">{emp.full_name} — {emp.position || 'N/A'}</p>}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg" style={{ background: `${sc}20`, color: sc }}>
            {STATUS_LABELS[cycle.status]}
          </span>

          {cycle.status === 'pending_1on1' && (
            <button onClick={handleMark1on1} disabled={marking}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-black hover:opacity-90 transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}>
              {marking ? '...' : '🤝 Đã hoàn thành 1-on-1'}
            </button>
          )}

          {cycle.status !== 'completed' && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/20 hover:bg-red-500/5 transition-all">
              Xóa
            </button>
          )}
          {confirmDelete && (
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white bg-red-500 hover:opacity-90 transition-all disabled:opacity-50">
                {deleting ? '...' : 'Xác nhận xóa'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
                Huỷ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Loại kỳ',        value: cycle.period_type === 'probation' ? 'Thử việc' : '6 tháng' },
          { label: 'NV tự đánh giá', value: fmtDate(cycle.self_submitted_at) },
          { label: 'Leader đánh giá', value: fmtDate(cycle.leader_submitted_at) },
          { label: 'Hoàn thành',     value: fmtDate(cycle.completed_at) },
          { label: 'Cần 1-on-1',     value: cycle.requires_1on1 ? '⚠️ Có' : 'Không' },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-[20px] border border-white/5 bg-surface">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">{label}</p>
            <p className="text-sm font-semibold text-neutral-light">{value}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16">
          <p className="text-neutral-medium text-sm animate-pulse">Đang tải...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Leader form: show self results as compact reference above form ── */}
          {showLeaderForm && selfSub && (
            <div className="rounded-[20px] border border-white/8 p-4 space-y-3" style={{ background: 'rgba(33,150,243,0.04)' }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#0A84FF' }}>Tự đánh giá của nhân viên — {selfSub.total_score.toFixed(2)}/5</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {selfSub.groups.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[10px] text-neutral-medium truncate">{g.name}</span>
                        <span className="text-[10px] font-black text-neutral-light ml-1">{g.group_avg.toFixed(1)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/8">
                        <div className="h-full rounded-full" style={{ width: `${(g.group_avg / 5) * 100}%`, background: '#0A84FF' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {selfSub.comments && <p className="text-xs text-neutral-medium italic">"{selfSub.comments}"</p>}
            </div>
          )}

          {/* ── Leader form ── */}
          {showLeaderForm && (
            <div className="rounded-[20px] border border-primary/20 p-5 space-y-5" style={{ background: 'rgba(255,149,0,0.03)' }}>
              {/* Form header + live preview */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-base font-black uppercase tracking-wider text-neutral-light">✍️ Đánh giá của Leader</p>
                  <p className="text-xs text-neutral-medium mt-0.5">Đánh giá độc lập — thang điểm 1–5</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Điểm dự kiến</p>
                  <div className="flex items-baseline gap-1.5 justify-end mt-0.5">
                    <span className="text-2xl font-black text-neutral-light">{previewScore !== null ? previewScore.toFixed(2) : '—'}</span>
                    <span className="text-xs text-neutral-medium">/5</span>
                  </div>
                  {previewRating && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mt-1"
                      style={{ background: `${RATING_COLOR[previewRating]}20`, color: RATING_COLOR[previewRating] }}>
                      {RATING_LABELS[previewRating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Groups */}
              <div className="space-y-3">
                {groupsConfig.map((gc, gIdx) => {
                  const groupDone = scores[gIdx].every(s => s > 0);
                  const isOpen    = openGroup === gIdx;
                  return (
                    <div key={gIdx} className={`rounded-2xl border transition-all overflow-hidden bg-surface ${isOpen ? 'border-primary/30' : 'border-white/8'}`}>
                      <button onClick={() => setOpenGroup(isOpen ? -1 : gIdx)}
                        className="w-full flex justify-between items-center px-4 py-3 text-left">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-neutral-light">{gc.name}</span>
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg bg-white/5 text-neutral-medium">{gc.weight}%</span>
                          {groupDone && <span className="text-[9px] font-black text-status-success">✓ {calcGroupAvg(scores[gIdx]).toFixed(1)}</span>}
                        </div>
                        <svg className={`w-4 h-4 text-neutral-medium transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div className="border-t border-white/5 divide-y divide-white/5">
                          {gc.criteria.map((criterion, cIdx) => {
                            const val = scores[gIdx][cIdx];
                            const sc  = val > 0 ? SCORE_CONFIG[val] : null;
                            return (
                              <div key={cIdx} className="px-4 py-4">
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
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Nhận xét của Leader *</label>
                <textarea rows={3} value={comments} onChange={e => setComments(e.target.value)}
                  placeholder="Đánh giá tổng quan về hiệu suất, thái độ, điểm mạnh / cần cải thiện..."
                  className="w-full bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 transition-all resize-none" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Đề xuất / Quyết định</label>
                <textarea rows={2} value={recommended} onChange={e => setRecommended(e.target.value)}
                  placeholder="VD: Đề xuất chính thức, tăng lương, gia hạn thử việc..."
                  className="w-full bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/40 transition-all resize-none" />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-medium">{doneCount}/{groups.length} nhóm hoàn tất</p>
                <button onClick={handleSubmitLeader} disabled={saving || !allFilled}
                  className="px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider text-black hover:opacity-90 transition-all disabled:opacity-50"
                  style={{ background: allFilled ? '#FF9500' : 'rgba(255,255,255,0.1)', color: allFilled ? '#000' : '#9D9C9D' }}>
                  {saving ? 'Đang lưu...' : '✓ Lưu đánh giá Leader'}
                </button>
              </div>
            </div>
          )}

          {/* Score comparison (after both submitted) */}
          {(selfSub || leaderSub) && !showLeaderForm && (
            <EvalScoreCard self={selfSub} leader={leaderSub} />
          )}

          {/* Empty state */}
          {!selfSub && !leaderSub && !showLeaderForm && (
            <div className="text-center py-16 text-neutral-700 text-sm">
              <p className="text-3xl mb-3">⏳</p>
              <p className="text-neutral-medium text-sm">Chưa có dữ liệu đánh giá</p>
              <p className="text-xs mt-1 text-neutral-700">{STATUS_LABELS[cycle.status]}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvalCycleDetail;
