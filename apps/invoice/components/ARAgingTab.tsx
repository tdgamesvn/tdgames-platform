import React, { useMemo, useState } from 'react';
import { InvoiceData } from '@/types';

interface Props {
  theme: string;
  history: InvoiceData[];
}

// ── Helpers ──────────────────────────────────────────────────
function calcTotal(inv: InvoiceData): number {
  const sub = inv.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const disc = inv.discountType === 'percentage' ? sub * (inv.discountValue / 100) : inv.discountValue;
  return Math.max(0, sub - disc) * (1 + inv.taxRate / 100);
}

function daysPastDue(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

function getBucket(dpd: number): AgingBucket {
  if (dpd <= 0) return 'current';
  if (dpd <= 30) return '1-30';
  if (dpd <= 60) return '31-60';
  if (dpd <= 90) return '61-90';
  return '90+';
}

const BUCKET_ORDER: AgingBucket[] = ['current', '1-30', '31-60', '61-90', '90+'];
const BUCKET_LABELS: Record<AgingBucket, string> = {
  'current': 'Chưa đến hạn',
  '1-30': '1–30 ngày',
  '31-60': '31–60 ngày',
  '61-90': '61–90 ngày',
  '90+': 'Trên 90 ngày',
};
const BUCKET_COLORS: Record<AgingBucket, string> = {
  'current': '#34C759',
  '1-30': '#FF9500',
  '31-60': '#FF6B00',
  '61-90': '#FF3B30',
  '90+': '#8B0000',
};

const fmt = (n: number, cur: string) =>
  cur === 'USD'
    ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + '₫';

// ── Component ─────────────────────────────────────────────────
const ARAgingTab: React.FC<Props> = ({ theme, history }) => {
  const dark = theme === 'dark';
  const [currency, setCurrency] = useState<'USD' | 'VND'>('USD');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Only unpaid invoices with a due date
  const unpaid = useMemo(() =>
    history.filter(inv =>
      inv.status !== 'paid' &&
      inv.status !== 'cancelled' &&
      inv.currency === currency &&
      inv.dueDate
    ), [history, currency]);

  // Per-client aging data
  const clientAging = useMemo(() => {
    const map: Record<string, { invoices: (InvoiceData & { dpd: number; bucket: AgingBucket; total: number })[] }> = {};
    unpaid.forEach(inv => {
      const name = inv.clientInfo?.name || 'Không rõ';
      if (!map[name]) map[name] = { invoices: [] };
      const dpd = daysPastDue(inv.dueDate!);
      const total = (inv as any).amount_received != null ? (inv as any).amount_received : calcTotal(inv);
      map[name].invoices.push({ ...inv, dpd, bucket: getBucket(dpd), total });
    });
    // Sort clients by total outstanding desc
    return Object.entries(map)
      .map(([client, data]) => {
        const buckets: Record<AgingBucket, number> = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
        data.invoices.forEach(inv => { buckets[inv.bucket] += inv.total; });
        const grandTotal = data.invoices.reduce((s, i) => s + i.total, 0);
        return { client, invoices: data.invoices, buckets, grandTotal };
      })
      .sort((a, b) => b.grandTotal - a.grandTotal);
  }, [unpaid]);

  // Summary totals by bucket
  const summary = useMemo(() => {
    const totals: Record<AgingBucket, number> = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    clientAging.forEach(c => BUCKET_ORDER.forEach(b => { totals[b] += c.buckets[b]; }));
    return totals;
  }, [clientAging]);

  const grandTotal = useMemo(() => Object.values(summary).reduce((s, v) => s + v, 0), [summary]);

  const cardBg = dark ? '#161616' : '#fff';
  const border = dark ? '#2a2a2a' : '#e5e7eb';
  const textMain = dark ? '#F5F5F5' : '#111';
  const textSub = dark ? '#888' : '#6b7280';

  return (
    <div className="animate-fadeInUp">
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            📊 AR Aging
          </h2>
          <p style={{ color: textSub, fontSize: 14, marginTop: 4 }}>
            Phân tích công nợ phải thu — {unpaid.length} hóa đơn chưa thanh toán
          </p>
        </div>
        {/* Currency toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['USD', 'VND'] as const).map(c => (
            <button key={c} onClick={() => setCurrency(c)} style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', fontWeight: 800,
              fontSize: 13, cursor: 'pointer',
              background: currency === c ? '#FF9500' : (dark ? '#222' : '#f3f4f6'),
              color: currency === c ? '#000' : textSub,
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {BUCKET_ORDER.map(bucket => (
          <div key={bucket} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: '18px 20px', borderTop: `3px solid ${BUCKET_COLORS[bucket]}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: BUCKET_COLORS[bucket], textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              {BUCKET_LABELS[bucket]}
            </p>
            <p style={{ fontSize: 22, fontWeight: 900, color: summary[bucket] > 0 ? BUCKET_COLORS[bucket] : textSub }}>
              {summary[bucket] > 0 ? fmt(summary[bucket], currency) : '—'}
            </p>
          </div>
        ))}
        <div style={{ background: dark ? 'rgba(255,149,0,0.1)' : '#fff7ed', border: `1px solid ${dark ? 'rgba(255,149,0,0.3)' : '#fed7aa'}`, borderRadius: 16, padding: '18px 20px', borderTop: '3px solid #FF9500' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>TỔNG CỘNG</p>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#FF9500' }}>{grandTotal > 0 ? fmt(grandTotal, currency) : '—'}</p>
        </div>
      </div>

      {/* No data */}
      {clientAging.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, background: cardBg, border: `1px solid ${border}`, borderRadius: 16 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🎉</p>
          <p style={{ fontWeight: 800, color: textMain, fontSize: 15 }}>Không có công nợ phải thu bằng {currency}</p>
          <p style={{ color: textSub, fontSize: 13, marginTop: 6 }}>Tất cả hóa đơn đã được thanh toán</p>
        </div>
      )}

      {/* Client Table */}
      {clientAging.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 0, padding: '12px 20px', borderBottom: `1px solid ${border}`, background: dark ? '#0F0F0F' : '#f9fafb' }}>
            {['Khách hàng', 'Chưa đến hạn', '1–30 ngày', '31–60 ngày', '61–90 ngày', 'Trên 90 ngày', 'Tổng'].map((h, i) => (
              <p key={h} style={{ fontSize: 10, fontWeight: 800, color: textSub, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i > 0 ? 'right' : 'left' }}>{h}</p>
            ))}
          </div>

          {clientAging.map(({ client, invoices, buckets, grandTotal: ct }) => (
            <div key={client}>
              {/* Client row */}
              <div
                onClick={() => setExpandedClient(expandedClient === client ? null : client)}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 0, padding: '14px 20px', borderBottom: `1px solid ${border}`, cursor: 'pointer', transition: 'background 0.15s', background: expandedClient === client ? (dark ? '#1a1a1a' : '#f0f9ff') : 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub }}>{expandedClient === client ? '▾' : '▸'}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: textMain }}>{client}</p>
                    <p style={{ fontSize: 11, color: textSub }}>{invoices.length} hóa đơn</p>
                  </div>
                </div>
                {BUCKET_ORDER.map(b => (
                  <p key={b} style={{ fontSize: 13, fontWeight: 700, color: buckets[b] > 0 ? BUCKET_COLORS[b] : textSub, textAlign: 'right' }}>
                    {buckets[b] > 0 ? fmt(buckets[b], currency) : '—'}
                  </p>
                ))}
                <p style={{ fontSize: 13, fontWeight: 900, color: '#FF9500', textAlign: 'right' }}>{fmt(ct, currency)}</p>
              </div>

              {/* Invoice detail rows */}
              {expandedClient === client && invoices
                .sort((a, b) => b.dpd - a.dpd)
                .map(inv => (
                  <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 0, padding: '10px 20px 10px 48px', borderBottom: `1px solid ${dark ? '#1a1a1a' : '#f3f4f6'}`, background: dark ? '#111' : '#f8fafc' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: textMain }}>{inv.invoiceNumber}</p>
                      <p style={{ fontSize: 11, color: textSub }}>
                        Hạn: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('vi-VN') : '—'}
                        {inv.dpd > 0 && <span style={{ color: BUCKET_COLORS[inv.bucket], marginLeft: 6, fontWeight: 700 }}>+{inv.dpd}d</span>}
                      </p>
                    </div>
                    {BUCKET_ORDER.map(b => (
                      <p key={b} style={{ fontSize: 12, color: inv.bucket === b ? BUCKET_COLORS[b] : 'transparent', fontWeight: 700, textAlign: 'right' }}>
                        {inv.bucket === b ? fmt(inv.total, currency) : '—'}
                      </p>
                    ))}
                    <p style={{ fontSize: 12, fontWeight: 700, color: textMain, textAlign: 'right' }}>{fmt(inv.total, currency)}</p>
                  </div>
                ))}
            </div>
          ))}

          {/* Grand total footer */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 0, padding: '14px 20px', background: dark ? '#0F0F0F' : '#f9fafb', borderTop: `2px solid ${border}` }}>
            <p style={{ fontSize: 12, fontWeight: 900, color: textMain, textTransform: 'uppercase' }}>TỔNG CỘNG</p>
            {BUCKET_ORDER.map(b => (
              <p key={b} style={{ fontSize: 13, fontWeight: 900, color: summary[b] > 0 ? BUCKET_COLORS[b] : textSub, textAlign: 'right' }}>
                {summary[b] > 0 ? fmt(summary[b], currency) : '—'}
              </p>
            ))}
            <p style={{ fontSize: 13, fontWeight: 900, color: '#FF9500', textAlign: 'right' }}>{fmt(grandTotal, currency)}</p>
          </div>
        </div>
      )}

      {/* Risk note */}
      {summary['61-90'] + summary['90+'] > 0 && (
        <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 12, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', fontSize: 13, color: '#FF3B30', fontWeight: 600 }}>
          ⚠️ Có {fmt(summary['61-90'] + summary['90+'], currency)} công nợ quá hạn trên 60 ngày — cần xử lý ngay để giảm rủi ro dòng tiền.
        </div>
      )}
    </div>
  );
};

export default ARAgingTab;
