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

const DOC_TYPE_LABELS: Record<string, string> = {
  TNHH: 'Công ty TNHH',
  'TNHH MTV': 'Công ty TNHH MTV',
  CP: 'Công ty cổ phần',
  DNTN: 'Doanh nghiệp tư nhân',
};

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

  const data = editing ? form as CompanyProfile : company;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏢</span>
            <div>
              <h2 className="text-white font-black text-lg">{company.entity_name_vn}</h2>
              <p className="text-neutral-500 text-xs">{company.entity_name_en}</p>
            </div>
          </div>
        </div>
        {canEdit && !editing && (
          <button onClick={startEdit}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all">
            ✏️ Chỉnh sửa
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
              Huỷ
            </button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-white transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}>
              {saving ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">{error}</div>
      )}

      {/* Info card */}
      <div className="rounded-2xl border border-white/8 p-6 space-y-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-neutral-500 text-[10px] font-black uppercase tracking-wider border-b border-white/5 pb-3">Thông tin pháp lý</p>

        {editing ? (
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
        ) : (
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
            {company.notes && <div className="col-span-2"><Field label="Ghi chú" value={company.notes} /></div>}
          </div>
        )}
      </div>

      <p className="text-neutral-700 text-xs">Cập nhật lần cuối: {company.updated_at ? new Date(company.updated_at).toLocaleString('vi-VN') : '—'}</p>
    </div>
  );
}
