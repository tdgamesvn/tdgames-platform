import { COMPANY_CONFIG, CompanyId } from '../shared/CompanySelector';
import { Worker, WorkforceTask, Settlement } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  sent: 'Đã gửi',
  accepted: 'Đã chấp nhận',
  paid: 'Đã thanh toán',
};

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

export async function exportSettlementPdf(
  settlement: Settlement,
  tasks: WorkforceTask[],
  workers: Worker[],
  vcbSellRate: number,
  companyId: CompanyId
): Promise<void> {
  const company = COMPANY_CONFIG[companyId];
  const workerName = settlement.worker?.full_name || workers.find(w => w.id === settlement.worker_id)?.full_name || '???';
  const logoBase64 = await convertLogoToBase64(company.logo);

  const taskRows = tasks.map((t, i) => {
    const effectiveRate = t.currency === 'USD' ? (t.payment_status === 'paid' && t.exchange_rate > 0 ? t.exchange_rate : vcbSellRate) : 0;
    const vndEquiv = t.currency === 'USD' && effectiveRate > 0 ? (t.price * effectiveRate).toLocaleString() : '';
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#666">${i + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;max-width:250px">${t.title}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap">${t.clickup_folder_name || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap">${t.closed_date || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${t.price > 0 ? t.price.toLocaleString() : '—'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${t.currency}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#666">${vndEquiv}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#d97706">${t.bonus > 0 ? t.bonus.toLocaleString() : ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#666;font-size:11px">${t.bonus_note || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#666;font-size:11px">${t.notes || ''}</td>
    </tr>`;
  }).join('');

  const totalPrice = tasks.reduce((s, t) => s + (t.price || 0), 0);
  const totalBonus = tasks.reduce((s, t) => s + (t.bonus || 0), 0);
  const totalVND = tasks.reduce((s, t) => {
    if (t.currency === 'USD') {
      const rate = t.payment_status === 'paid' && t.exchange_rate > 0 ? t.exchange_rate : vcbSellRate;
      return rate > 0 ? s + t.price * rate : s;
    }
    if (t.currency === 'VND') return s + t.price;
    return s;
  }, 0);
  const totalBonusVND = tasks.reduce((s, t) => {
    if (t.currency === 'USD') {
      const rate = t.payment_status === 'paid' && t.exchange_rate > 0 ? t.exchange_rate : vcbSellRate;
      return rate > 0 ? s + (t.bonus || 0) * rate : s;
    }
    if (t.currency === 'VND') return s + (t.bonus || 0);
    return s;
  }, 0);

  // Worker info for BÊN B
  const w = settlement.worker || workers.find(wk => wk.id === settlement.worker_id);

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nghiệm thu - ${workerName} - ${settlement.period}</title>
  <style>
    body{font-family:'Segoe UI',Roboto,sans-serif;margin:40px;color:#222;font-size:13px}
    h1{font-size:24px;margin:0;color:#111}
    h2{font-size:16px;margin:0;color:#555;font-weight:400}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #f59e0b;padding-bottom:20px}
    .logo-row{display:flex;align-items:center;gap:12px}
    .logo-row img{width:48px;height:48px;object-fit:contain}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px}
    .party-box{padding:14px 16px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb}
    .party-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#333;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #f59e0b}
    .party-info{font-size:12.5px;line-height:1.7}
    .party-info .label{color:#666;display:inline-block;width:100px}
    .party-info .value{color:#111;font-weight:500}
    .party-info .value b{font-weight:700;font-size:13px}
    .settlement-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;padding:10px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px}
    .settlement-meta .label{font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#92400e;font-weight:600}
    .settlement-meta .val{font-weight:700;color:#222;font-size:14px}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}
    tr{page-break-inside:avoid;break-inside:avoid}
    thead{display:table-header-group}
    th{padding:10px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #222;white-space:nowrap}
    .totals{margin-top:20px;text-align:right;font-size:14px;page-break-inside:avoid;break-inside:avoid}
    .totals .row{padding:6px 0;display:flex;justify-content:flex-end;gap:20px}
    .totals .grand{font-size:18px;font-weight:700;color:#f59e0b;border-top:2px solid #222;padding-top:10px;margin-top:5px}
    .footer{margin-top:60px;display:flex;justify-content:space-between;page-break-inside:avoid;break-inside:avoid}
    .sig{text-align:center;width:220px}
    .sig .sig-title{font-size:12px;font-weight:700;text-transform:uppercase;color:#333}
    .sig .sig-note{font-size:10px;font-style:italic;color:#888;margin-top:2px}
    .sig .line{margin-top:70px;border-top:1px solid #333;padding-top:5px;font-weight:600}
    @media print{@page{margin:10mm 12mm}body{margin:0}}
  </style></head><body>
  <div class="header">
    <div class="logo-row">${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ''}<div><h1>NGHIỆM THU CÔNG VIỆC</h1><h2>${company.subtitle}</h2></div></div>
    <div style="text-align:right"><div style="font-size:11px;color:#666">Kỳ nghiệm thu</div>
      <div style="font-size:20px;font-weight:700">${settlement.period}</div>
      <div style="font-size:11px;color:#666;margin-top:4px">Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}</div>
      <div style="font-size:11px;margin-top:4px;font-weight:600;color:${settlement.account_type === 'personal' ? '#059669' : '#d97706'}">${settlement.account_type === 'personal' ? '👤 TK Cá nhân' : '🏢 TK Công ty'}</div>
    </div>
  </div>
  <div class="parties">
    <div class="party-box">
      <div class="party-title">BÊN A — Bên thuê dịch vụ</div>
      <div class="party-info">
        <div><span class="label">Tên công ty</span><span class="value">: <b>${company.fullName}</b></span></div>
        <div><span class="label">Địa chỉ</span><span class="value">: ${company.address}</span></div>
        <div><span class="label">Mã số thuế</span><span class="value">: ${company.taxCode}</span></div>
        <div><span class="label">Đại diện</span><span class="value">: ${company.gender} <b>${company.representative}</b></span></div>
        <div><span class="label">Chức vụ</span><span class="value">: ${company.representativeTitle}</span></div>
      </div>
    </div>
    <div class="party-box">
      <div class="party-title">BÊN B — Cá nhân cung cấp dịch vụ</div>
      <div class="party-info">
        <div><span class="label">Họ và tên</span><span class="value">: <b>${w?.full_name || '—'}</b></span></div>
        <div><span class="label">Điện thoại</span><span class="value">: ${w?.phone || '—'}</span></div>
        <div><span class="label">Email</span><span class="value">: ${w?.email || '—'}</span></div>
        <div><span class="label">Ngân hàng</span><span class="value">: ${w?.bank_name || '—'}</span></div>
        <div><span class="label">Số tài khoản</span><span class="value">: <b>${w?.bank_account || '—'}</b></span></div>
        <div><span class="label">Chủ tài khoản</span><span class="value">: ${w?.full_name || '—'}</span></div>
      </div>
    </div>
  </div>
  <div class="settlement-meta">
    <div><div class="label">Số lượng task</div><div class="val">${tasks.length}</div></div>
    <div><div class="label">Trạng thái</div><div class="val">${STATUS_LABELS[settlement.status]}</div></div>
    ${settlement.notes ? `<div><div class="label">Ghi chú</div><div class="val" style="font-size:12px;font-weight:400">${settlement.notes}</div></div>` : `<div></div>`}
  </div>
  <table>
    <thead><tr>
      <th style="text-align:center">#</th><th>Task</th><th>Project</th><th>Ngày đóng</th>
      <th style="text-align:right">Giá</th><th style="text-align:center">Tiền tệ</th><th style="text-align:right">Quy đổi VNĐ</th>
      <th style="text-align:right">Bonus</th><th>Lý do</th><th>Ghi chú</th>
    </tr></thead>
    <tbody>${taskRows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Tổng giá tasks:</span><b>${totalPrice.toLocaleString()} ${settlement.currency}</b></div>
    <div class="row"><span>Tổng bonus task:</span><b>${totalBonus.toLocaleString()} ${settlement.currency}</b></div>
    ${(settlement.bonus_amount || 0) > 0 ? `<div class="row" style="color:#d97706"><span>+ Bonus nghiệm thu (${settlement.bonus_type === 'percent' ? settlement.bonus_value + '%' : 'cố định'}):</span><b>+${(settlement.bonus_amount || 0).toLocaleString()} ${settlement.currency}</b></div>` : ''}
    ${totalVND > 0 ? `<div class="row"><span>Tổng quy đổi VNĐ:</span><b>${(totalVND + totalBonusVND).toLocaleString()} VNĐ</b></div>` : ''}
    ${(settlement.tax_rate || 0) > 0
      ? `<div class="row" style="color:#dc2626"><span>− Thuế TNCN (${settlement.tax_rate}%):</span><b>-${(settlement.tax_amount || 0).toLocaleString()} ${settlement.currency}</b></div>`
      : `<div class="row" style="color:#059669"><span>${settlement.account_type === 'personal' ? '👤 TT cá nhân — Miễn thuế TNCN' : 'Dưới 5tr/lần — không khấu trừ TNCN (NĐ 253/2026)'}:</span><b>0</b></div>`}
    <div class="row grand" style="color:#059669"><span>THỰC NHẬN:</span><span>${(settlement.net_amount || 0).toLocaleString()} ${settlement.currency}${settlement.currency !== 'VND' && totalVND > 0 ? ` <span style="font-size:14px;color:#666;font-weight:400">(≈ ${Math.round((totalVND + totalBonusVND) * (1 - (settlement.tax_rate ?? 0) / 100)).toLocaleString()} VNĐ)</span>` : ''}</span></div>
  </div>
  <div class="footer">
    <div class="sig"><div class="sig-title">Đại diện Bên A</div><div class="sig-note">(Ký, ghi rõ họ tên)</div><div class="line">${company.representative}</div></div>
    <div class="sig"><div class="sig-title">Đại diện Bên B</div><div class="sig-note">(Ký, ghi rõ họ tên)</div><div class="line">${workerName}</div></div>
  </div>
  </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
}
