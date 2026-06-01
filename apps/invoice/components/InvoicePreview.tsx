
import React from 'react';
import { InvoiceData } from '@/types';

interface InvoicePreviewProps {
  data: InvoiceData;
}

const LOGO_URL_DARK = "https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/logo_td.png";
const LOGO_URL_LIGHT = "https://pub-dad8a9bea8cb47c7ac0a03614d43b5b1.r2.dev/logo/logo_td_black.png";

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ data }) => {
  const subtotal = data.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const discountAmount = data.discountType === 'percentage'
    ? subtotal * (data.discountValue / 100)
    : data.discountValue;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = afterDiscount * (data.taxRate / 100);
  const total = afterDiscount + taxAmount;

  const isDark = data.theme === 'dark';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(data.currency === 'VND' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency: data.currency
    }).format(val);
  };

  const themeStyles = {
    container: isDark ? 'bg-[#1A1A1A] text-[#F2F2F2]' : 'bg-[#FDFDFD] text-[#1A202C]',
    border: isDark ? 'border-[#3A3A3A]' : 'border-[#E2E8F0]',
    muted: isDark ? 'text-[#A0A0A0]' : 'text-[#4A5568]',
    accent: 'text-[#FF9500]',
    card: isDark ? 'bg-[#242424] border-[#3A3A3A]' : 'bg-white border-[#FF9500]/10 shadow-sm',
    tableText: isDark ? 'text-[#F2F2F2]' : 'text-[#1A202C]',
    summaryRow: isDark ? 'bg-white/5' : 'bg-white shadow-sm border border-[#FF9500]/10',
  };

  const hasDiscount = data.discountValue > 0;
  const hasTax = data.taxRate > 0;

  return (
    <div
      id="invoice-capture"
      className={`${themeStyles.container} p-10 md:p-12 w-full max-w-[850px] mx-auto relative`}
      style={{ boxSizing: 'border-box', minHeight: 'fit-content' }}
    >
      {/* Watermark Status */}
      {data.status === 'paid' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-[0.05] pointer-events-none z-0">
          <h1 className="text-[140px] font-black border-[15px] border-[#4CAF50] text-[#4CAF50] px-10 rounded-[60px] uppercase whitespace-nowrap">PAID</h1>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-10 relative z-10">
        <div>
          <div className="mb-4">
            <img
              src={isDark ? LOGO_URL_DARK : LOGO_URL_LIGHT}
              alt="TD Games Logo"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://picsum.photos/seed/tdgames/200/200";
              }}
              className="w-16 h-auto drop-shadow-[0_0_15px_rgba(255,149,0,0.4)]"
            />
          </div>
          <div className="mb-3">
            <h1 className="text-5xl font-black text-[#FF9500] uppercase tracking-tighter leading-none">Invoice</h1>
          </div>
          <div className={`${themeStyles.muted} text-[11px] space-y-1`}>
            <p className="font-bold text-sm text-[#FF9500] uppercase mb-0.5 tracking-wide">{data.studioInfo.name}</p>
            <p className="max-w-[300px] leading-relaxed">{data.studioInfo.address}</p>
            <p className="font-bold underline decoration-[#FF9500]/40">{data.studioInfo.email}</p>
            <p className="pt-0.5 font-bold">Tax ID: <span className={isDark ? 'text-white' : 'text-[#1A202C]'}>{data.studioInfo.taxCode}</span></p>
          </div>
        </div>

        <div className={`${themeStyles.card} border-l-[8px] border-[#FF9500] p-6 rounded-r-3xl w-72 shadow-xl`}>
          <div className="mb-4">
            <span className={`${themeStyles.muted} text-[10px] font-black uppercase tracking-[0.2em] block mb-1.5 opacity-70`}>Invoice Number</span>
            <span className="text-2xl font-black block tracking-tight">{data.invoiceNumber}</span>
            {data.poNumber && (
              <div className="mt-1.5">
                <span className={`${themeStyles.muted} text-[9px] font-black uppercase opacity-70`}>PO Number: </span>
                <span className="text-[13px] font-bold">{data.poNumber}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#FF9500]/20">
            <div>
              <span className={`${themeStyles.muted} text-[9px] font-black uppercase block mb-1 opacity-70`}>Issue Date</span>
              <span className="text-[13px] font-bold block">{data.issueDate}</span>
            </div>
            <div className="text-right">
              <span className={`${themeStyles.muted} text-[9px] font-black uppercase block mb-1 opacity-70`}>Due Date</span>
              <span className="text-[13px] font-black block text-[#FF9500]">{data.dueDate || '---'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-8 relative z-10">
        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FF9500] mb-5 border-b border-[#FF9500]/20 pb-3">Client Information</h2>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-2xl font-black mb-2">{data.clientInfo.name || '---'}</h3>
            <p className={`${themeStyles.muted} text-[13px] leading-relaxed max-w-[380px] font-bold`}>{data.clientInfo.address || '---'}</p>
            {(data.clientInfo.clientType || 'company') === 'company' && data.clientInfo.taxCode && (
              <p className={`${themeStyles.muted} text-[12px] font-bold mt-1`}>Tax ID: <span className={isDark ? 'text-white' : 'text-[#1A202C]'}>{data.clientInfo.taxCode}</span></p>
            )}
          </div>
          <div className="text-right space-y-2">
            <p className="text-[13px] font-black">
              <span className={`${themeStyles.muted} uppercase text-[10px] mr-2`}>
                {(data.clientInfo.clientType || 'company') === 'individual' ? 'Phone:' : 'Contact:'}
              </span>
              {data.clientInfo.contactPerson || '---'}
            </p>
            <p className="text-[13px] font-black"><span className={`${themeStyles.muted} uppercase text-[10px] mr-2`}>Email:</span> {data.clientInfo.email || '---'}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mb-10 relative z-10">
        <div className={`${isDark ? '' : 'bg-white rounded-[24px] overflow-hidden shadow-sm border border-[#FF9500]/10'}`}>
          <table className="w-full border-collapse table-fixed">
            <thead className={isDark ? 'border-b-2 border-[#FF9500]' : 'bg-[#FF9500]'}>
              <tr>
                <th className={`py-4 pl-8 text-left text-[11px] font-black uppercase w-[52px] ${isDark ? 'text-[#FF9500]' : 'text-black'}`}>#</th>
                <th className={`py-4 pl-4 text-left text-[11px] font-black uppercase w-auto ${isDark ? 'text-[#FF9500]' : 'text-black'}`}>Service Description</th>
                <th className={`py-4 text-center text-[11px] font-black uppercase w-[60px] ${isDark ? 'text-[#FF9500]' : 'text-black'}`}>Qty</th>
                <th className={`py-4 text-right text-[11px] font-black uppercase w-[130px] ${isDark ? 'text-[#FF9500]' : 'text-black'}`}>Unit Price</th>
                <th className={`py-4 pr-8 text-right text-[11px] font-black uppercase w-[140px] ${isDark ? 'text-[#FF9500]' : 'text-black'}`}>Total</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#FF9500]/10' : 'divide-[#FF9500]/5'}`}>
              {data.items.map((item, index) => (
                <tr key={item.id} className={isDark ? '' : 'bg-white'} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <td className={`py-5 pl-8 text-[13px] font-bold tabular-nums ${isDark ? 'text-[#FF9500]/60' : 'text-[#4A5568]'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className={`py-5 pl-4 text-[14px] font-black leading-snug ${themeStyles.tableText}`}>
                    {item.description}
                  </td>
                  <td className={`py-5 text-center text-[14px] font-bold tabular-nums ${themeStyles.tableText}`}>
                    {item.quantity}
                  </td>
                  <td className={`py-5 text-right text-[14px] font-bold tabular-nums ${themeStyles.tableText}`}>
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-5 pr-8 text-right text-[15px] font-black text-[#FF9500] tabular-nums">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Details */}
      <div className="grid grid-cols-12 gap-8 items-stretch relative z-10 pt-8 border-t-2 border-[#FF9500]/10">
        {/* Banking Info Column */}
        <div className="col-span-7">
          <h4 className="text-[11px] font-black uppercase text-[#FF9500] mb-4 tracking-[0.3em]">Banking Information</h4>
          <div className={`${themeStyles.card} border-2 border-[#FF9500]/10 p-6 rounded-[24px] space-y-4 shadow-md`}>
            <div>
              <span className={`${themeStyles.muted} text-[9px] font-black uppercase block mb-0.5 tracking-widest`}>Beneficiary Name</span>
              <span className="text-[13px] font-black block uppercase">{data.bankingInfo.accountName}</span>
            </div>

            <div>
              <span className={`${themeStyles.muted} text-[9px] font-black uppercase block mb-0.5 tracking-widest`}>Account Number</span>
              <span className="text-2xl font-black block text-[#FF9500] tracking-tight">{data.bankingInfo.accountNumber}</span>
            </div>

            <div>
              <span className={`${themeStyles.muted} text-[9px] font-black uppercase block mb-0.5 tracking-widest`}>Bank Name</span>
              <span className="text-[12px] font-bold block leading-snug">{data.bankingInfo.bankName}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#FF9500]/10">
              <div>
                <span className={`${themeStyles.muted} text-[9px] font-black uppercase block mb-0.5 tracking-widest`}>Swift Code</span>
                <span className="text-[12px] font-black block tracking-wider">{data.bankingInfo.swiftCode}</span>
              </div>
              <div>
                <span className={`${themeStyles.muted} text-[9px] font-black uppercase block mb-0.5 tracking-widest`}>Citad Code</span>
                <span className="text-[12px] font-black block tracking-wider">{data.bankingInfo.citadCode}</span>
              </div>
            </div>

            <div className="pt-1">
              <span className={`${themeStyles.muted} text-[9px] font-black uppercase block mb-0.5 tracking-widest`}>Branch & Address</span>
              <span className="text-[11px] font-bold block leading-relaxed italic">{[data.bankingInfo.branchName, data.bankingInfo.bankAddress].filter(Boolean).join(' — ')}</span>
            </div>
          </div>
        </div>

        {/* Totals Column */}
        <div className="col-span-5 flex flex-col justify-end space-y-3">
          {/* Subtotal */}
          <div className={`flex justify-between items-center px-6 py-4 rounded-2xl ${themeStyles.summaryRow}`}>
            <span className={`${themeStyles.muted} text-[11px] font-black uppercase tracking-[0.15em]`}>Subtotal</span>
            <span className="text-lg font-black tabular-nums">{formatCurrency(subtotal)}</span>
          </div>

          {/* Discount Row — only show if discount > 0 */}
          {hasDiscount && (
            <div className={`flex justify-between items-center px-6 py-4 rounded-2xl ${themeStyles.summaryRow}`}>
              <span className={`${themeStyles.muted} text-[11px] font-black uppercase tracking-[0.15em]`}>
                Discount {data.discountType === 'percentage' ? `(${data.discountValue}%)` : ''}
              </span>
              <span className="text-lg font-black tabular-nums text-[#4CAF50]">− {formatCurrency(discountAmount)}</span>
            </div>
          )}

          {/* Tax Row — only show if tax > 0 */}
          {hasTax && (
            <div className={`flex justify-between items-center px-6 py-4 rounded-2xl ${themeStyles.summaryRow}`}>
              <span className={`${themeStyles.muted} text-[11px] font-black uppercase tracking-[0.15em]`}>Tax ({data.taxRate}%)</span>
              <span className="text-lg font-black tabular-nums">{formatCurrency(taxAmount)}</span>
            </div>
          )}

          {/* Grand Total */}
          <div className="bg-[#FF9500] h-36 rounded-[36px] flex flex-col items-center justify-center text-center relative overflow-hidden px-6">
            <span className="text-[11px] font-black uppercase text-black/60 tracking-[0.4em] mb-2 leading-none">Grand Total Amount</span>
            <span className="text-[38px] font-black text-black tracking-tighter leading-none tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Decorative Footer */}
      <div className="mt-12 flex justify-between items-end border-t border-[#FF9500]/10 pt-8">
        <div>
          <p className={`${themeStyles.muted} text-[10px] font-black uppercase tracking-[0.4em]`}>Thank you for your business!</p>
          {data.serviceLocation && (
            <p className={`${themeStyles.muted} text-[12px] mt-1 italic opacity-80`}>{data.serviceLocation}</p>
          )}
        </div>
        <div className="text-right">
          <img
            src={isDark
              ? 'https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/chuky_white.png'
              : 'https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/chuky.png'}
            alt="Authorized Signature"
            className="h-16 w-auto ml-auto mb-2 object-contain"
          />
          <div className="w-48 h-[2px] bg-[#FF9500]/30 mb-3 ml-auto" />
          <p className={`${themeStyles.muted} text-[10px] font-black uppercase tracking-widest`}>Authorized Signature</p>
        </div>
      </div>
    </div>
  );
};
