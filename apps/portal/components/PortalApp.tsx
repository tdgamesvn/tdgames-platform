import React, { useState, useEffect, useMemo } from 'react';
import AppBackground from '@/components/AppBackground';
import {
  AccountUser,
  PayPayrollRecord,
  PayPayrollSheet,
  AttMonthlyRecord,
  AttMonthlySheet,
  AttRecord,
} from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/components/Navbar';
import MemberTabBar, { MEMBER_TABBAR_PAD } from '@/components/MemberTabBar';
import { isMemberOnly } from '@/config/apps';
import {
  fetchMyPayslips,
  fetchMyAttendance,
  fetchMyProfile,
} from '../services/portalService';
import PayslipAcknowledgeModal from './PayslipAcknowledgeModal';
import PayslipDetailSection from './PayslipDetailSection';
import CheckinWidget from './CheckinWidget';
import { fetchMyRecordsByRange } from '@/apps/attendance/services/attendanceService';

type PayslipWithSheet = PayPayrollRecord & { sheet?: PayPayrollSheet };
type AttendanceWithSheet = AttMonthlyRecord & { sheet?: AttMonthlySheet };
import LeaveTab from './LeaveTab';
import ProfileTab from './ProfileTab';
import EvalTab from './EvalTab';
import ChangeRequestsTab from './ChangeRequestsTab';
import TasksTab from './TasksTab';

type PortalTab = 'payslip' | 'attendance' | 'leave' | 'profile' | 'evaluation' | 'proposals' | 'mytasks';

interface PortalAppProps {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
  initialParam?: string | null;
}

const TAB_MAP: Record<PortalTab, string> = {
  payslip:    'activity',
  attendance: 'tasks',
  leave:      'recurring',
  profile:    'edit',
  evaluation: 'dashboard',
  proposals:  'proposals',
  mytasks:    'mytasks',
};
const TAB_LABELS: Record<string, string> = {
  activity:  'Bảng lương',
  tasks:     'Chấm công',
  recurring: 'Nghỉ phép',
  edit:      'Hồ sơ',
  dashboard: 'Đánh giá',
  proposals: 'Đề xuất',
  mytasks:   'Công việc',
};
const REVERSE_TAB: Record<string, PortalTab> = {
  activity:  'payslip',
  tasks:     'attendance',
  recurring: 'leave',
  edit:      'profile',
  dashboard: 'evaluation',
  proposals: 'proposals',
  mytasks:   'mytasks',
};

