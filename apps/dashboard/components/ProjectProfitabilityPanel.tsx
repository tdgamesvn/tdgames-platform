import React from 'react';
import { CeoDashboardData } from '../services/dashboardService';

const fmtM = (n: number) => {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + ' tỷ';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'tr';
  return sign + Math.round(abs).toLocaleString('vi-VN');
};

const ProjectProfitabilityPanel: React.FC<{ data: CeoDashboardData['projectProfitability'] }> = ({ data }) => (
  <div className="p-5 rounded-2xl bg-surface border border-white/8">
    <h3 className="text-xs font-black uppercase tracking-widest text-white mb-3">📊 Lãi/lỗ theo dự án</h3>
    {data.length === 0 ? (
      <p className="text-neutral-medium text-xs text-center py-4">Chưa có dự án nào được gán invoice/task/expense.</p>
    ) : (
      <div className="space-y-3">
        {data.map(p => (
          <div key={p.projectId} className="border-b border-white/5 pb-2 last:border-0">
            <p className="text-white font-bold text-sm mb-1">{p.projectName}</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[9px] font-black uppercase text-neutral-600 tracking-wider">Tạm tính</span>
                <p className={p.estimatedProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{fmtM(p.estimatedProfit)} đ</p>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-neutral-600 tracking-wider">Đã chốt</span>
                <p className={p.verifiedProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{fmtM(p.verifiedProfit)} đ</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ProjectProfitabilityPanel;
