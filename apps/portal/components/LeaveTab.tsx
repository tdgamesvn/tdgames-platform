import React, { useState, useEffect, useMemo } from 'react';
import { AccountUser, AttRequest, LeaveBalance, HrEmployee } from '@/types';
import {
  fetchMyLeaveRequests,
  submitLeaveRequest,
  deleteLeaveRequest,
  fetchLeaveBalances,
  ensureBalancesForYear,
  getAvailableLeaveDays,
  getCurrentQuarter,
} from '../services/leaveService';
import { supabase } from '@/services/supabaseClient';

interface LeaveTabProps {
  currentUser: AccountUser;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const LEAVE_TYPES: Record<string, string> = {
  annual: 'Phép năm',
  unpaid: 'Nghỉ không lương',
  sick: 'Nghỉ ốm',
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ duyệt',  color: '#FF9500', bg: 'rgba(255,149,0,0.1)' },
  approved: { label: 'Đã duyệt',   color: '#34C759', bg: 'rgba(52,199,89,0.1)' },
  rejected: { label: 'Từ chối',     color: '#FF3B30', bg: 'rgba(255,59,48,0.1)' },
};

const LeaveTab: React.FC<LeaveTabProps> = ({ currentUser, onToast }) => {
  const [requests, setRequests] = useState<AttRequest[]>([]);
  const [yearlyBalance, setYearlyBalance] = useState<LeaveBalance | null>(null);
  const [carryOverBalance, setCarryOverBalance] = useState<LeaveBalance | null>(null);
  const [employee, setEmployee] = useState<HrEmployee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [leaveType, setLeaveType] = useState<'annual' | 'unpaid' | 'sick'>('annual');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [leaveMode, setLeaveMode] = useState<'fullday' | 'hourly'>('fullday');
  const [timeFrom, setTimeFrom] = useState('08:00');
  const [timeTo, setTimeTo] = useState('17:00');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQ = getCurrentQuarter(now);

  // Load data
  useEffect(() => {
    if (!currentUser.employee_id) return;
    loadData();
  }, [currentUser.employee_id]);

  const loadData = async () => {
    if (!currentUser.employee_id) return;
    setIsLoading(true);
    try {
      // Fetch employee details
      const { data: emp } = await supabase
        .from('hr_employees')
        .select('*')
        .eq('id', currentUser.employee_id)
        .single();
      setEmployee(emp);

      if (emp) {
        // Ensure balances exist & calculate
        const { yearlyBalance: yb, carryOverBalance: cob } = await ensureBalancesForYear(emp, currentYear);
        setYearlyBalance(yb);
        setCarryOverBalance(cob);
      }

      const reqs = await fetchMyLeaveRequests(currentUser.employee_id);
      setRequests(reqs);
    } catch (err: any) {
      console.error('LeaveTab load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate available
  const leaveInfo = useMemo(() => {
    return getAvailableLeaveDays(yearlyBalance, carryOverBalance, currentQ);
  }, [yearlyBalance, carryOverBalance, currentQ]);

  // Calculate leave_days from date range (full-day mode)
  const calcLeaveDays = (from: string, to: string): number => {
    if (!from || !to) return 0;
    const d1 = new Date(from);
    const d2 = new Date(to);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, diff);
  };

  // Calculate hours from time range
  const calcLeaveHours = (from: string, to: string): number => {
    if (!from || !to) return 0;
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    const mins = (th * 60 + tm) - (fh * 60 + fm);
    return Math.max(0, Math.round(mins / 60 * 100) / 100);
  };

  const leaveHours = leaveMode === 'hourly' ? calcLeaveHours(timeFrom, timeTo) : 0;
  // 8h = 1 ngày làm việc
  const leaveDays = leaveMode === 'fullday'
    ? calcLeaveDays(dateFrom, dateTo)
    : Math.round((leaveHours / 8) * 100) / 100;

  const handleSubmit = async () => {
    if (!currentUser.employee_id) return;
    if (!dateFrom || !reason.trim()) {
      onToast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }
    if (leaveMode === 'fullday') {
      if (!dateTo) { onToast('Vui lòng chọn ngày kết thúc', 'error'); return; }
      if (new Date(dateTo) < new Date(dateFrom)) {
        onToast('Ngày kết thúc phải sau ngày bắt đầu', 'error');
        return;
      }
    }
    if (leaveMode === 'hourly' && leaveHours <= 0) {
      onToast('Giờ kết thúc phải sau giờ bắt đầu', 'error');
      return;
    }
    if (leaveType === 'annual' && leaveDays > leaveInfo.totalAvailable) {
      onToast(`Bạn chỉ còn ${leaveInfo.totalAvailable} ngày phép khả dụng`, 'error');
      return;
    }

    const effectiveDateTo = leaveMode === 'hourly' ? dateFrom : dateTo;

    setSubmitting(true);
    try {
      await submitLeaveRequest(
        currentUser.employee_id,
        dateFrom,
        effectiveDateTo,
        leaveDays,
        leaveType,
        reason,
        leaveMode === 'hourly' ? { leaveHours, timeFrom, timeTo } : undefined
      );
      onToast('Đã gửi đơn xin nghỉ phép thành công!', 'success');
      setShowForm(false);
      setDateFrom('');
      setDateTo('');
      setTimeFrom('08:00');
      setTimeTo('17:00');
      setReason('');
      setLeaveType('annual');
      setLeaveMode('fullday');
      await loadData();
    } catch (err: any) {
      onToast(err.message || 'Lỗi khi gửi đơn', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLeaveRequest(id);
      onToast('Đã huỷ đơn', 'success');
      await loadData();
    } catch (err: any) {
      onToast(err.message || 'Lỗi khi huỷ', 'error');
    }
  };

  if (!currentUser.employee_id) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
        <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔗</p>
        <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Tài khoản chưa liên kết nhân viên</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <p className="animate-pulse" style={{ color: '#888', fontSize: '13px' }}>Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp">
      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            🏖️ Nghỉ phép
          </h2>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
            Ngày phép năm {currentYear} và đơn xin nghỉ
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: 800,
            fontSize: '13px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
            background: showForm ? '#333' : 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
            color: '#fff', transition: 'all 0.2s',
          }}
        >
          {showForm ? '✕ Đóng' : '+ Xin nghỉ phép'}
        </button>
      </div>

      {/* Balance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {/* Total Available */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(8,145,178,0.08) 100%)',
          border: '1px solid rgba(6,182,212,0.2)', borderRadius: '16px', padding: '20px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            Tổng khả dụng
          </p>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#06B6D4' }}>
            {leaveInfo.totalAvailable}
          </p>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>ngày phép có thể dùng</p>
        </div>

        {/* Yearly Accrued */}
        <div style={{
          background: '#161616', border: '1px solid #222', borderRadius: '16px', padding: '20px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#34C759', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            Tích luỹ năm {currentYear}
          </p>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#34C759' }}>
            {leaveInfo.yearlyAccrued}
          </p>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
            đã dùng: {leaveInfo.yearlyUsed} · còn: {leaveInfo.yearlyAvailable}
          </p>
        </div>

        {/* Carry-over from previous year */}
        <div style={{
          background: '#161616', border: '1px solid #222', borderRadius: '16px', padding: '20px',
          opacity: leaveInfo.carryOverExpired ? 0.4 : 1,
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            Dư từ {currentYear - 1}
          </p>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#8B5CF6' }}>
            {leaveInfo.carryOver > 0 ? leaveInfo.carryOverAvailable : 0}
          </p>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
            {leaveInfo.carryOverExpired
              ? '⚠️ Đã hết hạn (chỉ dùng trong Q1)'
              : leaveInfo.carryOver > 0
                ? `dùng trước 31/3/${currentYear}`
                : 'Không có ngày dư'
            }
          </p>
        </div>

        {/* Used this year */}
        <div style={{
          background: '#161616', border: '1px solid #222', borderRadius: '16px', padding: '20px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            Đã dùng {currentYear}
          </p>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#FF9500' }}>
            {leaveInfo.yearlyUsed + leaveInfo.carryOverUsed}
          </p>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>ngày</p>
        </div>
      </div>

      {/* Info box about rules */}
      <div style={{
        background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: '12px', padding: '14px 18px', marginBottom: '24px',
        fontSize: '12px', color: '#aaa', lineHeight: '1.6',
      }}>
        💡 <strong style={{ color: '#8B5CF6' }}>Quy tắc:</strong> Mỗi tháng kể từ ngày chính thức = 1 ngày phép có lương.
        Tích luỹ cả năm. Cuối năm nếu dư → chuyển sang Q1 năm sau. Hết Q1 mà không dùng → mất.
      </div>

      {/* Request Form */}
      {showForm && (
        <div style={{
          background: '#161616', border: '1px solid #2a2a2a', borderRadius: '16px',
          padding: '28px', marginBottom: '24px',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5', marginBottom: '20px' }}>
            📝 Tạo đơn xin nghỉ phép
          </h3>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {(['fullday', 'hourly'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setLeaveMode(mode)}
                style={{
                  padding: '8px 18px', borderRadius: '10px', border: '1px solid',
                  borderColor: leaveMode === mode ? '#06B6D4' : '#333',
                  background: leaveMode === mode ? 'rgba(6,182,212,0.12)' : 'transparent',
                  color: leaveMode === mode ? '#06B6D4' : '#666',
                  fontSize: '12px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {mode === 'fullday' ? '📅 Cả ngày' : '⏱ Theo giờ'}
              </button>
            ))}
          </div>

          {/* Date row */}
          <div style={{ display: 'grid', gridTemplateColumns: leaveMode === 'fullday' ? '1fr 1fr' : '1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>
                {leaveMode === 'hourly' ? 'Ngày nghỉ' : 'Từ ngày'}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5',
                  fontSize: '14px', outline: 'none',
                }}
              />
            </div>
            {leaveMode === 'fullday' && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Đến ngày</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5',
                    fontSize: '14px', outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* Time row (hourly mode only) */}
          {leaveMode === 'hourly' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Giờ bắt đầu</label>
                <input
                  type="time"
                  value={timeFrom}
                  onChange={e => setTimeFrom(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5',
                    fontSize: '14px', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Giờ kết thúc</label>
                <input
                  type="time"
                  value={timeTo}
                  onChange={e => setTimeTo(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5',
                    fontSize: '14px', outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Loại nghỉ</label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value as any)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5',
                  fontSize: '14px', outline: 'none',
                }}
              >
                <option value="annual">Phép năm</option>
                <option value="sick">Nghỉ ốm</option>
                <option value="unpaid">Nghỉ không lương</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>
                {leaveMode === 'hourly' ? 'Quy đổi' : 'Số ngày nghỉ'}
              </label>
              <div style={{
                padding: '10px 14px', borderRadius: '10px', border: '1px solid #333',
                background: '#0F0F0F', color: leaveDays > 0 ? '#06B6D4' : '#555',
                fontSize: '14px', fontWeight: 800,
              }}>
                {leaveDays > 0
                  ? leaveMode === 'hourly'
                    ? `${leaveHours}h = ${leaveDays} ngày`
                    : `${leaveDays} ngày`
                  : '—'}
                {leaveType === 'annual' && leaveDays > leaveInfo.totalAvailable && (
                  <span style={{ color: '#FF3B30', fontSize: '11px', marginLeft: '8px' }}>
                    (vượt {+(leaveDays - leaveInfo.totalAvailable).toFixed(2)} ngày)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Lý do</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Nhập lý do xin nghỉ..."
              rows={3}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5',
                fontSize: '14px', outline: 'none', resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !dateFrom || !dateTo || !reason.trim()}
            style={{
              padding: '12px 32px', borderRadius: '12px', border: 'none', fontWeight: 800,
              fontSize: '14px', cursor: submitting ? 'wait' : 'pointer',
              background: submitting ? '#333' : 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              color: '#fff', opacity: (!dateFrom || (leaveMode === 'fullday' && !dateTo) || !reason.trim()) ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {submitting ? 'Đang gửi...' : '📨 Gửi đơn'}
          </button>
        </div>
      )}

      {/* Request History */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5', marginBottom: '16px' }}>
          📋 Lịch sử đơn nghỉ phép
        </h3>

        {requests.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px', background: '#161616',
            borderRadius: '16px', border: '1px solid #222',
          }}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>🏖️</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>
              Chưa có đơn xin nghỉ phép nào
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requests.map(req => {
              const st = STATUS_MAP[req.status] || STATUS_MAP.pending;
              return (
                <div key={req.id} style={{
                  background: '#161616', border: '1px solid #222', borderRadius: '12px',
                  padding: '18px 22px', transition: 'border-color 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 800, padding: '3px 10px', borderRadius: '6px',
                          background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {st.label}
                        </span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                          background: 'rgba(139,92,246,0.1)', color: '#8B5CF6',
                        }}>
                          {LEAVE_TYPES[req.leave_type] || req.leave_type}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5', marginBottom: '4px' }}>
                        {new Date(req.date_from).toLocaleDateString('vi-VN')}
                        {req.leave_hours
                          ? <span style={{ color: '#888', fontWeight: 400 }}> · {req.time_from?.slice(0, 5)}–{req.time_to?.slice(0, 5)}</span>
                          : req.date_to !== req.date_from
                            ? <span> → {new Date(req.date_to).toLocaleDateString('vi-VN')}</span>
                            : null
                        }
                        <span style={{ color: '#06B6D4', marginLeft: '8px', fontSize: '12px' }}>
                          {req.leave_hours
                            ? `(${req.leave_hours}h = ${req.leave_days} ngày)`
                            : `(${req.leave_days} ngày)`}
                        </span>
                      </p>
                      <p style={{ fontSize: '12px', color: '#888' }}>{req.reason}</p>
                      {req.reviewer_note && (
                        <p style={{ fontSize: '12px', color: req.status === 'rejected' ? '#FF3B30' : '#34C759', marginTop: '6px', fontStyle: 'italic' }}>
                          💬 {req.reviewer_note}
                        </p>
                      )}
                    </div>
                    {req.status === 'pending' && (
                      <button
                        onClick={() => handleDelete(req.id)}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', border: '1px solid #333',
                          background: 'transparent', color: '#FF3B30', fontSize: '11px',
                          fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Huỷ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveTab;