const PortalApp: React.FC<PortalAppProps> = ({ currentUser, onBack, initialTab, initialParam }) => {
  // Parse deep-link: initialTab === 'eval-{uuid}' → jump straight to evaluation tab
  const initialEvalCycleId = initialTab?.startsWith('eval-')
    ? initialTab.slice('eval-'.length)
    : null;

  // Deep-link: #portal/<navbar tab> → mở thẳng tab đó (recurring→leave, tasks→attendance…).
  // Trước đây chỉ nhận 'proposals', mọi hash khác rơi về 'payslip'.
  const resolvedInitialTab: PortalTab = initialEvalCycleId
    ? 'evaluation'
    : (initialTab && REVERSE_TAB[initialTab]) || 'payslip';

  const [activeTab, setActiveTab] = useState<PortalTab>(resolvedInitialTab);

  // Hash đổi khi component ĐANG mở (thanh tab đáy, nút Back trình duyệt, bookmark) thì
  // initialTab mới về nhưng useState ở trên không chạy lại → URL một đằng, màn một nẻo.
  useEffect(() => { setActiveTab(resolvedInitialTab); }, [resolvedInitialTab]);
  const [payslips, setPayslips] = useState<PayslipWithSheet[]>([]);
  /** id phiếu lương đang mở chi tiết trong danh sách dạng list — null = tất cả đang thu gọn */
  const [expandedPayslipId, setExpandedPayslipId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceWithSheet[]>([]);
  const [dailyRecords, setDailyRecords] = useState<AttRecord[]>([]);
  const [attMonth, setAttMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  /** undefined = đang tải hồ sơ; null = không có employee_id hoặc lỗi */
  const [linkedEmployeeType, setLinkedEmployeeType] = useState<string | null | undefined>(undefined);
  /** Phiếu lương đang chờ xác nhận bắt buộc (pending) — hiện modal blocking */
  const [pendingPayslip, setPendingPayslip] = useState<(PayPayrollRecord & { sheet?: PayPayrollSheet }) | null | undefined>(undefined);

  useEffect(() => {
    if (!currentUser.employee_id) {
      setLinkedEmployeeType(null);
      return;
    }
    let cancelled = false;
    fetchMyProfile(currentUser.employee_id)
      .then((p: { type?: string }) => {
        if (!cancelled) setLinkedEmployeeType(p?.type ?? null);
      })
      .catch(() => {
        if (!cancelled) setLinkedEmployeeType(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.employee_id]);

  const accessibleTabs = useMemo(() => {
    return ['activity', 'tasks', 'recurring', 'proposals', 'dashboard', 'edit', 'mytasks'];
  }, []);

  const navbarTab = TAB_MAP[activeTab];

  const handleNavChange = (tab: string) => {
    const mapped = REVERSE_TAB[tab];
    if (mapped) setActiveTab(mapped);
  };

  // Kiểm tra phiếu lương pending ngay khi mount — hiện modal blocking nếu có
  useEffect(() => {
    if (!currentUser.employee_id) return;
    fetchMyPayslips(currentUser.employee_id)
      .then(data => {
        setPayslips(data);
        const pending = data.find(p => (p.employee_status ?? 'pending') === 'pending' && p.sheet?.status === 'confirmed');
        setPendingPayslip(pending ?? null);
      })
      .catch(() => setPendingPayslip(null));
  }, [currentUser.employee_id]);

  // Load payslips when tab or employee changes (refresh khi vào tab)
  useEffect(() => {
    if (activeTab === 'payslip' && currentUser.employee_id) {
      setIsLoading(true);
      fetchMyPayslips(currentUser.employee_id)
        .then(data => {
          setPayslips(data);
          const pending = data.find(p => (p.employee_status ?? 'pending') === 'pending' && p.sheet?.status === 'confirmed');
          setPendingPayslip(pending ?? null);
        })
        .catch(() => setPayslips([]))
        .finally(() => setIsLoading(false));
    }
  }, [activeTab, currentUser.employee_id]);

  // Load attendance when tab changes
  useEffect(() => {
    if (activeTab === 'attendance' && currentUser.employee_id) {
      setIsLoading(true);
      // Trước đây hard-code tháng hiện tại => xem phiếu lương tháng cũ thì không có
      // đường nào tra lại ngày công của đúng tháng đó.
      const [y, m] = attMonth.split('-').map(Number);
      const from = `${attMonth}-01`;
      // Không dùng toISOString() — GMT+7 sẽ lùi về ngày hôm trước, mất ngày cuối tháng.
      const to = `${attMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
      Promise.all([
        fetchMyAttendance(currentUser.employee_id),
        fetchMyRecordsByRange(currentUser.employee_id, from, to),
      ])
        .then(([monthly, daily]) => {
          setAttendance(monthly);
          setDailyRecords(daily);
        })
        .catch(() => { setAttendance([]); setDailyRecords([]); })
        .finally(() => setIsLoading(false));
    }
  }, [activeTab, currentUser.employee_id, attMonth]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />

      {/* Modal blocking bắt buộc — nhân viên phải xác nhận trước khi dùng app */}
      {pendingPayslip && (
        <PayslipAcknowledgeModal
          payslip={pendingPayslip}
          onDone={() => {
            setPendingPayslip(null);
            // Refresh payslip list
            if (currentUser.employee_id) {
              fetchMyPayslips(currentUser.employee_id).then(data => setPayslips(data)).catch(() => {});
            }
          }}
        />
      )}

      <div className="min-h-screen flex flex-col relative z-10">
        <Navbar
          theme="dark"
          currentUser={currentUser}
          onBack={onBack}
          activeTab={navbarTab as any}
          onTabChange={handleNavChange as any}
          accessibleTabs={accessibleTabs as any}
          onLogout={onBack}
          tabLabels={TAB_LABELS}
          appName="Employee Portal"
          hideMobileTabs={isMemberOnly(currentUser)}
        />

        <MemberTabBar currentUser={currentUser} />
        <main className={`portal-main flex-1 px-4 md:px-8 lg:px-12 py-8 max-w-7xl mx-auto w-full ${MEMBER_TABBAR_PAD}`}>
          {/* ── Payslip Tab ── */}
          {activeTab === 'payslip' && (
            <div className="animate-fadeInUp">
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                  💵 Bảng lương của tôi
                </h2>
                <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
                  Xem phiếu lương theo tháng
                </p>
              </div>

              {!currentUser.employee_id ? (
                <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
                  <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔗</p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Tài khoản chưa liên kết nhân viên</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Liên hệ HR để liên kết tài khoản với hồ sơ nhân viên</p>
                </div>
              ) : isLoading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                  <p className="animate-pulse" style={{ color: '#888', fontSize: '13px' }}>Đang tải...</p>
                </div>
              ) : payslips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
                  <p style={{ fontSize: '48px', marginBottom: '12px' }}>💵</p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Chưa có phiếu lương</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Phiếu lương sẽ hiển thị khi kế toán tạo bảng lương</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[...payslips]
                    .sort((a: any, b: any) => {
                      const ay = a.sheet?.year || 0, by = b.sheet?.year || 0;
                      if (ay !== by) return by - ay;
                      const am = a.sheet?.month || 0, bm = b.sheet?.month || 0;
                      return bm - am;
                    })
                    .map((ps: any) => {
                    const sheet = ps.sheet || {};
                    const STANDARD_DAYS = sheet.standard_work_days ?? 22;
                    const ratio = (ps.work_days || 0) / STANDARD_DAYS;

                    // Thử việc / tháng chuyển giao (giống bản PaySlip.tsx của admin)
                    const isTransition = !ps.is_probation && (ps.probation_ratio || 0) > 0 && (ps.probation_ratio || 0) < 1;
                    const isExpanded = expandedPayslipId === ps.id;
                    const fmt = (n: number) => Math.round(n || 0).toLocaleString('vi-VN');

                    return (
                      <div key={ps.id} style={{
                        background: '#161616', border: '1px solid #222', borderRadius: '16px',
                        padding: '0', overflow: 'hidden',
                      }}>
                        {/* Header — bấm để mở/thu gọn chi tiết */}
                        <button
                          onClick={() => setExpandedPayslipId(isExpanded ? null : ps.id)}
                          className="w-full text-left"
                          style={{
                            padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            gap: '12px', flexWrap: 'wrap',
                            borderBottom: isExpanded ? '1px solid #222' : 'none',
                            background: 'rgba(6,182,212,0.03)', cursor: 'pointer', border: 'none',
                          }}
                        >
                          <div className="flex items-center gap-3 flex-wrap min-w-0">
                            <span style={{ fontSize: '13px', color: '#666', transition: 'transform 0.15s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                            <div className="min-w-0">
                              <p style={{ fontSize: '15px', fontWeight: 900, color: '#F5F5F5', letterSpacing: '-0.02em' }}>
                                📄 Tháng {sheet.month || '?'}/{sheet.year || '?'}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {ps.is_probation && (
                                  <span style={{
                                    background: 'rgba(255,149,0,0.12)', color: '#FF9500',
                                    padding: '2px 8px', borderRadius: '4px',
                                    fontSize: '9px', fontWeight: 900, letterSpacing: '0.04em',
                                  }}>
                                    ⭐ THỬ VIỆC
                                  </span>
                                )}
                                {isTransition && (
                                  <span style={{
                                    background: 'rgba(255,149,0,0.12)', color: '#FF9500',
                                    padding: '2px 8px', borderRadius: '4px',
                                    fontSize: '9px', fontWeight: 900, letterSpacing: '0.04em',
                                  }}>
                                    🔄 CHUYỂN GIAO
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                            <div className="text-right">
                              <p style={{ fontSize: '9px', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net thực lĩnh</p>
                              <p style={{ fontSize: '16px', fontWeight: 900, color: '#34C759' }}>{fmt(ps.net_salary)} ₫</p>
                            </div>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px',
                              background: sheet.status === 'confirmed' ? 'rgba(52,199,89,0.1)' : 'rgba(255,149,0,0.1)',
                              color: sheet.status === 'confirmed' ? '#34C759' : '#FF9500',
                              whiteSpace: 'nowrap',
                            }}>
                              {sheet.status === 'confirmed' ? '✅ Đã duyệt' : '📝 Nháp'}
                            </span>
                            {/* Nhân viên phải thấy "cần xác nhận" ngay khi chưa mở rộng */}
                            {(ps.employee_status ?? 'pending') === 'pending' && (
                              <span style={{
                                fontSize: '10px', fontWeight: 900, padding: '4px 10px', borderRadius: '8px',
                                background: 'rgba(255,149,0,0.15)', color: '#FF9500', whiteSpace: 'nowrap',
                              }}>
                                ⏳ Chờ bạn xác nhận
                              </span>
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div style={{ padding: '16px 24px' }}>
                            <PayslipDetailSection
                              ps={ps}
                              standardDays={STANDARD_DAYS}
                              onViewAttendance={sheet.month && sheet.year ? () => {
                                setAttMonth(`${sheet.year}-${String(sheet.month).padStart(2, '0')}`);
                                setActiveTab('attendance');
                              } : undefined}
                            />

                            {/* Nút xác nhận dự phòng — trước đây đường DUY NHẤT để xác nhận là
                                modal tự bật lúc mở app. Lỡ một lần là kẹt vĩnh viễn, không có
                                nút nào khác. Nút này mở lại chính modal đó, chủ động. */}
                            {(ps.employee_status ?? 'pending') === 'pending' ? (
                              <button
                                onClick={() => setPendingPayslip(ps)}
                                className="w-full mt-4 rounded-xl py-3 text-[13px] sm:text-[14px] font-black transition-colors"
                                style={{
                                  background: 'rgba(52,199,89,0.12)', color: '#34C759',
                                  border: '1px solid rgba(52,199,89,0.3)',
                                }}
                              >
                                ✅ Xác nhận / Báo sai sót phiếu lương này
                              </button>
                            ) : (
                              <p className="mt-4 text-center text-[12px] font-bold"
                                style={{ color: ps.employee_status === 'disputed' ? '#FF9500' : '#34C759' }}>
                                {ps.employee_status === 'disputed'
                                  ? '⚠️ Bạn đã báo sai sót — HR đang xử lý'
                                  : ps.employee_status === 'resolved'
                                    ? '✅ Khiếu nại đã được giải quyết'
                                    : '✅ Bạn đã xác nhận phiếu lương này'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Attendance Tab ── */}
          {activeTab === 'attendance' && (
            <div className="animate-fadeInUp">
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                  ⏰ Chấm công của tôi
                </h2>
                <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
                  Check in/out hàng ngày và xem lịch sử
                </p>
              </div>

              {!currentUser.employee_id ? (
                <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
                  <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔗</p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Tài khoản chưa liên kết nhân viên</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Liên hệ HR để liên kết tài khoản với hồ sơ nhân viên</p>
                </div>
              ) : (
                <>
                  {/* Check-in Widget */}
                  <CheckinWidget
                    employeeId={currentUser.employee_id}
                    onToast={(msg, type) => setToast({ message: msg, type })}
                  />

                  {/* Daily History — this month */}
                  <div style={{ marginBottom: '24px' }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: '12px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 900, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                        📅 Lịch sử chấm công
                      </p>
                      {/* ponytail: input type=month native — không thêm date-picker lib */}
                      <input
                        type="month"
                        value={attMonth}
                        onChange={e => e.target.value && setAttMonth(e.target.value)}
                        style={{
                          background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px', padding: '6px 10px', color: '#F5F5F5',
                          fontSize: '12px', fontWeight: 700, colorScheme: 'dark',
                        }}
                      />
                    </div>
                    {isLoading ? (
                      <p className="animate-pulse" style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Đang tải...</p>
                    ) : dailyRecords.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px', background: '#161616', borderRadius: '12px', border: '1px solid #222' }}>
                        <p style={{ color: '#666', fontSize: '13px' }}>Chưa có dữ liệu chấm công tháng {attMonth.split('-')[1]}/{attMonth.split('-')[0]}</p>
                      </div>
                    ) : (
                      <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden' }}>
                        {/* Table header */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px 80px 60px',
                          padding: '10px 16px', borderBottom: '1px solid #222',
                          background: 'rgba(255,255,255,0.02)',
                        }}>
                          {['Ngày', 'Vào', 'Ra', 'Số giờ', 'Ngày công', 'Loại'].map(h => (
                            <span key={h} style={{ fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                          ))}
                        </div>
                        {dailyRecords.map((rec) => {
                          const checkIn = rec.check_in ? new Date(rec.check_in) : null;
                          const checkOut = rec.check_out ? new Date(rec.check_out) : null;
                          const totalMs = (checkIn && checkOut) ? checkOut.getTime() - checkIn.getTime() : 0;
                          const totalHours = totalMs / 3_600_000;
                          const dayFrac = totalHours > 0 ? (totalHours / 8).toFixed(2) : '—';
                          const hm = totalMs > 0 ? (() => {
                            const m = Math.floor(totalMs / 60000);
                            return `${Math.floor(m / 60)}h ${m % 60}p`;
                          })() : '—';
                          const fmtTime = (d: Date | null) => d
                            ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                            : '—';
                          const fmtDate = (s: string) => {
                            const d = new Date(s);
                            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                          };
                          const methodBadge = rec.method === 'remote'
                            ? { label: 'Remote', color: '#06B6D4' }
                            : { label: 'VP', color: '#34C759' };
                          return (
                            <div key={rec.id} style={{
                              display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px 80px 60px',
                              padding: '10px 16px', borderBottom: '1px solid #111', alignItems: 'center',
                            }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ccc' }}>{fmtDate(rec.date)}</span>
                              <span style={{ fontSize: '13px', color: '#F5F5F5' }}>{fmtTime(checkIn)}</span>
                              <span style={{ fontSize: '13px', color: checkOut ? '#F5F5F5' : '#555' }}>
                                {checkOut ? fmtTime(checkOut) : 'Chưa ra'}
                              </span>
                              <span style={{ fontSize: '13px', color: totalMs > 0 ? '#FF9500' : '#555' }}>{hm}</span>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: totalMs > 0 ? '#34C759' : '#555' }}>{dayFrac}</span>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: methodBadge.color }}>{methodBadge.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Monthly summary from HR (existing att_monthly_records) */}
                  {attendance.length > 0 && (
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 900, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                        📊 Bảng công tháng (HR xác nhận)
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {attendance.map((att: any) => {
                          const sheet = att.sheet || {};
                          return (
                            <div key={att.id} style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px 24px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <p style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5' }}>
                                  ⏰ Tháng {sheet.month || '?'}/{sheet.year || '?'}
                                </p>
                                <span style={{
                                  fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px',
                                  background: sheet.status === 'finalized' ? 'rgba(52,199,89,0.1)' : 'rgba(255,149,0,0.1)',
                                  color: sheet.status === 'finalized' ? '#34C759' : '#FF9500',
                                }}>
                                  {sheet.status === 'finalized' ? '✅ Đã chốt' : '📝 Nháp'}
                                </span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                {[
                                  { label: 'Ngày công', value: att.work_days || 0, color: '#06B6D4' },
                                  { label: 'Giờ tăng ca', value: att.ot_hours || 0, color: '#FF9500' },
                                  { label: 'Đi muộn', value: att.late_count || 0, color: att.late_count > 0 ? '#FF3B30' : '#888' },
                                  { label: 'Nghỉ', value: att.absent_days || 0, color: att.absent_days > 0 ? '#FF3B30' : '#888' },
                                ].map(({ label, value, color }) => (
                                  <div key={label} style={{ background: '#0a0a0a', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                                    <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
                                    <p style={{ fontSize: '20px', fontWeight: 900, color }}>{value}</p>
                                  </div>
                                ))}
                              </div>
                              {att.note && <p style={{ fontSize: '12px', color: '#888', marginTop: '10px', fontStyle: 'italic' }}>📝 {att.note}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Leave Tab ── */}
          {activeTab === 'leave' && (
            <LeaveTab
              currentUser={currentUser}
              onToast={(msg, type) => setToast({ message: msg, type })}
            />
          )}

          {/* ── Profile Tab ── */}
          {activeTab === 'profile' && (
            <ProfileTab
              currentUser={currentUser}
              onToast={(msg, type) => setToast({ message: msg, type })}
            />
          )}

          {/* ── Change Requests Tab ── */}
          {activeTab === 'proposals' && (
            <ChangeRequestsTab
              currentUser={currentUser}
              onToast={(msg, type) => setToast({ message: msg, type })}
              highlightId={initialParam}
            />
          )}

          {/* ── Evaluation Tab ── */}
          {activeTab === 'evaluation' && (
            <EvalTab
              currentUser={currentUser}
              onToast={(msg, type) => setToast({ message: msg, type })}
              initialCycleId={initialEvalCycleId ?? undefined}
            />
          )}

          {/* ── My Tasks Tab ── */}
          {activeTab === 'mytasks' && (
            <TasksTab
              currentUser={currentUser}
              onToast={(msg, type) => setToast({ message: msg, type })}
            />
          )}
        </main>

        {toast && <ToastNotification message={{ text: toast.message, type: toast.type }} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
};

export default PortalApp;
