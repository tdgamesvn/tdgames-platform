import { CrmClient, CrmContact } from '@/types';
import { COMPANY_OPTIONS, CompanyKey } from '@/apps/hr/services/contractService';
import { supabase } from '@/services/supabaseClient';
import { cleanScopeHtml } from './scopeHtml';

// Re-export for convenience
export { COMPANY_OPTIONS, printContract } from '@/apps/hr/services/contractService';
export type { CompanyKey } from '@/apps/hr/services/contractService';

// ══════════════════════════════════════════════════════════════
// ── Types ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export interface PaymentPhase {
  label: string;
  percentage: number;
  amount: number;
  description: string;
}

export interface ClientContractData {
  // Contract
  contractNumber: string;
  signingDate: string;
  companyKey: CompanyKey;
  // Party A (client)
  clientName: string;
  clientAddress: string;
  clientTaxCode: string;
  clientRepresentative: string;
  clientRepresentativeTitle: string;
  // Project
  projectName: string;
  // Scope
  scopeContent: string;
  // Timeline
  startDate: string;
  estimatedDuration: string;
  estimatedCompletion: string;
  /** 'domestic' = khách Việt Nam (bắt buộc VND, toà án VN); 'international' = khách nước ngoài */
  contractType: 'domestic' | 'international';
  // Payment
  totalValue: number;
  currency: string;
  phases: PaymentPhase[];
  // Bank
  bankAccountName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankSwiftCode?: string;
  bankCitadCode?: string;
  bankAddress?: string;
}

export interface ScopeTemplate {
  name: string;
  content: string;
  createdAt: string;
}

// ══════════════════════════════════════════════════════════════
// ── Helpers ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const fmt = (n: number) => n.toLocaleString('vi-VN');

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '....../....../..........';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const blank = (v: string | null | undefined, placeholder = '..........') => v || placeholder;

const numberToWords = (n: number, currency: string): string => {
  if (currency === 'USD') return `${fmt(n)} US Dollars`;
  return `${fmt(n)} VNĐ`;
};

export function generateContractNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `UASA/TDG-${yy}${mm}`;
}

// ══════════════════════════════════════════════════════════════
// ── Scope Templates (localStorage) ──────────────────────────
// ══════════════════════════════════════════════════════════════

const SCOPE_STORAGE_KEY = 'crm_scope_templates';

