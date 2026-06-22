import React, { useState } from 'react';
import { FixedAsset, AssetType, AssetStatus } from '@/types';
import { calcDepreciation } from '../services/accountingService';

const fmt = (n: number) => n.toLocaleString('vi-VN');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  equipment: '🖥️ Thiết bị',
  furniture: '🪑 Nội thất',
  vehicle:   '🚗 Phương tiện',
  software:  '💿 Phần mềm',
  other:     '📦 Khác',
};

const STATUS_STYLES: Record<AssetStatus, { label: string; color: string; bg: string }> = {
  active:      { label: 'Đang dùng',   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  disposed:    { label: 'Đã thanh lý', color: 'text-red-400',     bg: 'bg-red-500/10' },
  written_off: { label: 'Đã xóa sổ',  color: 'text-neutral-400', bg: 'bg-neutral-500/10' },
};

const EMPTY_FORM = (): Omit<FixedAsset, 'id' | 'created_at' | 'updated_at'> => ({
  name: '', asset_type: 'equipment', purchase_date: new Date().toISOString().split('T')[0],
  cost: 0, useful_life_months: 36, residual_value: 0,
  description: '', serial_number: '', location: '', assigned_to: '',
  status: 'active', notes: '',
});

interface Props {
  assets: FixedAsset[];
  onAdd: (a: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onEdit: (id: string, u: Partial<FixedAsset>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const FixedAssetTab: React.FC<Props> = ({ assets, onAdd, onEdit, onDelete, onToast }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<FixedAsset | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | AssetStatus>('all');

  const today = new Date();
  const activeAssets = assets.filter(a => a.status === 'active');
  const totalCost = activeAssets.reduce((s, a) => s + a.cost, 0);
  const totalMonthlyDep = activeAssets.reduce((s, a) => {
    const { monthlyDep, isFullyDepreciated } = calcDepreciation(a);
    return s + (isFullyDepreciated ? 0 : monthlyDep);
  }, 0);
  const totalBookValue = activeAssets.reduce((s, a) => s + calcDepreciation(a).bookValue, 0);

  const filtered = assets.filter(a => filterStatus === 'all' || a.status === filterStatus);

  const openAdd = () => { setForm(EMPTY_FORM()); setEditId(null); setShowForm(true); };
  const openEdit = (a: FixedAsset) => {
    setForm({
      name: a.name, asset_type: a.asset_type, purchase_date: a.purchase_date,
      cost: a.cost, useful_life_months: a.useful_life_months, residual_value: a.residual_value,
      description: a.description || '', serial_number: a.serial_number || '',
      location: a.location || '', assigned_to: a.assigned_to || '',
      status: a.status, notes: a.notes || '',
    });
    setEditId(a.id); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.cost <= 0) { onToast('Vui lòng nhập tên và nguyên giá', 'error'); return; }
    setSaving(true);
    try {
      if (editId) { await onEdit(editId, form); onToast('Đã cập nhật tài sản'); }
      else { await onAdd(form); onToast('Đã thêm tài sản cố định'); }
      setShowForm(false);
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa tài sản này?')) return;
    try { await onDelete(id); onToast('Đã xóa'); setSelected(null); }
    catch (e: any) { onToast(e.message, 'error'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Tài sản cố định</h2>
          <p className="text-neutral-medium text-sm mt-1">Theo dõi & khấu hao đường thẳng</p>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all"
          style={{ background: '#FF9500' }}>
          + Thêm tài sản
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Nguyên giá (đang dùng)', value: `${fmt(totalCost)} ₫`, color: '#FF9500' },
          { label: 'Giá trị còn lại', value: `${fmt(Math.round(totalBookValue))} ₫`, color: '#30D158' },
          { label: 'Khấu hao / tháng', value: `${fmt(Math.round(totalMonthlyDep))} ₫`, color: '#FF375F' },
        ].map(c => (
          <div key={c.label} className="rounded-[20px] border border-primary/10 bg-surface p-5 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{c.label}</p>
            <p className="text-2xl font-black" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'active', 'disposed', 'written_off'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
            style={filterStatus === s ? { background: '#FF9500' } : { background: 'rgba(255,255,255,0.05)' }}>
            {s === 'all' ? 'Tất cả' : STATUS_STYLES[s].label}
          </button>
        ))}
      </div>

      {/* Asset list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">🏢</p>
            <p className="text-neutral-600 text-sm">Chưa có tài sản nào</p>
            <p className="text-xs mt-1 text-neutral-700">Nhấn "+ Thêm tài sản" để bắt đầu</p>
          </div>
        )}
        {filtered.map(a => {
          const dep = calcDepreciation(a, today);
          const pct = Math.min(100, (dep.depMonths / a.useful_life_months) * 100);
          const st = STATUS_STYLES[a.status];
          return (
            <div key={a.id} onClick={() => setSelected(selected?.id === a.id ? null : a)}
              className="rounded-2xl border border-white/5 p-4 cursor-pointer hover:border-white/10 transition-all"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{ASSET_TYPE_LABELS[a.asset_type].split(' ')[0]}</span>
                  <div>
                    <p className="text-white font-bold text-sm">{a.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${st.bg} ${st.color}`}>{st.label}</span>
                      {a.assigned_to && <span className="text-neutral-500 text-xs">👤 {a.assigned_to}</span>}
                      {a.location && <span className="text-neutral-500 text-xs">📍 {a.location}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-black text-sm">{fmt(Math.round(dep.bookValue))} ₫</p>
                  <p className="text-neutral-500 text-xs">Còn lại / {fmt(a.cost)} ₫</p>
                </div>
              </div>
              {/* Progress bar */}
              {a.status === 'active' && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-neutral-500 mb-1">
                    <span>Đã khấu hao {dep.depMonths} tháng</span>
                    <span>{dep.isFullyDepreciated ? '✅ Đã hết KH' : `Còn ${dep.remainingMonths} tháng`}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: dep.isFullyDepreciated ? '#30D158' : '#FF9500' }} />
                  </div>
                </div>
              )}
              {/* Detail panel */}
              {selected?.id === a.id && (
                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-neutral-500">Mua ngày</span><p className="text-white font-bold">{fmtDate(a.purchase_date)}</p></div>
                  <div><span className="text-neutral-500">Hết KH</span><p className="text-white font-bold">{fmtDate(dep.endDate.toISOString())}</p></div>
                  <div><span className="text-neutral-500">Nguyên giá</span><p className="text-white font-bold">{fmt(a.cost)} ₫</p></div>
                  <div><span className="text-neutral-500">KH / tháng</span><p className="text-white font-bold">{fmt(Math.round(dep.monthlyDep))} ₫</p></div>
                  <div><span className="text-neutral-500">Đã KH lũy kế</span><p className="text-white font-bold">{fmt(Math.round(dep.accumulated))} ₫</p></div>
                  <div><span className="text-neutral-500">Tỉ lệ KH / năm</span><p className="text-white font-bold">{dep.depreciationRate.toFixed(1)}%</p></div>
                  {a.serial_number && <div><span className="text-neutral-500">Serial</span><p className="text-white font-bold">{a.serial_number}</p></div>}
                  <div className="col-span-2 flex gap-2 mt-2">
                    <button onClick={e => { e.stopPropagation(); openEdit(a); }}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">
                      ✏️ Sửa
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
                      🗑 Xóa
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: '#1A1A1A' }}>
            <h3 className="text-base font-black uppercase tracking-wider text-white mb-6">
              {editId ? '✏️ Sửa tài sản' : '+ Thêm tài sản cố định'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Tên tài sản *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Máy tính Dell XPS 15" required
                  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                  style={{ background: '#0f0f0f' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Loại tài sản</label>
                  <select value={form.asset_type} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value as AssetType }))}
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#0f0f0f' }}>
                    {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Ngày mua *</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#0f0f0f' }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nguyên giá (₫) *</label>
                  <input type="number" min="0" value={form.cost || ''} onChange={e => setForm(f => ({ ...f, cost: +e.target.value }))}
                    placeholder="0" className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#0f0f0f' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Thời gian KH (tháng)</label>
                  <input type="number" min="1" value={form.useful_life_months} onChange={e => setForm(f => ({ ...f, useful_life_months: +e.target.value }))}
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#0f0f0f' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Giá trị còn lại (₫)</label>
                  <input type="number" min="0" value={form.residual_value || ''} onChange={e => setForm(f => ({ ...f, residual_value: +e.target.value }))}
                    placeholder="0" className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#0f0f0f' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Người sử dụng</label>
                  <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                    placeholder="VD: Nguyễn Văn A" className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#0f0f0f' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Vị trí</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="VD: Phòng dev, Tầng 3" className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#0f0f0f' }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Serial / Số hiệu</label>
                <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                  style={{ background: '#0f0f0f' }} />
              </div>
              {editId && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Trạng thái</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AssetStatus }))}
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#0f0f0f' }}>
                    {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Ghi chú</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
                  style={{ background: '#0f0f0f' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                  style={{ background: '#FF9500' }}>
                  {saving ? 'Đang lưu...' : editId ? 'Cập nhật' : 'Thêm mới'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
                  Huỷ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedAssetTab;
