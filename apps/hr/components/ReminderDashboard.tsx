import React from 'react';
import { HrReminder, HrEmployee } from '@/types';

interface Props {
  reminders: (HrReminder & { employee?: any })[];
  onGenerate: () => void;
  onDismiss: (id: string) => void;
}

const TYPE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  contract_expiry: { icon: '⚠️', label: 'Hợp đồng hết hạn', color: '#FF9500' },
  birthday: { icon: '🎂', label: 'Sinh nhật', color: '#FF375F' },
  evaluation: { icon: '📋', label: 'Đánh giá năng lực', color: '#0A84FF' },
  work_permit: { icon: '💉', label: 'Giấy phép lao động', color: '#AF52DE' },
  freelancer_payment: { icon: '💳', label: 'Thanh toán freelancer', color: '#34C759' },
  probation_end: { icon: '📋', label: 'Hết thử việc', color: '#FF6B00' },
  anniversary: { icon: '🎉', label: 'Kỷ niệm', color: '#5856D6' },
  performance_review: { icon: '🔄', label: 'Review định kỳ', color: '#30D158' },
  bhxh_payment_deadline: { icon: '🛡️', label: 'Hạn nộp BHXH', color: '#0A84FF' },
  bhxh_missing_insurance: { icon: '🛡️', label: 'Thiếu mã BHXH', color: '#FF9500' },
  bhxh_new_employee: { icon: '🛡️', label: 'Đăng ký BHXH', color: '#AF52DE' },
  bhxh_salary_change: { icon: '🛡️', label: 'Cập nhật BHXH', color: '#FFD60A' },
};

const ReminderDashboard: React.FC<Props> = ({ reminders, onGenerate, onDismiss }) => {
  const today = new Date();
  const getDaysUntil = (date: string) => {
    const d = new Date(date);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  };

  const getUrgencyColor = (days: number) => {
    if (days < 0) return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'Quá hạn' };
    if (days <= 7) return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: `${days} ngày` };
    if (days <= 15) return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', badge: `${days} ngày` };
    if (days <= 30) return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', badge: `${days} ngày` };
    return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: `${days} ngày` };
  };

  const sorted = [...reminders].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const urgentCount = reminders.filter(r => getDaysUntil(r.due_date) <= 7).length;
  const soonCount = reminders.filter(r => { const d = getDaysUntil(r.due_date); return d > 7 && d <= 30; }).length;

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-0 md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF375F' }}>Nhắc việc</h2>
          <p className="text-neutral-medium text-sm mt-1">Cảnh báo & nhắc nhở tự động</p>
        </div>
        <button onClick={onGenerate} className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all" style={{ background: 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>
          🔄 Quét nhắc nhở
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Tổng nhắc nhở</p>
          <p className="text-3xl font-black" style={{ color: '#FF375F' }}>{reminders.length}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-red-500/20 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">🔴 Khẩn cấp (≤7 ngày)</p>
          <p className="text-3xl font-black text-red-400">{urgentCount}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-orange-500/20 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">🟡 Sắp tới (≤30 ngày)</p>
          <p className="text-3xl font-black text-orange-400">{soonCount}</p>
        </div>
      </div>

      {/* Empty */}
      {sorted.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-emerald-500/10">
            <span className="text-4xl">✅</span>
          </div>
          <p className="text-neutral-medium text-sm">Không có nhắc nhở nào. Nhấn "Quét nhắc nhở" để kiểm tra.</p>
        </div>
      )}

      {/* Reminder List */}
      {sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map(r => {
            const days = getDaysUntil(r.due_date);
            const urg = getUrgencyColor(days);
            const typeInfo = TYPE_LABELS[r.type] || { icon: '🔔', label: r.type, color: '#888' };

            return (
              // ponytail: badge hạn + nút bên phải giành chỗ, ép cụm trái bóp lại → nhãn loại
              // rớt 3 dòng trên 390px. Cho wrap 2 tầng; md+ vẫn 1 hàng như cũ.
              <div key={r.id} className={`relative rounded-[16px] border ${urg.border} ${urg.bg} p-5 flex flex-wrap items-center justify-between gap-3 group transition-all`}>
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="text-2xl">{typeInfo.icon}</span>
                  <div>
                    <p className="text-white font-bold text-sm">{r.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md" style={{ background: `${typeInfo.color}20`, color: typeInfo.color }}>{typeInfo.label}</span>
                      {r.employee && (
                        <span className="text-neutral-medium text-xs">👤 {r.employee.full_name}</span>
                      )}
                      <span className="text-neutral-medium/60 text-xs">📅 {r.due_date}</span>
                    </div>
                    {r.notes && <p className="text-neutral-medium/60 text-xs mt-1">{r.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black ${urg.text}`}>{urg.badge}</span>
                  <button onClick={() => onDismiss(r.id)} className="p-2 rounded-lg hover:bg-white/10 text-neutral-medium hover:text-white opacity-0 group-hover:opacity-100 transition-all" title="Bỏ qua">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReminderDashboard;
