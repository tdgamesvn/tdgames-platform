import React, { useState } from 'react';
import { InvoiceData } from '@/types';
import { Button } from '@/components/Button';
import { supabase } from '@/services/supabaseClient';

interface EmailModalProps {
  theme: string;
  invoice: InvoiceData;
  onClose: () => void;
  onSent: (to: string) => void;
}

export const EmailModal: React.FC<EmailModalProps> = ({ theme, invoice, onClose, onSent }) => {
  const [to, setTo] = useState(invoice.clientInfo?.email || '');
  const [subject, setSubject] = useState(`Invoice ${invoice.invoiceNumber} from ${invoice.studioInfo?.name || 'TD Games'}`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const calcTotal = () => {
    const sub = invoice.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
    const disc = invoice.discountType === 'percentage' ? sub * (invoice.discountValue / 100) : invoice.discountValue;
    return Math.max(0, sub - disc) * (1 + invoice.taxRate / 100);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(invoice.currency === 'VND' ? 'vi-VN' : 'en-US', { style: 'currency', currency: invoice.currency }).format(val);

  const buildEmailHtml = () => `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #1A1A1A; color: #F2F2F2; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #FF9500 0%, #FF6B00 100%); padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 800; letter-spacing: 2px;">INVOICE</h1>
        <p style="margin: 8px 0 0; color: rgba(0,0,0,0.6); font-size: 14px; font-weight: 600;">${invoice.invoiceNumber}</p>
      </div>
      <div style="padding: 32px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr><td style="color: #9D9C9D; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0;">From</td><td style="text-align: right; font-weight: 700;">${invoice.studioInfo?.name || ''}</td></tr>
          <tr><td style="color: #9D9C9D; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0;">To</td><td style="text-align: right; font-weight: 700;">${invoice.clientInfo?.name || ''}</td></tr>
          <tr><td style="color: #9D9C9D; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0;">Issue Date</td><td style="text-align: right; font-weight: 700;">${invoice.issueDate}</td></tr>
          <tr><td style="color: #9D9C9D; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0;">Due Date</td><td style="text-align: right; font-weight: 700;">${invoice.dueDate}</td></tr>
        </table>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="color: #9D9C9D; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">
              <th style="text-align: left; padding: 8px 0;">Item</th>
              <th style="text-align: center; padding: 8px 0;">Qty</th>
              <th style="text-align: right; padding: 8px 0;">Price</th>
              <th style="text-align: right; padding: 8px 0;">Total</th>
            </tr>
            ${invoice.items.map(i => `
              <tr style="border-top: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px 0; font-weight: 600;">${i.description}</td>
                <td style="text-align: center; padding: 10px 0;">${i.quantity}</td>
                <td style="text-align: right; padding: 10px 0;">${formatCurrency(i.unitPrice)}</td>
                <td style="text-align: right; padding: 10px 0; font-weight: 700;">${formatCurrency(i.quantity * i.unitPrice)}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        <div style="border-top: 2px solid #FF9500; padding-top: 16px; text-align: right;">
          <span style="color: #9D9C9D; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-right: 16px;">Total</span>
          <span style="font-size: 24px; font-weight: 800; color: #FF9500;">${formatCurrency(calcTotal())}</span>
        </div>
        <div style="margin-top: 32px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 12px;">
          <p style="color: #9D9C9D; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Banking Details</p>
          <p style="margin: 4px 0; font-weight: 600;">${invoice.bankingInfo?.accountName || ''}</p>
          <p style="margin: 4px 0; color: #9D9C9D;">${invoice.bankingInfo?.accountNumber || ''} — ${invoice.bankingInfo?.bankName || ''}</p>
          ${invoice.bankingInfo?.swiftCode ? `<p style="margin: 4px 0; color: #9D9C9D;">SWIFT: ${invoice.bankingInfo.swiftCode}</p>` : ''}
        </div>
      </div>
      <div style="text-align: center; padding: 16px; color: #404040; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">
        TD Games • Enterprise Platform
      </div>
    </div>
  `;

  const handleSend = async () => {
    if (!to) return setError('Please enter a recipient email.');
    setSending(true);
    setError(null);
    try {
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice-email`;
      // Phải gửi access_token của phiên, KHÔNG phải anon key: anon key nằm trong bundle JS
      // công khai nên nó không chứng minh được danh tính ai cả. Edge function dùng token này
      // để kiểm caller là admin/ke_toan — thiếu nó thì hàm trả 401.
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({
          to, subject,
          html_body: buildEmailHtml(),
          invoice_id: invoice.id,
          invoice_number: invoice.invoiceNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send email');
      setSuccess(true);
      onSent(to);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const inputCls = `w-full px-4 py-3 rounded-xl text-sm font-bold border transition-colors ${theme === 'dark' ? 'bg-black/30 border-white/10 text-white focus:border-primary' : 'bg-gray-50 border-gray-200 text-black focus:border-primary'}`;
  const labelCls = `text-[10px] font-black uppercase tracking-widest mb-1 block ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className={`w-full max-w-lg p-8 rounded-[28px] border shadow-2xl animate-fadeInUp ${theme === 'dark' ? 'bg-[#1A1A1A] border-primary/20' : 'bg-white border-gray-200'}`}>
        {success ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-2xl bg-status-success/10 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✉️</span>
            </div>
            <h3 className={`text-xl font-black uppercase tracking-tighter mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Email Sent!</h3>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>Sent to {to} successfully</p>
            <Button onClick={onClose} variant="primary" size="sm">Close</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-black'}`}>✉️ Send Invoice Email</h3>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-neutral-medium hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className={labelCls}>Recipient</label>
                <input className={inputCls} type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="email@example.com" />
              </div>
              <div>
                <label className={labelCls}>Subject</label>
                <input className={inputCls} value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              {/* Preview card */}
              <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-gray-100 bg-gray-50'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Preview</p>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold">{invoice.invoiceNumber}</span>
                  <span className="text-primary font-black text-sm">{formatCurrency(calcTotal())}</span>
                </div>
                <p className={`text-xs ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>
                  {invoice.studioInfo?.name} → {invoice.clientInfo?.name} • {invoice.issueDate}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-status-error/10 border border-status-error/20 text-status-error text-sm font-bold">
                ❌ {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Button onClick={onClose} variant="ghost" size="sm">Cancel</Button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-gradient-primary text-black transition-all hover:scale-[1.02] shadow-btn-glow disabled:opacity-50"
              >
                {sending ? '⏳ Sending...' : '📤 Send Email'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
