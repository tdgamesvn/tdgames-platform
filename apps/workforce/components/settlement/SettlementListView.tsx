import React from 'react';
import { Worker, Settlement } from '@/types';
import { StatusBadge } from '../shared/StatusBadge';

const STATUS_LABELS: Record<string, string> = { draft: 'Bản nháp', sent: 'Đã gửi', accepted: 'Đã chấp nhận', paid: 'Đã thanh toán' };
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-neutral-dark/30 text-neutral-medium border-neutral-dark/50',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accepted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};
const STATUS_BAR: Record<string, string> = {
  draft: 'from-neutral-dark to-neutral-dark',
  sent: 'from-blue-500 to-blue-600',
  accepted: 'from-yellow-500 to-yellow-600',
  paid: 'from-emerald-500 to-emerald-600',
};

interface SettlementListViewProps {
  settlements: Settlement[];
  workers: Worker[];
  vcbSellRate: number;
  onOpenDetail: (s: Settlement) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
}

const fmt = (n: number) => n.toLocaleString();

const SettlementListView: React.FC<SettlementListViewProps> = ({
  settlements, workers, vcbSellRate, onOpenDetail, onCreateNew, onDelete,
}) => {
  const toVND = (st: Settlement) => {
    const amount = st.net_amount || st.total_amount;
    return st.currency === 'USD' ? Math.round(amount * vcbSellRate) : amount;
  };
  const totalPaidVND = settlements.filter(s => s.status === 'paid').reduce((s, st) => s + toVND(st), 0);
  const totalPendingVND = settlements.filter(s => s.status !== 'paid').reduce((s, st) => s + toVND(st), 0);

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">Nghiệm Thu</h2>
          <p className="text-neutral-medium text-sm mt-1">Tổng hợp & thanh toán theo tháng</p>
        </div>
        <button onClick={onCreateNew}
          className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-gradient-primary text-white shadow-btn-glow hover:shadow-btn-glow-hover transition-all hover:scale-[1.02]"
        >✚ Tạo nghiệm thu</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Tổng nghiệm thu</p>
          <p className="text-3xl font-black text-white">{settlements.length}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Đã thanh toán</p>
          <p className="text-3xl font-black text-emerald-400">{settlements.filter(s => s.status === 'paid').length}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Đã chi</p>
          <p className="text-2xl font-black text-primary">{fmt(totalPaidVND)} <span className="text-sm text-neutral-medium">VNĐ</span></p>
        </div>
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Chưa thanh toán</p>
          <p className="text-2xl font-black text-amber-400">{fmt(totalPendingVND)} <span className="text-sm text-neutral-medium">VNĐ</span></p>
        </div>
      </div>

      {/* Settlement List */}
      {settlements.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-neutral-medium text-sm">Chưa có nghiệm thu nào</p>
          <p className="text-neutral-medium/60 text-xs mt-2">Nhấn "✚ Tạo nghiệm thu" để bắt đầu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {settlements.map(s => {
            const workerName = s.worker?.full_name || workers.find(w => w.id === s.worker_id)?.full_name || '???';
            return (
              <div key={s.id}
                className="group relative rounded-[20px] border border-primary/10 bg-surface overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-card-glow cursor-pointer"
                onClick={() => onOpenDetail(s)}>
                <div className={`h-1 w-full bg-gradient-to-r ${STATUS_BAR[s.status]}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-bold text-base">{workerName}</p>
                      <p className="text-neutral-medium text-xs mt-0.5">Kỳ: {s.period}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.status} labels={STATUS_LABELS} colors={STATUS_COLORS} />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        s.account_type === 'personal'
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : 'border-primary/20 text-primary/60 bg-primary/5'
                      }`}>
                        {s.account_type === 'personal' ? '👤' : '🏢'}
                      </span>
                    </div>
                  </div>
                  <p className="text-neutral-medium text-xs">{s.total_tasks} tasks</p>
                  <p className="text-emerald-400 font-black text-2xl mt-3">{fmt(s.net_amount || s.total_amount)} <span className="text-xs text-neutral-medium">{s.currency}</span></p>
                  {(s.tax_amount || 0) > 0 && <p className="text-neutral-medium/50 text-[10px] line-through">{fmt(s.total_amount + (s.bonus_amount || 0))} (trước thuế)</p>}
                  {s.notes && <p className="text-neutral-medium/60 text-[11px] mt-2 line-clamp-1 italic">📝 {s.notes}</p>}
                  <p className="text-neutral-medium/30 text-[9px] mt-2">🔄 {s.created_at ? new Date(s.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(s.id!); }}
                  className="absolute bottom-4 right-4 z-20 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Xóa
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SettlementListView;
