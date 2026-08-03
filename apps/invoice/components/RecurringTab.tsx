import React, { useState, useEffect } from 'react';
import { Button } from '@/components/Button';
import {
  RecurringTemplate,
  fetchRecurringTemplates,
  saveRecurringTemplate,
  deleteRecurringTemplate,
  toggleRecurringActive,
} from '../services/supabaseService';
import { InvoiceData, ClientRecord, StudioRecord } from '@/types';
import { BankAccount, toBankingInfo } from '@/apps/expense/services/bankAccountService';

interface RecurringTabProps {
  theme: string;
  clients: ClientRecord[];
  studios: StudioRecord[];
  bankAccounts: BankAccount[];
  formatCurrencySimple: (val: number, curr: string) => string;
}

const FREQ_LABELS: Record<string, string> = { monthly: 'Hàng tháng', quarterly: 'Hàng quý', yearly: 'Hàng năm' };

export const RecurringTab: React.FC<RecurringTabProps> = ({
  theme, clients, studios, bankAccounts, formatCurrencySimple,
}) => {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formFrequency, setFormFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [formNextRun, setFormNextRun] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formStudioId, setFormStudioId] = useState('');
  const [formBankId, setFormBankId] = useState('');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'VND'>('USD');
  const [formItems, setFormItems] = useState([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try { setTemplates(await fetchRecurringTemplates()); }
    catch (e: any) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleSave = async () => {
    if (!formName || !formNextRun) return alert('Vui lòng nhập tên và ngày chạy tiếp theo.');
    const client = clients.find(c => c.id === formClientId);
    const studio = studios.find(s => s.id === formStudioId);
    const bank = bankAccounts.find(b => b.id === formBankId);

    const template = {
      name: formName,
      frequency: formFrequency,
      next_run: formNextRun,
      client_info: client ? { name: client.name, address: client.address, contactPerson: client.contactPerson, email: client.email, taxCode: client.taxCode, clientType: client.clientType } : {},
      studio_info: studio ? { name: studio.name, address: studio.address, email: studio.email, taxCode: studio.taxCode } : {},
      banking_info: bank ? toBankingInfo(bank) : {},
      items: formItems.filter(i => i.description),
      currency: formCurrency,
      tax_rate: 0,
      discount_type: 'percentage',
      discount_value: 0,
      payment_method: 'TM/CK',
      is_active: true,
    };
    try {
      await saveRecurringTemplate(template);
      setShowForm(false);
      resetForm();
      await loadTemplates();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
  };

  const resetForm = () => {
    setFormName(''); setFormFrequency('monthly'); setFormNextRun('');
    setFormClientId(''); setFormStudioId(''); setFormBankId('');
    setFormCurrency('USD'); setFormItems([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá template này?')) return;
    await deleteRecurringTemplate(id);
    await loadTemplates();
  };

  const handleToggle = async (id: string, current: boolean) => {
    await toggleRecurringActive(id, !current);
    await loadTemplates();
  };

  const calcTemplateTotal = (t: RecurringTemplate) =>
    (t.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 0) * (i.unitPrice || 0), 0);

  const inputCls = `w-full px-3 py-2.5 rounded-xl text-sm font-bold border transition-colors ${theme === 'dark' ? 'bg-black/30 border-white/10 text-white focus:border-primary' : 'bg-gray-50 border-gray-200 text-black focus:border-primary'}`;
  const labelCls = `text-[10px] font-black uppercase tracking-widest mb-1 block ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`;

  return (
    <div className="animate-fadeInUp space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">🔄 Recurring</h2>
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>Hoá đơn định kỳ tự động</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowForm(!showForm)} variant="primary" size="sm">{showForm ? 'Đóng' : '+ Tạo mới'}</Button>
          <Button onClick={loadTemplates} variant="ghost" size="sm" disabled={isLoading}>{isLoading ? '...' : 'Refresh'}</Button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className={`p-8 rounded-[24px] border animate-fadeInUp ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'}`}>
          <h3 className={`text-lg font-black uppercase tracking-tighter mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Tạo Recurring Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className={labelCls}>Tên template</label>
              <input className={inputCls} value={formName} onChange={e => setFormName(e.target.value)} placeholder="VD: Monthly - Meow Match" />
            </div>
            <div>
              <label className={labelCls}>Tần suất</label>
              <select className={inputCls} value={formFrequency} onChange={e => setFormFrequency(e.target.value as any)}>
                <option value="monthly">Hàng tháng</option>
                <option value="quarterly">Hàng quý</option>
                <option value="yearly">Hàng năm</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ngày chạy tiếp</label>
              <input className={inputCls} type="date" value={formNextRun} onChange={e => setFormNextRun(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className={labelCls}>Khách hàng</label>
              <select className={inputCls} value={formClientId} onChange={e => setFormClientId(e.target.value)}>
                <option value="">-- Chọn --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Studio</label>
              <select className={inputCls} value={formStudioId} onChange={e => setFormStudioId(e.target.value)}>
                <option value="">-- Chọn --</option>
                {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ngân hàng</label>
              <select className={inputCls} value={formBankId} onChange={e => setFormBankId(e.target.value)}>
                <option value="">-- Chọn --</option>
                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tiền tệ</label>
              <select className={inputCls} value={formCurrency} onChange={e => setFormCurrency(e.target.value as any)}>
                <option value="USD">USD</option>
                <option value="VND">VND</option>
              </select>
            </div>
          </div>

          {/* Line items */}
          <label className={labelCls}>Hạng mục</label>
          <div className="space-y-2 mb-6">
            {formItems.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2">
                <input className={`${inputCls} col-span-6`} placeholder="Mô tả" value={item.description} onChange={e => { const n = [...formItems]; n[idx] = { ...n[idx], description: e.target.value }; setFormItems(n); }} />
                <input className={`${inputCls} col-span-2`} type="number" placeholder="SL" value={item.quantity} onChange={e => { const n = [...formItems]; n[idx] = { ...n[idx], quantity: +e.target.value }; setFormItems(n); }} />
                <input className={`${inputCls} col-span-3`} type="number" placeholder="Đơn giá" value={item.unitPrice} onChange={e => { const n = [...formItems]; n[idx] = { ...n[idx], unitPrice: +e.target.value }; setFormItems(n); }} />
                <button className="col-span-1 text-status-error hover:text-red-400 text-lg" onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}>×</button>
              </div>
            ))}
            <button className="text-xs font-bold text-primary hover:text-primary-dark" onClick={() => setFormItems([...formItems, { id: String(Date.now()), description: '', quantity: 1, unitPrice: 0 }])}>+ Thêm hạng mục</button>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} variant="primary" size="sm">💾 Lưu Template</Button>
            <Button onClick={() => { setShowForm(false); resetForm(); }} variant="ghost" size="sm">Huỷ</Button>
          </div>
        </div>
      )}

      {/* Template list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.length === 0 && !isLoading && (
          <div className="col-span-full py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6 mx-auto">
              <span className="text-3xl opacity-20">🔄</span>
            </div>
            <p className="opacity-30 font-black uppercase tracking-widest text-xs">Chưa có template nào</p>
          </div>
        )}
        {templates.map(t => (
          <div key={t.id} className={`p-6 rounded-[24px] border transition-all hover:scale-[1.02] ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'} relative`}>
            <div className="flex justify-between items-start mb-3">
              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${t.is_active ? 'bg-status-success/20 text-status-success' : 'bg-neutral-medium/20 text-neutral-medium'}`}>
                {t.is_active ? 'Active' : 'Paused'}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>
                {FREQ_LABELS[t.frequency]}
              </span>
            </div>
            <h3 className={`text-lg font-black mb-1 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{t.name}</h3>
            <p className={`text-sm mb-1 truncate ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>{t.client_info?.name || '—'}</p>
            {t.studio_info?.name && <p className={`text-[10px] mb-2 truncate ${theme === 'dark' ? 'text-neutral-medium/60' : 'text-gray-400'}`}>🏢 {t.studio_info.name}</p>}
            
            <div className={`grid grid-cols-2 gap-3 py-3 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
              <div>
                <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Tổng</p>
                <p className="text-primary font-black text-sm">{formatCurrencySimple(calcTemplateTotal(t), t.currency)}</p>
              </div>
              <div>
                <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Next Run</p>
                <p className={`font-black text-sm ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{t.next_run}</p>
              </div>
            </div>
            {t.last_generated_at && (
              <p className={`text-[9px] mt-1 ${theme === 'dark' ? 'text-neutral-medium/50' : 'text-gray-300'}`}>
                Last: {new Date(t.last_generated_at).toLocaleDateString('vi-VN')}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => handleToggle(t.id, t.is_active)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all hover:scale-[1.02] ${t.is_active ? 'border-status-warning/30 text-status-warning hover:bg-status-warning/10' : 'border-status-success/30 text-status-success hover:bg-status-success/10'}`}>
                {t.is_active ? '⏸ Pause' : '▶ Resume'}
              </button>
              <button onClick={() => handleDelete(t.id)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-status-error/30 text-status-error hover:bg-status-error/10 transition-all hover:scale-[1.02]">
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
