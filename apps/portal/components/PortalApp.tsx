import React, { useState, useEffect, useMemo } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser } from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/apps/invoice/components/Navbar';
import {
  fetchEmployeeDirectory,
  fetchDepartments,
  fetchMyPayslips,
  fetchMyAttendance,
  fetchMyProfile,
} from '../services/portalService';
import { toPublicUrl } from '@/apps/hr/services/hrService';
import LeaveTab from './LeaveTab';
import ProfileTab from './ProfileTab';
import ParkingTab from './ParkingTab';

type PortalTab = 'directory' | 'payslip' | 'attendance' | 'leave' | 'parking' | 'profile';

interface PortalAppProps {
  currentUser: AccountUser;
  onBack: () => void;
}

const TAB_MAP: Record<PortalTab, string> = {
  directory:  'history',
  payslip:    'activity',
  attendance: 'tasks',
  leave:      'recurring',
  parking:    'overview',
  profile:    'edit',
};
const TAB_LABELS: Record<string, string> = {
  history:  'Thông tin công ty',
  activity: 'Bảng lương',
  tasks:    'Chấm công',
  recurring: 'Nghỉ phép',
  overview: 'Gửi xe',
  edit:     'Hồ sơ',
};
const REVERSE_TAB: Record<string, PortalTab> = {
  history:  'directory',
  activity: 'payslip',
  tasks:    'attendance',
  recurring: 'leave',
  overview: 'parking',
  edit:     'profile',
};

