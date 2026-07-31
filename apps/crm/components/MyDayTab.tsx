import React, { useEffect, useState } from 'react';
import { AccountUser, MyDayData, CrmDeal } from '@/types';
import { hasAnyRole } from '@/utils/roleUtils';
import { fetchMyDay } from '../services/crmService';

const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const fmtValue = (v: number, cur: string) => `${cur === 'USD' ? '$' : ''}${v.toLocaleString()}${cur === 'VND' ? '₫' : ''}`;

const Section: React.FC<{ title: string; hint: string; count: number; color: string; empty: string; children: React.ReactNode }> =
  ({ title, hint, count, color, empty, children }) => (
    <div className="bg-surface border border-primary/10 rounded-[20px] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">{title}</p>
          {count > 0 && <p className="text-[10px] text-neutral-500 mt-0.5">{hint}</p>}
        </div>
        <span className="text-2xl font-black shrink-0" style={{ color }}>{count}</span>
      </div>
      {count === 0 ? <p className="text-xs text-neutral-600">{empty}</p> : children}
    </div>
  );

const DealRow: React.FC<{ deal: CrmDeal; onClick: () => void; note?: string }> = ({ deal, onClick, note }) => (
  <button onClick={onClick} className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-primary/10 hover:border-primary/20 transition-all cursor-pointer">
    <div className="min-w-0">
      <p className="text-xs font-semibold text-white truncate">{deal.title}</p>
      <p className="text-[10px] text-neutral-500 truncate">{deal.client_name} · {fmtValue(deal.value, deal.currency)}</p>
    </div>
    {note && <span className="text-[10px] font-black text-status-error whitespace-nowrap">{note}</span>}
  </button>
);

const MyDayTab: React.FC<{ currentUser: AccountUser; onOpenDeals: () => void; onOpenClients: () => void }> =
  ({ currentUser, onOpenDeals, onOpenClients }) => {
  const [data, setData] = useState<MyDayData | null>(null);
  const isManager = hasAnyRole(currentUser, ['admin', 'ke_toan']);

  useEffect(() => {
    fetchMyDay(currentUser.id, isManager).then(setData).catch(() => setData(null));
  }, [currentUser.id, isManager]);

  if (!data) return <p className="text-neutral-500 text-sm animate-td-pulse text-center py-10">Đang tải việc hôm nay...</p>;

  const daysOverdue = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

  return (
    <div className="animate-fadeInUp grid grid-cols-1 md:grid-cols-2 gap-4">
      <Section title="Follow-up quá hạn" hint="Bấm để mở deal & đặt lịch follow-up mới" count={data.overdueFollowups.length} color="#FF3B30" empty="Sạch — không có follow-up trễ 💪">
        {data.overdueFollowups.map(d => (
          <DealRow key={d.id} deal={d} onClick={onOpenDeals}
            note={daysOverdue(d.next_follow_up!) > 0 ? `trễ ${daysOverdue(d.next_follow_up!)} ngày` : 'hôm nay'} />
        ))}
      </Section>
      <Section title="Deal chưa có bước tiếp theo" hint="Bấm để mở deal & thêm next step" count={data.noNextStep.length} color="#FF9500" empty="Mọi deal đều có next step ✅">
        {data.noNextStep.map(d => <DealRow key={d.id} deal={d} onClick={onOpenDeals} note="đặt follow-up" />)}
      </Section>
      <Section title="Báo giá sắp hết hạn (7 ngày)" hint="Bấm để mở deal & gia hạn hoặc chốt báo giá" count={data.expiringQuotes.length} color="#0A84FF" empty="Không có báo giá nào cần chốt">
        {data.expiringQuotes.map(q => (
          <button key={q.id} onClick={onOpenDeals} className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-primary/10 hover:border-primary/20 transition-all cursor-pointer">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{q.quotation_number} · {q.title}</p>
              <p className="text-[10px] text-neutral-500">{q.client_name} · {fmtValue(q.total, q.currency)}</p>
            </div>
            <span className="text-[10px] font-black text-status-warning whitespace-nowrap">hạn {fmtDate(q.valid_until)}</span>
          </button>
        ))}
      </Section>
      <Section title="Khách nguội (90 ngày im lặng)" hint="Không có activity/báo giá/deal cập nhật 90 ngày — bấm để liên hệ lại" count={data.coldClients.length} color="#AF52DE" empty="Mọi khách active đều có tương tác gần đây">
        {data.coldClients.map(c => (
          <button key={c.id} onClick={onOpenClients} className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-primary/10 hover:border-primary/20 transition-all cursor-pointer">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{c.name}</p>
              <p className="text-[10px] text-neutral-500 truncate">{c.country} · {c.industry}</p>
            </div>
            <span className="text-[10px] font-black text-status-info whitespace-nowrap">liên hệ lại</span>
          </button>
        ))}
      </Section>
    </div>
  );
};

export default MyDayTab;
