import React, { useEffect, useState } from 'react';
import { HrEvaluationCycle, HrEmployee, EvalStatus } from '@/types';
import { fetchEvaluationCycles, STATUS_LABELS } from '../../services/evaluationService';
import { AccountUser } from '@/types';
import EvalCreateModal from './EvalCreateModal';
import EvalCycleDetail from './EvalCycleDetail';

interface EvalCycleListProps {
  employees: HrEmployee[];
  currentUser: AccountUser;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

type FilterMode = 'all' | 'active' | 'completed';

const STATUS_COLOR: Record<EvalStatus, string> = {
  pending_self:   '#FFA726',
  pending_leader: '#2196F3',
  pending_1on1:   '#FF9500',
  completed:      '#4CAF50',
};
const STATUS_ICON: Record<EvalStatus, string> = {
  pending_self:   '⏳',
  pending_leader: '⏳',
  pending_1on1:   '🤝',
  completed:      '✅',
};

const EvalCycleList: React.FC<EvalCycleListProps> = ({ employees, currentUser, onToast }) => {
  const [cycles, setCycles] = useState<HrEvaluationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [viewingCycle, setViewingCycle] = useState<HrEvaluationCycle | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchEvaluationCycles();
      setCycles(data);
    } catch (e: any) {
      onToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (viewingCycle) {
    return (
      <EvalCycleDetail
        cycle={viewingCycle}
        onBack={() => setViewingCycle(null)}
        onRefresh={load}
        onToast={onToast}
      />
    );
  }

  const filtered = cycles.filter(c => {
    if (filter === 'active')    return c.status !== 'completed';
    if (filter === 'completed') return c.status === 'completed';
    return true;
  });

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            📋 Đánh giá nhân viên
          </h2>
          <p style={{ fontSize: '12px', color: '#9D9C9D', marginTop: '4px' }}>
            {cycles.length} kỳ · {cycles.filter(c => c.status !== 'completed').length} đang chờ
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 18px', borderRadius: '10px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 800, border: 'none',
            background: '#FF9500', color: '#000',
          }}
        >
          + Tạo kỳ đánh giá
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {([
          { key: 'all', label: 'Tất cả' },
          { key: 'active', label: 'Đang chờ' },
          { key: 'completed', label: 'Hoàn thành' },
        ] as { key: FilterMode; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '7px 16px', borderRadius: '7px', cursor: 'pointer',
              fontSize: '11px', fontWeight: 800, border: 'none',
              background: filter === tab.key ? 'rgba(255,149,0,0.15)' : 'transparent',
              color: filter === tab.key ? '#FF9500' : '#9D9C9D',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#9D9C9D', fontSize: '13px' }} className="animate-pulse">Đang tải...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px',
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: '12px',
        }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>📋</p>
          <p style={{ fontSize: '14px', color: '#9D9C9D', fontWeight: 600 }}>
            {filter === 'all' ? 'Chưa có kỳ đánh giá nào' : 'Không có kỳ phù hợp'}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                marginTop: '16px', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 800, border: 'none', background: '#FF9500', color: '#000',
              }}
            >
              Tạo kỳ đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(cycle => {
            const emp = cycle.employee;
            const sc = STATUS_COLOR[cycle.status];
            return (
              <div
                key={cycle.id}
                onClick={() => setViewingCycle(cycle)}
                style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '12px', padding: '14px 18px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: '12px', transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
              >
                {/* Left: Employee + period info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#F2F2F2', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {emp?.full_name ?? '—'} &nbsp;
                    <span style={{ fontSize: '11px', color: '#9D9C9D', fontWeight: 600 }}>
                      {cycle.period_type === 'probation' ? 'Thử việc' : '6 tháng'}
                    </span>
                  </p>
                  <p style={{ fontSize: '12px', color: '#9D9C9D', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cycle.period_label} · {fmtDate(cycle.created_at)}
                  </p>
                </div>

                {/* Right: status badge */}
                <span style={{
                  fontSize: '10px', fontWeight: 800, padding: '5px 10px', borderRadius: '7px',
                  textTransform: 'uppercase' as const, letterSpacing: '0.07em', whiteSpace: 'nowrap',
                  background: `${sc}18`, color: sc, border: `1px solid ${sc}44`,
                }}>
                  {STATUS_ICON[cycle.status]} {STATUS_LABELS[cycle.status]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <EvalCreateModal
          employees={employees}
          currentUser={currentUser}
          onCreated={() => { load(); onToast('Đã tạo kỳ đánh giá', 'success'); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
};

export default EvalCycleList;