const PortalApp: React.FC<PortalAppProps> = ({ currentUser, onBack }) => {
  const [activeTab, setActiveTab] = useState<PortalTab>('directory');
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  /** undefined = đang tải hồ sơ; null = không có employee_id hoặc lỗi */
  const [linkedEmployeeType, setLinkedEmployeeType] = useState<string | null | undefined>(undefined);

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

  /** Gửi xe chỉ cho nhân viên Fulltime / Parttime (không áp dụng freelancer). */
  const parkingEligible =
    linkedEmployeeType === 'fulltime' || linkedEmployeeType === 'parttime';

  const accessibleTabs = useMemo(() => {
    const tabs = ['history', 'activity', 'tasks', 'recurring'];
    if (parkingEligible) tabs.push('overview');
    tabs.push('edit');
    return tabs;
  }, [parkingEligible]);

  useEffect(() => {
    if (linkedEmployeeType === undefined) return;
    if (activeTab === 'parking' && !parkingEligible) {
      setActiveTab('directory');
    }
  }, [activeTab, parkingEligible, linkedEmployeeType]);

  const navbarTab = TAB_MAP[activeTab];

  const handleNavChange = (tab: string) => {
    const mapped = REVERSE_TAB[tab];
    if (mapped) setActiveTab(mapped);
  };

  // Load directory data
  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchEmployeeDirectory(), fetchDepartments()])
      .then(([emps, deps]) => { setEmployees(emps); setDepartments(deps); })
      .catch(err => setToast({ message: err.message, type: 'error' }))
      .finally(() => setIsLoading(false));
  }, []);

  // Load payslips when tab or employee changes
  useEffect(() => {
    if (activeTab === 'payslip' && currentUser.employee_id) {
      setIsLoading(true);
      fetchMyPayslips(currentUser.employee_id)
        .then(data => setPayslips(data))
        .catch(() => setPayslips([]))
        .finally(() => setIsLoading(false));
    }
  }, [activeTab, currentUser.employee_id]);

  // Load attendance when tab changes
  useEffect(() => {
    if (activeTab === 'attendance' && currentUser.employee_id) {
      setIsLoading(true);
      fetchMyAttendance(currentUser.employee_id)
        .then(data => setAttendance(data))
        .catch(() => setAttendance([]))
        .finally(() => setIsLoading(false));
    }
  }, [activeTab, currentUser.employee_id]);

  const deptMap = Object.fromEntries(departments.map((d: any) => [d.id, d.name]));

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
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
          {/* ── Directory Tab ── */}
          {activeTab === 'directory' && (
            <div className="animate-fadeInUp">
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                  👤 Thông tin công ty
                </h2>
                <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
                  Danh bạ nhân viên — read only
                </p>
              </div>

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                  <p className="animate-pulse" style={{ color: '#888', fontSize: '13px' }}>Đang tải...</p>
                </div>
              ) : employees.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
                  <p style={{ fontSize: '48px', marginBottom: '12px' }}>👤</p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Chưa có nhân viên nào</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                  {employees.map(emp => {
                    const avatarSrc = emp.avatar_url ? toPublicUrl(emp.avatar_url) : '';
                    return (
                      <div key={emp.id} style={{
                        background: '#161616', border: '1px solid #222', borderRadius: '20px',
                        display: 'flex', overflow: 'hidden',
                        transition: 'border-color 0.2s, transform 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#06B6D440'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        {/* Avatar — full height of card */}
                        <div style={{
                          width: '120px', minHeight: '140px', flexShrink: 0,
                          background: avatarSrc
                            ? `url(${avatarSrc}) center/cover no-repeat`
                            : 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRight: '1px solid #222',
                        }}>
                          {!avatarSrc && (
                            <span style={{ fontSize: '40px', fontWeight: 900, color: '#fff', opacity: 0.8 }}>
                              {emp.full_name?.[0] || '?'}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <p style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5' }}>
                              {emp.full_name}
                            </p>
                            <span style={{
                              fontSize: '9px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                              textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0,
                              background: emp.status === 'active' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                              color: emp.status === 'active' ? '#34C759' : '#FF3B30',
                            }}>
                              {emp.type === 'fulltime' ? 'FT' : emp.type === 'parttime' ? 'PT' : 'FL'}
                            </span>
                          </div>
                          {emp.position && (
                            <p style={{ fontSize: '13px', color: '#06B6D4', fontWeight: 600 }}>
                              {emp.position}
                            </p>
                          )}
                          {emp.department_id && deptMap[emp.department_id] && (
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '6px',
                              background: 'rgba(6,182,212,0.08)', color: '#06B6D4', alignSelf: 'flex-start',
                            }}>
                              {deptMap[emp.department_id]}
                            </span>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                            {emp.work_email && (
                              <span style={{ fontSize: '11px', color: '#888' }}>💼 {emp.work_email}</span>
                            )}
                            {emp.phone && (
                              <span style={{ fontSize: '11px', color: '#888' }}>📱 {emp.phone}</span>
                            )}
                            {emp.date_of_birth && (
                              <span style={{ fontSize: '11px', color: '#888' }}>🎂 {new Date(emp.date_of_birth).toLocaleDateString('vi-VN')}</span>
                            )}
                            {emp.address && (
                              <span style={{ fontSize: '11px', color: '#888', lineHeight: '1.3' }}>📍 {emp.address}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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

                          {[
                            { label: 'Lương cơ bản', ref: ps.base_salary, actual: Math.round((ps.base_salary || 0) * ratio) },
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
                            <span style={lblStyle}>Thuế TNCN</span>
                            <span style={{ ...valStyle, color: (ps.pit || 0) > 0 ? '#FF3B30' : '#34C759' }}>
                              {(ps.pit || 0) > 0 ? `-${fmt(ps.pit)}` : '0'} ₫
                            </span>
                          </div>

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
                  Xem bảng công theo tháng
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
              ) : attendance.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
                  <p style={{ fontSize: '48px', marginBottom: '12px' }}>⏰</p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Chưa có dữ liệu chấm công</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Bảng công sẽ hiển thị khi HR cập nhật dữ liệu chấm công</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {attendance.map((att: any) => {
                    const sheet = att.sheet || {};
                    return (
                      <div key={att.id} style={{
                        background: '#161616', border: '1px solid #222', borderRadius: '12px',
                        padding: '20px 24px',
                      }}>
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
                          <div style={{ background: '#0a0a0a', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                            <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Ngày công</p>
                            <p style={{ fontSize: '20px', fontWeight: 900, color: '#06B6D4' }}>{att.work_days || 0}</p>
                          </div>
                          <div style={{ background: '#0a0a0a', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                            <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Giờ tăng ca</p>
                            <p style={{ fontSize: '20px', fontWeight: 900, color: '#FF9500' }}>{att.ot_hours || 0}</p>
                          </div>
                          <div style={{ background: '#0a0a0a', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                            <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Đi muộn</p>
                            <p style={{ fontSize: '20px', fontWeight: 900, color: att.late_count > 0 ? '#FF3B30' : '#888' }}>{att.late_count || 0}</p>
                          </div>
                          <div style={{ background: '#0a0a0a', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                            <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Nghỉ</p>
                            <p style={{ fontSize: '20px', fontWeight: 900, color: att.absent_days > 0 ? '#FF3B30' : '#888' }}>{att.absent_days || 0}</p>
                          </div>
                        </div>
                        {att.note && (
                          <p style={{ fontSize: '12px', color: '#888', marginTop: '10px', fontStyle: 'italic' }}>📝 {att.note}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
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

          {/* ── Parking Tab ── */}
          {activeTab === 'parking' && (
            !currentUser.employee_id ? (
              <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
                <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔗</p>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Tài khoản chưa liên kết nhân viên</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Liên hệ HR để liên kết hồ sơ nhân viên</p>
              </div>
            ) : linkedEmployeeType === undefined ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <p className="animate-pulse" style={{ color: '#888' }}>Đang tải…</p>
              </div>
            ) : !parkingEligible ? (
              <div style={{ textAlign: 'center', padding: '48px', background: '#161616', borderRadius: '16px', border: '1px solid #222', maxWidth: 520, margin: '0 auto' }}>
                <p style={{ fontSize: '40px', marginBottom: '12px' }}>🅿️</p>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Đăng ký gửi xe chỉ áp dụng nhân viên Fulltime / Parttime</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '10px', lineHeight: 1.5 }}>
                  Cộng tác viên Freelancer không sử dụng bãi gửi xe công ty theo quy trình này.
                </p>
              </div>
            ) : (
              <ParkingTab
                employeeId={currentUser.employee_id}
                onToast={(msg, type) => setToast({ message: msg, type })}
              />
            )
          )}

          {/* ── Profile Tab ── */}
          {activeTab === 'profile' && (
            <ProfileTab
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
