import React from 'react';
import { AcceptanceExtraItem } from '@/types';

// Khoản cộng thêm không gắn task trên phiếu nghiệm thu khách (vd. khách bonus cho công ty).
// Cộng thẳng vào tổng phiếu, không bị discount, không chia vào doanh thu/KPI từng NV.

interface ExtraItemsEditorProps {
  items: AcceptanceExtraItem[];
  onChange: (items: AcceptanceExtraItem[]) => void;
  /** Gọi khi blur / xoá dòng — dùng để lưu DB ở màn chi tiết */
  onCommit?: (items: AcceptanceExtraItem[]) => void;
}

export const cleanExtraItems = (items: AcceptanceExtraItem[]) =>
  items.filter(i => i.label.trim() && Number(i.amount)).map(i => ({ label: i.label.trim(), amount: Number(i.amount) }));

export const ExtraItemsEditor: React.FC<ExtraItemsEditorProps> = ({ items, onChange, onCommit }) => {
  const update = (idx: number, patch: Partial<AcceptanceExtraItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(next);
    onCommit?.(next);
  };
  const commit = () => onCommit?.(items);

  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={it.label}
            onChange={e => update(idx, { label: e.target.value })}
            onBlur={commit}
            placeholder="Lý do (vd. Client bonus — Sep 2026)"
            className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 placeholder-neutral-medium/40"
          />
          <span className="text-neutral-medium/40 text-xs">$</span>
          <input
            type="number"
            step="1"
            value={it.amount || ''}
            onChange={e => update(idx, { amount: parseFloat(e.target.value) || 0 })}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="0"
            className="w-32 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-emerald-400 font-bold text-sm text-right focus:outline-none focus:border-blue-500/40 placeholder-neutral-medium/20"
          />
          <span className="text-[10px] text-neutral-medium/40">USD</span>
          <button
            type="button"
            onClick={() => remove(idx)}
            title="Xoá khoản này"
            className="px-2 py-1 text-neutral-medium hover:text-red-400 transition-colors"
          >✕</button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { label: '', amount: 0 }])}
        className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
      >+ Thêm khoản cộng thêm (bonus / phát sinh)</button>
    </div>
  );
};
