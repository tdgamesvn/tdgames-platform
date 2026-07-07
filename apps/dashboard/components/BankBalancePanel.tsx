import React from 'react';
import { CeoDashboardData } from '../services/dashboardService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const BankBalancePanel: React.FC<{ data: CeoDashboardData['cashPosition'] }> = ({ data }) => {
  const stale = data.staleDays;
  return (
    <div className="p-5 rounded-2xl bg-surface border border-white/8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-white">💵 Tiền mặt thực tế</h3>
        {stale !== null && (
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${stale > 7 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            Cập nhật {stale === 0 ? 'hôm nay' : `${stale} ngày trước`}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-white mb-3">{fmt(data.totalVnd)} <span className="text-xs font-normal text-neutral-medium">đ</span></p>
      <div className="space-y-1.5">
        {data.accounts.map(a => (
          <div key={a.name} className="flex justify-between text-xs">
            <span className="text-neutral-medium">{a.name}</span>
            <span className="text-white font-bold">{fmt(a.balance)} {a.currency}</span>
          </div>
        ))}
        {data.accounts.length === 0 && (
          <p className="text-neutral-medium text-xs text-center py-4">Chưa có số dư nào được nhập — vào Accounting → Số dư ngân hàng.</p>
        )}
      </div>
    </div>
  );
};

export default BankBalancePanel;
