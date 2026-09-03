import { COMPANY_CONFIG, CompanyId } from '../shared/CompanySelector';

// ClickUp status color palette
const CLICKUP_STATUS_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  'approved':       { bg: 'bg-emerald-500/20', text: 'text-emerald-400', hex: '#10b981' },
  'complete':       { bg: 'bg-emerald-500/20', text: 'text-emerald-400', hex: '#10b981' },
  'closed':         { bg: 'bg-emerald-500/20', text: 'text-emerald-400', hex: '#10b981' },
  'client_review':  { bg: 'bg-amber-500/20',   text: 'text-amber-400',   hex: '#f59e0b' },
  'review':         { bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  hex: '#eab308' },
  'lead_check':     { bg: 'bg-orange-500/20',  text: 'text-orange-400',  hex: '#f97316' },
  'in progess':     { bg: 'bg-blue-500/20',    text: 'text-blue-400',    hex: '#3b82f6' },
  'in progress':    { bg: 'bg-blue-500/20',    text: 'text-blue-400',    hex: '#3b82f6' },
  'fix':            { bg: 'bg-red-500/20',     text: 'text-red-400',     hex: '#ef4444' },
  'new request':    { bg: 'bg-purple-500/20',  text: 'text-purple-400',  hex: '#a855f7' },
};

export const getClickupStatusStyle = (status: string) => {
  const lower = status.toLowerCase();
  const known = CLICKUP_STATUS_COLORS[lower];
  if (known) return { className: `${known.bg} ${known.text}`, hex: known.hex };
  return { className: 'bg-neutral-500/20 text-neutral-400', hex: '#9ca3af' };
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
};

interface AcceptanceTask {
  id?: string;
  title: string;
  clickup_status?: string;
  status?: string;
  closed_date?: string;
  clickup_list_name?: string;
  client_price: number;
  acceptance_note: string;
}

