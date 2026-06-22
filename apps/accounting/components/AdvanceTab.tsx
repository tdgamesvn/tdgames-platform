import React, { useState } from 'react';
import { Advance, AdvanceStatus } from '@/types';

const fmt = (n: number) => n.toLocaleString('vi-VN');
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

const STATUS_STYLES: Record<AdvanceStatus, { label: string; color: string; bg: string }> = {
  open:      { label: '🟡 Đang tạm ứng', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  settled:   { label: '✅ Đã quyết toán', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  cancelled: { label: '❌ Đã huỷ',        color: 'text-neutral-400', bg: 'bg-neutral-500/10' },
};

const EMPTY_FORM = () => ({
  recipient_name: '',
  amount: 0,
  purpose: '',
  advance_date: new Date().toISOString().split('T')[0],
  expected_settlement_date: '',
  approved_by: '',
  notes: '',
  status: 'open' as AdvanceStatus,
});

const EMPTY_SETTLE = () => ({
  settled_amount: 0,
  returned_amount: 0,
  settlement_date: new Date().toISOString().split('T')[0],
  settlement_notes: '',
});

interface Props {
  advances: Advance[];
  openTotal: number;
  onAdd: (a: Omit<Advance, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onSettle: (id: string, p: { settled_amount: number; returned_amount: number; settlement_date: string; settlement_notes?: string }) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const AdvanceTab: React.FC<Props> = ({ advances, openTotal, onAdd, onSettle, onCancel, onDelete, onToast }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [settleId, setSettleId] = useState<string | null>(null);
  const [settleForm, setSettleForm] = useState(EMPTY_SETTLE());
  const [filterStatus, setFilterStatus] = useState<'all' | AdvanceStatus>('all');

  const filtered = advances.filter(a => filterStatus === 'all' || a.status === filterStatus);
  const openCount = advances.filter(a => a.status === 'open').length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipient_name || form.amount <= 0 || !form.purpose) {
      onToast('Vui lòng điền đầy đủ thông tin', 'error'); return;
    }
    setSaving(true);
    try {
      await onAdd({
        recipient_name: form.recipient_name,
        amount: form.amount,
        purpose: form.purpose,
        advance_date: form.advance_date,
        expected_settlement_date: form.expected_settlement_date || undefined,
        approved_by: form.approved_by || undefined,
        notes: form.notes || undefined,
        status: 'open',
        returned_amount: 0,
      });
      onToast('Đã tạo phiếu tạm ứng');
      setShowForm(false);
      setForm(EMPTY_FORM());
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleId) return;
    const adv = advances.find(a => a.id === settleId)!;
    const diff = adv.amount - settleForm.settled_amount;
    if (diff < 0) { onToast('Số đã chi không thể lớn hơn số tạm ứng', 'error'); return; }
    setSaving(true);
    try {
      await onSettle(settleId, {
        settled_amount: settleForm.settled_amount,
        returned_amount: Math.max(0, diff),
        settlement_date: settleForm.settlement_date,
        settlement_notes: settleForm.settlement_notes || undefined,
      });
      onToast('Đã quyết toán tạm ứng');
      setSettleId(null);
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Huỷ phiếu tạm ứng này?')) return;
    try { await onCancel(id); onToast('Đã huỷ phiếu'); }
    catch (e: any) { onToast(e.message, 'error'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa hẳn phiếu này?')) return;
    try { await onDelete(id); onToast('Đã xóa'); }
    catch (e: any) { onToast(e.message, 'error'); }
  };

  const openSettle = (adv: Advance) => {
    setSettleForm({ ...EMPTY_SETTLE(), settled_amount: adv.amount });
    setSettleId(adv.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Tạm ứng</h2>
          <p className="text-neutral-medium text-sm mt-1">Phiếu tạm ứng & quyết toán</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all"
          style={{ background: '#FF9500' }}>
          + Tạo phiếu
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Đang tạm ứng', value: `${fmt(openTotal)} ₫`, sub: `${openCount} phiếu`, color: '#FF9500' },
          { label: 'Đã quyết toán', value: `${advances.filter(a => a.status === 'settled').length} phiếu`, sub: '', color: '#30D158' },
          { label: 'Tổng phiếu', value: `${advances.length}`, sub: '', color: '#0A84FF' },
        ].map(c => (
          <div key={c.label} className="rounded-[20px] border border-primary/10 bg-surface p-5 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{c.label}</p>
            <p className="text-2xl font-black" style={{ color: c.color }}>{c.value}</p>
            {c.sub && <p className="text-neutral-500 text-xs">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'open', 'settled', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
            style={filterStatus === s ? { background: '#FF9500' } : { background: 'rgba(255,255,255,0.05)' }}>
            {s === 'all' ? 'Tất cả' : STATUS_STYLES[s].label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-neutral-700 text-sm">
            <p className="text-3xl mb-3">💳</p>
            <p className="text-neutral-600 text-sm">Chưa có phiếu tạm ứng nào</p>
            <p className="text-xs mt-1 text-neutral-700">Nhấn "+ Tạo phiếu" để bắt đầu</p>
          </div>
        )}
        {filtered.map(a => {
          const st = STATUS_STYLES[a.status];
          const returned = a.returned_amount ?? 0;
          return (
            <div key={a.id} className="rounded-[20px] border border-primary/10 bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-sm">{a.recipient_name}</p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${st.bg} ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-neutral-400 text-xs mt-0.5">{a.purpose}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                    <span>📅 {fmtDate(a.advance_date)}</span>
                    {a.expected_settlement_date && <span>⏰ Hạn QT: {fmtDate(a.expected_settlement_date)}</span>}
                    {a.approved_by && <span>✅ Duyệt: {a.approved_by}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-black text-base">{fmt(a.amount)} ₫</p>
                  {a.status === 'settled' && (
                    <div className="text-xs mt-0.5">
                      <span className="text-emerald-400">Chi: {fmt(a.settled_amount ?? 0)} ₫</span>
                      {returned > 0 && <span className="text-yellow-400 ml-2">Hoàn: {fmt(returned)} ₫</span>}
                    </div>
                  )}
                </div>
              </div>
              {a.settlement_notes && <p className="text-neutral-500 text-xs mt-2 italic">"{a.settlement_notes}"</p>}
              {a.status === 'open' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openSettle(a)} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:opacity-90 transition-all" style={{ background: '#30D158' }}>
                    Quyết toán
                  </button>
                  <button onClick={() => handleCancel(a.id)} className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">Huỷ</button>
                </div>
              )}
              {a.status !== 'open' && (
                <button onClick={() => handleDelete(a.id)} className="mt-3 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all">Xóa</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 p-6" style={{ background: '#1A1A1A' }}>
            <h3 className="text-base font-black uppercase tracking-wider text-white mb-6">Tạo phiếu tạm ứng</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Người tạm ứng *</label>
                <input value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
                  placeholder="VD: Kế toán Lan" required
                  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                  style={{ background: '#1a1a1a' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Số tiền (₫) *</label>
                  <input type="number" min="0" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))}
                    placeholder="0"
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                    style={{ background: '#1a1a1a' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Ngày tạm ứng *</label>
                  <input type="date" value={form.advance_date} onChange={e => setForm(f => ({ ...f, advance_date: e.target.value }))}
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                    style={{ background: '#1a1a1a' }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Mục đích *</label>
                <input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="VD: Chi phí vận hành tháng 5" required
                  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                  style={{ background: '#1a1a1a' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Hạn quyết toán</label>
                  <input type="date" value={form.expected_settlement_date} onChange={e => setForm(f => ({ ...f, expected_settlement_date: e.target.value }))}
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                    style={{ background: '#1a1a1a' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Người duyệt</label>
                  <input value={form.approved_by} onChange={e => setForm(f => ({ ...f, approved_by: e.target.value }))}
                    placeholder="VD: Giám đốc"
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                    style={{ background: '#1a1a1a' }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Ghi chú</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
                  style={{ background: '#1a1a1a' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)' }}>
                  {saving ? 'Đang lưu...' : 'Tạo phiếu'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
                  Huỷ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle modal */}
      {settleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 p-6" style={{ background: '#1A1A1A' }}>
            {(() => {
              const adv = advances.find(a => a.id === settleId)!;
              return (
                <>
                  <h3 className="text-base font-black uppercase tracking-wider text-white mb-2">Quyết toán tạm ứng</h3>
                  <p className="text-neutral-500 text-xs mb-6">Tạm ứng: <span className="text-white font-semibold">{fmt(adv.amount)} ₫</span> — {adv.recipient_name}</p>
                  <form onSubmit={handleSettle} className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Thực tế đã chi (₫) *</label>
                      <input type="number" min="0" max={adv.amount} value={settleForm.settled_amount || ''}
                        onChange={e => setSettleForm(f => ({ ...f, settled_amount: +e.target.value, returned_amount: Math.max(0, adv.amount - +e.target.value) }))}
                        className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                        style={{ background: '#1a1a1a' }} />
                    </div>
                    <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-yellow-400 text-sm font-semibold">
                        Hoàn lại: {fmt(Math.max(0, adv.amount - settleForm.settled_amount))} ₫
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Ngày quyết toán *</label>
                      <input type="date" value={settleForm.settlement_date}
                        onChange={e => setSettleForm(f => ({ ...f, settlement_date: e.target.value }))}
                        className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                        style={{ background: '#1a1a1a' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Ghi chú quyết toán</label>
                      <textarea value={settleForm.settlement_notes} onChange={e => setSettleForm(f => ({ ...f, settlement_notes: e.target.value }))} rows={2}
                        className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
                        style={{ background: '#1a1a1a' }} />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" disabled={saving}
                        className="flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                        style={{ background: '#30D158' }}>
                        {saving ? 'Đang lưu...' : 'Xác nhận quyết toán'}
                      </button>
                      <button type="button" onClick={() => setSettleId(null)}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
                        Huỷ
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvanceTab;
