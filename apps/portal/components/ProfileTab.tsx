import React, { useState, useEffect, useRef } from 'react';
import { AccountUser } from '@/types';
import { fetchMyProfile, updateMyProfile } from '../services/portalService';
import { uploadFileToR2, toPublicUrl } from '@/apps/hr/services/hrService';

interface Props {
  currentUser: AccountUser;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const inputCls = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-white placeholder-neutral-medium/40 focus:outline-none focus:border-cyan-500/40 transition-all text-sm";
const readOnlyCls = "w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-neutral-medium/70 text-sm cursor-not-allowed";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block";
const sectionCls = "rounded-[20px] border border-primary/10 bg-[#161616] p-6 md:p-8 space-y-6";

const VEHICLE_LABELS: Record<string, string> = {
  '': '-- Chọn --',
  motorcycle: 'Xe máy',
  car: 'Ô tô',
  bicycle: 'Xe đạp',
  electric_bike: 'Xe máy điện',
  other: 'Khác',
};

// Fields that employees can edit
const EDITABLE_FIELDS = [
  'full_name', 'email', 'phone', 'date_of_birth', 'gender', 'nationality',
  'address', 'temp_address', 'id_number', 'id_issue_date', 'id_issue_place',
  'avatar_url', 'id_card_front_url', 'id_card_back_url',
  'tax_code', 'insurance_number',
  'bank_name', 'bank_account', 'bank_branch',
  'vehicle_type', 'license_plate', 'vehicle_brand', 'vehicle_color',
];

// Fields used for completion calculation
const PROFILE_FIELDS = [
  'full_name', 'email', 'phone', 'date_of_birth', 'gender', 'address', 'temp_address',
  'id_number', 'id_issue_date', 'id_issue_place', 'tax_code', 'insurance_number',
  'bank_name', 'bank_account', 'bank_branch', 'avatar_url',
];

const ProfileTab: React.FC<Props> = ({ currentUser, onToast }) => {
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Photo upload refs
  const avatarRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser.employee_id) return;
    setIsLoading(true);
    fetchMyProfile(currentUser.employee_id)
      .then(data => {
        setProfile(data);
        setForm({ ...data });
      })
      .catch(err => onToast(err.message, 'error'))
      .finally(() => setIsLoading(false));
  }, [currentUser.employee_id]);

  const updateField = (key: string, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const handlePhotoUpload = async (field: string, file: File) => {
    setUploadingField(field);
    try {
      const result = await uploadFileToR2(file);
      updateField(field, result.url);
    } catch (err: any) {
      onToast('Upload thất bại: ' + (err.message || ''), 'error');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async () => {
    if (saving || !currentUser.employee_id) return;
    setSaving(true);
    try {
      // Only send editable fields that actually changed
      const updates: Record<string, any> = {};
      for (const key of EDITABLE_FIELDS) {
        if (form[key] !== profile[key]) {
          updates[key] = form[key];
        }
      }
      if (Object.keys(updates).length === 0) {
        onToast('Không có thay đổi nào', 'success');
        setSaving(false);
        return;
      }
      await updateMyProfile(currentUser.employee_id, updates);
      setProfile({ ...profile, ...updates });
      setDirty(false);
      onToast('Đã cập nhật hồ sơ thành công!', 'success');
    } catch (err: any) {
      onToast(err.message || 'Lỗi cập nhật', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Profile completion
  const completedCount = PROFILE_FIELDS.filter(f => {
    const v = form[f];
    return v && (typeof v !== 'string' || v.trim().length > 0);
  }).length;
  const completionPct = Math.round((completedCount / PROFILE_FIELDS.length) * 100);
  const completionColor = completionPct >= 90 ? '#34C759' : completionPct >= 60 ? '#FF9500' : '#FF3B30';

  if (!currentUser.employee_id) {
    return (
      <div className="animate-fadeInUp text-center py-20">
        <div className="text-5xl mb-4">🔗</div>
        <p className="text-white font-bold text-lg">Tài khoản chưa liên kết nhân viên</p>
        <p className="text-neutral-medium text-sm mt-2">Liên hệ HR để liên kết tài khoản</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-fadeInUp text-center py-20">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-neutral-medium text-sm">Đang tải hồ sơ...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="animate-fadeInUp text-center py-20">
        <div className="text-5xl mb-4">❌</div>
        <p className="text-white font-bold text-lg">Không tìm thấy hồ sơ</p>
      </div>
    );
  }

  const renderReadonly = (label: string, value: string) => (
    <div>
      <label className={labelCls}>{label} 🔒</label>
      <div className={readOnlyCls}>{value || '—'}</div>
    </div>
  );

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            📋 Hồ sơ của tôi
          </h2>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
            Xem và cập nhật thông tin cá nhân
          </p>
        </div>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #34C759 0%, #059669 100%)', boxShadow: '0 8px 24px rgba(52,199,89,0.3)' }}
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang lưu...</>
            ) : (
              <>💾 Lưu thay đổi</>
            )}
          </button>
        )}
      </div>

      {/* Completion Progress */}
      <div className="rounded-[20px] border border-primary/10 bg-[#161616] p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-widest text-neutral-medium">Hoàn thiện hồ sơ</span>
          <span className="text-sm font-black" style={{ color: completionColor }}>{completionPct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${completionPct}%`, background: `linear-gradient(90deg, ${completionColor}, ${completionColor}80)` }}
          />
        </div>
        {completionPct < 100 && (
          <p className="text-neutral-medium/60 text-xs mt-2">
            Còn {PROFILE_FIELDS.length - completedCount} trường chưa điền. Hãy hoàn thiện để HR có đầy đủ thông tin.
          </p>
        )}
      </div>

      {/* ── Section: HR-assigned info (Read-only) ── */}
      <div className={sectionCls}>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">🏢 Thông tin công việc</h3>
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400">HR quản lý</span>
        </div>
        <p className="text-neutral-medium/50 text-xs">Các trường này do HR/Admin thiết lập, bạn không thể chỉnh sửa.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {renderReadonly('Mã nhân viên', profile.employee_code)}
          {renderReadonly('Email công việc', profile.work_email)}
          {renderReadonly('Phòng ban', profile.department?.name || '')}
          {renderReadonly('Chức danh', profile.position)}
          {renderReadonly('Cấp bậc', profile.level)}
          {renderReadonly('Loại', profile.type === 'fulltime' ? 'Fulltime' : profile.type === 'parttime' ? 'Part-time' : 'Freelancer')}
          {renderReadonly('Ngày bắt đầu', profile.start_date || '')}
          {renderReadonly('Hết thử việc', profile.probation_end || '')}
          {renderReadonly('Trạng thái', profile.status === 'active' ? 'Đang làm việc' : profile.status)}
        </div>
      </div>

      {/* ── Section: Personal Info (Editable) ── */}
      <div className={sectionCls}>
        <h3 className="text-lg font-black text-white uppercase tracking-tight">👤 Thông tin cá nhân</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className={labelCls}>Họ tên</label>
            <input className={inputCls} value={form.full_name || ''} onChange={e => updateField('full_name', e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label className={labelCls}>Email cá nhân</label>
            <input className={inputCls} value={form.email || ''} onChange={e => updateField('email', e.target.value)} placeholder="email@gmail.com" />
          </div>
          <div>
            <label className={labelCls}>SĐT</label>
            <input className={inputCls} value={form.phone || ''} onChange={e => updateField('phone', e.target.value)} placeholder="0912 345 678" />
          </div>
          <div>
            <label className={labelCls}>Ngày sinh</label>
            <input type="date" className={inputCls} value={form.date_of_birth || ''} onChange={e => updateField('date_of_birth', e.target.value || null)} />
          </div>
          <div>
            <label className={labelCls}>Giới tính</label>
            <select className={inputCls} value={form.gender || ''} onChange={e => updateField('gender', e.target.value)}>
              <option value="">-- Chọn --</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Quốc tịch</label>
            <input className={inputCls} value={form.nationality || ''} onChange={e => updateField('nationality', e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Địa chỉ thường trú</label>
            <input className={inputCls} value={form.address || ''} onChange={e => updateField('address', e.target.value)} placeholder="Số nhà, đường, quận, TP..." />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Địa chỉ tạm trú</label>
            <input className={inputCls} value={form.temp_address || ''} onChange={e => updateField('temp_address', e.target.value)} placeholder="Nếu giống thường trú, điền lại" />
          </div>
        </div>
      </div>

      {/* ── Section: CCCD & Photos ── */}
      <div className={sectionCls}>
        <h3 className="text-lg font-black text-white uppercase tracking-tight">🪪 CMND / CCCD & Ảnh</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className={labelCls}>Số CMND/CCCD</label>
            <input className={inputCls} value={form.id_number || ''} onChange={e => updateField('id_number', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Ngày cấp</label>
            <input type="date" className={inputCls} value={form.id_issue_date || ''} onChange={e => updateField('id_issue_date', e.target.value || null)} />
          </div>
          <div>
            <label className={labelCls}>Nơi cấp</label>
            <input className={inputCls} value={form.id_issue_place || ''} onChange={e => updateField('id_issue_place', e.target.value)} />
          </div>
        </div>

        {/* Photo uploads */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {/* Avatar */}
          <div>
            <label className={labelCls}>Ảnh đại diện</label>
            <input type="file" ref={avatarRef} accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload('avatar_url', f); }} />
            {form.avatar_url ? (
              <div className="relative group rounded-xl overflow-hidden border border-primary/10 cursor-pointer" style={{ aspectRatio: '1/1' }}
                onClick={() => avatarRef.current?.click()}>
                <img src={toPublicUrl(form.avatar_url)} alt="Avatar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <span className="text-white text-xs font-bold">📷 Đổi ảnh</span>
                </div>
              </div>
            ) : (
              <div onClick={() => avatarRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-cyan-500/40 ${uploadingField === 'avatar_url' ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-primary/10 bg-white/[0.02]'}`}
                style={{ aspectRatio: '1/1' }}>
                {uploadingField === 'avatar_url' ? (
                  <><div className="w-6 h-6 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /><span className="text-xs font-bold text-cyan-400">Đang upload...</span></>
                ) : (
                  <><span className="text-3xl">👤</span><span className="text-xs text-neutral-medium">Upload ảnh</span></>
                )}
              </div>
            )}
          </div>
          {/* CCCD Front */}
          <div>
            <label className={labelCls}>CCCD Mặt trước</label>
            <input type="file" ref={frontRef} accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload('id_card_front_url', f); }} />
            {form.id_card_front_url ? (
              <div className="relative group rounded-xl overflow-hidden border border-primary/10 cursor-pointer" style={{ aspectRatio: '1.6/1' }}
                onClick={() => frontRef.current?.click()}>
                <img src={toPublicUrl(form.id_card_front_url)} alt="CCCD Front" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <span className="text-white text-xs font-bold">🔄 Thay ảnh</span>
                </div>
              </div>
            ) : (
              <div onClick={() => frontRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-cyan-500/40 ${uploadingField === 'id_card_front_url' ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-primary/10 bg-white/[0.02]'}`}
                style={{ aspectRatio: '1.6/1' }}>
                {uploadingField === 'id_card_front_url' ? (
                  <><div className="w-6 h-6 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /><span className="text-xs font-bold text-cyan-400">Đang upload...</span></>
                ) : (
                  <><span className="text-3xl">📷</span><span className="text-xs text-neutral-medium">Upload mặt trước</span></>
                )}
              </div>
            )}
          </div>
          {/* CCCD Back */}
          <div>
            <label className={labelCls}>CCCD Mặt sau</label>
            <input type="file" ref={backRef} accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload('id_card_back_url', f); }} />
            {form.id_card_back_url ? (
              <div className="relative group rounded-xl overflow-hidden border border-primary/10 cursor-pointer" style={{ aspectRatio: '1.6/1' }}
                onClick={() => backRef.current?.click()}>
                <img src={toPublicUrl(form.id_card_back_url)} alt="CCCD Back" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <span className="text-white text-xs font-bold">🔄 Thay ảnh</span>
                </div>
              </div>
            ) : (
              <div onClick={() => backRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-cyan-500/40 ${uploadingField === 'id_card_back_url' ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-primary/10 bg-white/[0.02]'}`}
                style={{ aspectRatio: '1.6/1' }}>
                {uploadingField === 'id_card_back_url' ? (
                  <><div className="w-6 h-6 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /><span className="text-xs font-bold text-cyan-400">Đang upload...</span></>
                ) : (
                  <><span className="text-3xl">📷</span><span className="text-xs text-neutral-medium">Upload mặt sau</span></>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section: Tax & Insurance ── */}
      <div className={sectionCls}>
        <h3 className="text-lg font-black text-white uppercase tracking-tight">📄 Thuế & Bảo hiểm</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Mã số thuế cá nhân</label>
            <input className={inputCls} value={form.tax_code || ''} onChange={e => updateField('tax_code', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Số sổ bảo hiểm</label>
            <input className={inputCls} value={form.insurance_number || ''} onChange={e => updateField('insurance_number', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Section: Bank Info ── */}
      <div className={sectionCls}>
        <h3 className="text-lg font-black text-white uppercase tracking-tight">🏦 Thông tin ngân hàng</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className={labelCls}>Tên ngân hàng</label>
            <input className={inputCls} value={form.bank_name || ''} onChange={e => updateField('bank_name', e.target.value)} placeholder="VCB, ACB, MB..." />
          </div>
          <div>
            <label className={labelCls}>Số tài khoản</label>
            <input className={inputCls} value={form.bank_account || ''} onChange={e => updateField('bank_account', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Chi nhánh</label>
            <input className={inputCls} value={form.bank_branch || ''} onChange={e => updateField('bank_branch', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Section: Vehicle Info ── */}
      <div className={sectionCls}>
        <h3 className="text-lg font-black text-white uppercase tracking-tight">🚗 Xe & Gửi xe</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Loại xe</label>
            <select
              className={inputCls}
              style={{ colorScheme: 'dark' }}
              value={form.vehicle_type || ''}
              onChange={e => updateField('vehicle_type', e.target.value)}
            >
              {Object.entries(VEHICLE_LABELS).map(([k, v]) => (
                <option key={k} value={k} style={{ background: '#1A1A1A' }}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nhãn hiệu xe</label>
            <input
              className={inputCls}
              value={form.vehicle_brand || ''}
              onChange={e => updateField('vehicle_brand', e.target.value)}
              placeholder="Honda, Yamaha, Toyota…"
            />
          </div>
          <div>
            <label className={labelCls}>Màu xe</label>
            <input
              className={inputCls}
              value={form.vehicle_color || ''}
              onChange={e => updateField('vehicle_color', e.target.value)}
              placeholder="Đen, Trắng, Xám…"
            />
          </div>
          <div>
            <label className={labelCls}>Biển số xe</label>
            <input
              className={inputCls}
              value={form.license_plate || ''}
              onChange={e => updateField('license_plate', e.target.value.toUpperCase())}
              placeholder="59A1-123.45"
            />
          </div>
        </div>
      </div>

      {/* Bottom save button */}
      {dirty && (
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #34C759 0%, #059669 100%)', boxShadow: '0 8px 24px rgba(52,199,89,0.3)' }}
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang lưu...</>
            ) : (
              <>💾 Lưu thay đổi</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileTab;
