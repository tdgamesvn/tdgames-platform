import React, { useState, useEffect } from 'react';
import { HrSalaryComponent } from '@/types';
import * as svc from '../services/hrService';

const SalaryComponentManager: React.FC = () => {
  const [components, setComponents] = useState<HrSalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const emptyForm = {
    name: '', code: '', category: 'fixed' as HrSalaryComponent['category'], is_bhxh: false,
    is_taxable: false, is_tax_exempt: false, tax_cap_yearly: 0,
    description: '', sort_order: 0, is_active: true,
  };
  const [form, setForm] = useState(emptyForm);

  const cardCls = 'rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl';
  const inputCls = 'w-full px-4 py-3 rounded-xl bg-black/30 border border-primary/10 text-white text-sm focus:border-primary/40 outline-none transition-colors';
  const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1';

  const load = async () => {
    setLoading(true);
    try { setComponents(await svc.fetchSalaryComponents()); } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.code) return;
    try {
      if (editingId) {
        await svc.updateSalaryComponent(editingId, form);
        setComponents(prev => prev.map(c => c.id === editingId ? { ...c, ...form } : c));
      } else {
        const saved = await svc.saveSalaryComponent(form);
        setComponents(prev => [...prev, saved]);
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await svc.deleteSalaryComponent(id);
      setComponents(prev => prev.filter(c => c.id !== id));
      setConfirmDeleteId(null);
    } catch (e: any) { alert(e.message); }
  };

  const startEdit = (c: HrSalaryComponent) => {
    setForm({
      name: c.name, code: c.code, category: c.category, is_bhxh: c.is_bhxh,
      is_taxable: c.is_taxable, is_tax_exempt: c.is_tax_exempt,
      tax_cap_yearly: c.tax_cap_yearly, description: c.description,
      sort_order: c.sort_order, is_active: c.is_active,
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const badge = (on: boolean, label: string, color: string) => (
    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${on ? `bg-${color}-500/20 text-${color}-400` : 'bg-white/[0.03] text-neutral-medium/30'}`}>
      {label}
    </span>
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-400 to-yellow-400 bg-clip-text text-transparent uppercase tracking-tight">
            💰 Cấu trúc lương
          </h1>
          <p className="text-neutral-medium text-sm mt-1">Quản lý các khoản lương & phụ cấp mẫu</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-yellow-500 text-white font-black text-sm uppercase tracking-wide hover:scale-105 transition-all">
          + Thêm khoản
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className={cardCls}>
          <h3 className="text-lg font-black text-white uppercase mb-4">{editingId ? '✏️ Sửa khoản' : '➕ Thêm khoản mới'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelCls}>Tên khoản *</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Phụ cấp ăn trưa" />
            </div>
            <div>
              <label className={labelCls}>Mã khoản *</label>
              <input className={inputCls} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="lunch" />
            </div>
            <div>
              <label className={labelCls}>Loại</label>
              <select className={inputCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}>
                <option value="fixed">Cố định</option>
                <option value="variable">Biến động</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Trần thuế/năm (VND)</label>
              <input type="number" className={inputCls} value={form.tax_cap_yearly} onChange={e => setForm(f => ({ ...f, tax_cap_yearly: +e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Thứ tự hiển thị</label>
              <input type="number" className={inputCls} value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-4">
            {([
              ['is_bhxh', 'Đóng BHXH'],
              ['is_taxable', 'Tính thuế TNCN'],
              ['is_tax_exempt', 'Miễn thuế'],
              ['is_active', 'Đang áp dụng'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-emerald-500"
                  checked={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                <span className="text-sm text-white">{label}</span>
              </label>
            ))}
          </div>

          <div className="mb-4">
            <label className={labelCls}>Mô tả / Căn cứ pháp lý</label>
            <textarea className={inputCls + ' h-20 resize-none'} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="VD: Theo TT 96/2015/TT-BTC" />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSubmit} className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-yellow-500 text-white font-black text-sm">
              {editingId ? '💾 Cập nhật' : '💾 Lưu'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-6 py-3 rounded-xl bg-white/[0.05] text-neutral-medium font-bold text-sm">
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Component List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-[10px] font-black uppercase tracking-widest text-neutral-medium py-3 px-4">#</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-neutral-medium py-3 px-4">Khoản lương</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-neutral-medium py-3 px-4">Mã</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-neutral-medium py-3 px-4">Loại</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-neutral-medium py-3 px-4 text-center">BHXH</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-neutral-medium py-3 px-4 text-center">Thuế TNCN</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-neutral-medium py-3 px-4 text-center">Miễn thuế</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-neutral-medium py-3 px-4">Trần/năm</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-neutral-medium py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {components.map((c, i) => (
                <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] group transition-colors">
                  <td className="py-3 px-4 text-neutral-medium text-sm">{i + 1}</td>
                  <td className="py-3 px-4">
                    <div className="text-white font-bold text-sm">{c.name}</div>
                    {c.description && <div className="text-neutral-medium/60 text-[11px] mt-0.5 max-w-xs truncate">{c.description}</div>}
                  </td>
                  <td className="py-3 px-4 text-neutral-medium text-xs font-mono">{c.code}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${c.category === 'fixed' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {c.category === 'fixed' ? 'Cố định' : 'Biến động'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-lg ${c.is_bhxh ? 'text-emerald-400' : 'text-neutral-medium/20'}`}>{c.is_bhxh ? '✓' : '—'}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-lg ${c.is_taxable ? 'text-orange-400' : 'text-neutral-medium/20'}`}>{c.is_taxable ? '✓' : '—'}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-lg ${c.is_tax_exempt ? 'text-blue-400' : 'text-neutral-medium/20'}`}>{c.is_tax_exempt ? '✓' : '—'}</span>
                  </td>
                  <td className="py-3 px-4 text-white text-sm">{c.tax_cap_yearly > 0 ? c.tax_cap_yearly.toLocaleString() : '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => startEdit(c)} className="px-2 h-7 rounded-lg bg-blue-500/20 text-blue-400 text-[10px] font-bold hover:bg-blue-500/30">✏️</button>
                      {confirmDeleteId === c.id ? (
                        <>
                          <button onClick={() => handleDelete(c.id)} className="px-2 h-7 rounded-lg bg-red-500 text-white text-[10px] font-bold">Xóa</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2 h-7 rounded-lg bg-white/10 text-neutral-medium text-[10px] font-bold">Hủy</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(c.id)} className="px-2 h-7 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30">🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {components.length === 0 && (
            <div className="text-center py-16 opacity-40">
              <div className="text-5xl mb-4">💰</div>
              <div className="text-lg font-bold">Chưa có khoản lương nào</div>
              <div className="text-sm">Nhấn "+ Thêm khoản" để bắt đầu</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SalaryComponentManager;
