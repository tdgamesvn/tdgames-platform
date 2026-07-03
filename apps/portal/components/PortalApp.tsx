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
import {
  fetchMyPayslips,
  fetchMyAttendance,
  fetchMyProfile,
} from '../services/portalService';
import PayslipAcknowledgeModal from './PayslipAcknowledgeModal';
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

  // Deep-link: initialTab === 'proposals' → jump to change requests tab
  const resolvedInitialTab: PortalTab = initialEvalCycleId
    ? 'evaluation'
    : initialTab === 'proposals'
      ? 'proposals'
      : 'payslip';

  const [activeTab, setActiveTab] = useState<PortalTab>(resolvedInitialTab);
  const [payslips, setPayslips] = useState<PayslipWithSheet[]>([]);
  const [attendance, setAttendance] = useState<AttendanceWithSheet[]>([]);
  const [dailyRecords, setDailyRecords] = useState<AttRecord[]>([]);
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
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const to = now.toISOString().split('T')[0];
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
  }, [activeTab, currentUser.employee_id]);

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
        />

        <main className="flex-1 px-4 md:px-8 lg:px-12 py-8 max-w-7xl mx-auto w-full">
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {payslips.map((ps: any) => {
                    const sheet = ps.sheet || {};
                    const STANDARD_DAYS = 22;
                    const ratio = (ps.work_days || 0) / STANDARD_DAYS;
                    const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

                    // Thử việc / tháng chuyển giao (giống bản PaySlip.tsx của admin)
                    const isTransition = !ps.is_probation && (ps.probation_ratio || 0) > 0 && (ps.probation_ratio || 0) < 1;
                    const hasPreSalary = isTransition && ps.pre_official_base_salary != null;
                    const effectiveBase = hasPreSalary
                      ? Math.round(ps.pre_official_base_salary * ps.probation_ratio + (ps.base_salary || 0) * (1 - ps.probation_ratio))
                      : (ps.base_salary || 0);

                    // Row helper styles
                    const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' } as const;
                    const lblStyle = { fontSize: '12px', color: '#aaa' } as const;
                    const valStyle = { fontSize: '12px', fontWeight: 600, color: '#F5F5F5', textAlign: 'right' as const } as const;
                    const subStyle = { fontSize: '10px', color: 'rgba(255,255,255,0.3)', textAlign: 'right' as const } as const;

                    return (
                      <div key={ps.id} style={{
                        background: '#161616', border: '1px solid #222', borderRadius: '16px',
                        padding: '0', overflow: 'hidden',
                      }}>
                        {/* Header */}
                        <div style={{
                          padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          borderBottom: '1px solid #222', background: 'rgba(6,182,212,0.03)',
                        }}>
                          <div>
                            <p style={{ fontSize: '18px', fontWeight: 900, color: '#F5F5F5', letterSpacing: '-0.02em' }}>
                              📄 Phiếu lương Tháng {sheet.month || '?'}/{sheet.year || '?'}
                            </p>
                            <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Ngày công: {ps.work_days || 0}/{STANDARD_DAYS} (tỷ lệ: {(ratio * 100).toFixed(1)}%)</p>
                            {ps.is_probation && (
                              <span style={{
                                display: 'inline-block', marginTop: '6px',
                                background: 'rgba(255,149,0,0.12)', color: '#FF9500',
                                padding: '2px 10px', borderRadius: '4px',
                                fontSize: '9px', fontWeight: 900, letterSpacing: '0.06em',
                              }}>
                                ⭐ THỬ VIỆC — miễn BHXH, thuế TNCN cố định
                              </span>
                            )}
                            {isTransition && (
                              <span style={{
                                display: 'inline-block', marginTop: '6px',
                                background: 'rgba(255,149,0,0.12)', color: '#FF9500',
                                padding: '2px 10px', borderRadius: '4px',
                                fontSize: '9px', fontWeight: 900, letterSpacing: '0.06em',
                              }}>
                                🔄 THÁNG CHUYỂN GIAO — {Math.round(ps.probation_ratio * 100)}% thử việc + {Math.round((1 - ps.probation_ratio) * 100)}% chính thức
                              </span>
                            )}
                          </div>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '4px 12px', borderRadius: '8px',
                            background: sheet.status === 'confirmed' ? 'rgba(52,199,89,0.1)' : 'rgba(255,149,0,0.1)',
                            color: sheet.status === 'confirmed' ? '#34C759' : '#FF9500',
                          }}>
                            {sheet.status === 'confirmed' ? '✅ Đã duyệt' : '📝 Nháp'}
                          </span>
                        </div>

                        <div style={{ padding: '16px 24px' }}>
                          {/* Section: Lương thực tế */}
                          <p style={{ fontSize: '10px', fontWeight: 900, color: '#06B6D4', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                            💰 Lương thực tế
                          </p>
                          {/* Header row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '2px solid rgba(255,255,255,0.08)', marginBottom: '2px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Khoản mục</span>
                            <div style={{ display: 'flex', gap: '32px' }}>
                              <span style={{ fontSize: '9px', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', width: '90px', textAlign: 'right' }}>Tham chiếu</span>
                              <span style={{ fontSize: '9px', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', width: '90px', textAlign: 'right' }}>Thực tế</span>
                            </div>
                          </div>

                          {hasPreSalary ? (
                            <>
                              <div style={rowStyle}>
                                <span style={lblStyle}>{`Lương CB cũ (TV ${Math.round(ps.probation_ratio * 100)}%)`}</span>
                                <div style={{ display: 'flex', gap: '32px' }}>
                                  <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(ps.pre_official_base_salary)}</span>
                                  <span style={{ ...valStyle, width: '90px' }}>{fmt(Math.round(ps.pre_official_base_salary * ps.probation_ratio * ratio))}</span>
                                </div>
                              </div>
                              <div style={rowStyle}>
                                <span style={lblStyle}>{`Lương CB mới (CThức ${Math.round((1 - ps.probation_ratio) * 100)}%)`}</span>
                                <div style={{ display: 'flex', gap: '32px' }}>
                                  <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(ps.base_salary || 0)}</span>
                                  <span style={{ ...valStyle, width: '90px' }}>{fmt(Math.round((ps.base_salary || 0) * (1 - ps.probation_ratio) * ratio))}</span>
                                </div>
                              </div>
                              <div style={rowStyle}>
                                <span style={{ ...lblStyle, color: '#FF9500' }}>Lương CB thực tế (prorate)</span>
                                <div style={{ display: 'flex', gap: '32px' }}>
                                  <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(effectiveBase)}</span>
                                  <span style={{ ...valStyle, color: '#FF9500', width: '90px' }}>{fmt(Math.round(effectiveBase * ratio))}</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div style={rowStyle}>
                              <span style={lblStyle}>Lương cơ bản</span>
                              <div style={{ display: 'flex', gap: '32px' }}>
                                <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(ps.base_salary || 0)}</span>
                                <span style={{ ...valStyle, width: '90px' }}>{fmt(Math.round((ps.base_salary || 0) * ratio))}</span>
                              </div>
                            </div>
                          )}

                          {[
                            { label: 'PC ăn trưa', ref: ps.lunch_allowance, actual: Math.round((ps.lunch_allowance || 0) * ratio) },
                            { label: 'PC xăng xe', ref: ps.transport_allowance, actual: Math.round((ps.transport_allowance || 0) * ratio) },
                            { label: 'PC điện thoại', ref: ps.phone_allowance, actual: Math.round((ps.phone_allowance || 0) * ratio) },
                            { label: 'PC trang phục', ref: ps.clothing_allowance, actual: Math.round((ps.clothing_allowance || 0) * ratio) },
                            { label: 'Phụ cấp KPI', ref: ps.kpi_allowance, actual: Math.round((ps.kpi_allowance || 0) * ratio) },
                            { label: 'Tăng ca mặc định', ref: ps.default_ot, actual: Math.round((ps.default_ot || 0) * ratio) },
                          ].map((item, i) => (
                            <div key={i} style={rowStyle}>
                              <span style={lblStyle}>{item.label}</span>
                              <div style={{ display: 'flex', gap: '32px' }}>
                                <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(item.ref || 0)}</span>
                                <span style={{ ...valStyle, width: '90px' }}>{fmt(item.actual)}</span>
                              </div>
                            </div>
                          ))}

                          {/* Extra OT row */}
                          {(ps.extra_ot_hours || 0) > 0 && (
                            <div style={rowStyle}>
                              <span style={{ ...lblStyle, color: '#FF9500' }}>Tăng ca phát sinh ({ps.extra_ot_hours}h)</span>
                              <div style={{ display: 'flex', gap: '32px' }}>
                                <span style={{ ...valStyle, color: '#888', width: '90px' }}>—</span>
                                <span style={{ ...valStyle, color: '#FF9500', width: '90px' }}>{fmt(ps.extra_ot || 0)}</span>
                              </div>
                            </div>
                          )}

                          {/* Gross rows */}
                          <div style={{ borderTop: '2px solid rgba(255,255,255,0.08)', marginTop: '4px', paddingTop: '6px' }}>
                            <div style={rowStyle}>
                              <span style={{ ...lblStyle, fontWeight: 800, color: '#ccc' }}>GROSS THAM CHIẾU</span>
                              <span style={{ ...valStyle, fontWeight: 800 }}>{fmt(ps.gross_ref || 0)} ₫</span>
                            </div>
                            <div style={rowStyle}>
                              <span style={{ ...lblStyle, fontWeight: 800, color: '#06B6D4' }}>GROSS THỰC TẾ</span>
                              <span style={{ fontSize: '14px', fontWeight: 900, color: '#06B6D4' }}>{fmt(ps.gross_actual || 0)} ₫</span>
                            </div>
                          </div>

                          {/* Section: BH & Thuế */}
                          <p style={{ fontSize: '10px', fontWeight: 900, color: '#FF9500', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '16px 0 8px' }}>
                            🛡️ Bảo hiểm & Thuế
                          </p>

                          {ps.is_probation ? (
                            <>
                              <div style={rowStyle}>
                                <span style={lblStyle}>BH nhân viên</span>
                                <span style={{ ...valStyle, color: '#888' }}>0 (không đóng — thử việc)</span>
                              </div>
                              <div style={rowStyle}>
                                <span style={lblStyle}>Thu nhập chịu thuế</span>
                                <span style={valStyle}>{fmt(ps.taxable_income || 0)} ₫</span>
                              </div>
                              <div style={rowStyle}>
                                <span style={lblStyle}>Thuế TNCN (cố định, thử việc)</span>
                                <span style={{ ...valStyle, color: (ps.pit || 0) > 0 ? '#FF3B30' : '#34C759' }}>
                                  {(ps.pit || 0) > 0 ? `-${fmt(ps.pit)}` : '0'} ₫
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={rowStyle}>
                                <span style={lblStyle}>BH nhân viên (10.5%)</span>
                                <span style={{ ...valStyle, color: '#FF9500' }}>-{fmt(ps.employee_bhxh || 0)} ₫</span>
                              </div>
                              <div style={rowStyle}>
                                <span style={lblStyle}>Thu nhập chịu thuế (CB + KPI)</span>
                                <span style={valStyle}>{fmt(ps.taxable_income || 0)} ₫</span>
                              </div>
                              <div style={rowStyle}>
                                <span style={lblStyle}>Giảm trừ bản thân</span>
                                <span style={{ ...valStyle, color: '#888' }}>-15.500.000 ₫</span>
                              </div>
                              <div style={rowStyle}>
                                <span style={lblStyle}>Giảm trừ NPT ({ps.dependents_count || 0} người)</span>
                                <span style={{ ...valStyle, color: '#888' }}>-{fmt((ps.dependents_count || 0) * 6_200_000)} ₫</span>
                              </div>
                              <div style={rowStyle}>
                                <span style={lblStyle}>Thu nhập tính thuế</span>
                                <span style={valStyle}>{(ps.assessable_income || 0) > 0 ? fmt(ps.assessable_income) : '0'} ₫</span>
                              </div>
                              <div style={rowStyle}>
                                <span style={lblStyle}>Thuế TNCN (lũy tiến)</span>
                                <span style={{ ...valStyle, color: (ps.pit || 0) > 0 ? '#FF3B30' : '#34C759' }}>
                                  {(ps.pit || 0) > 0 ? `-${fmt(ps.pit)}` : '0'} ₫
                                </span>
                              </div>
                            </>
                          )}

                          {/* Thưởng (nếu có) — cộng thẳng vào net, không tính thuế/BH */}
                          {(ps.bonus || 0) > 0 && (
                            <div style={rowStyle}>
                              <span style={{ ...lblStyle, color: '#EAB308' }}>🎁 {ps.bonus_reason || 'Thưởng'}</span>
                              <span style={{ ...valStyle, color: '#EAB308' }}>+{fmt(ps.bonus)} ₫</span>
                            </div>
                          )}

                          {/* NET */}
                          <div style={{
                            padding: '14px 20px', borderRadius: '12px', margin: '14px 0',
                            background: 'linear-gradient(135deg, rgba(52,199,89,0.15), rgba(5,150,105,0.15))',
                            border: '1px solid rgba(52,199,89,0.2)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <span style={{ fontSize: '12px', fontWeight: 900, color: '#34C759', letterSpacing: '0.06em' }}>💵 NET THỰC LĨNH</span>
                            <span style={{ fontSize: '22px', fontWeight: 900, color: '#34C759' }}>{fmt(ps.net_salary || 0)} ₫</span>
                          </div>

                          {/* Confidentiality notice */}
                          <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '8px',
                            padding: '10px 14px', marginTop: '6px',
                            background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.12)',
                            borderRadius: '10px',
                          }}>
                            <span style={{ fontSize: '13px', flexShrink: 0 }}>🔒</span>
                            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                              Thông tin lương là <span style={{ color: 'rgba(255,149,0,0.7)', fontWeight: 700 }}>bảo mật cá nhân</span>. Vui lòng không chia sẻ, tiết lộ hoặc cho bất kỳ ai khác biết nội dung phiếu lương này.
                            </p>
                          </div>
                        </div>
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
                    <p style={{ fontSize: '12px', fontWeight: 900, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                      📅 Lịch sử tháng này
                    </p>
                    {isLoading ? (
                      <p className="animate-pulse" style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Đang tải...</p>
                    ) : dailyRecords.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px', background: '#161616', borderRadius: '12px', border: '1px solid #222' }}>
                        <p style={{ color: '#666', fontSize: '13px' }}>Chưa có dữ liệu chấm công tháng này</p>
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
