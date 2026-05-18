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

// ── Công ty: 08:30 → 17:30, nghỉ trưa 12:00–13:00 = 8h/ngày ──
const WORK_START = 8 * 60 + 30;   // 510 phút
const WORK_END   = 17 * 60 + 30;  // 1050 phút
const LUNCH_START = 12 * 60;       // 720 phút
const LUNCH_END   = 13 * 60;       // 780 phút
const HOURS_PER_DAY = 8;

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Tính giờ thực giữa 2 thời điểm trong ngày, trừ nghỉ trưa */
function effectiveHours(timeFrom: string, timeTo: string): number {
  const from = Math.max(toMins(timeFrom), WORK_START);
  const to   = Math.min(toMins(timeTo),   WORK_END);
  if (from >= to) return 0;
  const lunch = Math.max(0, Math.min(to, LUNCH_END) - Math.max(from, LUNCH_START));
  return Math.round(((to - from - lunch) / 60) * 100) / 100;
}

/**
 * Tính tổng giờ & ngày nghỉ có tính ca làm việc.
 * - 1 ngày: tính theo timeFrom–timeTo trừ trưa
 * - Nhiều ngày: ngày đầu (timeFrom → 17:30), ngày giữa (full), ngày cuối (08:30 → timeTo)
 */
function calcLeave(dateFrom: string, dateTo: string, timeFrom: string, timeTo: string) {
  if (!dateFrom || !dateTo || !timeFrom || !timeTo) return { hours: 0, days: 0 };
  const d1 = new Date(dateFrom);
  const d2 = new Date(dateTo);
  if (d2 < d1) return { hours: 0, days: 0 };

  const dayCount = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;

  let totalHours: number;
  if (dayCount === 1) {
    totalHours = effectiveHours(timeFrom, timeTo);
  } else {
    const firstH  = effectiveHours(timeFrom, '17:30');
    const lastH   = effectiveHours('08:30', timeTo);
    const middleH = (dayCount - 2) * HOURS_PER_DAY;
    totalHours = firstH + middleH + lastH;
  }

  const hours = Math.round(totalHours * 100) / 100;
  const days  = Math.round((totalHours / HOURS_PER_DAY) * 100) / 100;
  return { hours, days };
}

// ────────────────────────────────────────────────────────────

