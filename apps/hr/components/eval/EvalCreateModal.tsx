import React, { useState } from 'react';
import { HrEmployee, EvalPeriodType } from '@/types';
import { createCycle, autoLabel } from '../../services/evaluationService';
import { AccountUser } from '@/types';

interface EvalCreateModalProps {
  employees: HrEmployee[];
  currentUser: AccountUser;
  onCreated: () => void;
  onClose: () => void;
}

const EvalCreateModal: React.FC<EvalCreateModalProps> = ({ employees, currentUser, onCreated, onClose }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [periodType, setPeriodType] = useState<EvalPeriodType>('probation');
  const [periodLabel, setPeriodLabel] = useState(autoLabel('probation'));
  const [leaderUserId, setLeaderUserId] = useState(currentUser.id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    if (!employeeId) { setError('Vui lòng chọn nhân viên'); return; }
    if (!periodLabel.trim()) { setError('Vui lòng nhập tên kỳ đánh giá'); return; }
    if (!leaderUserId.trim()) { setError('Vui lòng nhập User ID của leader'); return; }

    setSaving(true);
    setError('');
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

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '10px 14px', color: '#F2F2F2',
    fontSize: '13px', fontWeight: 600, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: '#9D9C9D', marginBottom: '6px', display: 'block',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }} onClick={onClose}>
      <div style={{
        background: '#161616', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            📋 Tạo kỳ đánh giá
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9D9C9D', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Employee */}
          <div>
            <label style={labelStyle}>Nhân viên *</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">— Chọn nhân viên —</option>
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code}) — {emp.position || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          {/* Period type */}
          <div>
            <label style={labelStyle}>Loại kỳ *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['probation', 'semi_annual'] as EvalPeriodType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handlePeriodTypeChange(t)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 800, border: '1px solid',
                    background: periodType === t ? 'rgba(255,149,0,0.12)' : 'rgba(255,255,255,0.03)',
                    borderColor: periodType === t ? 'rgba(255,149,0,0.4)' : 'rgba(255,255,255,0.1)',
                    color: periodType === t ? '#FF9500' : '#9D9C9D',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'probation' ? '🧪 Thử việc' : '📅 6 tháng'}
                </button>
              ))}
            </div>
          </div>

          {/* Period label */}
          <div>
            <label style={labelStyle}>Tên kỳ *</label>
            <input
              type="text"
              value={periodLabel}
              onChange={e => setPeriodLabel(e.target.value)}
              placeholder="VD: Thử việc T6/2026"
              style={inputStyle}
            />
          </div>

          {/* Leader user ID */}
          <div>
            <label style={labelStyle}>Leader User ID *</label>
            <input
              type="text"
              value={leaderUserId}
              onChange={e => setLeaderUserId(e.target.value)}
              placeholder="UUID của tài khoản leader"
              style={inputStyle}
            />
            <p style={{ fontSize: '11px', color: '#9D9C9D', marginTop: '4px' }}>
              Mặc định: tài khoản của bạn. Thay bằng UUID nếu người đánh giá khác.
            </p>
          </div>

          {error && (
            <p style={{ fontSize: '12px', color: '#F44336', background: 'rgba(244,67,54,0.08)', borderRadius: '8px', padding: '8px 12px', margin: 0 }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#9D9C9D',
              }}
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 20px', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '12px', fontWeight: 800, border: 'none',
                background: saving ? 'rgba(255,149,0,0.5)' : '#FF9500',
                color: '#000', opacity: saving ? 0.7 : 1,
              }}
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
