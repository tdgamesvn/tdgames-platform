import React, { useEffect, useState } from 'react';
import { HrEvaluationCycle, HrEvaluationSubmission, EvalStatus } from '@/types';
import { fetchMyCycles, fetchSubmissions, STATUS_LABELS } from '../../../hr/services/evaluationService';
import PortalEvalForm from './PortalEvalForm';
import PortalEvalResult from './PortalEvalResult';

interface PortalEvalListProps {
  employeeId: string;
  userId:     string;
  onToast:    (msg: string, type: 'success' | 'error') => void;
}

type ViewMode = 'list' | 'form' | 'result';

const STATUS_COLOR: Record<EvalStatus, string> = {
  pending_self:   '#FFA726',
  pending_leader: '#0A84FF',
  pending_1on1:   '#FF9500',
  completed:      '#34C759',
};
const STATUS_ICON: Record<EvalStatus, string> = {
  pending_self:   '✏️',
  pending_leader: '⏳',
  pending_1on1:   '🤝',
  completed:      '✅',
};

const PortalEvalList: React.FC<PortalEvalListProps> = ({ employeeId, userId, onToast }) => {
  const [cycles, setCycles]           = useState<HrEvaluationCycle[]>([]);
  const [loading, setLoading]         = useState(true);
  const [view, setView]               = useState<ViewMode>('list');
  const [selected, setSelected]       = useState<HrEvaluationCycle | null>(null);
  const [submissions, setSubmissions] = useState<HrEvaluationSubmission[]>([]);

  const loadCycles = async () => {
    setLoading(true);
    try { setCycles(await fetchMyCycles(employeeId)); }
    catch (e: any) { onToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCycles(); }, [employeeId]);

  const openCycle = async (cycle: HrEvaluationCycle) => {
    setSelected(cycle);
    try { setSubmissions(await fetchSubmissions(cycle.id)); } catch { setSubmissions([]); }
    setView(cycle.status === 'pending_self' ? 'form' : 'result');
  };

  const handleBack = () => { setView('list'); setSelected(null); setSubmissions([]); };

  const handleFormSubmitted = async () => {
    await loadCycles();
    if (selected) {
      const subs = await fetchSubmissions(selected.id).catch(() => []);
      setSubmissions(subs);
      const updated = await fetchMyCycles(employeeId).catch(() => []);
      const refreshed = updated.find(c => c.id === selected.id);
      if (refreshed) setSelected(refreshed);
    }
    setView('result');
  };

  if (view === 'form' && selected)
    return <PortalEvalForm cycle={selected} userId={userId} onSubmitted={handleFormSubmitted} onBack={handleBack} onToast={onToast} />;

  if (view === 'result' && selected)
    return <PortalEvalResult cycle={selected} self={submissions.find(s => s.evaluator_role === 'self')} leader={submissions.find(s => s.evaluator_role === 'leader')} onBack={handleBack} />;

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Đánh giá</h2>
        <p className="text-neutral-medium text-sm mt-1">Kỳ đánh giá của bạn</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Tổng kỳ',    value: cycles.length,                                      color: '#FF9500' },
          { label: 'Cần điền',   value: cycles.filter(c => c.status === 'pending_self').length, color: '#FFA726' },
        ].map(c => (
          <div key={c.label} className="p-5 rounded-[20px] border border-primary/10 bg-surface">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">{c.label}</p>
            <p className="text-3xl font-black" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-20">
          <p className="text-neutral-medium text-sm animate-pulse">Đang tải...</p>
        </div>
      ) : cycles.length === 0 ? (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-neutral-medium text-sm">Chưa có kỳ đánh giá nào</p>
          <p className="text-xs mt-1 text-neutral-700">HR sẽ tạo kỳ đánh giá khi đến hạn thử việc hoặc review định kỳ.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map(cycle => {
            const sc      = STATUS_COLOR[cycle.status];
            const isPending = cycle.status === 'pending_self';
            return (
              <div
                key={cycle.id}
                onClick={() => openCycle(cycle)}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                  isPending ? 'border-primary/20 hover:border-primary/40' : 'border-white/5 hover:border-white/10'
                }`}
                style={{ background: isPending ? 'rgba(255,149,0,0.03)' : 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-neutral-light truncate">{cycle.period_label}</p>
                  <p className="text-xs text-neutral-medium mt-0.5">
                    {cycle.period_type === 'probation' ? 'Thử việc' : 'Review 6 tháng'}
                    {' · '}{new Date(cycle.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0" style={{ background: `${sc}20`, color: sc }}>
                  {STATUS_ICON[cycle.status]} {STATUS_LABELS[cycle.status]}
                </span>
                <svg className="w-4 h-4 text-neutral-medium shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalEvalList;