async function convertLogoToBase64(logoPath: string): Promise<string> {
  try {
    const resp = await fetch(logoPath);
    const blob = await resp.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/** Ngày nghiệm thu = ngày cuối tháng của period 'YYYY-MM'. Chứng từ theo kỳ, không dùng ngày đóng task nội bộ. */
export const periodEndDate = (period?: string): string => {
  if (!period) return '';
  const [y, m] = period.split('-').map(Number);
  return `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};

export async function exportAcceptancePdf(
  acceptance: {
    project_name: string;
    client_name: string;
    period?: string;
    status: string;
    notes?: string;
    discount_type?: string;
    discount_value?: number;
    account_type?: 'company' | 'personal';
  },
  tasks: AcceptanceTask[],
  companyId: CompanyId
): Promise<void> {
  const company = COMPANY_CONFIG[companyId];
  const logoBase64 = await convertLogoToBase64(company.logo);

  // Group tasks by clickup_list_name
  const pdfListGroups = new Map<string, AcceptanceTask[]>();
  tasks.forEach(t => {
    const listName = t.clickup_list_name || 'Other';
    if (!pdfListGroups.has(listName)) pdfListGroups.set(listName, []);
    pdfListGroups.get(listName)!.push(t);
  });

  let rowIdx = 0;
  const taskRows = Array.from(pdfListGroups.entries()).map(([listName, groupTasks]) => {
    const hdr = `<tr><td colspan="6" style="padding:10px 8px 6px;font-weight:800;font-size:12px;color:#1e293b;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:1px;background:#f8fafc">${listName} <span style="font-weight:400;font-size:10px;color:#94a3b8;margin-left:8px">${groupTasks.length} tasks</span></td></tr>`;
    const rows = groupTasks.map(t => {
      rowIdx++;
      const price = t.client_price || 0;
      const cs = t.clickup_status || t.status || '';
      const ss = getClickupStatusStyle(cs);
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#666">${rowIdx}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;max-width:380px">${t.title}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${ss.hex}15;color:${ss.hex};text-transform:capitalize">${cs}</span></td>
        <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap">${periodEndDate(acceptance.period) || t.closed_date || ''}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${price > 0 ? '$' + price.toLocaleString('en-US') : ''}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#888;font-size:11px">${t.acceptance_note || ''}</td>
      </tr>`;
    }).join('');
    return hdr + rows;
  }).join('');

  const totalClientPrice = tasks.reduce((s, t) => s + (t.client_price || 0), 0);
  const discountAmt = acceptance.discount_type === 'percent'
    ? totalClientPrice * (acceptance.discount_value || 0) / 100
    : (acceptance.discount_value || 0);
  const netTotal = Math.max(0, totalClientPrice - discountAmt);

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const hasDiscount = (acceptance.discount_value || 0) > 0;
  const discountRowHtml = hasDiscount ? `
    <div class="row"><span>Subtotal:</span><span>$${totalClientPrice.toLocaleString('en-US')}</span></div>
    <div class="row" style="color:#e74c3c"><span>Discount${acceptance.discount_type === 'percent' ? ` (${acceptance.discount_value}%)` : ''}:</span><span>-$${discountAmt.toLocaleString('en-US')}</span></div>
  ` : '';

  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Project Acceptance - ${acceptance.project_name}</title>
  <style>
    body{font-family:'Segoe UI',Roboto,sans-serif;margin:40px;color:#222;font-size:13px}
    h1{font-size:24px;margin:0;color:#111}
    h2{font-size:16px;margin:0;color:#555;font-weight:400}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;border-bottom:3px solid #3b82f6;padding-bottom:20px}
    .logo-row{display:flex;align-items:center;gap:12px}
    .logo-row img{width:48px;height:48px;object-fit:contain}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px;color:#555;margin-bottom:20px}
    .meta span{font-weight:700;color:#222;font-size:16px}
    table{width:100%;border-collapse:collapse;margin:20px 0;font-size:12px}
    tr{page-break-inside:avoid;break-inside:avoid}
    thead{display:table-header-group}
    th{padding:10px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #222;white-space:nowrap}
    .totals{margin-top:20px;text-align:right;font-size:14px;page-break-inside:avoid;break-inside:avoid}
    .totals .row{padding:6px 0;display:flex;justify-content:flex-end;gap:20px}
    .totals .grand{font-size:18px;font-weight:700;color:#3b82f6;border-top:2px solid #222;padding-top:10px;margin-top:5px}
    .footer{margin-top:60px;display:flex;justify-content:space-between;page-break-inside:avoid;break-inside:avoid}
    .sig{text-align:center;width:200px}
    .sig .line{margin-top:60px;border-top:1px solid #333;padding-top:5px;font-weight:600}
    @media print{@page{margin:10mm 12mm}body{margin:0}}
  </style></head><body>
  <div class="header">
    <div class="logo-row">${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ''}<div><h1>PROJECT ACCEPTANCE</h1><h2>${company.name}</h2></div></div>
    <div style="text-align:right"><div style="font-size:11px;color:#666">Date</div>
      <div style="font-size:16px;font-weight:700">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      ${acceptance.period ? `<div style="font-size:11px;color:#666;margin-top:4px">Period: ${acceptance.period}</div>` : ''}
      <div style="font-size:11px;margin-top:4px;font-weight:600;color:${acceptance.account_type === 'personal' ? '#059669' : '#d97706'}">${acceptance.account_type === 'personal' ? '👤 TK Cá nhân' : '🏢 TK Công ty'}</div>
    </div>
  </div>
  <div class="meta">
    <div>Client: <span>${acceptance.client_name}</span></div>
    <div>Project: <span>${acceptance.project_name}</span></div>
    <div>Total Tasks: <span>${tasks.length}</span></div>
    <div>Status: <span>${STATUS_LABELS[acceptance.status]}</span></div>
    ${acceptance.notes ? `<div style="grid-column:span 2">Notes: <span>${acceptance.notes}</span></div>` : ''}
  </div>
  <table>
    <thead><tr>
      <th style="text-align:center">#</th><th>Task Description</th><th>Status</th><th>Accepted</th>
      <th style="text-align:right">Amount (USD)</th><th>Notes</th>
    </tr></thead>
    <tbody>${taskRows}</tbody>
  </table>
  <div class="totals">
    ${discountRowHtml}
    <div class="row grand"><span>TOTAL:</span><span>$${netTotal.toLocaleString('en-US')}</span></div>
  </div>
  <div class="footer">
    <div class="sig"><div style="font-size:11px;color:#666">Service Provider</div><div class="line">${company.name}</div></div>
    <div class="sig"><div style="font-size:11px;color:#666">Client</div><div class="line">${acceptance.client_name}</div></div>
  </div>
  </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
}
