import React, { useState, useEffect } from 'react';
import { CrmClient } from '@/types';
import { InvoiceRecord, fetchInvoicesByClient } from '../services/crmService';

interface Props {
  clients: CrmClient[];
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  paid:     { label: 'Đã thanh toán', color: '#34C759', bg: 'rgba(52,199,89,0.12)' },
  sent:     { label: 'Đã gửi', color: '#0A84FF', bg: 'rgba(10,132,255,0.12)' },
  draft:    { label: 'Nháp', color: '#888', bg: 'rgba(136,136,136,0.12)' },
  overdue:  { label: 'Quá hạn', color: '#FF453A', bg: 'rgba(255,69,58,0.12)' },
};

const PaymentTracker: React.FC<Props> = ({ clients }) => {
  const [selectedClient, setSelectedClient] = useState('');
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadInvoices = async (clientName?: string) => {
    setIsLoading(true);
    try {
      const data = await fetchInvoicesByClient(clientName || undefined);
      setInvoices(data);
    } catch { } finally { setIsLoading(false); }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client) loadInvoices(client.name);
    } else {
      loadInvoices(); // Load all
    }
  };

  // Load all invoices on mount
  useEffect(() => {
    loadInvoices();
  }, []);

  const totalAmount = invoices.reduce((sum, inv) => {
    const invTotal = inv.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    return sum + invTotal;
  }, 0);
  const paidAmount = invoices.filter(i => i.status === 'paid').reduce((sum, inv) => {
    return sum + inv.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  }, 0);
  const unpaidAmount = totalAmount - paidAmount;
  const currency = invoices[0]?.currency || 'USD';

  return (
    <div className="animate-fadeInUp">
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>Thanh toán</h2>
        <p className="text-sm text-neutral-medium mt-1">Theo dõi tình trạng thanh toán (đồng bộ từ Invoice app)</p>
      </div>

      {/* Client selector */}
      <div style={{ marginBottom: '20px' }}>
        <select style={{
          width: '350px', padding: '12px 16px', background: '#1A1A1A', border: '1px solid #333',
          borderRadius: '10px', color: '#F5F5F5', fontSize: '14px', outline: 'none',
        }} value={selectedClient} onChange={e => handleClientChange(e.target.value)}>
          <option value="">Tất cả khách hàng</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      {invoices.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Tổng hóa đơn', value: invoices.length.toString(), color: '#F5F5F5' },
            { label: `Tổng giá trị (${currency})`, value: totalAmount.toLocaleString(), color: '#FF9500' },
            { label: 'Đã thanh toán', value: paidAmount.toLocaleString(), color: '#34C759' },
            { label: 'Chưa thanh toán', value: unpaidAmount.toLocaleString(), color: unpaidAmount > 0 ? '#FF453A' : '#34C759' },
          ].map(card => (
            <div key={card.label} style={{
              background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9D9C9D', marginBottom: '8px' }}>{card.label}</p>
              <p style={{ fontSize: '24px', fontWeight: 900, color: card.color }}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading && <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>Đang tải...</p>}

      {/* Invoice table */}
      {invoices.length > 0 && (
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1A1A1A' }}>
                {['Số HĐ', 'Khách hàng', 'Mô tả', 'Giá trị', 'Trạng thái', 'Ngày TT', 'Ngày tạo'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '14px 16px', fontSize: '11px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', borderBottom: '1px solid #222',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                const total = inv.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #1A1A1A' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1A1A1A')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 16px', color: '#F5F5F5', fontWeight: 700, fontSize: '13px' }}>{inv.invoice_number}</td>
                    <td style={{ padding: '14px 16px', color: '#aaa', fontSize: '13px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.client_name}</td>
                    <td style={{ padding: '14px 16px', color: '#aaa', fontSize: '13px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inv.items.map(it => it.description).join(', ')}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#FF9500', fontWeight: 800, fontSize: '13px' }}>
                      {total.toLocaleString()} {inv.currency}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', background: st.bg, color: st.color, textTransform: 'uppercase' }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#888', fontSize: '13px' }}>
                      {inv.paid_date ? new Date(inv.paid_date).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#666', fontSize: '13px' }}>
                      {new Date(inv.created_at).toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && invoices.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#555' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>💳</p>
          <p style={{ fontSize: '14px' }}>Chưa có hoá đơn nào{selectedClient ? ' cho khách hàng này' : ''}</p>
        </div>
      )}
    </div>
  );
};

export default PaymentTracker;
