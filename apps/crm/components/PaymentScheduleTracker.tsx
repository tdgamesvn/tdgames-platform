// apps/crm/components/PaymentScheduleTracker.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { CrmClient, AccountUser } from '@/types';
import { hasAnyRole } from '@/utils/roleUtils';
import {
  fetchAllPaymentSchedules,
  markPaymentScheduleInvoiced,
  markPaymentSchedulePaid,
  type PaymentScheduleWithProject,
} from '../services/crmPaymentScheduleService';

interface Props {
  clients: CrmClient[];
  currentUser: AccountUser | null;
}

function getStatus(s: PaymentScheduleWithProject) {
  if (s.status === 'paid')
    return { label: 'Đã thu tiền',     icon: '🟢', color: '#34C759', bg: 'rgba(52,199,89,0.12)' };
  if (s.status === 'invoiced')
    return { label: 'Đã xuất invoice', icon: '🔵', color: '#0A84FF', bg: 'rgba(10,132,255,0.12)' };
  const today = new Date().toISOString().slice(0, 10);
  if (s.due_date < today)
    return { label: 'Quá hạn',         icon: '🔴', color: '#FF453A', bg: 'rgba(255,69,58,0.12)' };
  return   { label: 'Chờ xuất',        icon: '🟡', color: '#FF9500', bg: 'rgba(255,149,0,0.12)' };
}

const fmt = (n: number, cur: string) =>
  cur === 'VND'
    ? n.toLocaleString('vi-VN') + ' ₫'
    : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const sel: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
  color: '#E5E5E5', padding: '8px 12px', fontSize: '12px', outline: 'none',
};

const PaymentScheduleTracker: React.FC<Props> = ({ clients, currentUser }) => {
  const [schedules, setSchedules]           = useState<PaymentScheduleWithProject[]>([]);
  const [loading, setLoading]               = useState(true);
  const [filterStatus, setFilterStatus]     = useState('all');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterMonth, setFilterMonth]       = useState('');
  const [actionOpenId, setActionOpenId]     = useState<string | null>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const canMarkStatus = hasAnyRole(currentUser, ['admin', 'ke_toan']);

  useEffect(() => {
    if (!actionOpenId) return;
    const handler = (e: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(e.target as Node))
        setActionOpenId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionOpenId]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAllPaymentSchedules({
        status:   filterStatus !== 'all' ? filterStatus : undefined,
        month:    filterMonth   || undefined,
        clientId: filterClientId || undefined,
      });
      setSchedules(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus, filterMonth, filterClientId]);

  const today        = new Date().toISOString().slice(0, 10);
  const nextMonthStr = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); })();
  const activeMonth  = filterMonth || nextMonthStr;
  const upcomingLabel = new Date(activeMonth + '-02').toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  const overdue  = schedules.filter(s => s.status === 'pending' && s.due_date < today);
  const upcoming = schedules.filter(s => s.status === 'pending' && s.due_date >= today && s.due_date.startsWith(activeMonth));
  const invoiced = schedules.filter(s => s.status === 'invoiced');

  const renderRow = (s: PaymentScheduleWithProject) => {
    const isActionOpen = actionOpenId === s.id;
    return (
      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#E5E5E5', margin: 0 }}>{s.project_name} – {s.name}</p>
          <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>{s.client_name}</p>
        </div>
        <span style={{ fontSize: '13px', fontWeight: 900, color: '#F5F5F5', whiteSpace: 'nowrap' }}>{fmt(s.amount, s.currency)}</span>
        <span style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>Hạn: {s.due_date}</span>
        {canMarkStatus && s.status !== 'paid' && (
          <div style={{ position: 'relative' }} ref={isActionOpen ? actionRef : undefined}>
            <button type="button" onClick={() => setActionOpenId(isActionOpen ? null : s.id)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">
              Action ▾
            </button>
            {isActionOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', zIndex: 50, minWidth: '210px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                {s.status === 'pending' && (
                  <button type="button" onClick={async () => { await markPaymentScheduleInvoiced(s.id); setActionOpenId(null); await load(); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#0A84FF', background: 'none', border: 'none', cursor: 'pointer' }}>
                    🔵 Đánh dấu đã xuất invoice
                  </button>
                )}
                <button type="button" onClick={async () => { await markPaymentSchedulePaid(s.id); setActionOpenId(null); await load(); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#34C759', background: 'none', border: 'none', cursor: 'pointer' }}>
                  🟢 Đánh dấu đã thu tiền
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (icon: string, title: string, items: PaymentScheduleWithProject[], color: string) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: '16px', background: '#111', border: `1px solid ${color}30`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', background: `${color}10`, borderBottom: `1px solid ${color}20` }}>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>{icon} {title} ({items.length})</span>
        </div>
        <div>{items.map(renderRow)}</div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sel}>
          <option value="all">Tất cả trạng thái</option>
          <option value="overdue">🔴 Quá hạn</option>
          <option value="pending">🟡 Chờ xuất</option>
          <option value="invoiced">🔵 Đã xuất invoice</option>
          <option value="paid">🟢 Đã thu</option>
        </select>
        <select value={filterClientId} onChange={e => setFilterClientId(e.target.value)} style={sel}>
          <option value="">Tất cả khách hàng</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={sel} />
        {filterMonth && (
          <button type="button" onClick={() => setFilterMonth('')}
            style={{ fontSize: '11px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Xoá filter tháng
          </button>
        )}
      </div>
      {loading ? (
        <p style={{ color: '#555', fontSize: '13px' }}>Đang tải...</p>
      ) : (
        <>
          {renderGroup('🔴', 'QUÁ HẠN', overdue, '#FF453A')}
          {renderGroup('🟡', `SẮP ĐẾN HẠN – ${upcomingLabel}`, upcoming, '#FF9500')}
          {renderGroup('🔵', 'ĐÃ XUẤT INVOICE – chờ thu', invoiced, '#0A84FF')}
          {overdue.length === 0 && upcoming.length === 0 && invoiced.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: '#555', fontSize: '13px', fontStyle: 'italic' }}>Không có dữ liệu phù hợp với bộ lọc hiện tại.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentScheduleTracker;
