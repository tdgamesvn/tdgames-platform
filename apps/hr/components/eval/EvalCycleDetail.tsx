import React, { useEffect, useState } from 'react';
import { HrEvaluationCycle, HrEvaluationSubmission } from '@/types';
import { fetchSubmissions, markComplete1on1, deleteCycle, STATUS_LABELS } from '../../services/evaluationService';
import EvalScoreCard from './EvalScoreCard';

interface EvalCycleDetailProps {
  cycle: HrEvaluationCycle;
  onBack: () => void;
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending_self:   '#FFA726',
  pending_leader: '#0A84FF',
  pending_1on1:   '#FF9500',
  completed:      '#34C759',
};

const EvalCycleDetail: React.FC<EvalCycleDetailProps> = ({ cycle, onBack, onRefresh, onToast }) => {
  const [submissions, setSubmissions]   = useState<HrEvaluationSubmission[]>([]);
  const [loading, setLoading]           = useState(true);
  const [marking, setMarking]           = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          <span
            className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
            style={{ background: `${sc}20`, color: sc }}
          >
            {STATUS_LABELS[cycle.status]}
          </span>

          {cycle.status === 'pending_1on1' && (
            <button
              onClick={handleMark1on1}
              disabled={marking}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-black hover:opacity-90 transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}
            >
              {marking ? '...' : '🤝 Đã hoàn thành 1-on-1'}
            </button>
          )}

          {cycle.status !== 'completed' && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/20 hover:bg-red-500/5 transition-all"
            >
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

      {/* Metadata grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Loại kỳ',       value: cycle.period_type === 'probation' ? 'Thử việc' : '6 tháng' },
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

      {/* Submissions */}
      {loading ? (
        <div className="text-center py-16">
          <p className="text-neutral-medium text-sm animate-pulse">Đang tải dữ liệu đánh giá...</p>
        </div>
      ) : (selfSub || leaderSub) ? (
        <EvalScoreCard self={selfSub} leader={leaderSub} />
      ) : (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">⏳</p>
          <p className="text-neutral-medium text-sm">Chưa có dữ liệu đánh giá</p>
          <p className="text-xs mt-1 text-neutral-700">{STATUS_LABELS[cycle.status]}</p>
        </div>
      )}
    </div>
  );
};

export default EvalCycleDetail;
