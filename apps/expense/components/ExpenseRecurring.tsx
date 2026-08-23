import React, { useState } from 'react';
import { RecurringExpense, ExpenseCategory } from '@/types';
import { Button } from '@/components/Button';

interface Props {
  recurring: RecurringExpense[];
  categories: ExpenseCategory[];
  onSave: (data: Omit<RecurringExpense, 'id' | 'created_at' | 'category'>) => void;
  onUpdate: (id: string, data: Partial<RecurringExpense>) => void;
  onDelete: (id: string) => void;
}

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  yearly: 'Hàng năm',
};

const getToday = () => new Date().toISOString().split('T')[0];

const EMPTY = {
  title: '', amount: 0, currency: 'VND' as const, category_id: null as string | null,
  project: '', vendor: '', frequency: 'monthly' as const, next_run: getToday(), is_active: true,
};

const ExpenseRecurring: React.FC<Props> = ({ recurring, categories, onSave, onUpdate, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
    setForm({ ...EMPTY, next_run: getToday() });
    setShowForm(false);
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'VND') return amount.toLocaleString('vi-VN') + ' ₫';
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  const inputClass = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all";
  const labelClass = "block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2";

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">Recurring</h2>
          <p className="text-neutral-medium text-sm mt-2">Chi phí định kỳ tự động</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant="ghost" size="sm">
          {showForm ? '✕ Đóng' : '+ Thêm mẫu'}
        </Button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-[24px] border border-primary/10 p-8 bg-surface animate-fadeInUp">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Tên mẫu *</label>
              <input type="text" value={form.title} onChange={e => update('title', e.target.value)} className={inputClass} placeholder="Ví dụ: Hosting hàng tháng..." required />
            </div>
            <div>
              <label className={labelClass}>Tần suất</label>
              <select value={form.frequency} onChange={e => update('frequency', e.target.value)} className={inputClass}>
                <option value="monthly">Hàng tháng</option>
                <option value="quarterly">Hàng quý</option>
                <option value="yearly">Hàng năm</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Số tiền</label>
              <input type="number" value={form.amount || ''} onChange={e => update('amount', Number(e.target.value))} className={inputClass} min="0" step="0.01" />
            </div>
            <div>
              <label className={labelClass}>Tiền tệ</label>
              <select value={form.currency} onChange={e => update('currency', e.target.value)} className={inputClass}>
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Danh mục</label>
              <select value={form.category_id || ''} onChange={e => update('category_id', e.target.value || null)} className={inputClass}>
                <option value="">-- Chọn --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Vendor</label>
              <input type="text" value={form.vendor} onChange={e => update('vendor', e.target.value)} className={inputClass} placeholder="Nhà cung cấp..." />
            </div>
            <div>
              <label className={labelClass}>Dự án</label>
              <input type="text" value={form.project} onChange={e => update('project', e.target.value)} className={inputClass} placeholder="Dự án..." />
            </div>
            <div>
              <label className={labelClass}>Ngày chạy tiếp</label>
              <input type="date" value={form.next_run} onChange={e => update('next_run', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all hover:scale-[1.01]">
              Huỷ
            </button>
            <button type="submit"
              className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-primary text-black transition-all hover:scale-[1.01] shadow-btn-glow">
              Lưu mẫu
            </button>
          </div>
        </form>
      )}

      {/* List — card style matching Invoice History */}
      {recurring.length === 0 ? (
        <div className="col-span-full py-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="opacity-50 font-black uppercase tracking-widest text-xs">No recurring templates</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recurring.map((rec) => (
            <div key={rec.id} className={`rounded-[20px] border transition-all hover:scale-[1.01] bg-surface border-primary/10 hover:border-primary/25 relative overflow-hidden group ${!rec.is_active ? 'opacity-50' : ''}`}>
              {/* Status bar */}
              <div className={`h-1 w-full ${rec.is_active ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-neutral-500 to-neutral-400'}`} />

              <div className="p-5">
                {/* Row 1: Title + Frequency */}
                <div className="flex justify-between items-center mb-3">
                  <h3 className={`text-lg font-black tracking-tight ${rec.is_active ? 'text-white' : 'text-white/40 line-through'}`}>{rec.title}</h3>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-400">
                    {FREQ_LABELS[rec.frequency]}
                  </span>
                </div>

                {/* Row 2: Vendor + Category */}
                <p className="text-sm font-semibold truncate text-white/70">{rec.vendor || 'Không vendor'}</p>
                {rec.category && <p className="text-[10px] truncate mt-0.5 text-neutral-medium/50">{rec.category.icon} {rec.category.name}</p>}

                {/* Row 3: Badges */}
                <div className="flex items-center gap-2 mt-3">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${rec.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-neutral-500/15 text-neutral-400'}`}>
                    {rec.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                  </span>
                  <span className="text-[9px] text-neutral-medium font-bold tabular-nums">Next: {rec.next_run}</span>
                </div>

                {/* Row 4: Amount */}
                <div className="mt-4 pt-3 border-t border-primary/5">
                  <p className="text-xl font-black text-primary tabular-nums">{formatCurrency(rec.amount, rec.currency)}</p>
                </div>

                {/* Actions — hover visible like Invoice */}
                <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-primary/5 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onUpdate(rec.id!, { is_active: !rec.is_active })} title={rec.is_active ? 'Tạm dừng' : 'Kích hoạt'}
                    className={`p-2 rounded-lg transition-colors ${rec.is_active ? 'hover:bg-amber-500/10 hover:text-amber-400' : 'hover:bg-emerald-500/10 hover:text-emerald-400'} hover:bg-white/5`}>
                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={rec.is_active ? "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"} /></svg>
                  </button>
                  <div className="w-px h-5 mx-0.5 bg-white/10" />
                  {deleteConfirm === rec.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => { onDelete(rec.id!); setDeleteConfirm(null); }} className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider">Xoá</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 text-[10px] font-black uppercase tracking-wider">Huỷ</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(rec.id!)} title="Xoá" className="p-2 rounded-lg transition-colors text-red-500/50 hover:text-red-400 hover:bg-red-500/10">
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpenseRecurring;
