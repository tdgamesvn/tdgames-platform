import React, { useEffect, useState } from 'react';
import { HrEvaluationCycle, HrEvaluationSubmission, EvalStatus } from '@/types';
import { fetchMyCycles, fetchSubmissions, STATUS_LABELS } from '../../../hr/services/evaluationService';
import PortalEvalForm from './PortalEvalForm';
import PortalEvalResult from './PortalEvalResult';

interface PortalEvalListProps {
  employeeId: string;
  userId: string;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

type ViewMode = 'list' | 'form' | 'result';

const STATUS_COLOR: Record<EvalStatus, string> = {
  pending_self:   '#FFA726',
  pending_leader: '#2196F3',
  pending_1on1:   '#FF9500',
  completed:      '#4CAF50',
};
const STATUS_ICON: Record<EvalStatus, string> = {
  pending_self:   '✏️',
  pending_leader: '⏳',
  pending_1on1:   '🤝',
  completed:      '✅',
};

const PortalEvalList: React.FC<PortalEvalListProps> = ({ employeeId, userId, onToast }) => {
  const [cycles, setCycles] = useState<HrEvaluationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [selected, setSelected] = useState<HrEvaluationCycle | null>(null);
  const [submissions, setSubmissions] = useState<HrEvaluationSubmission[]>([]);

  const loadCycles = async () => {
    setLoading(true);
    try {
      const data = await fetchMyCycles(employeeId);
      setCycles(data);
    } catch (e: any) {
      onToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCycles(); }, [employeeId]);

  const openCycle = async (cycle: HrEvaluationCycle) => {
    setSelected(cycle);
    try {
      const subs = await fetchSubmissions(cycle.id);
      setSubmissions(subs);
    } catch {
      setSubmissions([]);
    }
    if (cycle.status === 'pending_self') {
      setView('form');
    } else {
      setView('result');
    }
  };

  const handleBack = () => {
    setView('list');
    setSelected(null);
    setSubmissions([]);
  };

  const handleFormSubmitted = async () => {
    await loadCycles();
    if (selected) {
      const subs = await fetchSubmissions(selected.id).catch(() => []);
      setSubmissions(subs);
      // Refresh selected cycle from new data
      const updated = await fetchMyCycles(employeeId).catch(() => []);
      const refreshed = updated.find(c => c.id === selected.id);
      if (refreshed) setSelected(refreshed);
    }
    setView('result');
  };

  if (view === 'form' && selected) {
    return (
      <PortalEvalForm
        cycle={selected}
        userId={userId}
        onSubmitted={handleFormSubmitted}
        onBack={handleBack}
        onToast={onToast}
      />
    );
  }

  if (view === 'result' && selected) {
    return (
      <PortalEvalResult
        cycle={selected}
        self={submissions.find(s => s.evaluator_role === 'self')}
        leader={submissions.find(s => s.evaluator_role === 'leader')}
        onBack={handleBack}
      />
    );
  }

  // List view
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: 0 }}>
          📋 Đánh giá của tôi
        </h2>
        <p style={{ fontSize: '12px', color: '#9D9C9D', marginTop: '4px' }}>
          Lịch sử kỳ đánh giá — nhấn vào kỳ để xem hoặc điền
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#9D9C9D', fontSize: '13px' }} className="animate-pulse">Đang tải...</p>
        </div>
      ) : cycles.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px',
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: '12px',
        }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>📋</p>
          <p style={{ fontSize: '14px', color: '#9D9C9D', fontWeight: 600 }}>Chưa có kỳ đánh giá nào</p>
          <p style={{ fontSize: '12px', color: '#9D9C9D', marginTop: '6px' }}>
            HR sẽ tạo kỳ đánh giá khi đến hạn thử việc hoặc review định kỳ.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {cycles.map(cycle => {
            const sc = STATUS_COLOR[cycle.status];
            const isPending = cycle.status === 'pending_self';
            return (
              <div
                key={cycle.id}
                onClick={() => openCycle(cycle)}
                style={{
                  background: isPending ? 'rgba(255,149,0,0.04)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isPending ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '12px', padding: '16px 20px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: '12px', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = isPending ? 'rgba(255,149,0,0.4)' : 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = isPending ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.07)'; }}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#F2F2F2', margin: 0 }}>
                    {cycle.period_label}
                  </p>
                  <p style={{ fontSize: '12px', color: '#9D9C9D', margin: '3px 0 0' }}>
                    {cycle.period_type === 'probation' ? 'Thử việc' : 'Review 6 tháng'}
                    {' · '}
                    {new Date(cycle.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 800, padding: '5px 10px', borderRadius: '7px',
                    textTransform: 'uppercase' as const, letterSpacing: '0.07em', whiteSpace: 'nowrap',
                    background: `${sc}18`, color: sc, border: `1px solid ${sc}44`,
                  }}>
                    {STATUS_ICON[cycle.status]} {STATUS_LABELS[cycle.status]}
                  </span>
                  <span style={{ color: '#9D9C9D', fontSize: '16px' }}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalEvalList;
