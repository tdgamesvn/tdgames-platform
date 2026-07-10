import React, { useState, useEffect, useRef } from 'react';
import { ExpenseRecord, ExpenseCategory } from '@/types';
import { supabase } from '@/services/supabaseClient';
import { useWorkspace } from '@/services/WorkspaceContext';

const R2_UPLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-expense-upload`;

interface Props {
  categories: ExpenseCategory[];
  editingExpense: ExpenseRecord | null;
  onSave: (data: Omit<ExpenseRecord, 'id' | 'created_at' | 'updated_at' | 'category'>) => void;
  onUpdate: (id: string, data: Partial<ExpenseRecord>) => void;
  onCancel: () => void;
}

const PAYMENT_METHODS = [
  { value: 'CK', label: 'Chuyển khoản' },
  { value: 'TM', label: 'Tiền mặt' },
  { value: 'CARD', label: 'Thẻ tín dụng' },
  { value: 'KHAC', label: 'Khác' },
];

const getToday = () => new Date().toISOString().split('T')[0];

const EMPTY: Omit<ExpenseRecord, 'id' | 'created_at' | 'updated_at' | 'category'> = {
  title: '',
  amount: 0,
  currency: 'VND',
  expense_date: getToday(),
  category_id: null,
  project: '',
  client_name: '',
  vendor: '',
  payment_method: 'CK',
  status: 'pending',
  notes: '',
  receipt_url: '',
  created_by: '',
  account_type: 'company',
  entity: 'TD GAMES' as const,
};

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp';
const MAX_SIZE_MB = 10;

const ExpenseForm: React.FC<Props> = ({ categories, editingExpense, onSave, onUpdate, onCancel }) => {
  const { workspace } = useWorkspace();
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEditing = !!editingExpense;

  useEffect(() => {
    if (editingExpense) {
      const { id, created_at, updated_at, category, ...rest } = editingExpense;
      setForm(rest as any);
    } else {
      // Tạo mới: default entity theo workspace đang chọn (edit giữ nguyên entity của record)
      setForm({ ...EMPTY, expense_date: getToday(), entity: workspace === 'TD CONSULTING' ? 'TD CONSULTING' : 'TD GAMES' });
    }
  }, [editingExpense]);

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (isEditing) {
      onUpdate(editingExpense.id!, form);
    } else {
      onSave(form);
    }
  };

  // ── File Upload to R2 ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File quá lớn! Tối đa ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(R2_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      update('receipt_url', data.url);
    } catch (err: any) {
      alert('Upload thất bại: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveReceipt = async () => {
    if (!form.receipt_url) return;
    try {
      // Extract R2 key from public URL (everything after the domain)
      const url = new URL(form.receipt_url);
      const key = url.pathname.replace(/^\//, '');
      if (key) {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(R2_UPLOAD_URL, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ key }),
        });
      }
    } catch { /* ignore delete errors */ }
    update('receipt_url', '');
  };

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(url);

  const inputClass = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all";
  const labelClass = "block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2";

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Page Header — consistent with HistoryTab / ExpenseList */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">
            {isEditing ? 'Edit Expense' : 'New Expense'}
          </h2>
          <p className="text-neutral-medium text-sm mt-2">
            {isEditing ? 'Chỉnh sửa chi phí hiện tại' : 'Nhập thông tin chi phí mới'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="rounded-[24px] border border-primary/10 p-8 bg-surface">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label className={labelClass}>Mô tả chi phí *</label>
              <input type="text" value={form.title} onChange={e => update('title', e.target.value)} className={inputClass} placeholder="Ví dụ: Thuê freelancer design..." required />
            </div>

            {/* Amount + Currency */}
            <div>
              <label className={labelClass}>Số tiền *</label>
              <input type="number" value={form.amount || ''} onChange={e => update('amount', Number(e.target.value))} className={inputClass} placeholder="0" min="0" step="0.01" required />
            </div>
            <div>
              <label className={labelClass}>Đơn vị tiền tệ</label>
              <select value={form.currency} onChange={e => update('currency', e.target.value)} className={inputClass}>
                <option value="VND">VND (₫)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            {/* Date + Category */}
            <div>
              <label className={labelClass}>Ngày chi</label>
              <input type="date" value={form.expense_date} onChange={e => update('expense_date', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Danh mục</label>
              <select value={form.category_id || ''} onChange={e => update('category_id', e.target.value || null)} className={inputClass}>
                <option value="">-- Chọn danh mục --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            {/* Project + Client */}
            <div>
              <label className={labelClass}>Dự án</label>
              <input type="text" value={form.project} onChange={e => update('project', e.target.value)} className={inputClass} placeholder="Tên dự án..." />
            </div>
            <div>
              <label className={labelClass}>Khách hàng</label>
              <input type="text" value={form.client_name} onChange={e => update('client_name', e.target.value)} className={inputClass} placeholder="Tên khách hàng..." />
            </div>

            {/* Vendor + Payment */}
            <div>
              <label className={labelClass}>Chi cho (Vendor)</label>
              <input type="text" value={form.vendor} onChange={e => update('vendor', e.target.value)} className={inputClass} placeholder="Người / Công ty nhận tiền..." />
            </div>
            <div>
              <label className={labelClass}>Phương thức thanh toán</label>
              <select value={form.payment_method} onChange={e => update('payment_method', e.target.value)} className={inputClass}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className={labelClass}>Trạng thái</label>
              <select value={form.status} onChange={e => update('status', e.target.value)} className={inputClass}>
                <option value="pending">Chờ duyệt</option>
                <option value="approved">Đã duyệt</option>
                <option value="paid">Đã trả</option>
              </select>
            </div>

            {/* Account Type */}
            <div>
              <label className={labelClass}>Tài khoản</label>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => update('account_type', 'company')}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    (form as any).account_type !== 'personal'
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-primary/10 text-neutral-medium hover:border-primary/20'
                  }`}>
                  🏢 Công ty
                </button>
                <button type="button"
                  onClick={() => update('account_type', 'personal')}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    (form as any).account_type === 'personal'
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
                      : 'border-primary/10 text-neutral-medium hover:border-primary/20'
                  }`}>
                  👤 Cá nhân
                </button>
              </div>
            </div>

            {/* Entity — sổ sách */}
            <div>
              <label className={labelClass}>Công ty</label>
              <div className="flex gap-2">
                {(['TD GAMES', 'TD CONSULTING'] as const).map(e => (
                  <button key={e} type="button" onClick={() => update('entity', e)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      ((form as any).entity || 'TD GAMES') === e
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-primary/10 text-neutral-medium hover:border-primary/20'
                    }`}>
                    {e === 'TD GAMES' ? 'TD Games' : 'TD Consulting'}
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt Upload */}
            <div>
              <label className={labelClass}>Hoá đơn / Receipt</label>
              {form.receipt_url ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/10 bg-black/20">
                  {isImageUrl(form.receipt_url) ? (
                    <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <img src={form.receipt_url} alt="Receipt" className="w-14 h-14 object-cover rounded-lg border border-white/10" />
                    </a>
                  ) : (
                    <a href={form.receipt_url} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 w-14 h-14 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <span className="text-2xl">📄</span>
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={form.receipt_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline truncate block">
                      {decodeURIComponent(form.receipt_url.split('/').pop() || 'File')}
                    </a>
                    <p className="text-[10px] text-neutral-medium mt-0.5">Bấm để xem</p>
                  </div>
                  <button type="button" onClick={handleRemoveReceipt}
                    className="flex-shrink-0 p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Xoá file">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    id="receipt-upload"
                  />
                  <label htmlFor="receipt-upload"
                    className={`flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      uploading
                        ? 'border-primary/30 bg-primary/5 cursor-wait'
                        : 'border-primary/10 hover:border-primary/30 hover:bg-primary/5'
                    }`}>
                    {uploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <span className="text-sm text-primary font-bold">Đang upload...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm text-neutral-medium">Chọn file PDF, JPG, PNG (tối đa {MAX_SIZE_MB}MB)</span>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className={labelClass}>Ghi chú</label>
              <textarea value={form.notes} onChange={e => update('notes', e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="Ghi chú thêm..." />
            </div>
          </div>

          {/* Actions — matching Invoice modal button pattern */}
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={onCancel}
              className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all hover:scale-[1.01]">
              Huỷ
            </button>
            <button type="submit"
              className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-primary text-black transition-all hover:scale-[1.01] shadow-btn-glow">
              {isEditing ? '💾 Cập nhật' : '➕ Thêm chi phí'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ExpenseForm;

