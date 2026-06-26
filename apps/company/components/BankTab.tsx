import React, { useEffect, useState } from 'react';
import { CompanyProfile } from '../services/companyService';
import { supabase } from '@/services/supabaseClient';

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number: string;
  swift_code?: string;
  citad_code?: string;
  bank_address?: string;
  currency: string;
  account_type: string;
  entity: string;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  company: CompanyProfile;
  canEdit?: boolean;
}

const currencyColor: Record<string, string> = { VND: '#34C759', USD: '#0A84FF' };

const emptyForm: Omit<BankAccount, 'id' | 'is_active' | 'sort_order'> = {
  name: '', bank_name: '', account_number: '', swift_code: '', citad_code: '',
  bank_address: '', currency: 'VND', account_type: 'company', entity: '',
};

const inputCls = 'w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors';
const inputStyle = { background: '#1a1a1a' };
const labelCls = 'text-neutral-500 text-[10px] font-black uppercase tracking-wider';

export default function BankTab({ company, canEdit = true }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const loadAccounts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('finance_bank_accounts')
      .select('*')
      .eq('entity', company.entity_short)
      .order('sort_order', { ascending: true });
    setAccounts((data || []) as BankAccount[]);
    setLoading(false);
  };

  useEffect(() => { loadAccounts(); }, [company.entity_short]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, entity: company.entity_short });
    setShowForm(true);
  };

  const openEdit = (acc: BankAccount) => {
    setEditingId(acc.id);
    setForm({
      name: acc.name, bank_name: acc.bank_name, account_number: acc.account_number,
      swift_code: acc.swift_code || '', citad_code: acc.citad_code || '',
      bank_address: acc.bank_address || '', currency: acc.currency,
      account_type: acc.account_type, entity: acc.entity,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.bank_name.trim()) {
      showToast('Vui lòng nhập tên TK và tên ngân hàng', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('finance_bank_accounts')
          .update({
            name: form.name, bank_name: form.bank_name, account_number: form.account_number,
            swift_code: form.swift_code || null, citad_code: form.citad_code || null,
            bank_address: form.bank_address || null, currency: form.currency,
            account_type: form.account_type,
          })
          .eq('id', editingId);
        if (error) throw error;
        showToast('Cập nhật thành công', 'success');
      } else {
        const nextOrder = accounts.length > 0 ? Math.max(...accounts.map(a => a.sort_order)) + 1 : 1;
        const { error } = await supabase.from('finance_bank_accounts')
          .insert({
            ...form,
            swift_code: form.swift_code || null, citad_code: form.citad_code || null,
            bank_address: form.bank_address || null,
            is_active: true, sort_order: nextOrder,
          });
        if (error) throw error;
        showToast('Thêm tài khoản thành công', 'success');
      }
      setShowForm(false);
      loadAccounts();
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      // Set all accounts of this entity to sort_order > 1
      for (const acc of accounts) {
        if (acc.id === id) {
          await supabase.from('finance_bank_accounts').update({ sort_order: 1 }).eq('id', acc.id);
        } else if (acc.sort_order === 1) {
          await supabase.from('finance_bank_accounts').update({ sort_order: 2 }).eq('id', acc.id);
        }
      }
      showToast('Đã đặt làm tài khoản chính', 'success');
      loadAccounts();
    } catch (err: any) {
      showToast(err.message || 'Lỗi', 'error');
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await supabase.from('finance_bank_accounts').update({ is_active: false }).eq('id', id);
      showToast('Đã ẩn tài khoản', 'success');
      setDeleteConfirmId(null);
      loadAccounts();
    } catch (err: any) {
      showToast(err.message || 'Lỗi xoá', 'error');
    }
  };

  const field = (label: string, key: keyof typeof form, opts?: { placeholder?: string; type?: string }) => (
    <div className="flex flex-col gap-1">
      <label className={labelCls}>{label}</label>
      <input
        value={form[key] || ''}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={opts?.placeholder || ''}
        type={opts?.type || 'text'}
        className={inputCls}
        style={inputStyle}
      />
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Tài khoản ngân hàng</h2>
          <p className="text-neutral-medium text-sm mt-1">{company.entity_short} • {accounts.length} tài khoản</p>
        </div>
        {canEdit && (
          <button onClick={openAdd}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}>
            + Thêm tài khoản
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border border-primary/10 p-6 space-y-4" style={{ background: 'rgba(255,149,0,0.03)' }}>
          <p className="text-sm font-black text-white">{editingId ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('Tên tài khoản (Account Name) *', 'name', { placeholder: 'CONG TY TNHH TD GAMES' })}
            {field('Tên ngân hàng (Bank Name) *', 'bank_name', { placeholder: 'Techcombank' })}
            {field('Số tài khoản (Account No.)', 'account_number', { placeholder: '19xxxxxxxxxx' })}
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Loại tiền (Currency)</label>
              <select value={form.currency} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
            </div>
            {field('SWIFT Code', 'swift_code', { placeholder: 'VTCBVNVX' })}
            {field('CITAD Code', 'citad_code', { placeholder: '1234567' })}
          </div>
          {field('Địa chỉ ngân hàng (Bank Address)', 'bank_address', { placeholder: '191 Bà Triệu, Hai Bà Trưng, Hà Nội' })}

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
              Huỷ
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}>
              {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-neutral-600 text-sm">Đang tải...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">🏦</p>
          <p>Chưa có tài khoản ngân hàng nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map(acc => (
            <div key={acc.id}
              className="rounded-[20px] border transition-all p-5"
              style={{
                background: acc.sort_order === 1 ? 'rgba(255,149,0,0.04)' : 'rgba(255,255,255,0.02)',
                borderColor: acc.sort_order === 1 ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)',
              }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  🏦
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-black text-sm">{acc.bank_name}</span>
                    {acc.sort_order === 1 && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400">Chính</span>
                    )}
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                      style={{ background: `${currencyColor[acc.currency] || '#666'}20`, color: currencyColor[acc.currency] || '#999' }}>
                      {acc.currency}
                    </span>
                  </div>
                  <p className="text-neutral-300 font-mono text-sm mt-0.5 tracking-wider">{acc.account_number}</p>
                  <p className="text-neutral-500 text-xs mt-0.5">{acc.name}</p>
                  {(acc.swift_code || acc.citad_code) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {acc.swift_code && <span className="text-[10px] text-neutral-600">SWIFT: <span className="text-neutral-400 font-mono">{acc.swift_code}</span></span>}
                      {acc.citad_code && <span className="text-[10px] text-neutral-600">CITAD: <span className="text-neutral-400 font-mono">{acc.citad_code}</span></span>}
                    </div>
                  )}
                  {acc.bank_address && (
                    <p className="text-[10px] text-neutral-600 mt-0.5">{acc.bank_address}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex gap-2 mt-3 justify-end">
                  {acc.sort_order !== 1 && (
                    <button onClick={() => handleSetPrimary(acc.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-all">
                      ⭐ Chính
                    </button>
                  )}
                  <button onClick={() => openEdit(acc)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all">
                    Sửa
                  </button>
                  {deleteConfirmId === acc.id ? (
                    <div className="flex gap-1 items-center">
                      <span className="text-[10px] text-red-400 font-bold">Ẩn TK?</span>
                      <button onClick={() => handleDeactivate(acc.id)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all">
                        Xác nhận
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1.5 rounded-lg text-[10px] text-neutral-500 border border-white/10 hover:bg-white/5 transition-all">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(acc.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-500 border border-white/10 hover:text-red-400 hover:border-red-500/30 transition-all">
                      Ẩn
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold animate-scaleIn"
          style={{ background: toast.type === 'success' ? '#10b981' : '#ef4444', color: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
