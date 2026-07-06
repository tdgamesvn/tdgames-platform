import React, { useState, useEffect, useMemo } from 'react';
import { AccountUser, AttRequest, LeaveBalance, HrEmployee } from '@/types';
import {
  fetchMyLeaveRequests,
  submitLeaveRequest,
  deleteLeaveRequest,
  fetchYearlyBalance,
  getAvailableLeaveDays,
} from '../services/leaveService';
import { supabase } from '@/services/supabaseClient';

interface LeaveTabProps {
  currentUser: AccountUser;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const LEAVE_LABELS: Record<string, string> = {
  annual:   'Phép năm',
  unpaid:   'Nghỉ không lương',
  birthday: '🎂 Nghỉ sinh nhật',
  remote:   '🏠 Làm remote',
  hieu_hi:  '🎊 Hiếu hỉ',
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ duyệt', color: '#FF9500', bg: 'rgba(255,149,0,0.1)' },
  approved: { label: 'Đã duyệt',  color: '#34C759', bg: 'rgba(52,199,89,0.1)' },
  rejected: { label: 'Từ chối',   color: '#FF3B30', bg: 'rgba(255,59,48,0.1)' },
};

// ── Ca làm việc cố định: 08:30–17:30, nghỉ trưa 12:00–13:00 = 8h/ngày ──
const WORK_START  = 8 * 60 + 30;
const WORK_END    = 17 * 60 + 30;
const LUNCH_START = 12 * 60;
const LUNCH_END   = 13 * 60;
const HOURS_PER_DAY = 8;

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function effectiveHours(tf: string, tt: string) {
  const from  = Math.max(toMins(tf), WORK_START);
  const to    = Math.min(toMins(tt), WORK_END);
  if (from >= to) return 0;
  const lunch = Math.max(0, Math.min(to, LUNCH_END) - Math.max(from, LUNCH_START));
  return Math.round(((to - from - lunch) / 60) * 100) / 100;
}
function calcLeave(df: string, dt: string, tf: string, tt: string) {
  if (!df || !dt || !tf || !tt) return { hours: 0, days: 0 };
  const d1 = new Date(df), d2 = new Date(dt);
  if (d2 < d1) return { hours: 0, days: 0 };
  const dayCount = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
  let totalH: number;
  if (dayCount === 1) {
    totalH = effectiveHours(tf, tt);
  } else {
    totalH = effectiveHours(tf, '17:30') + (dayCount - 2) * HOURS_PER_DAY + effectiveHours('08:30', tt);
  }
  const hours = Math.round(totalH * 100) / 100;
  const days  = Math.round((totalH / HOURS_PER_DAY) * 100) / 100;
  return { hours, days };
}

// ── Eligibility helpers ──
function getOfficialDate(emp: HrEmployee): Date | null {
  const d = emp.official_date || emp.probation_end;
  return d ? new Date(d) : null;
}
function monthsSince(d: Date): number {
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7; // make Sunday = 7
  d.setDate(d.getDate() - day + 1); // Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

// ────────────────────────────────────────────────────────────

const LeaveTab: React.FC<LeaveTabProps> = ({ currentUser, onToast }) => {
  const [requests, setRequests]             = useState<AttRequest[]>([]);
  const [yearlyBalance, setYearlyBalance]   = useState<LeaveBalance | null>(null);
  const [employee, setEmployee]             = useState<HrEmployee | null>(null);
  const [isLoading, setIsLoading]           = useState(true);
  const [showForm, setShowForm]             = useState(false);

  // Form
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [timeFrom,  setTimeFrom]  = useState('08:30');
  const [timeTo,    setTimeTo]    = useState('17:30');
  const [leaveType, setLeaveType] = useState<AttRequest['leave_type']>('annual');
  const [reason,    setReason]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();

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
        // accrued_days do DB trigger/cron tự tính (xem leaveService.ts) — chỉ đọc, không tạo/ghi.
        try {
          setYearlyBalance(await fetchYearlyBalance(emp.id, currentYear));
        } catch (balErr) {
          console.warn('LeaveTab: không đọc được leave_balances:', balErr);
        }
      }
      // Luôn load danh sách đơn nghỉ, kể cả khi balance lỗi
      const reqs = await fetchMyLeaveRequests(currentUser.employee_id);
      setRequests(reqs);
    } catch (err: any) {
      console.error('LeaveTab load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const leaveInfo = useMemo(
    () => getAvailableLeaveDays(yearlyBalance),
    [yearlyBalance]
  );

  const { hours: leaveHours, days: leaveDays } = useMemo(
    () => calcLeave(dateFrom, dateTo, timeFrom, timeTo),
    [dateFrom, dateTo, timeFrom, timeTo]
  );
  const isFullWorkday = leaveHours === HOURS_PER_DAY && dateFrom === dateTo;

  // ── Eligibility ──
  const officialDate   = employee ? getOfficialDate(employee) : null;
  const isOfficial     = officialDate != null && officialDate <= now;
  const workedMonths   = officialDate ? monthsSince(officialDate) : 0;

  const birthdayUsedThisYear = useMemo(() =>
    requests.some(r =>
      r.leave_type === 'birthday' &&
      new Date(r.date_from).getFullYear() === currentYear &&
      r.status !== 'rejected'
    ), [requests, currentYear]);

  const remoteUsedThisWeek = useMemo(() => {
    const weekStart = startOfWeek(now);
    const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    return requests.some(r => {
      if (r.leave_type !== 'remote' || r.status === 'rejected') return false;
      const d = new Date(r.date_from);
      return d >= weekStart && d <= weekEnd;
    });
  }, [requests]);

  // Số tháng còn lại trong năm (chưa bắt đầu) → mỗi tháng official = +1 ngày phép
  const monthsRemainingInYear = isOfficial ? Math.max(0, 12 - (now.getMonth() + 1)) : 0;

  // Đơn đã duyệt có ngày bắt đầu trong tương lai
  const upcomingApproved = useMemo(() =>
    requests
      .filter(r => r.status === 'approved' && new Date(r.date_from) > now)
      .sort((a, b) => new Date(a.date_from).getTime() - new Date(b.date_from).getTime()),
    [requests]
  );

  // ── Available leave type options ──
  const leaveTypeOptions: { value: AttRequest['leave_type']; label: string; why?: string }[] = [
    {
      value: 'annual',
      label: 'Phép năm',
      why: !isOfficial
        ? 'Chỉ áp dụng sau khi chính thức'
        : leaveInfo.available <= 0
          ? 'Hết ngày phép năm'
          : undefined,
    },
    { value: 'unpaid', label: 'Nghỉ không lương' },
    {
      value: 'birthday',
      label: '🎂 Nghỉ sinh nhật',
      why: !isOfficial
        ? 'Chỉ áp dụng sau khi chính thức'
        : workedMonths < 6
          ? `Cần đủ 6 tháng (còn ${6 - workedMonths} tháng)`
          : birthdayUsedThisYear
            ? 'Đã dùng năm nay'
            : undefined,
    },
    {
      value: 'remote',
      label: '🏠 Làm remote',
      why: !isOfficial
        ? 'Chỉ áp dụng sau khi chính thức'
        : remoteUsedThisWeek
          ? 'Đã dùng 1 ngày remote tuần này'
          : undefined,
    },
    // Hiếu hỉ: áp dụng theo Điều 115 BLLĐ — tất cả nhân viên, không giới hạn số dư
    { value: 'hieu_hi', label: '🎊 Hiếu hỉ' },
  ].filter(o => !o.why); // ẩn những loại không đủ điều kiện

  // Ensure selected type stays valid
  useEffect(() => {
    if (leaveTypeOptions.length > 0 && !leaveTypeOptions.find(o => o.value === leaveType)) {
      setLeaveType(leaveTypeOptions[0].value);
    }
  }, [leaveTypeOptions.map(o => o.value).join(',')]);

  const handleSubmit = async () => {
    if (!currentUser.employee_id) return;
    if (!dateFrom || !dateTo || !reason.trim()) {
      onToast('Vui lòng điền đầy đủ thông tin', 'error'); return;
    }
    if (new Date(dateTo) < new Date(dateFrom)) {
      onToast('Ngày kết thúc phải sau ngày bắt đầu', 'error'); return;
    }
    if (leaveDays <= 0) {
      onToast('Thời gian nghỉ phải lớn hơn 0', 'error'); return;
    }
    if (leaveType === 'annual' && leaveDays > leaveInfo.available) {
      onToast(`Bạn chỉ còn ${leaveInfo.available} ngày phép khả dụng`, 'error'); return;
    }
    if ((leaveType === 'birthday' || leaveType === 'remote') && dateFrom !== dateTo) {
      onToast(`${LEAVE_LABELS[leaveType]} chỉ được chọn 1 ngày`, 'error'); return;
    }

    setSubmitting(true);
    try {
      await submitLeaveRequest(
        currentUser.employee_id,
        dateFrom, dateTo, leaveDays, leaveType, reason,
        isFullWorkday ? undefined : { leaveHours, timeFrom, timeTo }
      );
      onToast('Đã gửi đơn thành công!', 'success');
      setShowForm(false);
      setDateFrom(''); setDateTo('');
      setTimeFrom('08:30'); setTimeTo('17:30');
      setReason('');
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

      {/* Balance Cards — gọn: Còn lại + Sắp tích luỹ */}
      <div style={{ display: 'grid', gridTemplateColumns: isOfficial && monthsRemainingInYear > 0 ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(8,145,178,0.08) 100%)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Ngày phép còn lại</p>
          <p style={{ fontSize: '40px', fontWeight: 900, color: '#06B6D4', lineHeight: 1 }}>{leaveInfo.available}</p>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
            ngày có thể dùng {leaveInfo.expired > 0 && <span style={{ color: '#555' }}>· {leaveInfo.expired} ngày năm {currentYear - 1} đã hết hạn</span>}
          </p>
        </div>
        {isOfficial && monthsRemainingInYear > 0 && (
          <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '16px', padding: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#34C759', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Sắp tích luỹ</p>
            <p style={{ fontSize: '40px', fontWeight: 900, color: '#34C759', lineHeight: 1 }}>{monthsRemainingInYear}</p>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>ngày sẽ cộng thêm từ nay đến hết {currentYear}</p>
          </div>
        )}
      </div>

      {/* Quyền lợi nghỉ phép */}
      <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
          🎁 Quyền lợi nghỉ phép
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Phép năm', status: !isOfficial ? 'Chưa chính thức' : `${leaveInfo.available} ngày còn lại` },
            { label: '🎂 Sinh nhật', status: !isOfficial ? 'Chưa chính thức' : workedMonths < 6 ? `Cần đủ 6 tháng (còn ${6 - workedMonths})` : birthdayUsedThisYear ? 'Đã dùng năm nay' : '1 ngày/năm, có lương' },
            { label: '🏠 Remote', status: !isOfficial ? 'Chưa chính thức' : remoteUsedThisWeek ? 'Đã dùng tuần này' : '1 ngày/tuần' },
            { label: '🎊 Hiếu hỉ', status: 'Không trừ phép năm · số ngày theo sự kiện (HR duyệt)' },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#F5F5F5', marginBottom: '4px' }}>{item.label}</p>
              <p style={{ fontSize: '12px', color: '#06B6D4' }}>{item.status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Đơn đã duyệt sắp tới */}
      {upcomingApproved.length > 0 && (
        <div style={{ background: 'rgba(52,199,89,0.05)', border: '1px solid rgba(52,199,89,0.15)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', fontWeight: 800, color: '#34C759', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
            📆 Đơn đã duyệt sắp tới
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcomingApproved.map(req => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#F5F5F5', fontWeight: 600 }}>
                  {new Date(req.date_from).toLocaleDateString('vi-VN')}
                  {req.date_from !== req.date_to && (
                    <span> → {new Date(req.date_to).toLocaleDateString('vi-VN')}</span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>
                    {LEAVE_LABELS[req.leave_type] || req.leave_type}
                  </span>
                  <span style={{ fontSize: '12px', color: '#34C759', fontWeight: 700 }}>{req.leave_days} ngày</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No options warning */}
      {leaveTypeOptions.length === 0 && (
        <div style={{ background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: '#FF9500' }}>
          ⚠️ Bạn chưa đủ điều kiện xin nghỉ (đang trong thời gian thử việc hoặc hết ngày phép).
        </div>
      )}

      {/* Request Form */}
      {showForm && leaveTypeOptions.length > 0 && (
        <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5', marginBottom: '20px' }}>
            📝 Tạo đơn xin nghỉ
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
              <select value={leaveType} onChange={e => setLeaveType(e.target.value as AttRequest['leave_type'])} style={inputStyle}>
                {leaveTypeOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Quy đổi</label>
              <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #333', background: '#0F0F0F', fontSize: '14px', fontWeight: 800, color: leaveDays > 0 ? '#06B6D4' : '#555' }}>
                {leaveDays > 0
                  ? isFullWorkday ? `${leaveDays} ngày` : `${leaveHours}h = ${leaveDays} ngày`
                  : '—'}
                {leaveType === 'annual' && leaveDays > leaveInfo.available && (
                  <span style={{ color: '#FF3B30', fontSize: '11px', marginLeft: '8px' }}>
                    (vượt {+(leaveDays - leaveInfo.available).toFixed(2)} ngày)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Hint cho remote/birthday/hieu_hi */}
          {(leaveType === 'remote' || leaveType === 'birthday') && (
            <div style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#06B6D4' }}>
              ℹ️ {leaveType === 'remote' ? 'Làm remote chỉ 1 ngày/tuần.' : 'Nghỉ sinh nhật chỉ 1 ngày/năm, có lương.'} Vui lòng chọn đúng 1 ngày.
            </div>
          )}
          {leaveType === 'hieu_hi' && (
            <div style={{ background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#FF9500' }}>
              🎊 <strong>Nghỉ hiếu hỉ có lương</strong> (Điều 115 BLLĐ) — Vui lòng ghi rõ sự kiện trong phần lý do.<br />
              <span style={{ color: '#888', marginTop: '4px', display: 'block' }}>
                Cưới bản thân: 3 ngày · Con kết hôn: 1 ngày · Bố/mẹ/vợ/chồng/con mất: 3 ngày · Ông bà/anh chị em mất: 1 ngày
              </span>
            </div>
          )}

          {/* Reason */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#888', display: 'block', marginBottom: '6px' }}>Lý do</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Nhập lý do..." rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !dateFrom || !dateTo || !reason.trim()}
            style={{
              padding: '12px 32px', borderRadius: '12px', border: 'none', fontWeight: 800,
              fontSize: '14px', cursor: submitting ? 'wait' : 'pointer',
              background: submitting ? '#333' : 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              color: '#fff', opacity: (!dateFrom || !dateTo || !reason.trim()) ? 0.5 : 1, transition: 'all 0.2s',
            }}
          >
            {submitting ? 'Đang gửi...' : '📨 Gửi đơn'}
          </button>
        </div>
      )}

      {/* Request History */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5', marginBottom: '16px' }}>📋 Lịch sử đơn</h3>
        {requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>🏖️</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>Chưa có đơn nào</p>
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
                          {LEAVE_LABELS[req.leave_type] || req.leave_type}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5', marginBottom: '4px' }}>
                        {new Date(req.date_from).toLocaleDateString('vi-VN')}
                        {!isSameDay && <span> → {new Date(req.date_to).toLocaleDateString('vi-VN')}</span>}
                        {req.time_from && req.time_to && (
                          <span style={{ color: '#888', fontWeight: 400 }}> · {req.time_from.slice(0,5)}–{req.time_to.slice(0,5)}</span>
                        )}
                        <span style={{ color: '#06B6D4', marginLeft: '8px', fontSize: '12px' }}>
                          {req.leave_hours ? `(${req.leave_hours}h = ${req.leave_days} ngày)` : `(${req.leave_days} ngày)`}
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
