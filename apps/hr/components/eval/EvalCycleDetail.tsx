import React, { useEffect, useState } from 'react';
import { HrEvaluationCycle, HrEvaluationSubmission } from '@/types';
import {
  fetchSubmissions, markComplete1on1, deleteCycle,
  RATING_LABELS, STATUS_LABELS,
} from '../../services/evaluationService';
import EvalScoreCard from './EvalScoreCard';

interface EvalCycleDetailProps {
  cycle: HrEvaluationCycle;
  onBack: () => void;
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const EvalCycleDetail: React.FC<EvalCycleDetailProps> = ({ cycle, onBack, onRefresh, onToast }) => {
  const [submissions, setSubmissions] = useState<HrEvaluationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const emp = cycle.employee;

  const load = async () => {
    setLoading(true);
    try {
      const subs = await fetchSubmissions(cycle.id);
      setSubmissions(subs);
    } catch (e: any) {
      onToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [cycle.id]);

  const selfSub   = submissions.find(s => s.evaluator_role === 'self');
  const leaderSub = submissions.find(s => s.evaluator_role === 'leader');

  const handleMark1on1 = async () => {
    setMarking(true);
    try {
      await markComplete1on1(cycle.id);
      onToast('Đã đánh dấu hoàn thành 1-on-1', 'success');
      onRefresh();
      onBack();
    } catch (e: any) {
      onToast(e.message, 'error');
    } finally {
      setMarking(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCycle(cycle.id);
      onToast('Đã xóa kỳ đánh giá', 'success');
      onRefresh();
      onBack();
    } catch (e: any) {
      onToast(e.message, 'error');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending_self: '#FFA726',
    pending_leader: '#2196F3',
    pending_1on1: '#FF9500',
    completed: '#4CAF50',
  };
  const statusColor = statusColors[cycle.status] ?? '#9D9C9D';

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '12px', fontWeight: 800, color: '#9D9C9D',
        display: 'flex', alignItems: 'center', gap: '6px', padding: 0, marginBottom: '20px',
      }}>
        ← Quay lại danh sách
      </button>

      {/* Header card */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px', padding: '20px 24px', marginBottom: '20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9D9C9D', marginBottom: '4px' }}>
            Kỳ đánh giá
          </p>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: 0 }}>
            {cycle.period_label}
          </h2>
          {emp && (
            <p style={{ fontSize: '13px', color: '#9D9C9D', marginTop: '4px' }}>
              {emp.full_name} — {emp.position || 'N/A'}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status badge */}
          <span style={{
            fontSize: '10px', fontWeight: 800, padding: '5px 12px', borderRadius: '8px',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44`,
          }}>
            {STATUS_LABELS[cycle.status]}
          </span>

          {/* 1-on-1 action */}
          {cycle.status === 'pending_1on1' && (
            <button
              onClick={handleMark1on1}
              disabled={marking}
              style={{
                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '11px', fontWeight: 800, border: 'none',
                background: '#FF9500', color: '#000', opacity: marking ? 0.7 : 1,
              }}
            >
              {marking ? '...' : '🤝 Đã hoàn thành 1-on-1'}
            </button>
          )}

          {/* Delete */}
          {cycle.status !== 'completed' && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '10px', fontWeight: 800, border: '1px solid rgba(244,67,54,0.3)',
                background: 'rgba(244,67,54,0.08)', color: '#F44336',
              }}
            >
              Xóa
            </button>
          )}
          {confirmDelete && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '10px', fontWeight: 800, border: 'none', background: '#F44336', color: '#fff' }}>
                {deleting ? '...' : 'Xác nhận xóa'}
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '10px', fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9D9C9D' }}>
                Huỷ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '20px',
      }}>
        {[
          { label: 'Loại kỳ', value: cycle.period_type === 'probation' ? 'Thử việc' : '6 tháng' },
          { label: 'NV tự đánh giá', value: fmtDate(cycle.self_submitted_at) },
          { label: 'Leader đánh giá', value: fmtDate(cycle.leader_submitted_at) },
          { label: 'Hoàn thành', value: fmtDate(cycle.completed_at) },
          { label: 'Cần 1-on-1', value: cycle.requires_1on1 ? '⚠️ Có' : 'Không' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px' }}>
            <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9D9C9D', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#F2F2F2', margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Submissions */}
      {loading ? (
        <p style={{ color: '#9D9C9D', fontSize: '13px', textAlign: 'center', padding: '40px 0' }} className="animate-pulse">
          Đang tải dữ liệu đánh giá...
        </p>
      ) : (
        <div>
          {/* Score comparison (if both submitted) */}
          {selfSub || leaderSub ? (
            <EvalScoreCard self={selfSub} leader={leaderSub} />
          ) : (
            <div style={{
              textAlign: 'center', padding: '48px', background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px',
            }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</p>
              <p style={{ fontSize: '14px', color: '#9D9C9D', fontWeight: 600 }}>
                Chưa có dữ liệu đánh giá
              </p>
              <p style={{ fontSize: '12px', color: '#9D9C9D', marginTop: '4px' }}>
                {STATUS_LABELS[cycle.status]}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvalCycleDetail;
