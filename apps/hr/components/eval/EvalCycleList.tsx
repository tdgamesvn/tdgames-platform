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
  pending_leader: '#0A84FF',
  pending_1on1:   '#FF9500',
  completed:      '#34C759',
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
        currentUser={currentUser}
        onBack={() => setViewingCycle(null)}
        onRefresh={load}
        onToast={onToast}
      />
    );
  }

  // Tách sổ: cycle theo employee thuộc workspace — prop `employees` đã filter sẵn ở useHrState
  const empIds = new Set(employees.map(e => e.id));
  const wsCycles = cycles.filter(c => empIds.has(c.employee_id));

  const filtered = wsCycles.filter(c => {
    if (filter === 'active')    return c.status !== 'completed';
    if (filter === 'completed') return c.status === 'completed';
    return true;
  });

  const pendingCount   = wsCycles.filter(c => c.status !== 'completed').length;
  const completedCount = wsCycles.filter(c => c.status === 'completed').length;

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-0 md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            Đánh giá
          </h2>
          <p className="text-neutral-medium text-sm mt-1">Quản lý kỳ đánh giá nhân viên</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-black font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)' }}
        >
          + Tạo kỳ đánh giá
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Tổng kỳ', value: wsCycles.length, color: '#FF9500' },
          { label: 'Đang chờ', value: pendingCount, color: '#FFA726' },
          { label: 'Hoàn thành', value: completedCount, color: '#34C759' },
        ].map(c => (
          <div key={c.label} className="p-5 rounded-[20px] border border-primary/10 bg-surface">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">{c.label}</p>
            <p className="text-3xl font-black" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 w-fit border border-white/5">
        {([
          { key: 'all',       label: 'Tất cả' },
          { key: 'active',    label: 'Đang chờ' },
          { key: 'completed', label: 'Hoàn thành' },
        ] as { key: FilterMode; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              filter === tab.key
                ? 'bg-primary/20 text-primary'
                : 'text-neutral-medium hover:text-neutral-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20">
          <p className="text-neutral-medium text-sm animate-pulse">Đang tải...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-neutral-medium text-sm">
            {filter === 'all' ? 'Chưa có kỳ đánh giá nào' : 'Không có kỳ phù hợp'}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-black hover:opacity-90 transition-all"
              style={{ background: '#FF9500' }}
            >
              Tạo kỳ đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(cycle => {
            const emp = cycle.employee;
            const sc = STATUS_COLOR[cycle.status];
            return (
              <div
                key={cycle.id}
                onClick={() => setViewingCycle(cycle)}
                className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                {/* Employee info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-neutral-light truncate">
                    {emp?.full_name ?? '—'}
                    <span className="ml-2 text-[10px] font-bold text-neutral-medium normal-case">
                      {cycle.period_type === 'probation' ? 'Thử việc' : '6 tháng'}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-medium mt-0.5 truncate">
                    {cycle.period_label} · {new Date(cycle.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0"
                  style={{ background: `${sc}20`, color: sc }}
                >
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