const LeaveTab: React.FC<LeaveTabProps> = ({ currentUser, onToast }) => {
  const [requests, setRequests]             = useState<AttRequest[]>([]);
  const [yearlyBalance, setYearlyBalance]   = useState<LeaveBalance | null>(null);
  const [carryOverBalance, setCarryOverBalance] = useState<LeaveBalance | null>(null);
  const [employee, setEmployee]             = useState<HrEmployee | null>(null);
  const [isLoading, setIsLoading]           = useState(true);
  const [showForm, setShowForm]             = useState(false);

  // Form
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [timeFrom, setTimeFrom] = useState('08:30');
  const [timeTo,   setTimeTo]   = useState('17:30');
  const [leaveType, setLeaveType] = useState<'annual' | 'unpaid' | 'sick'>('annual');
  const [reason,    setReason]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQ    = getCurrentQuarter(now);

  useEffect(() => {
    if (!currentUser.employee_id) return;
    loadData();
  }, [currentUser.employee_id]);

  const loadData = async () => {
    if (!currentUser.employee_id) return;
    setIsLoading(true);
    try {
      const { data: emp } = await supabase
        .from('hr_employees').select('*')
        .eq('id', currentUser.employee_id).single();
      setEmployee(emp);
      if (emp) {
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

  const leaveInfo = useMemo(
    () => getAvailableLeaveDays(yearlyBalance, carryOverBalance, currentQ),
    [yearlyBalance, carryOverBalance, currentQ]
  );

  const { hours: leaveHours, days: leaveDays } = useMemo(
    () => calcLeave(dateFrom, dateTo, timeFrom, timeTo),
    [dateFrom, dateTo, timeFrom, timeTo]
  );

  // Nếu cùng 1 ngày và giờ = cả ca → không lưu hours (để tránh hiện "8h = 1 ngày" dư thừa)
  const isFullWorkday = leaveHours === HOURS_PER_DAY && dateFrom === dateTo;

  const handleSubmit = async () => {
    if (!currentUser.employee_id) return;
    if (!dateFrom || !dateTo || !reason.trim()) {
      onToast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }
    if (new Date(dateTo) < new Date(dateFrom)) {
      onToast('Ngày kết thúc phải sau ngày bắt đầu', 'error');
      return;
    }
    if (leaveDays <= 0) {
      onToast('Thời gian nghỉ phải lớn hơn 0', 'error');
      return;
    }
    if (leaveType === 'annual' && leaveDays > leaveInfo.totalAvailable) {
      onToast(`Bạn chỉ còn ${leaveInfo.totalAvailable} ngày phép khả dụng`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitLeaveRequest(
        currentUser.employee_id,
        dateFrom, dateTo,
        leaveDays,
        leaveType,
        reason,
        isFullWorkday ? undefined : { leaveHours, timeFrom, timeTo }
      );
      onToast('Đã gửi đơn xin nghỉ phép thành công!', 'success');
      setShowForm(false);
      setDateFrom(''); setDateTo('');
      setTimeFrom('08:30'); setTimeTo('17:30');
      setReason(''); setLeaveType('annual');
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5',
    fontSize: '14px', outline: 'none',
  };

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
        <div style={{
          background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(8,145,178,0.08) 100%)',
          border: '1px solid rgba(6,182,212,0.2)', borderRadius: '16px', padding: '20px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Tổng khả dụng</p>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#06B6D4' }}>{leaveInfo.totalAvailable}</p>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>ngày phép có thể dùng</p>
        </div>
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#34C759', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Tích luỹ năm {currentYear}</p>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#34C759' }}>{leaveInfo.yearlyAccrued}</p>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>đã dùng: {leaveInfo.yearlyUsed} · còn: {leaveInfo.yearlyAvailable}</p>
        </div>
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '16px', padding: '20px', opacity: leaveInfo.carryOverExpired ? 0.4 : 1 }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Dư từ {currentYear - 1}</p>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#8B5CF6' }}>{leaveInfo.carryOver > 0 ? leaveInfo.carryOverAvailable : 0}</p>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
            {leaveInfo.carryOverExpired ? '⚠️ Đã hết hạn (chỉ dùng trong Q1)' : leaveInfo.carryOver > 0 ? `dùng trước 31/3/${currentYear}` : 'Không có ngày dư'}
          </p>
        </div>
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Đã dùng {currentYear}</p>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#FF9500' }}>{leaveInfo.yearlyUsed + leaveInfo.carryOverUsed}</p>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>ngày</p>
        </div>
      </div>

      {/* Rules */}
      <div style={{
        background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: '12px', padding: '14px 18px', marginBottom: '24px',
        fontSize: '12px', color: '#aaa', lineHeight: '1.6',
      }}>
        💡 <strong style={{ color: '#8B5CF6' }}>Quy tắc:</strong> Mỗi tháng kể từ ngày chính thức = 1 ngày phép có lương.
        Tích luỹ cả năm. Cuối năm nếu dư → chuyển sang Q1 năm sau. Hết Q1 mà không dùng → mất.
        Ca làm việc: 08:30–17:30, nghỉ trưa 12:00–13:00 (= 8h/ngày).
      </div>

      {/* Request Form */}
      {showForm && (
        <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5', marginBottom: '20px' }}>
            📝 Tạo đơn xin nghỉ phép
          </h3>

          {/* Row 1: Ngày */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Từ ngày</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); if (!dateTo) setDateTo(e.target.value); }} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Đến ngày</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Row 2: Giờ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Giờ bắt đầu</label>
              <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Giờ kết thúc</label>
              <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Row 3: Loại + Quy đổi */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Loại nghỉ</label>
              <select value={leaveType} onChange={e => setLeaveType(e.target.value as any)} style={inputStyle}>
                <option value="annual">Phép năm</option>
                <option value="sick">Nghỉ ốm</option>
                <option value="unpaid">Nghỉ không lương</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Quy đổi</label>
              <div style={{
                padding: '10px 14px', borderRadius: '10px', border: '1px solid #333',
                background: '#0F0F0F', fontSize: '14px', fontWeight: 800,
                color: leaveDays > 0 ? '#06B6D4' : '#555',
              }}>
                {leaveDays > 0
                  ? isFullWorkday
                    ? `${leaveDays} ngày`
                    : `${leaveHours}h = ${leaveDays} ngày`
                  : '—'}
                {leaveType === 'annual' && leaveDays > leaveInfo.totalAvailable && (
                  <span style={{ color: '#FF3B30', fontSize: '11px', marginLeft: '8px' }}>
                    (vượt {+(leaveDays - leaveInfo.totalAvailable).toFixed(2)} ngày)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Lý do</label>
            <textarea
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Nhập lý do xin nghỉ..." rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !dateFrom || !dateTo || !reason.trim()}
            style={{
              padding: '12px 32px', borderRadius: '12px', border: 'none', fontWeight: 800,
              fontSize: '14px', cursor: submitting ? 'wait' : 'pointer',
              background: submitting ? '#333' : 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              color: '#fff', opacity: (!dateFrom || !dateTo || !reason.trim()) ? 0.5 : 1,
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
          <div style={{ textAlign: 'center', padding: '48px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>🏖️</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>Chưa có đơn xin nghỉ phép nào</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requests.map(req => {
              const st = STATUS_MAP[req.status] || STATUS_MAP.pending;
              const isSameDay = req.date_from === req.date_to;
              return (
                <div key={req.id} style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 10px', borderRadius: '6px', background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {st.label}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>
                          {LEAVE_TYPES[req.leave_type] || req.leave_type}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5', marginBottom: '4px' }}>
                        {new Date(req.date_from).toLocaleDateString('vi-VN')}
                        {!isSameDay && <span> → {new Date(req.date_to).toLocaleDateString('vi-VN')}</span>}
                        {req.time_from && req.time_to && (
                          <span style={{ color: '#888', fontWeight: 400 }}> · {req.time_from.slice(0,5)}–{req.time_to.slice(0,5)}</span>
                        )}
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
                      <button onClick={() => handleDelete(req.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#FF3B30', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
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
