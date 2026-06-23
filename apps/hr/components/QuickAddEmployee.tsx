import React, { useState, useEffect } from 'react';
import { HrDepartment, HrSalaryComponent } from '@/types';
import { supabase } from '@/services/supabaseClient';
import * as svc from '../services/hrService';

interface Props {
  departments: HrDepartment[];
  onSave: (emp: any) => Promise<void> | void;
  onCancel: () => void;
}

type QuickAddMode = 'employee' | 'freelancer';

const inputCls = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-white placeholder-neutral-medium/40 focus:outline-none focus:border-primary/40 transition-all text-sm";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block";
const sectionCls = "rounded-[20px] border border-primary/10 bg-surface p-8 space-y-6";

const SPECIALIZATION_OPTIONS = ['2D', '3D', 'VFX', 'Concept Art', 'Animation', 'Storyboard', 'Compositing', 'Rigging', 'Modeling', 'Texturing', 'Lighting', 'Motion Graphics'];

const QuickAddEmployee: React.FC<Props> = ({ departments, onSave, onCancel }) => {
  const [mode, setMode] = useState<QuickAddMode>('employee');

  // ── Employee form state ──
  const [empForm, setEmpForm] = useState({
    full_name: '',
    work_email: '',
    department_id: null as string | null,
    position: '',
    level: '',
    role: 'member' as string,
    start_date: null as string | null,
    probation_end: null as string | null,
  });

  // ── Freelancer form state ──
  const [flForm, setFlForm] = useState({
    full_name: '',
    email: '',
    specializations: [] as string[],
    level: '',
  });

  const [salaryComponents, setSalaryComponents] = useState<HrSalaryComponent[]>([]);
  const [salaryAmounts, setSalaryAmounts] = useState<Record<string, number>>({});
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Load salary components (only for employee mode)
  useEffect(() => {
    if (mode !== 'employee') return;
    const load = async () => {
      setLoadingSalary(true);
      try {
        const comps = await svc.fetchSalaryComponents();
        setSalaryComponents(comps.filter(c => c.is_active));
      } catch {}
      finally { setLoadingSalary(false); }
    };
    load();
  }, [mode]);

  // Reset validation on mode change
  useEffect(() => {
    setShowValidation(false);
    setEmailError('');
  }, [mode]);

  // ── Employee validation ──
  const empRequiredFields = [
    { key: 'full_name', label: 'Họ tên' },
    { key: 'work_email', label: 'Email công việc' },
    { key: 'department_id', label: 'Phòng ban' },
    { key: 'position', label: 'Chức danh' },
    { key: 'start_date', label: 'Ngày bắt đầu' },
  ];
  const empMissing = empRequiredFields.filter(f => {
    const val = (empForm as any)[f.key];
    return !val || (typeof val === 'string' && !val.trim());
  });

  // ── Freelancer validation ──
  const flRequiredFields = [
    { key: 'full_name', label: 'Họ tên' },
    { key: 'email', label: 'Email cá nhân' },
    { key: 'level', label: 'Level' },
  ];
  const flMissing = flRequiredFields.filter(f => {
    const val = (flForm as any)[f.key];
    return !val || (typeof val === 'string' && !val.trim());
  });
  // Also check specializations
  if (flForm.specializations.length === 0 && showValidation) {
    flMissing.push({ key: 'specializations', label: 'Chuyên môn' });
  }

  const missingRequired = mode === 'employee' ? empMissing : flMissing;
  const isFieldMissing = (key: string) => showValidation && missingRequired.some(f => f.key === key);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setShowValidation(true);
    setEmailError('');

    if (mode === 'employee') {
      if (empMissing.length > 0) return;

      // Cross-check email: ensure no conflict between work_email and freelancer personal email
      const emailConflict = await svc.checkEmailConflict(empForm.work_email.trim().toLowerCase());
      if (emailConflict) {
        setEmailError(emailConflict);
        return;
      }

      setSaving(true);
      try {
        const totalGross = (Object.values(salaryAmounts) as number[]).reduce((s, v) => s + (v || 0), 0);
        const empData: any = {
          type: 'fulltime',
          status: 'active',
          full_name: empForm.full_name.trim(),
          work_email: empForm.work_email.trim().toLowerCase(),
          department_id: empForm.department_id,
          position: empForm.position.trim(),
          level: empForm.level,
          start_date: empForm.start_date,
          probation_end: empForm.probation_end,
          salary: totalGross,
          salary_currency: 'VND',
          email: '', phone: '', gender: '', nationality: 'Vietnam',
          address: '', temp_address: '',
          id_number: '', id_issue_date: null, id_issue_place: '',
          id_card_front_url: '', id_card_back_url: '',
          tax_code: '', insurance_number: '',
          avatar_url: '',
          portfolio_url: '', specializations: [], timezone: 'UTC+7',
          rate_type: '', rate_amount: 0, rate_currency: 'USD',
          payment_method: '', payment_details: {},
          bank_name: '', bank_account: '', bank_branch: '',
          notes: '', tags: [],
          _salaryAmounts: salaryAmounts,
          _role: empForm.role,
        };
        await onSave(empData);
      } catch {} finally { setSaving(false); }
    } else {
      // Freelancer mode
      const flMissingNow = flRequiredFields.filter(f => {
        const val = (flForm as any)[f.key];
        return !val || (typeof val === 'string' && !val.trim());
      });
      if (flForm.specializations.length === 0) flMissingNow.push({ key: 'specializations', label: 'Chuyên môn' });
      if (flMissingNow.length > 0) return;

      // Cross-check email: ensure no conflict between freelancer email and fulltime work_email
      const emailConflict = await svc.checkEmailConflict(flForm.email.trim().toLowerCase());
      if (emailConflict) {
        setEmailError(emailConflict);
        return;
      }

      setSaving(true);
      try {
        const flData: any = {
          type: 'freelancer',
          status: 'active',
          full_name: flForm.full_name.trim(),
          email: flForm.email.trim().toLowerCase(),
          level: flForm.level,
          specializations: flForm.specializations,
          // Default empty values
          work_email: '', phone: '', gender: '', nationality: 'Vietnam',
          address: '', temp_address: '',
          id_number: '', id_issue_date: null, id_issue_place: '',
          id_card_front_url: '', id_card_back_url: '',
          tax_code: '', insurance_number: '',
          avatar_url: '', position: '',
          portfolio_url: '', timezone: 'UTC+7',
          rate_type: '', rate_amount: 0, rate_currency: 'USD',
          payment_method: '', payment_details: {},
          bank_name: '', bank_account: '', bank_branch: '',
          notes: '', tags: [],
          salary: 0, salary_currency: 'VND',
        };
        await onSave(flData);
      } catch {} finally { setSaving(false); }
    }
  };

  const toggleSpec = (spec: string) => {
    setFlForm(f => ({
      ...f,
      specializations: f.specializations.includes(spec)
        ? f.specializations.filter(s => s !== spec)
        : [...f.specializations, spec],
    }));
  };

  const accentColor = mode === 'employee' ? '#06B6D4' : '#F59E0B';
  const accentGradient = mode === 'employee'
    ? 'linear-gradient(135deg, #34C759 0%, #059669 100%)'
    : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)';

  return (
    <div className="animate-fadeInUp space-y-8 relative">
      {/* ── Full-screen saving overlay ── */}
      {saving && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
          <div className="w-16 h-16 border-4 rounded-full animate-spin" style={{ borderColor: `${accentColor}30`, borderTopColor: accentColor }} />
          <div className="text-center">
            <p className="text-white font-black text-lg uppercase tracking-widest">
              {mode === 'employee' ? 'Đang thêm nhân sự...' : 'Đang thêm freelancer...'}
            </p>
            <p className="text-neutral-medium text-sm mt-2">
              {mode === 'employee' ? 'Tạo tài khoản & gửi email mời đăng nhập' : 'Gửi email mời vào Freelancer Portal'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF375F' }}>
          ⚡ Thêm nhanh
        </h2>
        <p className="text-neutral-medium text-sm mt-1">
          Nhập thông tin cơ bản — {mode === 'employee' ? 'nhân viên' : 'freelancer'} sẽ tự điền phần còn lại qua Portal
        </p>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="flex gap-2 p-1 rounded-2xl bg-black/30 border border-white/[0.04] w-fit">
        <button
          type="button"
          onClick={() => setMode('employee')}
          className="px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all"
          style={{
            background: mode === 'employee' ? 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' : 'transparent',
            color: mode === 'employee' ? 'white' : '#666',
            boxShadow: mode === 'employee' ? '0 4px 16px rgba(6,182,212,0.3)' : 'none',
          }}
        >
          👤 Nhân viên
        </button>
        <button
          type="button"
          onClick={() => setMode('freelancer')}
          className="px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all"
          style={{
            background: mode === 'freelancer' ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'transparent',
            color: mode === 'freelancer' ? 'white' : '#666',
            boxShadow: mode === 'freelancer' ? '0 4px 16px rgba(245,158,11,0.3)' : 'none',
          }}
        >
          🤝 Freelancer
        </button>
      </div>

      {/* Info Banner */}
      <div className="rounded-[16px] border bg-opacity-5 p-5 flex items-start gap-4"
        style={{ borderColor: `${accentColor}30`, background: `${accentColor}08` }}>
        <span className="text-2xl">📬</span>
        <div>
          <p className="font-bold text-sm" style={{ color: accentColor }}>Luồng tự động sau khi thêm</p>
          <ol className="text-neutral-medium text-xs mt-2 space-y-1 list-decimal list-inside">
            {mode === 'employee' ? (
              <>
                <li>Email mời đăng nhập sẽ được gửi tới <strong className="text-white">email công việc</strong></li>
                <li>Nhân viên nhấn link → đặt mật khẩu lần đầu</li>
                <li>Đăng nhập → tự điền thông tin cá nhân còn thiếu (CCCD, ngân hàng, ảnh...)</li>
              </>
            ) : (
              <>
                <li>Email mời sẽ được gửi tới <strong className="text-amber-400">email cá nhân</strong> của freelancer</li>
                <li>Freelancer nhấn link → đặt mật khẩu</li>
                <li>Đăng nhập → điền thông tin hồ sơ CTV (CCCD, ngân hàng, MST)</li>
                <li>Truy cập Freelancer Portal xem tasks & nghiệm thu</li>
              </>
            )}
          </ol>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ══════════════ EMPLOYEE MODE ══════════════ */}
        {mode === 'employee' && (
          <>
            {/* Basic Info */}
            <div className={sectionCls}>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">👤 Thông tin cơ bản</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Họ tên *</label>
                  <input
                    className={inputCls}
                    style={isFieldMissing('full_name') ? { borderColor: '#FF453A' } : {}}
                    value={empForm.full_name}
                    onChange={e => setEmpForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className={labelCls}>Email công việc *</label>
                  <input
                    className={inputCls}
                    style={isFieldMissing('work_email') || emailError ? { borderColor: '#FF453A' } : {}}
                    value={empForm.work_email}
                    onChange={e => { setEmpForm(f => ({ ...f, work_email: e.target.value })); setEmailError(''); }}
                    placeholder="ten@tdgamestudio.com"
                  />
                  {emailError && <p className="text-red-400 text-xs mt-1 font-bold">⚠️ {emailError}</p>}
                </div>
              </div>
            </div>

            {/* Position & Department */}
            <div className={sectionCls}>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">🏢 Vị trí công việc</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Phòng ban *</label>
                  <select
                    className={inputCls}
                    style={isFieldMissing('department_id') ? { borderColor: '#FF453A' } : {}}
                    value={empForm.department_id || ''}
                    onChange={e => setEmpForm(f => ({ ...f, department_id: e.target.value || null }))}
                  >
                    <option value="">-- Chọn --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Chức danh *</label>
                  <input
                    className={inputCls}
                    style={isFieldMissing('position') ? { borderColor: '#FF453A' } : {}}
                    value={empForm.position}
                    onChange={e => setEmpForm(f => ({ ...f, position: e.target.value }))}
                    placeholder="Senior Artist"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label className={labelCls}>Cấp bậc</label>
                  <select
                    className={inputCls}
                    value={empForm.level}
                    onChange={e => setEmpForm(f => ({ ...f, level: e.target.value }))}
                  >
                    <option value="">-- Chọn --</option>
                    <option value="Intern">Intern</option>
                    <option value="Junior">Junior</option>
                    <option value="Mid">Mid</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                    <option value="Manager">Manager</option>
                    <option value="Director">Director</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Vai trò hệ thống</label>
                  <select
                    className={inputCls}
                    value={empForm.role}
                    onChange={e => setEmpForm(f => ({ ...f, role: e.target.value }))}
                  >
                    <option value="member">👤 Nhân viên (member)</option>
                    <option value="ke_toan">📊 Kế toán (ke_toan)</option>
                    <option value="hr">🧑‍💼 Nhân sự (hr)</option>
                    <option value="admin">👑 Admin</option>
                  </select>
                  <p className="text-neutral-medium/50 text-[10px] mt-1">Quyền truy cập các module trong hệ thống</p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className={sectionCls}>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">📅 Ngày làm việc</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Ngày bắt đầu *</label>
                  <input
                    type="date"
                    className={inputCls}
                    style={isFieldMissing('start_date') ? { borderColor: '#FF453A' } : {}}
                    value={empForm.start_date || ''}
                    onChange={e => {
                      const val = e.target.value || null;
                      setEmpForm(f => {
                        const updated = { ...f, start_date: val };
                        if (val) {
                          const d = new Date(val);
                          d.setMonth(d.getMonth() + 2);
                          updated.probation_end = d.toISOString().split('T')[0];
                        }
                        return updated;
                      });
                    }}
                  />
                </div>
                <div>
                  <label className={labelCls}>Ngày hết thử việc</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={empForm.probation_end || ''}
                    onChange={e => setEmpForm(f => ({ ...f, probation_end: e.target.value || null }))}
                  />
                  <p className="text-neutral-medium/50 text-[10px] mt-1">Tự động = ngày bắt đầu + 2 tháng</p>
                </div>
              </div>
            </div>

            {/* Salary Structure */}
            <div className={sectionCls}>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">💰 Cấu trúc lương</h3>
              {loadingSalary ? (
                <div className="flex justify-center py-6"><div className="w-6 h-6 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="space-y-3">
                    {salaryComponents.map(comp => (
                      <div key={comp.id} className="flex items-center gap-4 p-3 rounded-xl bg-black/20 border border-white/[0.04]">
                        <span className="flex-1 text-white font-bold text-sm">{comp.name}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className="w-40 px-3 py-2 rounded-lg bg-black/30 border border-primary/10 text-white text-sm text-right outline-none focus:border-emerald-500/40 transition-colors"
                            value={salaryAmounts[comp.id] || ''}
                            onChange={e => setSalaryAmounts(prev => ({ ...prev, [comp.id]: +e.target.value }))}
                            placeholder="0"
                          />
                          <span className="text-neutral-medium text-xs w-8">VNĐ</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-emerald-500/20">
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Tổng Gross</span>
                    <div>
                      <span className="text-white font-black text-xl">{(Object.values(salaryAmounts) as number[]).reduce((s, v) => s + (v || 0), 0).toLocaleString()}</span>
                      <span className="text-neutral-medium text-xs ml-1">VNĐ</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ══════════════ FREELANCER MODE ══════════════ */}
        {mode === 'freelancer' && (
          <div className={sectionCls} style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
            <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: '#F59E0B' }}>🤝 Thông tin Freelancer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelCls}>Họ tên *</label>
                <input
                  className={inputCls}
                  style={isFieldMissing('full_name') ? { borderColor: '#FF453A' } : {}}
                  value={flForm.full_name}
                  onChange={e => setFlForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <label className={labelCls}>Email cá nhân *</label>
                <input
                  className={inputCls}
                  type="email"
                  style={isFieldMissing('email') || emailError ? { borderColor: '#FF453A' } : {}}
                  value={flForm.email}
                  onChange={e => { setFlForm(f => ({ ...f, email: e.target.value })); setEmailError(''); }}
                  placeholder="freelancer@gmail.com"
                />
                {emailError && <p className="text-red-400 text-xs mt-1 font-bold">⚠️ {emailError}</p>}
              </div>
            </div>

            <div>
              <label className={labelCls} style={isFieldMissing('specializations') ? { color: '#FF453A' } : {}}>Chuyên môn * (chọn ít nhất 1)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SPECIALIZATION_OPTIONS.map(spec => {
                  const active = flForm.specializations.includes(spec);
                  return (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => toggleSpec(spec)}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                        color: active ? '#F59E0B' : '#666',
                        border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      {active ? '✓ ' : ''}{spec}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-w-xs">
              <label className={labelCls}>Level *</label>
              <select
                className={inputCls}
                style={isFieldMissing('level') ? { borderColor: '#FF453A' } : {}}
                value={flForm.level}
                onChange={e => setFlForm(f => ({ ...f, level: e.target.value }))}
              >
                <option value="">-- Chọn --</option>
                <option value="Junior">Junior</option>
                <option value="Mid">Mid</option>
                <option value="Senior">Senior</option>
                <option value="Lead">Lead</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Validation Errors ── */}
        {showValidation && missingRequired.length > 0 && (
          <div className="rounded-[16px] border border-red-500/20 bg-red-500/[0.05] p-5">
            <p className="text-red-400 font-bold text-sm mb-2">⚠️ Vui lòng điền đầy đủ các trường bắt buộc:</p>
            <ul className="text-red-300 text-xs space-y-1 list-disc list-inside">
              {missingRequired.map(f => <li key={f.key}>{f.label}</li>)}
            </ul>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            style={{ background: accentGradient, boxShadow: `0 8px 24px ${accentColor}40` }}
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xử lý...</>
            ) : (
              <>✅ {mode === 'employee' ? 'Thêm & Gửi email mời' : 'Thêm & Gửi invite'}</>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-4 rounded-2xl border border-primary/10 text-neutral-medium font-black text-sm uppercase tracking-widest hover:text-white hover:border-primary/30 transition-all"
          >
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuickAddEmployee;
