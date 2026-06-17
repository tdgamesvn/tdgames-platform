import React, { useState, useEffect, useMemo } from 'react';
import { AccountUser, AttRequest, LeaveBalance, HrEmployee } from '@/types';
import {
  fetchMyLeaveRequests,
  submitLeaveRequest,
  deleteLeaveRequest,
  fetchLeaveBalances,
  getAvailableLeaveDays,
  getCurrentQuarter,
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
  const [carryOverBalance, setCarryOverBalance] = useState<LeaveBalance | null>(null);
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
        // Balance creation requires is_staff() RLS — employees can only READ existing balances.
        // Wrap separately so a missing balance record doesn't block the leave request list.
        try {
          const { yearlyBalance: yb, carryOverBalance: cob } = await ensureBalancesForYear(emp, currentYear);
          setYearlyBalance(yb);
          setCarryOverBalance(cob);
        } catch (balErr) {
          console.warn('LeaveTab: không thể tạo bản ghi leave_balances (HR cần tạo thủ công):', balErr);
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
    () => getAvailableLeaveDays(yearlyBalance, carryOverBalance, currentQ),
    [yearlyBalance, carryOverBalance, currentQ]
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

  // ── Available leave type options ──
  const leaveTypeOptions: { value: AttRequest['leave_type']; label: string; why?: string }[] = [
    {
      value: 'annual',
      label: 'Phép năm',
      why: !isOfficial
        ? 'Chỉ áp dụng sau khi chính thức'
        : leaveInfo.totalAvailable <= 0
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
    if (leaveType === 'annual' && leaveDays > leaveInfo.totalAvailable) {
      onToast(`Bạn chỉ còn ${leaveInfo.totalAvailable} ngày phép khả dụng`, 'error'); return;
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

      {/* Balance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(8,145,178,0.08) 100%)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '16px', padding: '20px' }}>
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

      {/* Info — Quy tắc phúc lợi */}
      <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
          💡 Quy tắc phúc lợi
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            {
              icon: '📅',
              title: 'Phép năm có lương',
              desc: 'Mỗi tháng làm việc sau ngày chính thức = 1 ngày phép. Tích luỹ cả năm. Cuối năm nếu dư → chuyển sang Q1 năm sau, hết Q1 mà không dùng → mất.',
            },
            {
              icon: '🎂',
              title: 'Nghỉ sinh nhật có lương',
              desc: 'Áp dụng sau khi làm việc đủ 6 tháng kể từ ngày chính thức. Được nghỉ 1 ngày/năm vào dịp sinh nhật, hưởng lương đầy đủ.',
              highlight: isOfficial && workedMonths >= 6 && !birthdayUsedThisYear
                ? '✅ Bạn đang đủ điều kiện dùng năm nay!'
                : isOfficial && workedMonths >= 6 && birthdayUsedThisYear
                  ? '✔ Đã dùng năm nay'
                  : isOfficial && workedMonths < 6
                    ? `⏳ Cần thêm ${6 - workedMonths} tháng nữa`
                    : undefined,
              highlightColor: birthdayUsedThisYear ? '#555' : '#FF375F',
            },
            {
              icon: '🏠',
              title: 'Làm remote',
              desc: 'Áp dụng sau khi chính thức. Được làm việc từ xa 1 ngày mỗi tuần làm việc.',
              highlight: isOfficial
                ? remoteUsedThisWeek
                  ? '✔ Đã dùng tuần này'
                  : '✅ Còn 1 ngày remote tuần này!'
                : undefined,
              highlightColor: remoteUsedThisWeek ? '#555' : '#34C759',
            },
            {
              icon: '⏰',
              title: 'Ca làm việc',
              desc: '08:30 – 17:30, nghỉ trưa 12:00 – 13:00 (= 8 giờ/ngày). Xin nghỉ bán ca: chọn đúng giờ bắt đầu/kết thúc, hệ thống tự quy đổi.',
            },
          ].map(rule => (
            <div key={rule.title} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{rule.icon}</span>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ccc' }}>{rule.title}: </span>
                <span style={{ fontSize: '12px', color: '#888' }}>{rule.desc}</span>
                {rule.highlight && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: rule.highlightColor, marginLeft: '6px' }}>
                    {rule.highlight}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

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
                {leaveType === 'annual' && leaveDays > leaveInfo.totalAvailable && (
                  <span style={{ color: '#FF3B30', fontSize: '11px', marginLeft: '8px' }}>
                    (vượt {+(leaveDays - leaveInfo.totalAvailable).toFixed(2)} ngày)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Hint cho remote/birthday */}
          {(leaveType === 'remote' || leaveType === 'birthday') && (
            <div style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#06B6D4' }}>
              ℹ️ {leaveType === 'remote' ? 'Làm remote chỉ 1 ngày/tuần.' : 'Nghỉ sinh nhật chỉ 1 ngày/năm, có lương.'} Vui lòng chọn đúng 1 ngày.
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