export function getScopeTemplates(): ScopeTemplate[] {
  try {
    const raw = localStorage.getItem(SCOPE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveScopeTemplate(name: string, content: string): void {
  const templates = getScopeTemplates().filter(t => t.name !== name);
  templates.unshift({ name, content, createdAt: new Date().toISOString() });
  localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(templates));
}

export function deleteScopeTemplate(name: string): void {
  const templates = getScopeTemplates().filter(t => t.name !== name);
  localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(templates));
}

// ══════════════════════════════════════════════════════════════
// ── CSS (reuse HR pattern) ──────────────────────────────────
// ══════════════════════════════════════════════════════════════

const PRINT_CSS = `
@page { size: A4; margin: 18mm 22mm 18mm 22mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Times New Roman', 'Tinos', serif;
  font-size: 13px;
  line-height: 1.6;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.header-national { text-align: center; margin-bottom: 14px; }
.header-national .en { font-size: 13px; font-weight: bold; text-transform: uppercase; }
.header-national .vi { font-size: 13px; font-weight: bold; text-transform: uppercase; }
.header-national .motto-en { font-size: 13px; font-style: italic; }
.header-national .motto-vi { font-size: 13px; font-weight: bold; font-style: italic; }
.header-national .stars { font-size: 14px; letter-spacing: 4px; margin: 2px 0; }
.contract-title { text-align: center; font-size: 15px; font-weight: bold; text-transform: uppercase; margin: 10px 0 3px 0; }
.contract-number { text-align: center; font-size: 13px; font-style: italic; margin-bottom: 10px; }
.bilingual { margin-bottom: 4px; }
.bilingual .en { }
.bilingual .vi { font-style: italic; color: #444; }
.info-table { width: 100%; border-collapse: collapse; margin: 4px 0 8px 0; }
.info-table td { padding: 2px 4px; vertical-align: top; font-size: 13px; }
.info-table .label { width: 220px; }
.info-table .value { }
.article { margin: 8px 0; }
.article-title { font-weight: bold; font-size: 13px; margin-bottom: 4px; text-transform: uppercase; break-after: avoid; page-break-after: avoid; }
.article p, .article li { text-align: justify; margin-bottom: 3px; orphans: 2; widows: 2; }
.article ul, .article ol { padding-left: 20px; }
.payment-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.payment-table th, .payment-table td { border: 1px solid #666; padding: 4px 8px; font-size: 12px; vertical-align: top; }
.payment-table th { background: #f5f5f5; font-weight: bold; text-align: center; }
.timeline-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.timeline-table td { padding: 3px 6px; font-size: 13px; vertical-align: top; }
.timeline-table .tl-label { width: 200px; font-weight: bold; }
.signature-block { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
.signature-col { width: 45%; text-align: center; }
.signature-col .sig-title { font-weight: bold; font-size: 13px; margin-bottom: 2px; }
.signature-col .sig-subtitle { font-weight: bold; font-size: 12px; font-style: italic; margin-bottom: 2px; }
.signature-col .sig-note { font-style: italic; font-size: 11px; color: #555; margin-bottom: 70px; }
@media screen {
  body { max-width: 210mm; margin: 0 auto; padding: 18mm 22mm; background: white; }
}
`;

// ══════════════════════════════════════════════════════════════
// ── Template Generator ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export function generateClientContract(data: ClientContractData): string {
  const company = COMPANY_OPTIONS[data.companyKey];
  // ponytail: 1 template + 1 cờ, không nhân đôi 400 dòng — khác biệt chỉ nằm ở 3 chỗ.
  const dom = data.contractType === 'domestic';

  const paymentScheduleRows = data.phases.map((p, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${p.label}<br><span style="font-style:italic;color:#444">${p.description}</span></td>
      <td style="text-align:center">${p.percentage}%</td>
      <td style="text-align:right">${fmt(p.amount)} ${data.currency}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <style>${PRINT_CSS}</style>
</head>
<body>

<!-- Header -->
<div class="header-national">
  <div class="en">SOCIALIST REPUBLIC OF VIETNAM</div>
  <div class="vi">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
  <div class="motto-en">Independence – Freedom – Happiness</div>
  <div class="motto-vi">Độc lập – Tự do – Hạnh phúc</div>
  <div class="stars">***</div>
</div>

<div class="contract-title">
  OUTSOURCING SERVICE AGREEMENT<br>
  <span style="font-size:14px">HỢP ĐỒNG DỊCH VỤ THUÊ NGOÀI</span>
</div>
<div class="contract-number">
  Contract No / Số hợp đồng: ${blank(data.contractNumber)}<br>
  Date of Signing / Ngày ký: ${fmtDate(data.signingDate)}
</div>

<div class="bilingual">
  <p class="en">Pursuant to the Civil Code of Vietnam 2015 and the Law on Commerce of Vietnam 2005;</p>
  <p class="vi">Căn cứ Bộ luật Dân sự Việt Nam năm 2015 và Luật Thương mại Việt Nam năm 2005;</p>
</div>
<div class="bilingual">
  <p class="en">Pursuant to the agreement and actual requirements of the parties;</p>
  <p class="vi">Căn cứ thỏa thuận và nhu cầu thực tế của các bên;</p>
</div>
<div class="bilingual" style="margin-bottom:10px">
  <p class="en">The parties listed below hereby enter into this Agreement under the following terms and conditions:</p>
  <p class="vi">Các bên dưới đây cùng nhau ký kết Hợp đồng này với các điều khoản và điều kiện sau:</p>
</div>

<!-- ARTICLE I -->
<div class="article">
  <div class="article-title">ARTICLE I. PARTIES INFORMATION / ĐIỀU I. THÔNG TIN CÁC BÊN</div>

  <p style="font-weight:bold;margin:6px 0 2px">1.1 Party A (Client) / Bên A (Khách hàng)</p>
  <table class="info-table">
    <tr><td class="label">Company Name / Tên công ty:</td><td class="value">${blank(data.clientName)}</td></tr>
    <tr><td class="label">Address / Địa chỉ:</td><td class="value">${blank(data.clientAddress)}</td></tr>
    <tr><td class="label">Tax ID / Mã số thuế:</td><td class="value">${blank(data.clientTaxCode)}</td></tr>
    <tr><td class="label">Representative / Người đại diện:</td><td class="value">${blank(data.clientRepresentative)}</td></tr>
    <tr><td class="label">Position / Chức vụ:</td><td class="value">${blank(data.clientRepresentativeTitle)}</td></tr>
  </table>

  <p style="font-weight:bold;margin:6px 0 2px">1.2 Party B (Service Provider) / Bên B (Đơn vị cung cấp dịch vụ)</p>
  <table class="info-table">
    <tr><td class="label">Company Name / Tên công ty:</td><td class="value">${company.name}</td></tr>
    <tr><td class="label">Address / Địa chỉ:</td><td class="value">${company.address}</td></tr>
    <tr><td class="label">Email:</td><td class="value">tdgames.vn@gmail.com</td></tr>
    <tr><td class="label">Tax ID / Mã số thuế:</td><td class="value">${company.taxCode}</td></tr>
    <tr><td class="label">Representative / Người đại diện:</td><td class="value">${company.representative}</td></tr>
    <tr><td class="label">Position / Chức vụ:</td><td class="value">${company.representativeTitle}</td></tr>
  </table>

  <p style="font-style:italic;margin:6px 0 10px">The parties referred to above collectively as "the Parties" hereby agree as follows: / Các bên nêu trên, gọi chung là "Các Bên", đồng ý với nhau như sau:</p>
</div>

<!-- ARTICLE II — SCOPE -->
<div class="article">
  <div class="article-title">ARTICLE II. SCOPE OF WORK / ĐIỀU II. PHẠM VI CÔNG VIỆC</div>
  <p style="font-weight:bold;margin-bottom:4px">Project Name / Tên dự án: ${blank(data.projectName)}</p>
  <div style="margin-top:6px">${data.scopeContent || '<p style="color:#999">[Scope of work will be defined here]</p>'}</div>
  <div class="bilingual" style="margin-top:8px">
    <p class="en"><strong>Out of Scope:</strong> Any assets, features, or requirements not explicitly listed in this Article shall be considered additional work outside the scope of this Agreement and may be quoted separately in accordance with Article 6.2.</p>
    <p class="vi"><strong>Ngoài phạm vi:</strong> Bất kỳ tài sản, tính năng hoặc yêu cầu nào không được liệt kê rõ ràng trong Điều này đều được coi là công việc phát sinh ngoài phạm vi Hợp đồng và có thể được báo giá riêng theo Điều 6.2.</p>
  </div>
</div>

<!-- ARTICLE III — TIMELINE -->
<div class="article">
  <div class="article-title">ARTICLE III. TIMELINE / ĐIỀU III. TIẾN ĐỘ THỰC HIỆN</div>
  <table class="timeline-table">
    <tr><td class="tl-label">Start Date / Ngày bắt đầu</td><td>${data.startDate ? fmtDate(data.startDate) : 'Within 3 business days after receipt of the prepayment. / Trong vòng 3 ngày làm việc sau khi nhận tạm ứng.'}</td></tr>
    <tr><td class="tl-label">Estimated Duration / Thời gian dự kiến</td><td>${blank(data.estimatedDuration)}</td></tr>
    <tr><td class="tl-label">Estimated Completion / Ngày hoàn thành dự kiến</td><td>${data.estimatedCompletion ? fmtDate(data.estimatedCompletion) : blank('')}</td></tr>
  </table>
  <div class="bilingual" style="margin-top:6px">
    <p class="en">Any delay caused by late feedback, missing references, or change requests from Party A shall automatically extend the production schedule accordingly.</p>
    <p class="vi">Trong trường hợp tiến độ bị ảnh hưởng do Bên A chậm phản hồi, thời hạn thực hiện sẽ được tự động gia hạn tương ứng.</p>
  </div>
</div>

<!-- ARTICLE IV — PAYMENT -->
<div class="article">
  <div class="article-title">ARTICLE IV. PAYMENT TERMS / ĐIỀU IV. ĐIỀU KHOẢN THANH TOÁN</div>

  <p style="font-weight:bold;margin:4px 0 2px">4.1 Total Contract Value / Tổng giá trị hợp đồng</p>
  <table class="info-table">
    <tr><td class="label">Amount (Figures) / Bằng số:</td><td class="value"><strong>${fmt(data.totalValue)} ${data.currency}</strong></td></tr>
    <tr><td class="label">Amount (Words) / Bằng chữ:</td><td class="value">${numberToWords(data.totalValue, data.currency)}</td></tr>
  </table>

  <p style="font-weight:bold;margin:6px 0 2px">4.2 Payment Schedule / Lịch thanh toán</p>
  <table class="payment-table">
    <thead>
      <tr><th>#</th><th>Description</th><th>%</th><th>Amount</th></tr>
    </thead>
    <tbody>${paymentScheduleRows}</tbody>
  </table>
  <div class="bilingual" style="margin-top:6px">
    <p class="en">Party B shall issue an invoice for each payment phase upon the phase becoming due. Party A shall pay each invoice in full within fifteen (15) calendar days from the date of receipt of the invoice. A payment is deemed overdue from the day following the expiry of that period, and Article 6.6 shall apply.</p>
    <p class="vi">Bên B phát hành hóa đơn cho từng đợt thanh toán khi đợt đó đến hạn. Bên A thanh toán đầy đủ trong vòng 15 ngày kể từ ngày nhận được hóa đơn. Khoản thanh toán được coi là quá hạn kể từ ngày kế tiếp sau khi hết thời hạn nêu trên, và Điều 6.6 sẽ được áp dụng.</p>
  </div>
  ${dom ? `<div class="bilingual" style="margin-top:4px">
    <p class="en">Party B shall issue a lawful electronic VAT invoice in accordance with the tax laws of Vietnam. Party A shall provide accurate invoicing details (company name, address, tax code) and is responsible for any adjustment arising from incorrect details it supplies.</p>
    <p class="vi">Bên B xuất hóa đơn giá trị gia tăng điện tử hợp pháp theo quy định pháp luật thuế Việt Nam. Bên A có trách nhiệm cung cấp chính xác thông tin xuất hóa đơn (tên công ty, địa chỉ, mã số thuế) và chịu trách nhiệm về việc điều chỉnh hóa đơn phát sinh do thông tin cung cấp sai.</p>
  </div>` : ''}

  <p style="font-weight:bold;margin:8px 0 2px">4.3 Payment Method / Phương thức thanh toán</p>
  <div class="bilingual">
    <p class="en">Payment shall be made by bank transfer to the following account:</p>
    <p class="vi">Thanh toán được thực hiện bằng hình thức chuyển khoản ngân hàng đến tài khoản sau:</p>
  </div>
  <table class="info-table" style="margin-top:4px">
    <tr><td class="label">Account Name:</td><td class="value">${data.bankAccountName || company.name}</td></tr>
    <tr><td class="label">Bank Name:</td><td class="value">${data.bankName || '..........'}</td></tr>
    <tr><td class="label">Bank Account No.:</td><td class="value">${data.bankAccountNumber || '..........'}</td></tr>
    ${!dom && data.bankSwiftCode ? `<tr><td class="label">Bank Swift Code:</td><td class="value">${data.bankSwiftCode}</td></tr>` : ''}
    ${data.bankCitadCode ? `<tr><td class="label">Bank CITAD Code:</td><td class="value">${data.bankCitadCode}</td></tr>` : ''}
    ${!dom && data.bankAddress ? `<tr><td class="label">Bank Address:</td><td class="value">${data.bankAddress}</td></tr>` : ''}
  </table>
  <div class="bilingual" style="margin-top:4px">
    ${dom
      ? `<p class="en">Each Party shall bear the bank charges levied by its own bank. Payment shall be made in Vietnamese Dong (VND) by bank transfer; cash payment shall not be accepted.</p>
    <p class="vi">Mỗi Bên chịu phí ngân hàng do ngân hàng của mình thu. Việc thanh toán được thực hiện bằng Đồng Việt Nam (VND) qua chuyển khoản; không chấp nhận thanh toán bằng tiền mặt.</p>`
      : `<p class="en">All bank transfer fees incurred outside of Vietnam shall be borne by Party A. Fees within Vietnam shall be borne by Party B. Payment shall be made by bank transfer; cash payment shall not be accepted.</p>
    <p class="vi">Tất cả phí chuyển khoản phát sinh ngoài lãnh thổ Việt Nam do Bên A chịu. Phí trong nước do Bên B chịu. Việc thanh toán được thực hiện qua chuyển khoản; không chấp nhận thanh toán bằng tiền mặt.</p>`}
  </div>
</div>

<!-- ARTICLE V — RIGHTS & OBLIGATIONS (BOILERPLATE) -->
<div class="article">
  <div class="article-title">ARTICLE V. RIGHTS AND OBLIGATIONS / ĐIỀU V. QUYỀN VÀ NGHĨA VỤ CÁC BÊN</div>

  <p style="font-weight:bold;margin:4px 0 2px">5.1 Obligations of Party B (Service Provider) / Nghĩa vụ của Bên B</p>
  <ul>
    <li>Perform the agreed scope of work accurately and professionally. / Thực hiện đúng và chuyên nghiệp phạm vi công việc đã thỏa thuận.</li>
    <li>Deliver all products on time and in compliance with the required quality standards. / Bàn giao tất cả sản phẩm đúng hạn và đáp ứng tiêu chuẩn chất lượng.</li>
    <li>Maintain strict confidentiality of all project-related information. / Bảo mật nghiêm ngặt toàn bộ thông tin liên quan đến dự án.</li>
    <li>Provide technical support within thirty (30) days following delivery. / Hỗ trợ kỹ thuật trong vòng 30 ngày sau khi bàn giao.</li>
    <li>Delete all of Party A's source files within thirty (30) days after the expiry of the technical support period, save for one archival copy retained solely to perform warranty obligations and to comply with accounting and statutory record-keeping requirements. / Xóa toàn bộ file gốc của Bên A trong vòng 30 ngày kể từ khi kết thúc thời hạn hỗ trợ kỹ thuật, trừ một bản lưu trữ duy nhất chỉ nhằm thực hiện nghĩa vụ bảo hành và tuân thủ yêu cầu lưu trữ chứng từ kế toán theo quy định pháp luật.</li>
  </ul>

  <p style="font-weight:bold;margin:6px 0 2px">5.2 Obligations of Party A (Client) / Nghĩa vụ của Bên A</p>
  <ul>
    <li>Provide all necessary source files, briefs, and references in a timely manner. / Cung cấp đầy đủ và kịp thời file gốc, brief và tài liệu tham khảo.</li>
    <li>Make payments in accordance with the schedule set forth in Article IV. / Thanh toán đúng lịch quy định tại Điều IV.</li>
    <li>Review and provide feedback within five (05) working days. / Xem xét và phản hồi trong vòng 5 ngày làm việc.</li>
    <li>Provide all project-related information necessary for production. / Cung cấp toàn bộ thông tin cần thiết cho sản xuất.</li>
  </ul>

  <p style="font-weight:bold;margin:6px 0 2px">5.3 Intellectual Property Rights / Quyền sở hữu trí tuệ</p>
  <div class="bilingual">
    <p class="en">All economic rights and the right to publish the final deliverables shall be transferred to Party A upon completion of all payment obligations. Until such payment is completed in full, all rights remain vested in Party B.</p>
    <p class="vi">Toàn bộ quyền tài sản và quyền công bố đối với sản phẩm bàn giao cuối cùng sẽ được chuyển giao cho Bên A sau khi hoàn tất toàn bộ nghĩa vụ thanh toán. Cho đến khi thanh toán đầy đủ, mọi quyền vẫn thuộc về Bên B.</p>
  </div>
  <div class="bilingual">
    <p class="en">The moral rights of the author (including the right to be named as author and the right to protect the integrity of the work) are inalienable under the Intellectual Property Law of Vietnam and shall remain with the author, save for the right to publish which is transferred under this Article.</p>
    <p class="vi">Quyền nhân thân của tác giả (bao gồm quyền đứng tên tác giả và quyền bảo vệ sự toàn vẹn của tác phẩm) không thể chuyển nhượng theo Luật Sở hữu trí tuệ Việt Nam và vẫn thuộc về tác giả, trừ quyền công bố tác phẩm đã được chuyển giao theo Điều này.</p>
  </div>
  <div class="bilingual">
    <p class="en">Following the public release, Party B may showcase the completed work in its portfolio only with the prior written approval of Party A.</p>
    <p class="vi">Sau khi phát hành công khai, Bên B được quyền sử dụng sản phẩm để giới thiệu nếu được sự đồng ý của Bên A bằng văn bản.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">5.4 Warranty of Title &amp; Use of Personnel / Cam kết về quyền và việc sử dụng nhân sự</p>
  <div class="bilingual">
    <p class="en">Party B warrants that the deliverables are original works created for Party A and do not infringe the intellectual property rights of any third party, and that Party B holds full rights to transfer them under Article 5.3. Should a third party raise a claim in respect of the deliverables, Party B shall handle the claim at its own cost and compensate Party A for direct damage actually incurred, subject to Article 6.9.</p>
    <p class="vi">Bên B cam kết sản phẩm bàn giao là tác phẩm nguyên gốc được tạo ra cho Bên A, không xâm phạm quyền sở hữu trí tuệ của bất kỳ bên thứ ba nào, và Bên B có đầy đủ quyền để chuyển giao theo Điều 5.3. Nếu có bên thứ ba khiếu nại liên quan đến sản phẩm bàn giao, Bên B tự chịu chi phí xử lý và bồi thường thiệt hại trực tiếp thực tế cho Bên A, theo giới hạn tại Điều 6.9.</p>
  </div>
  <div class="bilingual">
    <p class="en">Party B may engage employees, collaborators or subcontractors to perform the work. Party B remains fully responsible for their performance and confidentiality, and warrants that it has secured from each of them all rights necessary to effect the transfer under Article 5.3.</p>
    <p class="vi">Bên B có quyền sử dụng nhân viên, cộng tác viên hoặc đơn vị thầu phụ để thực hiện công việc. Bên B chịu trách nhiệm hoàn toàn về chất lượng công việc và nghĩa vụ bảo mật của những người này, đồng thời cam kết đã nhận được từ họ đầy đủ các quyền cần thiết để thực hiện việc chuyển giao theo Điều 5.3.</p>
  </div>
</div>

<!-- ARTICLE VI — GENERAL PROVISIONS (BOILERPLATE) -->
<div class="article">
  <div class="article-title">ARTICLE VI. GENERAL PROVISIONS / ĐIỀU VI. ĐIỀU KHOẢN CHUNG</div>

  <p style="font-weight:bold;margin:4px 0 2px">6.1 Acceptance & Revision Policy / Tiêu chí nghiệm thu</p>
  <div class="bilingual">
    <p class="en">Deliverables shall be deemed accepted when conforming to agreed specifications. Party A shall notify rejection, with specific written reasons, within five (05) working days from delivery. If Party A gives no such notice within that period, the deliverable shall be deemed accepted in full. Each deliverable is subject to a maximum of two (02) rounds of revision free of charge.</p>
    <p class="vi">Sản phẩm bàn giao được coi là đã nghiệm thu khi phù hợp với thông số đã thỏa thuận. Bên A phải thông báo từ chối kèm lý do cụ thể bằng văn bản trong vòng 5 ngày làm việc kể từ ngày bàn giao. Quá thời hạn trên mà Bên A không có thông báo, sản phẩm được coi là đã nghiệm thu toàn bộ. Mỗi sản phẩm được chỉnh sửa tối đa 2 lần miễn phí.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.2 Additional Requests / Yêu cầu phát sinh</p>
  <div class="bilingual">
    <p class="en">Any task outside the scope defined in Article II shall constitute an additional request. Party B provides a quotation within two (02) working days. Production commences only upon Party A's written approval.</p>
    <p class="vi">Bất kỳ công việc nào ngoài phạm vi Điều II đều là yêu cầu phát sinh. Bên B cung cấp báo giá trong 2 ngày làm việc. Sản xuất chỉ bắt đầu sau khi có phê duyệt của Bên A.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.3 Confidentiality / Bảo mật thông tin</p>
  <div class="bilingual">
    <p class="en">"Confidential Information" means all non-public information disclosed by either Party in connection with this Agreement, including source files, briefs, game designs, pricing and business information. Both Parties agree to keep such information strictly confidential and not to disclose it to any third party without prior written consent. This obligation survives termination and remains in force for three (03) years thereafter. It does not apply to information that is already public through no fault of the receiving Party, or whose disclosure is required by law or by a competent State authority.</p>
    <p class="vi">"Thông tin bảo mật" là mọi thông tin không công khai được một Bên cung cấp liên quan đến Hợp đồng này, bao gồm file gốc, brief, thiết kế game, thông tin giá và thông tin kinh doanh. Các Bên cam kết giữ bí mật và không tiết lộ cho bên thứ ba khi chưa có chấp thuận bằng văn bản. Nghĩa vụ này tiếp tục có hiệu lực sau khi Hợp đồng chấm dứt và kéo dài thêm 03 năm. Nghĩa vụ này không áp dụng với thông tin đã công khai không do lỗi của Bên nhận, hoặc thông tin phải cung cấp theo yêu cầu của pháp luật hoặc cơ quan Nhà nước có thẩm quyền.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.4 Governing Law / Luật điều chỉnh</p>
  <div class="bilingual">
    <p class="en">This Agreement shall be governed by the laws of Vietnam. Disputes shall be resolved through negotiation within thirty (30) days, failing which either Party may submit the dispute to the competent People's Court in Ha Noi.</p>
    <p class="vi">Hợp đồng này được điều chỉnh theo pháp luật Việt Nam. Tranh chấp ưu tiên giải quyết bằng thương lượng trong 30 ngày, nếu không giải quyết được thì mỗi Bên có quyền khởi kiện tại Tòa án nhân dân có thẩm quyền tại Hà Nội.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.5 Contract Termination / Chấm dứt hợp đồng</p>
  <div class="bilingual">
    <p class="en">Either Party may request termination with twenty (20) calendar days written notice. In all cases Party A shall pay for work completed up to the effective date of termination on a pro-rata basis, and amounts already received corresponding to such completed work are non-refundable. Where termination results from a breach by Party B, Party B shall refund any amount received in excess of the value of the work actually completed. Termination does not affect either Party's liability for damages arising from its breach.</p>
    <p class="vi">Mỗi Bên có thể yêu cầu chấm dứt với 20 ngày thông báo bằng văn bản. Trong mọi trường hợp, Bên A thanh toán cho khối lượng công việc đã hoàn thành đến ngày chấm dứt theo tỷ lệ, và khoản đã nhận tương ứng với phần công việc đó không được hoàn lại. Trường hợp chấm dứt do lỗi vi phạm của Bên B, Bên B phải hoàn trả phần đã nhận vượt quá giá trị công việc thực tế đã hoàn thành. Việc chấm dứt không làm ảnh hưởng đến trách nhiệm bồi thường thiệt hại của Bên vi phạm.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.6 Late Payment &amp; Penalty for Breach / Chậm thanh toán và phạt vi phạm</p>
  <div class="bilingual">
    <p class="en">Any overdue payment shall bear interest at the average overdue-debt interest rate on the market at the time of payment, in accordance with Article 306 of the Law on Commerce 2005. In addition, the Parties agree a penalty for breach of contractual obligations equal to eight percent (08%) of the value of the breached obligation, being the maximum permitted under Article 301 of the Law on Commerce 2005. Party B may suspend work if any payment is overdue by more than fifteen (15) calendar days.</p>
    <p class="vi">Khoản thanh toán chậm phải chịu lãi theo lãi suất nợ quá hạn trung bình trên thị trường tại thời điểm thanh toán, theo Điều 306 Luật Thương mại 2005. Ngoài ra, các Bên thỏa thuận mức phạt vi phạm nghĩa vụ hợp đồng bằng 8% giá trị phần nghĩa vụ bị vi phạm, là mức tối đa theo Điều 301 Luật Thương mại 2005. Bên B có quyền tạm dừng công việc nếu khoản thanh toán quá hạn trên 15 ngày.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.7 Force Majeure / Sự kiện bất khả kháng</p>
  <div class="bilingual">
    <p class="en">Neither Party shall be liable for failure to perform caused by an event of force majeure as defined in Article 156 of the Civil Code 2015 (including natural disaster, epidemic, war, or acts of competent State authorities). The affected Party shall notify the other within seven (07) calendar days. Performance shall be extended by the duration of the event; if it continues beyond sixty (60) calendar days, either Party may terminate and settle the completed work under Article 6.5.</p>
    <p class="vi">Không Bên nào chịu trách nhiệm về việc không thực hiện được nghĩa vụ do sự kiện bất khả kháng theo Điều 156 Bộ luật Dân sự 2015 (bao gồm thiên tai, dịch bệnh, chiến tranh hoặc quyết định của cơ quan Nhà nước có thẩm quyền). Bên bị ảnh hưởng phải thông báo cho Bên kia trong vòng 7 ngày. Thời hạn thực hiện được gia hạn tương ứng thời gian xảy ra sự kiện; nếu kéo dài quá 60 ngày, mỗi Bên có quyền chấm dứt và quyết toán phần công việc đã hoàn thành theo Điều 6.5.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.8 Governing Language / Ngôn ngữ của Hợp đồng</p>
  <div class="bilingual">
    <p class="en">This Agreement is executed in both English and Vietnamese. In the event of any discrepancy or conflict of interpretation between the two versions, the Vietnamese version shall prevail.</p>
    <p class="vi">Hợp đồng này được lập bằng cả tiếng Anh và tiếng Việt. Trường hợp có sự khác biệt hoặc mâu thuẫn trong cách hiểu giữa hai bản, bản tiếng Việt được ưu tiên áp dụng.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.9 Limitation of Liability / Giới hạn trách nhiệm</p>
  <div class="bilingual">
    <p class="en">Save for breach of confidentiality, infringement of third-party intellectual property rights, and wilful misconduct, the total aggregate liability of either Party under this Agreement shall not exceed the total contract value stated in Article 4.1. Neither Party shall be liable for indirect or consequential loss, loss of profit, loss of revenue, or loss of data.</p>
    <p class="vi">Trừ trường hợp vi phạm nghĩa vụ bảo mật, xâm phạm quyền sở hữu trí tuệ của bên thứ ba và hành vi cố ý, tổng trách nhiệm của mỗi Bên theo Hợp đồng này không vượt quá tổng giá trị hợp đồng nêu tại Điều 4.1. Không Bên nào chịu trách nhiệm về thiệt hại gián tiếp, thiệt hại phái sinh, lợi nhuận mất, doanh thu mất hoặc mất mát dữ liệu.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.10 Assignment / Chuyển nhượng hợp đồng</p>
  <div class="bilingual">
    <p class="en">Neither Party may assign this Agreement or any of its rights and obligations hereunder to a third party without the prior written consent of the other Party.</p>
    <p class="vi">Không Bên nào được chuyển nhượng Hợp đồng này hoặc bất kỳ quyền và nghĩa vụ nào theo Hợp đồng cho bên thứ ba khi chưa có chấp thuận bằng văn bản của Bên kia.</p>
  </div>

  <p style="font-weight:bold;margin:6px 0 2px">6.11 Working Days / Ngày làm việc</p>
  <div class="bilingual">
    <p class="en">"Working day" means a day from Monday to Friday, excluding public holidays of the Socialist Republic of Vietnam (including the Lunar New Year holiday). Party B shall notify Party A of its holiday schedule at least seven (07) calendar days in advance.</p>
    <p class="vi">"Ngày làm việc" là ngày từ Thứ Hai đến Thứ Sáu, không bao gồm các ngày nghỉ lễ, Tết theo quy định của nước Cộng hòa xã hội chủ nghĩa Việt Nam (bao gồm kỳ nghỉ Tết Nguyên đán). Bên B thông báo lịch nghỉ cho Bên A trước ít nhất 07 ngày.</p>
  </div>
</div>

<!-- ARTICLE VII — FINAL PROVISIONS (BOILERPLATE) -->
<div class="article">
  <div class="article-title">ARTICLE VII. FINAL PROVISIONS / ĐIỀU VII. ĐIỀU KHOẢN CUỐI</div>
  <ul>
    <li>This Agreement takes effect from the date of signing. / Hợp đồng có hiệu lực kể từ ngày ký.</li>
    <li>This Agreement terminates upon full performance of all obligations. / Hợp đồng chấm dứt khi hoàn thành toàn bộ nghĩa vụ.</li>
    <li>This Agreement is made in two (02) original copies of equal legal validity, each Party retaining one (01) copy; where signed electronically, each Party retains one signed electronic counterpart. / Hợp đồng lập thành 2 bản gốc có giá trị pháp lý ngang nhau, mỗi Bên giữ 01 bản; trường hợp ký điện tử, mỗi Bên giữ 01 bản điện tử đã ký.</li>
    <li>Any amendment shall be made in writing and signed by both Parties. / Mọi sửa đổi phải được lập bằng văn bản và ký bởi cả hai Bên.</li>
    <li>The Parties agree that a signed copy transmitted by email or other electronic means, and electronic signatures made in accordance with the Law on Electronic Transactions, shall have the same legal validity as an original wet-ink signature. / Các Bên thống nhất rằng bản hợp đồng đã ký được gửi qua email hoặc phương tiện điện tử khác, và chữ ký điện tử được thực hiện theo Luật Giao dịch điện tử, có giá trị pháp lý như bản ký trực tiếp.</li>
  </ul>
</div>

<!-- SIGNATURE BLOCK -->
<div class="signature-block">
  <div class="signature-col">
    <div class="sig-title">PARTY A (CLIENT)</div>
    <div class="sig-subtitle">BÊN A (KHÁCH HÀNG)</div>
    <div class="sig-note">Signature, Full Name and Seal<br>Chữ ký, Họ tên và Con dấu</div>
    <div>___________________________</div>
    <div style="margin-top:4px;font-weight:bold">${blank(data.clientRepresentative)}</div>
  </div>
  <div class="signature-col">
    <div class="sig-title">PARTY B (SERVICE PROVIDER)</div>
    <div class="sig-subtitle">BÊN B (ĐƠN VỊ CUNG CẤP DỊCH VỤ)</div>
    <div class="sig-note">Signature, Full Name and Seal<br>Chữ ký, Họ tên và Con dấu</div>
    <div>___________________________</div>
    <div style="margin-top:4px;font-weight:bold">${company.representative}</div>
  </div>
</div>

</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════
// ── AI format scope ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

/** Paste text thô → HTML song ngữ chuẩn cho ĐIỀU II. Throw kèm message tiếng Việt nếu lỗi. */
export async function formatScopeWithAI(text: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-format-scope', { body: { text } });
  if (error) throw new Error(data?.error || error.message || 'Không gọi được AI.');
  if (!data?.html) throw new Error(data?.error || 'AI không trả về nội dung.');
  return cleanScopeHtml(data.html);
}
