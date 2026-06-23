import React, { useState } from 'react';
import { CompanyProfile, updateCompanyProfile } from '../services/companyService';

interface Props {
  company: CompanyProfile;
  canEdit: boolean;
  onUpdated: (updated: CompanyProfile) => void;
}

const Field: React.FC<{ label: string; value: string | null; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex flex-col gap-1">
    <span className="text-neutral-600 text-[10px] font-black uppercase tracking-wider">{label}</span>
    <span className={`text-white text-sm ${mono ? 'font-mono' : 'font-semibold'}`}>{value || '—'}</span>
  </div>
);

const SidebarItem: React.FC<{ icon: string; label: string; value: string | null; mono?: boolean }> = ({
  icon, label, value, mono,
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-neutral-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
      <span>{icon}</span> {label}
    </span>
    <span className={`text-white text-sm leading-snug ${mono ? 'font-mono tracking-wider' : 'font-semibold'}`}>
      {value || '—'}
    </span>
  </div>
);

export default function InfoTab({ company, canEdit, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CompanyProfile>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = () => {
    setForm({ ...company });
    setEditing(true);
    setError('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({});
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await updateCompanyProfile(company.id, form);
      onUpdated({ ...company, ...form } as CompanyProfile);
      setEditing(false);
    } catch (e: any) {
      setError(e.message || 'Lỗi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const input = (field: keyof CompanyProfile, label: string, type = 'text') => (
    <div className="flex flex-col gap-1">
      <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={(form[field] as string) || ''}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
        style={{ background: '#1a1a1a' }}
      />
    </div>
  );

  return (
    <div className="w-full space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏢</span>
          <div>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>{company.entity_name_vn}</h2>
            <p className="text-neutral-medium text-sm mt-1">{company.entity_name_en}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && !editing && (
            <button onClick={startEdit}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all">
              ✏️ Chỉnh sửa
            </button>
          )}
          {editing && (
            <>
              <button onClick={cancelEdit}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
                Huỷ
              </button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-white transition-all disabled:opacity-50"
                style={{ background: '#FF9500' }}>
                {saving ? 'Đang lưu...' : '💾 Lưu'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">{error}</div>
      )}

      {/* ── Edit mode: full-width form ── */}
      {editing ? (
        <div className="rounded-[20px] border border-primary/10 bg-surface p-6 space-y-6">
          <p className="text-neutral-500 text-[10px] font-black uppercase tracking-wider border-b border-white/5 pb-3">
            Thông tin pháp lý
          </p>
          <div className="grid grid-cols-2 gap-4">
            {input('entity_name_vn', 'Tên tiếng Việt')}
            {input('entity_name_en', 'Tên quốc tế')}
            {input('entity_short', 'Tên viết tắt')}
            {input('tax_id', 'Mã số thuế')}
            {input('legal_rep', 'Người đại diện')}
            {input('operation_date', 'Ngày hoạt động', 'date')}
            {input('email', 'Email')}
            {input('phone', 'Điện thoại')}
            {input('managed_by', 'Thuế cơ sở quản lý')}
            <div className="col-span-2">{input('address', 'Địa chỉ')}</div>
            <div className="col-span-2">
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Ghi chú</label>
              <textarea
                rows={3}
                value={(form.notes as string) || ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
                style={{ background: '#1a1a1a' }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ── View mode: 2-column dashboard layout ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Main info card — 2/3 width */}
          <div className="lg:col-span-2 rounded-2xl border border-white/8 p-6 space-y-6"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-neutral-500 text-[10px] font-black uppercase tracking-wider border-b border-white/5 pb-3">
              Thông tin pháp lý
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              <Field label="Tên tiếng Việt" value={company.entity_name_vn} />
              <Field label="Tên quốc tế" value={company.entity_name_en} />
              <Field label="Tên viết tắt" value={company.entity_short} />
              <Field label="Mã số thuế" value={company.tax_id} mono />
              <Field label="Người đại diện" value={company.legal_rep} />
              <Field label="Ngày hoạt động" value={company.operation_date} />
              <Field label="Email" value={company.email} />
              <Field label="Điện thoại" value={company.phone} />
              <div className="col-span-2"><Field label="Địa chỉ" value={company.address} /></div>
              <div className="col-span-2"><Field label="Thuế cơ sở quản lý" value={company.managed_by} /></div>
              {company.notes && (
                <div className="col-span-2"><Field label="Ghi chú" value={company.notes} /></div>
              )}
            </div>
          </div>

          {/* Sidebar quick-summary — 1/3 width */}
          <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4">

            {/* Quick-ref card */}
            <div className="rounded-2xl border p-5 space-y-5"
              style={{
                background: 'rgba(255,149,0,0.03)',
                borderColor: 'rgba(255,149,0,0.12)',
              }}>
              <p className="text-orange-400/70 text-[10px] font-black uppercase tracking-wider border-b pb-3"
                style={{ borderColor: 'rgba(255,149,0,0.1)' }}>
                Tóm tắt nhanh
              </p>
              <div className="space-y-4">
                <SidebarItem icon="🔑" label="Mã số thuế" value={company.tax_id} mono />
                <SidebarItem icon="👤" label="Người đại diện" value={company.legal_rep} />
                <SidebarItem icon="📅" label="Ngày hoạt động" value={company.operation_date} />
                <SidebarItem icon="📧" label="Email" value={company.email} />
                {company.phone && <SidebarItem icon="📞" label="Điện thoại" value={company.phone} />}
              </div>
            </div>

            {/* Address card */}
            {company.address && (
              <div className="rounded-[20px] border border-primary/10 bg-surface p-5 space-y-2">
                <p className="text-neutral-600 text-[10px] font-black uppercase tracking-wider">📍 Địa chỉ</p>
                <p className="text-neutral-300 text-sm leading-relaxed">{company.address}</p>
              </div>
            )}

            {/* Updated at */}
            <p className="text-neutral-700 text-xs px-1">
              Cập nhật lần cuối:{' '}
              {company.updated_at ? new Date(company.updated_at).toLocaleString('vi-VN') : '—'}
            </p>
          </div>

        </div>
      )}

      {/* Updated at (edit mode) */}
      {editing && (
        <p className="text-neutral-700 text-xs">
          Cập nhật lần cuối: {company.updated_at ? new Date(company.updated_at).toLocaleString('vi-VN') : '—'}
        </p>
      )}

    </div>
  );
}
