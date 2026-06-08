import React, { useState } from 'react';
import { HrEmployee, EvalPeriodType, AccountUser } from '@/types';
import { createCycle, autoLabel } from '../../services/evaluationService';

interface EvalCreateModalProps {
  employees: HrEmployee[];
  currentUser: AccountUser;
  onCreated: () => void;
  onClose: () => void;
}

const EvalCreateModal: React.FC<EvalCreateModalProps> = ({ employees, currentUser, onCreated, onClose }) => {
  const [employeeId, setEmployeeId]     = useState('');
  const [periodType, setPeriodType]     = useState<EvalPeriodType>('probation');
  const [periodLabel, setPeriodLabel]   = useState(autoLabel('probation'));
  const [leaderUserId, setLeaderUserId] = useState(currentUser.id);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  // Chỉ Fulltime và Parttime mới được đánh giá — Freelancer không áp dụng
  const activeEmployees = employees.filter(
    e => e.status === 'active' && (e.type === 'fulltime' || e.type === 'parttime')
  );

  const handlePeriodTypeChange = (t: EvalPeriodType) => {
    setPeriodType(t);
    setPeriodLabel(autoLabel(t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId)          { setError('Vui lòng chọn nhân viên'); return; }
    if (!periodLabel.trim())  { setError('Vui lòng nhập tên kỳ'); return; }
    if (!leaderUserId.trim()) { setError('Vui lòng nhập User ID của leader'); return; }

    setSaving(true); setError('');
    try {
      await createCycle({
        employee_id: employeeId,
        period_type: periodType,
        period_label: periodLabel.trim(),
        leader_user_id: leaderUserId.trim(),
        created_by: currentUser.id,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi tạo kỳ đánh giá');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all";
  const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-[20px] border border-primary/10 p-7 w-full max-w-md animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base font-black uppercase tracking-wider text-neutral-light">
            📋 Tạo kỳ đánh giá
          </h3>
          <button onClick={onClose} className="text-neutral-medium hover:text-neutral-light transition-all text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Nhân viên *</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Chọn nhân viên —</option>
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code}) — {emp.position || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          {/* Period type */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Loại kỳ *</label>
            <div className="flex gap-2">
              {(['probation', 'semi_annual'] as EvalPeriodType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handlePeriodTypeChange(t)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                    periodType === t
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-transparent border-white/10 text-neutral-medium hover:bg-white/5'
                  }`}
                >
                  {t === 'probation' ? '🧪 Thử việc' : '📅 6 tháng'}
                </button>
              ))}
            </div>
          </div>

          {/* Period label */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Tên kỳ *</label>
            <input
              type="text"
              value={periodLabel}
              onChange={e => setPeriodLabel(e.target.value)}
              placeholder="VD: Thử việc T6/2026"
              className={inputCls}
            />
          </div>

          {/* Leader user ID */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Leader User ID *</label>
            <input
              type="text"
              value={leaderUserId}
              onChange={e => setLeaderUserId(e.target.value)}
              placeholder="UUID của tài khoản leader"
              className={inputCls}
            />
            <p className="text-xs text-neutral-medium">Mặc định: tài khoản của bạn. Thay bằng UUID nếu người đánh giá khác.</p>
          </div>

          {error && (
            <p className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-black hover:opacity-90 transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}
            >
              {saving ? 'Đang tạo...' : 'Tạo kỳ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EvalCreateModal;
