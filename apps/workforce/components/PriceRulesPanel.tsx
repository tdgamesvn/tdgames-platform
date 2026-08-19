import React, { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';

export interface PriceRule {
  id?: string;
  label: string;
  space_name: string | null;
  folder_name: string | null;
  list_name: string | null;
  title_pattern: string | null;
  client_price: number | null;
  client_currency: string;
  price: number | null;
  currency: string;
  priority: number;
  active: boolean;
}

const EMPTY: PriceRule = {
  label: '', space_name: null, folder_name: null, list_name: null, title_pattern: null,
  client_price: null, client_currency: 'USD', price: null, currency: 'VND',
  priority: 0, active: true,
};

interface Props {
  onToast: (msg: string, type: 'success' | 'error') => void;
}

/**
 * Bảng đơn giá theo loại việc. Task sync về mà chưa có giá thì DB tự điền
 * (trigger trg_apply_wf_price_rule). Giá đã chỉnh tay không bao giờ bị đè.
 */
const PriceRulesPanel: React.FC<Props> = ({ onToast }) => {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [editing, setEditing] = useState<PriceRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: rows }, { data: sp }] = await Promise.all([
      supabase.from('wf_price_rules').select('*').order('priority', { ascending: false }),
      supabase.from('wf_tasks').select('clickup_space_name').not('clickup_space_name', 'is', null),
    ]);
    setRules((rows || []) as PriceRule[]);
    setSpaces([...new Set((sp || []).map((r: any) => r.clickup_space_name))].sort());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.label.trim()) return onToast('Đặt tên gợi nhớ cho quy tắc', 'error');
    if (editing.client_price == null && editing.price == null) {
      return onToast('Nhập ít nhất 1 trong 2 giá', 'error');
    }
    setBusy(true);
    const { id, ...payload } = editing;
    const q = id
      ? supabase.from('wf_price_rules').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
      : supabase.from('wf_price_rules').insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return onToast(`Lỗi: ${error.message}`, 'error');
    onToast('✅ Đã lưu quy tắc giá', 'success');
    setEditing(null);
    load();
  };

  const remove = async (r: PriceRule) => {
    if (!confirm(`Xoá quy tắc "${r.label}"?`)) return;
    const { error } = await supabase.from('wf_price_rules').delete().eq('id', r.id!);
    if (error) return onToast(`Lỗi: ${error.message}`, 'error');
    onToast('Đã xoá', 'success');
    load();
  };

  const backfill = async () => {
    if (!confirm('Áp bảng giá cho các task đang TRỐNG giá? Task đã có giá không bị đụng.')) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('backfill_wf_task_prices');
    setBusy(false);
    if (error) return onToast(`Lỗi: ${error.message}`, 'error');
    onToast(`✅ Đã điền giá cho ${data ?? 0} task`, 'success');
  };

  const fmt = (n: number | null, cur: string) => (n == null ? '—' : `${Number(n).toLocaleString()} ${cur}`);
  const set = (patch: Partial<PriceRule>) => setEditing(prev => (prev ? { ...prev, ...patch } : prev));
  const nullable = (v: string) => (v.trim() === '' ? null : v.trim());
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const inputCls = 'w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50';
  const labelCls = 'text-[10px] font-black text-neutral-600 uppercase tracking-wider mb-1 block';

  return (
    <div className="bg-surface border border-white/8 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-white font-black uppercase tracking-wider text-sm">💵 Bảng đơn giá tự động</h3>
          <p className="text-[11px] text-neutral-medium mt-0.5">
            Task sync về mà chưa có giá sẽ được điền theo quy tắc khớp. Giá chỉnh tay không bị đè.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={backfill} disabled={busy || rules.length === 0}
            className="px-3 py-2 rounded-lg border border-white/10 text-neutral-light font-black text-[10px] uppercase tracking-widest hover:text-white disabled:opacity-40">
            Áp cho task chưa có giá
          </button>
          <button onClick={() => setEditing({ ...EMPTY })}
            className="px-3 py-2 rounded-lg bg-primary text-black font-black text-[10px] uppercase tracking-widest hover:bg-primary/90">
            + Thêm quy tắc
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-neutral-medium text-sm py-4 text-center">Đang tải…</p>
      ) : rules.length === 0 ? (
        <p className="text-neutral-medium text-sm py-6 text-center">
          Chưa có quy tắc nào — task mới sẽ về với giá 0 như hiện tại.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black text-neutral-600 uppercase tracking-wider border-b border-white/5">
                <th className="text-left py-2">Quy tắc</th>
                <th className="text-left py-2">Khớp khi</th>
                <th className="text-right py-2">Thu khách</th>
                <th className="text-right py-2">Trả người làm</th>
                <th className="text-center py-2">Ưu tiên</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className={`border-b border-white/5 ${r.active ? '' : 'opacity-40'}`}>
                  <td className="py-2 text-white font-semibold">{r.label}</td>
                  <td className="py-2 text-[11px] text-neutral-medium">
                    {[r.space_name, r.folder_name, r.list_name].filter(Boolean).join(' › ') || 'mọi space'}
                    {r.title_pattern && <span className="text-primary/70"> · tên khớp “{r.title_pattern}”</span>}
                  </td>
                  <td className="py-2 text-right text-blue-400 font-bold">{fmt(r.client_price, r.client_currency)}</td>
                  <td className="py-2 text-right text-primary font-bold">{fmt(r.price, r.currency)}</td>
                  <td className="py-2 text-center text-neutral-medium">{r.priority}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(r)} className="text-[10px] font-black uppercase text-primary hover:text-primary/80 mr-3">Sửa</button>
                    <button onClick={() => remove(r)} className="text-[10px] font-black uppercase text-red-400/80 hover:text-red-400">Xoá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-surface border border-white/10 rounded-xl p-5 w-full max-w-2xl space-y-3" onClick={e => e.stopPropagation()}>
            <h4 className="text-white font-black uppercase tracking-wider text-sm">
              {editing.id ? 'Sửa quy tắc' : 'Quy tắc giá mới'}
            </h4>

            <div>
              <label className={labelCls}>Tên gợi nhớ</label>
              <input className={inputCls} value={editing.label} placeholder="VD: 2D Animation — Character"
                onChange={e => set({ label: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Space (để trống = mọi space)</label>
                <select className={inputCls} value={editing.space_name || ''} onChange={e => set({ space_name: nullable(e.target.value) })}>
                  <option value="">— Mọi space —</option>
                  {spaces.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tên task khớp mẫu (dùng % làm ký tự đại diện)</label>
                <input className={inputCls} value={editing.title_pattern || ''} placeholder="%[Character]%"
                  onChange={e => set({ title_pattern: nullable(e.target.value) })} />
              </div>
              <div>
                <label className={labelCls}>Folder (tuỳ chọn)</label>
                <input className={inputCls} value={editing.folder_name || ''} onChange={e => set({ folder_name: nullable(e.target.value) })} />
              </div>
              <div>
                <label className={labelCls}>List (tuỳ chọn)</label>
                <input className={inputCls} value={editing.list_name || ''} onChange={e => set({ list_name: nullable(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
              <div>
                <label className={labelCls}>🔵 Giá thu khách</label>
                <div className="flex gap-2">
                  <input type="number" className={inputCls} value={editing.client_price ?? ''}
                    onChange={e => set({ client_price: num(e.target.value) })} />
                  <button onClick={() => set({ client_currency: editing.client_currency === 'USD' ? 'VND' : 'USD' })}
                    className="px-3 rounded-lg border border-blue-500/30 text-blue-400 font-black text-xs">{editing.client_currency}</button>
                </div>
              </div>
              <div>
                <label className={labelCls}>🟠 Giá trả người làm</label>
                <div className="flex gap-2">
                  <input type="number" className={inputCls} value={editing.price ?? ''}
                    onChange={e => set({ price: num(e.target.value) })} />
                  <button onClick={() => set({ currency: editing.currency === 'USD' ? 'VND' : 'USD' })}
                    className="px-3 rounded-lg border border-primary/30 text-primary font-black text-xs">{editing.currency}</button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className={labelCls}>Ưu tiên (quy tắc cụ thể hơn để số cao hơn)</label>
                <input type="number" className={inputCls} value={editing.priority}
                  onChange={e => set({ priority: Number(e.target.value) || 0 })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-light mt-4">
                <input type="checkbox" checked={editing.active} onChange={e => set({ active: e.target.checked })} />
                Đang bật
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={busy}
                className="px-6 py-2 rounded-lg bg-primary text-black font-black text-[10px] uppercase tracking-widest hover:bg-primary/90 disabled:opacity-40">Lưu</button>
              <button onClick={() => setEditing(null)}
                className="px-6 py-2 rounded-lg border border-white/10 text-neutral-medium font-black text-[10px] uppercase tracking-widest hover:text-white">Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceRulesPanel;
