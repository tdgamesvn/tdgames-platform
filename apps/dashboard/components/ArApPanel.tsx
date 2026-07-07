import React from 'react';
import { CeoDashboardData } from '../services/dashboardService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const ArApPanel: React.FC<{ data: CeoDashboardData['arApSummary'] }> = ({ data }) => (
  <div className="p-5 rounded-2xl bg-surface border border-white/8">
    <h3 className="text-xs font-black uppercase tracking-widest text-white mb-3">📥📤 Công nợ</h3>
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Phải thu (AR)</span>
        <a href="#invoice" className="text-primary text-[10px] font-bold hover:underline">Xem chi tiết →</a>
      </div>
      <p className="text-white font-black text-lg mb-1.5">{fmt(data.arTotal)} đ</p>
      {data.arBuckets.filter(b => b.total > 0).map(b => (
        <div key={b.bucket} className="flex justify-between text-[11px]">
          <span className="text-neutral-medium">{b.bucket}</span>
          <span className="text-white">{fmt(b.total)} đ</span>
        </div>
      ))}
    </div>
    <div className="border-t border-white/5 pt-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Phải trả (AP)</span>
        <a href="#accounting" className="text-primary text-[10px] font-bold hover:underline">Xem chi tiết →</a>
      </div>
      <p className="text-white font-black text-lg mb-1.5">{fmt(data.apTotal)} đ</p>
      {data.apTopVendors.map(v => (
        <div key={v.vendor} className="flex justify-between text-[11px]">
          <span className="text-neutral-medium">{v.vendor}</span>
          <span className="text-white">{fmt(v.total)} đ</span>
        </div>
      ))}
    </div>
  </div>
);

export default ArApPanel;
