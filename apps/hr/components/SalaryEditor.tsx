import React from 'react';

// ══════════════════════════════════════════════════════════
// ── Types ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

export interface SalaryRow {
  component_id: string;
  name: string;
  old_amount: number;
  new_amount: number;
}

// ══════════════════════════════════════════════════════════
// ── Helpers ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

const fmt = (n: number) => n.toLocaleString('vi-VN');

const labelCls = 'text-neutral-500 text-[10px] font-black uppercase tracking-wider';

// ══════════════════════════════════════════════════════════
// ── SalaryEditor ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════

interface Props {
  rows: SalaryRow[];
  onChange: (rows: SalaryRow[]) => void;
}

const SalaryEditor: React.FC<Props> = ({ rows, onChange }) => {
  const setAmount = (idx: number, val: number) => {
    const next = [...rows];
    next[idx] = { ...next[idx], new_amount: val };
    onChange(next);
  };

  const oldTotal = rows.reduce((s, r) => s + r.old_amount, 0);
  const newTotal = rows.reduce((s, r) => s + r.new_amount, 0);
  const diff = newTotal - oldTotal;

  return (
    <div className="rounded-xl border border-white/5 p-4" style={{ background: '#0F0F0F' }}>
      <p className={labelCls + ' mb-3'}>Bảng lương</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-neutral-medium">
            <th className="text-left py-1.5 font-black uppercase tracking-wider">Khoản mục</th>
            <th className="text-right py-1.5 font-black uppercase tracking-wider">Hiện tại</th>
            <th className="text-right py-1.5 font-black uppercase tracking-wider w-36">Đề xuất</th>
            <th className="text-right py-1.5 font-black uppercase tracking-wider">Chênh lệch</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const d = r.new_amount - r.old_amount;
            return (
              <tr key={r.component_id} className="border-t border-white/5">
                <td className="py-2 text-neutral-light">{r.name}</td>
                <td className="py-2 text-right text-neutral-medium">{fmt(r.old_amount)}</td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    value={r.new_amount || ''}
                    onChange={e => setAmount(i, Number(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded-lg text-sm text-right text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#1a1a1a' }}
                    min={0}
                  />
                </td>
                <td className={`py-2 text-right font-black ${d > 0 ? 'text-emerald-400' : d < 0 ? 'text-red-400' : 'text-neutral-medium'}`}>
                  {d > 0 ? '+' : ''}{fmt(d)}
                </td>
              </tr>
            );
          })}
          {rows.length > 1 && (
            <tr className="border-t-2 border-white/10 font-black">
              <td className="py-2 text-neutral-light uppercase tracking-wider text-[10px]">Tổng</td>
              <td className="py-2 text-right text-neutral-medium">{fmt(oldTotal)}</td>
              <td className="py-2 text-right" style={{ color: '#FF9500' }}>{fmt(newTotal)}</td>
              <td className={`py-2 text-right ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-neutral-medium'}`}>
                {diff > 0 ? '+' : ''}{fmt(diff)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SalaryEditor;
