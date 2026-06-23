import { HrEmployee, HrDepartment, HrEmployeeSalary } from '@/types';

// ══════════════════════════════════════════════════════════════
// ── Helpers ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const fmt = (n: number) => n.toLocaleString('vi-VN');

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '....../....../..........';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const fmtDateParts = (d: string | null | undefined): { day: string; month: string; year: string } => {
  if (!d) return { day: '......', month: '......', year: '..........' };
  const dt = new Date(d);
  return {
    day: String(dt.getDate()).padStart(2, '0'),
    month: String(dt.getMonth() + 1).padStart(2, '0'),
    year: String(dt.getFullYear()),
  };
};

const genderVi = (g: string) => g === 'male' ? 'Nam' : g === 'female' ? 'Nữ' : g || '..........';
const blank = (v: string | null | undefined, placeholder = '..........') => v || placeholder;

function getSalaryAmount(salaryComponents: HrEmployeeSalary[], code: string): number {
  // Only use currently-active salary records (effective_to is null)
  const comp = salaryComponents.find(s => s.component?.code === code && !s.effective_to);
  return comp?.amount || 0;
}

// ══════════════════════════════════════════════════════════════
// ── Shared CSS ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const PRINT_CSS = `
@page { size: A4; margin: 18mm 22mm 18mm 22mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Times New Roman', 'Tinos', serif;
  font-size: 13px;
  line-height: 1.5;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.header-national {
  text-align: center;
  margin-bottom: 14px;
}
.header-national .country {
  font-size: 13px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.header-national .motto {
  font-size: 13px;
  font-weight: bold;
  font-style: italic;
}
.header-national .stars {
  font-size: 14px;
  letter-spacing: 4px;
  margin: 2px 0;
}
.contract-title {
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  text-transform: uppercase;
  margin: 10px 0 3px 0;
  letter-spacing: 1px;
}
.contract-number {
  text-align: center;
  font-size: 13px;
  font-style: italic;
  margin-bottom: 10px;
}
.intro-text {
  margin-bottom: 8px;
  text-align: justify;
}
.party-header {
  font-weight: bold;
  font-size: 13px;
  margin: 8px 0 4px 0;
  text-transform: uppercase;
}
.info-table {
  width: 100%;
  border-collapse: collapse;
  margin: 2px 0 8px 0;
}
.info-table td {
  padding: 1px 4px;
  vertical-align: top;
  font-size: 13px;
}
.info-table .label {
  width: 170px;
  font-weight: normal;
}
.info-table .colon { width: 12px; text-align: center; }
.info-table .value { font-weight: normal; }
.called-as {
  font-style: italic;
  margin: 4px 0 8px 0;
  font-size: 13px;
}
.article {
  margin: 6px 0;
}
.article-title {
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 3px;
  break-after: avoid;
  page-break-after: avoid;
}
.article p, .article li {
  text-align: justify;
  margin-bottom: 2px;
  orphans: 2;
  widows: 2;
}
.party-header {
  break-after: avoid;
  page-break-after: avoid;
}
.article ul, .article ol {
  padding-left: 20px;
}
.allowance-table {
  width: 100%;
  border-collapse: collapse;
  margin: 4px 0;
}
.allowance-table td {
  padding: 1px 6px;
  font-size: 13px;
  vertical-align: top;
}
.allowance-table .a-label { width: 140px; padding-left: 10px; }
.allowance-table .a-colon { width: 12px; text-align: center; }
.allowance-table .a-value { font-weight: bold; }
.allowance-table .a-note { font-style: italic; color: #555; font-size: 12px; }
.signature-block {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
  page-break-inside: avoid;
}
.signature-col {
  width: 45%;
  text-align: center;
}
.signature-col .sig-title {
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 4px;
}
.signature-col .sig-note {
  font-style: italic;
  font-size: 12px;
  color: #555;
  margin-bottom: 70px;
}
.underline-value {
  border-bottom: 1px dotted #999;
  min-width: 180px;
  display: inline-block;
  padding-bottom: 1px;
}
@media screen {
  body { max-width: 210mm; margin: 0 auto; padding: 18mm 22mm; background: white; }
}
`;

// ══════════════════════════════════════════════════════════════
// Helper to build the national header
// ══════════════════════════════════════════════════════════════

const nationalHeader = () => `
  <div class="header-national">
    <div class="country">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
    <div class="motto">Độc lập – Tự do – Hạnh phúc</div>
    <div class="stars">***</div>
  </div>`;

// ══════════════════════════════════════════════════════════════
// ── Company Options (Bên A) ───────────────────────────────────
// ══════════════════════════════════════════════════════════════

export type CompanyKey = 'tdgames' | 'tdconsulting';

export const COMPANY_OPTIONS: Record<CompanyKey, {
  name: string;
  nameShort: string;
  address: string;
  taxCode: string;
  representative: string;
  representativeTitle: string;
  gender: string; // Ông/Bà
}> = {
  tdgames: {
    name: 'CÔNG TY TNHH TD GAMES',
    nameShort: 'Công ty TNHH TD Games',
    address: 'Xóm Ngoài, Xã Đông Anh, TP Hà Nội',
    taxCode: '0111386856',
    representative: 'ĐẶNG THẾ TOÀN',
    representativeTitle: 'Tổng giám đốc',
    gender: 'Ông',
  },
  tdconsulting: {
    name: 'CÔNG TY TNHH TD CONSULTING',
    nameShort: 'Công ty TNHH TD Consulting',
    address: 'Xóm Ngoài, Xã Đông Anh, TP Hà Nội',
    taxCode: '0109898663',
    representative: 'NGUYỄN THỊ THÙY DUNG',
    representativeTitle: 'Tổng giám đốc',
    gender: 'Bà',
  },
};

const companyInfo = (companyKey: CompanyKey = 'tdgames') => {
  const c = COMPANY_OPTIONS[companyKey];
  return `
  <div class="party-header">BÊN A: ${c.name}</div>
  <table class="info-table">
    <tr><td class="label">Đại diện</td><td class="colon">:</td><td class="value">${c.gender} ${c.representative}</td></tr>
    <tr><td class="label">Chức vụ</td><td class="colon">:</td><td class="value">${c.representativeTitle}</td></tr>
    <tr><td class="label">Địa chỉ</td><td class="colon">:</td><td class="value">${c.address}</td></tr>
    <tr><td class="label">Mã số thuế</td><td class="colon">:</td><td class="value">${c.taxCode}</td></tr>
  </table>
  <p class="called-as">Sau đây gọi là "Người Sử Dụng Lao Động"</p>`;
};

const employeeInfo = (e: HrEmployee) => `
  <div class="party-header">BÊN B:</div>
  <table class="info-table">
    <tr><td class="label">Họ và tên</td><td class="colon">:</td><td class="value"><strong>${blank(e.full_name)}</strong></td></tr>
    <tr><td class="label">Ngày tháng năm sinh</td><td class="colon">:</td><td class="value">${fmtDate(e.date_of_birth)}</td></tr>
    <tr><td class="label">Quốc tịch</td><td class="colon">:</td><td class="value">${blank(e.nationality)}</td></tr>
    <tr><td class="label">Giới tính</td><td class="colon">:</td><td class="value">${genderVi(e.gender)}</td></tr>
    <tr><td class="label">Địa chỉ thường trú</td><td class="colon">:</td><td class="value">${blank(e.address)}</td></tr>
    <tr><td class="label">Số CMND</td><td class="colon">:</td><td class="value">${blank(e.id_number)}</td></tr>
    <tr><td class="label">Ngày cấp</td><td class="colon">:</td><td class="value">${fmtDate(e.id_issue_date)}</td></tr>
    <tr><td class="label">Nơi cấp</td><td class="colon">:</td><td class="value">${blank(e.id_issue_place)}</td></tr>
  </table>
  <p class="called-as">Sau đây gọi là "Người Lao Động"</p>`;

const signatureBlock = (leftTitle: string, leftNote: string, rightTitle: string, rightNote: string) => `
  <div class="signature-block">
    <div class="signature-col">
      <div class="sig-title">${leftTitle}</div>
      <div class="sig-note">${leftNote}</div>
    </div>
    <div class="signature-col">
      <div class="sig-title">${rightTitle}</div>
      <div class="sig-note">${rightNote}</div>
    </div>
  </div>`;

const allowanceRow = (label: string, amount: number, note: string) => `
  <tr>
    <td class="a-label">- ${label}</td>
    <td class="a-colon">:</td>
    <td class="a-value">${amount > 0 ? fmt(amount) + ' đồng/tháng' : '.......... đồng/tháng'}</td>
    <td class="a-note">${note}</td>
  </tr>`;

// ══════════════════════════════════════════════════════════════
// ── 1. HĐLĐ – Hợp đồng lao động ─────────────────────────────
// ══════════════════════════════════════════════════════════════

export function generateHDLD(
  employee: HrEmployee,
  department: HrDepartment | undefined,
  salaryComponents: HrEmployeeSalary[],
  signingDate: string,
  contractNumber: string,
): string {
  const d = fmtDateParts(signingDate);
  const baseSalary = getSalaryAmount(salaryComponents, 'base_salary') || employee.salary;
  const lunch = getSalaryAmount(salaryComponents, 'lunch');
  const transport = getSalaryAmount(salaryComponents, 'transport');
  const phone = getSalaryAmount(salaryComponents, 'phone');
  const clothing = getSalaryAmount(salaryComponents, 'clothing');
  const kpi = getSalaryAmount(salaryComponents, 'kpi');

  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>HĐLĐ - ${employee.full_name}</title>
<style>${PRINT_CSS}</style></head><body>
${nationalHeader()}
<div class="contract-title">HỢP ĐỒNG LAO ĐỘNG</div>
<div class="contract-number">Số: ${contractNumber || '......'}/HĐLĐ/TDG-${employee.full_name || ''}</div>

<p class="intro-text">Hôm nay, ngày ${d.day} tháng ${d.month} năm ${d.year}, tại Công ty TNHH TD GAMES, chúng tôi gồm:</p>

${companyInfo()}
${employeeInfo(employee)}
<p class="intro-text">Thỏa thuận ký kết hợp đồng lao động này ("Hợp Đồng") và cam kết thực hiện những điều khoản theo sau:</p>

<div class="article">
  <div class="article-title">Điều 1: Thời hạn và công việc hợp đồng</div>
  <p>1.1. Loại hợp đồng lao động: Hợp đồng lao động</p>
  <p>1.2. Thời hạn hợp đồng: 12 tháng kể từ ngày ký</p>
  <p>1.3. Vị trí: <span class="underline-value">${blank(employee.position)}</span></p>
  <p>1.4. Mô tả Công việc: Theo bản mô tả công việc được cấp phát bởi Công Ty.</p>
</div>

<div class="article">
  <div class="article-title">Điều 2: Chế độ làm việc</div>
  <p>2.1. Thời giờ làm việc: 8h30 đến 17h30 (Nghỉ trưa 1 tiếng) từ thứ 2 đến thứ 6</p>
  <p>2.2. Những dụng cụ làm việc được cấp phát bao gồm:</p>
  <p>Theo quy định pháp luật về lao động hiện hành và theo yêu cầu bản chất công việc theo thỏa thuận tại Hợp Đồng này.</p>
</div>

<div class="article">
  <div class="article-title">Điều 3: Nghĩa vụ, quyền lợi, và lợi ích của Người Lao Động</div>
  <p><strong>3.1. Quyền lợi</strong></p>
  <p>a) Mức lương cơ bản: <strong>${baseSalary > 0 ? fmt(baseSalary) : '..........'}</strong> đồng/tháng</p>
  <p>b) Phương thức trả lương: ngày 3 đến ngày 5 hàng tháng</p>
  <p>c) Hình thức trả lương: Chuyển khoản</p>
  <p>d) Các khoản tiền thưởng: Theo chính sách của Công Ty và các quy định pháp luật về lao động hiện hành.</p>
  <p>e) Chế độ nâng mức lương: Theo chính sách của Công Ty</p>
  <p>f) Việc cung cấp trang bị bảo hộ cá nhân gồm:</p>
  <p>Theo quy định pháp luật về lao động hiện hành và theo như yêu cầu bản chất công việc được thỏa thuận tại Hợp Đồng này.</p>
  <p>g) Thời gian nghỉ ngơi (phép tháng, phép năm, và các ngày Lễ chính) theo quy định pháp luật về lao động hiện hành.</p>
</div>
<div class="article">
  <p>Bảo hiểm theo luật định: Hưởng các chế độ BHXH, BHYT và BHTN theo quy định pháp luật hiện hành.</p>
  <p>h) Chế độ đào tạo nghề: Phụ thuộc vào yêu cầu công việc. Trong thời gian huấn luyện, Người Lao Động phải nghiêm túc hoàn thành mỗi khóa huấn luyện đúng thời hạn và yêu cầu.</p>
  <p>i) Những thỏa thuận khác:</p>
  <p>Công Ty sẽ khấu trừ và kê khai thay cho Người Lao Động này về thuế thu nhập cá nhân (nếu có) phát sinh từ tiền lương, phụ cấp, tiền thưởng do Công Ty chi trả theo quy định pháp luật hiện hành của Việt Nam.</p>
  <p>k) Người Lao Động sẽ không nhận được số tiền lương tính theo ngày làm việc tương ứng nếu đơn phương hoặc tự ý chấm dứt hợp đồng trước thời hạn mà không báo trước cho Công ty theo thời hạn luật định hoặc không bàn giao đầy đủ công việc và tài sản cho Công Ty cấp phát (nếu có).</p>
</div>

<div class="article">
  <p><strong>3.2. Nghĩa vụ của Người Lao Động</strong></p>
  <p>a) Hoàn thành công việc đã cam kết trong Hợp đồng Lao động này và các Phụ lục được lập vào từng thời điểm (nếu có).</p>
  <p>b) Tuân thủ các nghĩa vụ đóng Bảo hiểm Xã hội (BHXH), Bảo hiểm Y tế (BHYT), Bảo hiểm Thất nghiệp (BHTN) (nếu có) và Thuế Thu nhập Cá nhân theo pháp luật hiện hành.</p>
  <p>c) Tuân thủ các chỉ dẫn hợp pháp của người quản lý hoặc người phụ trách có thẩm quyền, nội quy lao động và các quy định nội bộ khác của Công ty và bên thứ ba có liên quan đến công việc thực hiện theo Hợp đồng này.</p>
  <p>d) Bồi thường cho Công Ty do (i) Người Lao Động làm hư hỏng dụng cụ, thiết bị hoặc có hành vi khác gây thiệt hại tài sản của Công Ty thì phải bồi thường theo quy định của pháp luật; và/hoặc (ii) vi phạm kỷ luật lao động hoặc trách nhiệm pháp lý khác căn cứ theo nội quy lao động, Bộ Luật Lao Động Việt Nam hoặc theo các thỏa thuận giữa Công ty và Người Lao Động.</p>
</div>

<div class="article">
  <div class="article-title">Điều 4: Nghĩa vụ và quyền hạn của người sử dụng lao động</div>
  <p><strong>4.1. Nghĩa vụ</strong></p>
  <p>a) Bảo đảm việc làm và đáp ứng những nghĩa vụ theo Hợp đồng Lao động này và pháp luật hiện hành.</p>
</div>
<div class="article">
  <p>b) Đóng BHXH, BHYT và BHTN theo pháp luật hiện hành. Công ty thực hiện đóng BHXH, BHYT và BHTN cho người lao động trong thời gian thử việc</p>
  <p>c) Thanh toán đầy đủ và đúng thời hạn tất cả các chế độ và quyền lợi khác cho Người Lao Động này theo Hợp đồng Lao động này và thỏa thuận chung, nếu có.</p>
  <p><strong>4.2. Quyền hạn</strong></p>
  <p>a) Quản lý Người Lao Động này để đảm bảo rằng các nghĩa vụ của anh/chị ấy được hoàn tất theo hợp đồng lao động này</p>
  <p>b) Tạm hoãn hoặc chấm dứt Hợp đồng Lao động này, và áp dụng các hình thức xử lý kỷ luật theo Bộ Luật Lao Động Việt Nam, Thỏa Thuận Chung (nếu có) và các nội quy của Công ty.</p>
</div>

<div class="article">
  <div class="article-title">Điều 5: Các nội dung khác</div>
  <p>- Ngoài các khoản tiền lương và phụ cấp mà người lao động nhận được tại Điều 3 của hợp đồng lao động này, người lao động còn được nhận các khoản khác như sau:</p>
  <p><strong>5.1. Hỗ trợ:</strong></p>
  <table class="allowance-table">
    ${allowanceRow('Ăn trưa', lunch, 'Tính theo ngày công thực tế')}
    ${allowanceRow('Điện thoại', phone, 'Tính theo ngày công thực tế')}
    ${allowanceRow('Xăng xe', transport, 'Tính theo ngày công thực tế')}
    ${allowanceRow('Trang phục', clothing, 'Tính theo ngày công thực tế')}
    ${allowanceRow('KPI', kpi, 'Tính theo hiệu quả công việc')}
  </table>
  <p>5.2. Các khoản phúc lợi khác: theo quy chế của Công ty</p>
  <p>5.3. Thưởng Lễ, Tết: theo quy chế của Công ty</p>
</div>

<div class="article">
  <div class="article-title">Điều 6: Điều khoản thực thi</div>
  <p>6.1. Bất kỳ vấn đề về lao động nào không được định nghĩa trong Hợp đồng Lao động này sẽ phải được quyết định theo các điều khoản của Thỏa ước Lao động Chung (nếu có) và quy định của pháp luật về lao động hiện hành.</p>
  <p>6.2. Hợp đồng này sẽ chấm dứt theo quy định của pháp luật về lao động hiện hành.</p>
</div>
<div class="article">
  <p>6.3. Hợp đồng lao động này được lập thành 02 (hai) bản có giá trị ngang nhau tại Thành phố Hà Nội, có hiệu lực từ ngày ký kết hợp đồng. Mỗi bên sẽ giữ một bản sao. Khi hai bên ký kết Phụ lục đính kèm theo Hợp đồng Lao động này, thì nội dung của Phụ lục đó cũng sẽ được xem là nội dung của bản Hợp đồng Lao động này.</p>
</div>

<div class="article">
  <div class="article-title">Điều 7: Đơn phương chấm dứt hợp đồng:</div>
  <p><strong>7.1. Người sử dụng lao động</strong></p>
  <p>- Người lao động thường xuyên không hoàn thành công việc theo hợp đồng.</p>
  <p>- Do thiên tai, hỏa hoạn, hoặc những lý do bất khả kháng khác mà người sử dụng lao động đã tìm mọi biện pháp khắc phục nhưng vẫn buộc phải thu hẹp sản xuất, giảm chỗ làm việc.</p>
  <p>- Doanh nghiệp, cơ quan, tổ chức chấm dứt hoạt động.</p>
  <p>- Người lao động có hành vi gây thiệt hại nghiêm trọng về tài sản và lợi ích của Bên A.</p>
  <p>- Người lao động tự ý bỏ việc 5 ngày/1 tháng và 20 ngày/1 năm.</p>
  <p>- Người lao động vi phạm Pháp luật Nhà nước.</p>
  <p><strong>7.2. Người lao động</strong></p>
  <p>- Không được bố trí theo đúng công việc, địa điểm làm việc hoặc không được bảo đảm các điều kiện làm việc đã thỏa thuận trong hợp đồng.</p>
  <p>- Không được trả công đầy đủ hoặc trả công không đúng thời hạn đã thỏa thuận trong hợp đồng.</p>
  <p>- Bị ngược đãi, bị cưỡng bức lao động.</p>
  <p>- Bản thân hoặc gia đình thật sự có hoàn cảnh khó khăn không thể tiếp tục thực hiện hợp đồng.</p>
  <p>- Người lao động nữ có thai phải nghỉ việc theo chỉ định của thầy thuốc.</p>
  <p>- Người lao động bị ốm đau, tai nạn đã điều trị 03 tháng liền mà khả năng lao động chưa được hồi phục</p>
</div>

${signatureBlock('Đại diện Công ty', '(Ký, đóng dấu và ghi rõ họ tên)', 'Người lao động', '(Ký và ghi rõ họ tên)')}

</body></html>`;
}

// ══════════════════════════════════════════════════════════════
// ── 2. HĐTV – Hợp đồng thử việc ─────────────────────────────
// ══════════════════════════════════════════════════════════════

export function generateHDTV(
  employee: HrEmployee,
  department: HrDepartment | undefined,
  salaryComponents: HrEmployeeSalary[],
  signingDate: string,
  contractNumber: string,
): string {
  const d = fmtDateParts(signingDate);
  const baseSalary = getSalaryAmount(salaryComponents, 'base_salary') || employee.salary;
  const lunch = getSalaryAmount(salaryComponents, 'lunch');
  const transport = getSalaryAmount(salaryComponents, 'transport');
  const phone = getSalaryAmount(salaryComponents, 'phone');
  const clothing = getSalaryAmount(salaryComponents, 'clothing');
  const kpi = getSalaryAmount(salaryComponents, 'kpi');

  // Calculate probation end (2 months from start)
  const startDate = employee.start_date || signingDate;
  let endDate = employee.probation_end;
  if (!endDate && startDate) {
    const dt = new Date(startDate);
    dt.setMonth(dt.getMonth() + 2);
    endDate = dt.toISOString().split('T')[0];
  }

  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>HĐTV - ${employee.full_name}</title>
<style>${PRINT_CSS}</style></head><body>
${nationalHeader()}
<div class="contract-title">HỢP ĐỒNG THỬ VIỆC</div>
<div class="contract-number">Số HĐTV: ${contractNumber || '......'}-HĐTV/TDG-${employee.full_name || ''}</div>

<p class="intro-text" style="margin-bottom:4px;">- Căn cứ Bộ luật Lao động nước Cộng hòa xã hội chủ nghĩa Việt Nam năm 2019;</p>
<p class="intro-text" style="margin-bottom:12px;">- Căn cứ nhu cầu và năng lực của hai bên;</p>
<p class="intro-text">Hôm nay, ngày ${d.day} tháng ${d.month} năm ${d.year} tại công ty TNHH TD GAMES, chúng tôi gồm:</p>

${companyInfo()}
${employeeInfo(employee)}

<p class="intro-text">Sau khi thỏa thuận, hai bên thống nhất ký Hợp đồng thử việc với các điều khoản sau đây:</p>
<div class="article">
  <div class="article-title">Điều 1: Điều khoản chung</div>
  <p>1. Loại hợp đồng: Hợp đồng thử việc.</p>
  <p>2. Thời hạn hợp đồng: 02 tháng kể từ ngày ký</p>
  <p>3. Thời điểm bắt đầu: <span class="underline-value">${fmtDate(startDate)}</span></p>
  <p>4. Thời điểm kết thúc: <span class="underline-value">${fmtDate(endDate)}</span></p>
  <p>5. Địa điểm làm việc: Văn phòng công ty</p>
  <p>6. Bộ phận công tác: <span class="underline-value">${blank(department?.name)}</span></p>
  <p>7. Chức danh chuyên môn (vị trí công tác): <span class="underline-value">${blank(employee.position)}</span></p>
  <p>8. Nhiệm vụ công việc như sau:</p>
  <p>- Thực hiện công việc theo đúng chức danh chuyên môn của mình dưới sự quản lý, điều hành của người có thẩm quyền.</p>
  <p>- Phối hợp cùng với các bộ phận, phòng ban khác trong Công ty để đạt hiệu quả cao nhất trong thời gian thử việc.</p>
  <p>- Những công việc khác theo nhu cầu của Công ty.</p>
</div>

<div class="article">
  <div class="article-title">Điều 2: Chế độ làm việc</div>
  <p>1. Thời gian làm việc: 8:30 đến 17:30 từ thứ 2 đến thứ 6</p>
  <p>2. Thời gian nghỉ ngơi: 12:00 - 13:00</p>
  <p>3. Thiết bị và công cụ làm việc sẽ được Công ty cấp phát tùy theo nhu cầu của công việc.</p>
  <p>4. Điều kiện an toàn và vệ sinh lao động tại nơi làm việc theo quy định của pháp luật hiện hành.</p>
</div>

<div class="article">
  <div class="article-title">Điều 3: Quyền và nghĩa vụ của người lao động</div>
  <p><strong>1. Quyền của người lao động</strong></p>
  <p><strong>1.1. Quyền lợi:</strong></p>
  <p>- Mức lương cơ bản: <strong>${baseSalary > 0 ? fmt(baseSalary) : '..........'}</strong> đồng/tháng</p>
  <p>- Mức lương thử việc: 100% lương cơ bản</p>
  <p>- Hình thức trả lương: chuyển khoản</p>
  <p>- Thời hạn trả lương: từ ngày 03 đến ngày 05 hàng tháng</p>
  <p><strong>1.2. Hỗ trợ:</strong></p>
  <table class="allowance-table">
    ${allowanceRow('Ăn trưa', lunch, 'Tính theo ngày công thực tế')}
    ${allowanceRow('Điện thoại', phone, 'Tính theo ngày công thực tế')}
  </table>
</div>
<div class="article">
  <table class="allowance-table">
    ${allowanceRow('Xăng xe', transport, 'Tính theo ngày công thực tế')}
    ${allowanceRow('Trang phục', clothing, 'Tính theo ngày công thực tế')}
    ${allowanceRow('KPI', kpi, 'Tính theo hiệu quả công việc')}
  </table>
  <p>Tính theo ngày công đi làm thực tế trong tháng.</p>
  <p>1.3. Các khoản phúc lợi khác: theo chính sách và kết quả hoạt động kinh doanh của Công ty</p>
  <p>1.4. Thưởng Lễ, Tết: theo chính sách và kết quả hoạt động kinh doanh của Công ty</p>
</div>

<div class="article">
  <p><strong>2. Nghĩa vụ của người lao động</strong></p>
  <p>- Thực hiện công việc với hiệu quả cao nhất theo sự phân công, điều hành của người có thẩm quyền.</p>
  <p>- Nắm rõ và chấp hành nghiêm túc kỷ luật lao động, an toàn lao động, vệ sinh lao động, phòng cháy chữa cháy, văn hóa công ty, nội quy lao động và các chủ trương, chính sách của Công ty.</p>
  <p>- Bồi thường vi phạm và vật chất theo quy chế, nội quy của Công ty và pháp luật Nhà nước quy định.</p>
  <p>- Thực hiện đúng cam kết trong hợp đồng thử việc và các thỏa thuận bằng văn bản khác với Công ty.</p>
  <p>- Đóng các loại thuế, phí đầy đủ theo quy định của pháp luật.</p>
</div>

<div class="article">
  <div class="article-title">Điều 4: Quyền và nghĩa vụ của người sử dụng lao động</div>
  <p><strong>1. Quyền của người sử dụng lao động</strong></p>
  <p>- Điều hành người lao động hoàn thành công việc theo Hợp đồng thử việc.</p>
  <p>- Có quyền tạm thời chuyển người lao động sang làm công việc khác, ngừng việc và áp dụng các biện pháp kỷ luật theo quy định của pháp luật hiện hành và theo nội quy Công ty trong thời gian thử việc.</p>
  <p>- Trong thời gian thử việc, được huỷ bỏ thoả thuận thử việc mà không cần báo trước và không phải bồi thường nếu việc làm thử của người lao động không đạt yêu cầu theo thoả thuận.</p>
  <p>- Tạm hoãn, chấm dứt hợp đồng, kỷ luật người lao động theo đúng quy định của pháp luật và nội quy công ty.</p>
  <p>- Đòi bồi thường, khiếu nại với cơ quan có thẩm quyền để bảo vệ quyền lợi của mình nếu người lao động vi phạm pháp luật hay các điều khoản của hợp đồng này.</p>
  <p><strong>2. Nghĩa vụ của người sử dụng lao động</strong></p>
  <p>- Bảo đảm việc làm và thực hiện đúng các thỏa thuận theo hợp đồng này để người lao động đạt hiệu quả công việc cao.</p>
  <p>- Thanh toán đầy đủ, đúng thời hạn các chế độ và quyền lợi cho người lao động.</p>
</div>
<div class="article">
  <p>- Trong thời hạn 02 ngày trước khi kết thúc thời gian thử việc phải thông báo cho người lao động kết quả công việc đã làm thử; trường hợp đạt yêu cầu thì khi kết thúc thời gian thử việc phải giao kết ngay hợp đồng lao động.</p>
</div>

<div class="article">
  <div class="article-title">Điều 5: Điều khoản thi hành</div>
  <p>- Những vấn đề về lao động không ghi trong hợp đồng này thì áp dụng theo quy định của thỏa ước tập thể, nội quy lao động và pháp luật lao động.</p>
  <p>- Hợp đồng này được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
</div>

${signatureBlock('Người lao động', '(Ký và ghi rõ họ tên)', 'Người sử dụng lao động', '(Ký và đóng dấu)')}

</body></html>`;
}

// ══════════════════════════════════════════════════════════════
// ── 3. NDA – Cam kết bảo mật ─────────────────────────────────
// ══════════════════════════════════════════════════════════════

export function generateNDA(
  employee: HrEmployee,
  department: HrDepartment | undefined,
  signingDate: string,
): string {
  const d = fmtDateParts(signingDate);

  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>NDA - ${employee.full_name}</title>
<style>${PRINT_CSS}</style></head><body>
${nationalHeader()}
<div class="contract-title">CAM KẾT BẢO MẬT THÔNG TIN</div>
<div class="contract-number">(Outsource Art/ Animation/VFX)</div>

<p class="intro-text">Hôm nay, ngày ${d.day} tháng ${d.month} năm ${d.year}, chúng tôi gồm:</p>

<div class="party-header">BÊN TIẾP NHẬN CAM KẾT:</div>
<table class="info-table">
  <tr><td class="label">Công ty</td><td class="colon">:</td><td class="value">CÔNG TY TNHH TD GAMES</td></tr>
  <tr><td class="label">Đại Diện</td><td class="colon">:</td><td class="value">Đặng Thế Toàn</td></tr>
  <tr><td class="label">Chức vụ</td><td class="colon">:</td><td class="value">Tổng Giám Đốc</td></tr>
</table>

<div class="party-header">BÊN CAM KẾT:</div>
<table class="info-table">
  <tr><td class="label">Ông/Bà</td><td class="colon">:</td><td class="value"><strong>${blank(employee.full_name)}</strong></td></tr>
  <tr><td class="label">Vị trí</td><td class="colon">:</td><td class="value">${blank(employee.position)}</td></tr>
</table>

<p class="intro-text">Bên cam kết đồng ý và cam kết thực hiện nghiêm túc các quy định sau:</p>

<div class="article">
  <div class="article-title">1. Bảo mật thông tin:</div>
  <p>- Không tiết lộ, chia sẻ hoặc cung cấp bất kỳ thông tin nào liên quan đến dự án, tài sản sáng tạo (concept art, model 3D, texture, animation, VFX, storyboard...), thông tin khách hàng quốc tế, yêu cầu kỹ thuật, quy trình sản xuất nội bộ và dữ liệu bảo mật của công ty dưới bất kỳ hình thức nào, trừ khi có sự đồng ý bằng văn bản từ công ty.</p>
</div>

<div class="article">
  <div class="article-title">2. Bảo mật tài sản sáng tạo và quyền sở hữu trí tuệ:</div>
  <p>- Tất cả tài sản được tạo ra trong quá trình làm việc tại TD GAMES (bao gồm artwork, animation, VFX, file dự án, bản demo, prototype...) đều là tài sản thuộc sở hữu của công ty và/hoặc khách hàng. Bên cam kết không được sử dụng, đăng tải, chia sẻ hoặc khai thác vì mục đích cá nhân khi chưa có sự chấp thuận bằng văn bản.</p>
  <p>- Không sử dụng tài sản dự án (bao gồm cả phần chưa hoàn thiện) để làm portfolio cá nhân, tham gia cuộc thi, hoặc phục vụ mục đích quảng bá cá nhân mà không có văn bản cho phép của công ty.</p>
</div>

<div class="article">
  <div class="article-title">3. Không làm việc song song hoặc xung đột lợi ích:</div>
</div>
<div class="article">
  <p>- Cam kết không thực hiện bất kỳ hoạt động nghệ thuật, animation hoặc VFX nào cho đối thủ cạnh tranh hoặc các dự án có nội dung tương tự trong thời gian hợp tác với công ty mà không được sự chấp thuận trước bằng văn bản.</p>
  <p>- Nếu có hoạt động freelance bên ngoài, nhân viên cần khai báo và được phê duyệt bằng văn bản từ quản lý trực tiếp trước khi tiến hành.</p>
</div>

<div class="article">
  <div class="article-title">4. Quản lý tài liệu và dữ liệu dự án:</div>
  <p>- Bảo vệ tất cả file dự án, tài liệu hướng dẫn, brief khách hàng, asset kỹ thuật số (bản gốc và bản chỉnh sửa) được lưu trữ và chia sẻ trong quá trình sản xuất.</p>
  <p>- Không sao chép, tải xuống thiết bị cá nhân, hoặc chuyển dữ liệu ra khỏi hệ thống lưu trữ của công ty (server, cloud, NAS...) mà không có sự cho phép rõ ràng từ quản lý.</p>
  <p>- Khi kết thúc hợp đồng, có trách nhiệm bàn giao toàn bộ file, asset và tài liệu liên quan cho công ty và xóa khỏi thiết bị cá nhân.</p>
</div>

<div class="article">
  <div class="article-title">5. Sử dụng thông tin đúng mục đích:</div>
  <p>- Chỉ sử dụng thông tin, tài liệu, công cụ và phần mềm được cung cấp vào mục đích thực hiện công việc được phân công trong dự án.</p>
  <p>- Không sử dụng thông tin, hình ảnh hoặc tài sản của dự án để phục vụ lợi ích cá nhân, bên thứ ba hoặc vì bất kỳ mục đích thương mại nào khác.</p>
</div>

<div class="article">
  <div class="article-title">6. Bảo mật công nghệ và hệ thống:</div>
  <p>- Không cài đặt, sử dụng phần mềm không có bản quyền hoặc công cụ trái phép trên máy tính/thiết bị làm việc có thể gây rủi ro bảo mật cho hệ thống công ty.</p>
  <p>- Thực hiện các biện pháp bảo mật thông tin khi làm việc từ xa (remote), truy cập hệ thống nội bộ hoặc các công cụ quản lý dự án của công ty (Slack, Shotgrid, Perforce, Google Drive...).</p>
  <p>- Không chia sẻ thông tin đăng nhập, quyền truy cập hệ thống hoặc tài khoản nội bộ cho bất kỳ bên thứ ba nào.</p>
</div>

<div class="article">
  <div class="article-title">7. Bảo mật thông tin trên mạng xã hội:</div>
  <p>- Không đăng tải, chia sẻ screenshot, hình ảnh, video, đoạn mô tả nội dung dự án lên bất kỳ mạng xã hội, diễn đàn hay nền tảng công khai nào khi chưa có sự cho phép của công ty.</p>
  <p>- Không thảo luận về tiến độ, nội dung hay khách hàng của dự án tại các kênh công khai dưới bất kỳ hình thức nào.</p>
</div>

<div class="article">
  <div class="article-title">8. Trách nhiệm khi vi phạm:</div>
</div>
<div class="article">
  <p>- Nếu vi phạm các điều khoản trong cam kết này, bên cam kết chịu hoàn toàn trách nhiệm trước pháp luật về hành vi vi phạm bảo mật thông tin, vi phạm bản quyền và sở hữu trí tuệ.</p>
  <p>- Phải bồi thường toàn bộ thiệt hại thực tế phát sinh (bao gồm thiệt hại từ phía khách hàng quốc tế) theo quy định của công ty và pháp luật hiện hành.</p>
</div>

<p class="intro-text">Cam kết này có hiệu lực kể từ ngày ký và kéo dài trong suốt thời gian hợp tác với công ty và ít nhất 02 (hai) năm sau khi chấm dứt hợp đồng lao động hoặc hợp tác dưới mọi hình thức.</p>

<p class="intro-text">Hai bên thống nhất lập biên bản cam kết bảo mật thông tin theo những nội dung như trên. Biên bản được lập thành 02 (hai) bản giống nhau, mỗi bên giữ một bản có giá trị pháp lý tương đương nhau.</p>

${signatureBlock('BÊN CAM KẾT', '(Ký và ghi rõ họ tên)', 'BÊN TIẾP NHẬN CAM KẾT', '(Ký, đóng dấu và ghi rõ họ tên)')}

</body></html>`;
}

// ══════════════════════════════════════════════════════════════
// ── Print Helper ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export function printContract(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };
}

export type ContractType = 'hdld' | 'hdtv' | 'nda' | 'hdkv' | 'nda_ctv' | 'hdctv';

export const CONTRACT_TYPES_FULLTIME: { key: ContractType; label: string; icon: string; description: string }[] = [
  { key: 'hdld', label: 'Hợp đồng Lao động', icon: '📋', description: 'HĐLĐ – Hợp đồng chính thức 12 tháng' },
  { key: 'hdtv', label: 'Hợp đồng Thử việc', icon: '📝', description: 'HĐTV – Thử việc 2 tháng, 100% lương' },
  { key: 'nda', label: 'Cam kết Bảo mật', icon: '🔒', description: 'NDA – Bảo mật thông tin dự án' },
  { key: 'hdctv', label: 'HĐ Cộng tác viên', icon: '🎓', description: 'HĐCTV – Hợp đồng CTV thiết kế (Intern)' },
];

export const CONTRACT_TYPES_FREELANCER: { key: ContractType; label: string; icon: string; description: string }[] = [
  { key: 'hdkv', label: 'Hợp đồng Khoán việc', icon: '📄', description: 'HĐKV – Hợp đồng dịch vụ CTV/Freelancer' },
  { key: 'hdctv', label: 'HĐ Cộng tác viên', icon: '🎓', description: 'HĐCTV – Hợp đồng CTV thiết kế (Intern)' },
  { key: 'nda_ctv', label: 'Thỏa thuận Bảo mật', icon: '🔐', description: 'NDA CTV – Bảo mật thông tin chi tiết' },
];

export const CONTRACT_TYPES = [...CONTRACT_TYPES_FULLTIME, ...CONTRACT_TYPES_FREELANCER];

// ══════════════════════════════════════════════════════════════
// ── 4. HĐKV – Hợp đồng khoán việc (Freelancer) ──────────────
// ══════════════════════════════════════════════════════════════

export function generateHDKV(
  employee: HrEmployee,
  signingDate: string,
  contractNumber: string,
  projectName: string,
  workScope: string,
  companyKey: CompanyKey = 'tdgames',
): string {
  const d = fmtDateParts(signingDate);
  const c = COMPANY_OPTIONS[companyKey];

  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>HĐKV - ${employee.full_name}</title>
<style>${PRINT_CSS}</style></head><body>

${nationalHeader()}
<div class="contract-title">HỢP ĐỒNG KHOÁN VIỆC</div>
<div class="contract-number">(V/v: ${projectName})</div>
<div class="contract-number">Số: ${contractNumber || '......'}/HĐKV-${employee.full_name || ''}</div>

<div class="article">
  <p>Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</p>
  <p>Căn cứ Luật Sở hữu trí tuệ số 50/2005/QH11, được sửa đổi bổ sung năm 2022;</p>
  <p>Căn cứ Nhu cầu hợp tác sản xuất nội dung ${workScope} cho dự án ${projectName} của Bên A và năng lực chuyên môn của Bên B.</p>
  <p>Hôm nay, ngày ${d.day} tháng ${d.month} năm ${d.year}, tại TD Consulting, hai bên gồm có:</p>
</div>

<div class="article-title">I. THÔNG TIN CÁC BÊN</div>

<div class="party-header">BÊN A (Bên thuê dịch vụ):</div>
<table class="info-table">
  <tr><td class="label">Tên công ty</td><td class="colon">:</td><td class="value">${c.nameShort}</td></tr>
  <tr><td class="label">Địa chỉ</td><td class="colon">:</td><td class="value">${c.address}</td></tr>
  <tr><td class="label">Mã số thuế</td><td class="colon">:</td><td class="value">${c.taxCode}</td></tr>
  <tr><td class="label">Đại diện</td><td class="colon">:</td><td class="value">${c.gender} ${c.representative}</td></tr>
  <tr><td class="label">Chức vụ</td><td class="colon">:</td><td class="value">${c.representativeTitle}</td></tr>
</table>
<p class="called-as">(Sau đây gọi tắt là "Bên A")</p>

<div class="party-header">BÊN B (Cá nhân cung cấp dịch vụ):</div>
<table class="info-table">
  <tr><td class="label">Họ và tên</td><td class="colon">:</td><td class="value"><strong>${blank(employee.full_name)}</strong></td></tr>
  <tr><td class="label">Ngày sinh</td><td class="colon">:</td><td class="value">${fmtDate(employee.date_of_birth)}</td></tr>
  <tr><td class="label">Giới tính</td><td class="colon">:</td><td class="value">${genderVi(employee.gender)}</td></tr>
  <tr><td class="label">Số CCCD/CMND</td><td class="colon">:</td><td class="value">${blank(employee.id_number)}</td></tr>
  <tr><td class="label">Ngày cấp</td><td class="colon">:</td><td class="value">${fmtDate(employee.id_issue_date)}</td></tr>
  <tr><td class="label">Nơi cấp</td><td class="colon">:</td><td class="value">${blank(employee.id_issue_place)}</td></tr>
  <tr><td class="label">Địa chỉ</td><td class="colon">:</td><td class="value">${blank(employee.address)}</td></tr>
  <tr><td class="label">Số điện thoại/Email</td><td class="colon">:</td><td class="value">${blank(employee.phone)}${employee.email ? ' / ' + employee.email : ''}</td></tr>
</table>
<p class="called-as">(Sau đây gọi tắt là "Bên B")</p>

<div class="article">
  <div class="article-title">II. NỘI DUNG VÀ PHẠM VI DỊCH VỤ</div>
  <p>Bên B cung cấp các thiết kế hoặc thực hiện các công việc liên quan đến ${workScope} theo yêu cầu của từng Phụ lục Hợp đồng được ký kèm.</p>
  <p>Mỗi Phụ lục sẽ mô tả cụ thể:</p>
  <ul>
    <li>Tên dự án, hạng mục công việc;</li>
    <li>Thời hạn hoàn thành;</li>
    <li>Yêu cầu kỹ thuật và sản phẩm bàn giao;</li>
    <li>Mức thù lao, phương thức thanh toán.</li>
  </ul>
  <p>Bên B tự chịu trách nhiệm về phương tiện, thiết bị, thời gian và cách thức thực hiện để hoàn thành đúng tiến độ, chất lượng đã thỏa thuận.</p>
  <p>Bên A có quyền yêu cầu chỉnh sửa trong phạm vi hợp lý để đảm bảo sản phẩm đáp ứng yêu cầu của khách hàng.</p>
</div>

<div class="article">
  <div class="article-title">III. NGHIỆM THU VÀ THANH TOÁN</div>
  <p>Sau khi Bên B hoàn thành công việc, hai bên tiến hành nghiệm thu sản phẩm.</p>
  <p>Bên A thanh toán thù lao cho Bên B sau khi có kết quả nghiệm thu.</p>
  <p>Mức thù lao, hình thức chuyển khoản hoặc tiền mặt được ghi rõ trong từng Phụ lục.</p>
  <p>Thuế TNCN (nếu có) sẽ được bên A kê khai và nộp hộ bên B.</p>
</div>

<div class="article">
  <div class="article-title">IV. QUYỀN VÀ NGHĨA VỤ CỦA CÁC BÊN</div>
  <p><strong>1. Quyền và nghĩa vụ của Bên A</strong></p>
  <p><strong>a, Quyền của Bên A</strong></p>
  <p>Yêu cầu chỉnh sửa trong phạm vi hợp lý theo mục II; phạm vi cụ thể, số vòng và tiêu chí đánh giá do từng Phụ lục quy định.</p>
  <p>Yêu cầu Bên B tuân thủ tiến độ, chất lượng, tiêu chuẩn kỹ thuật và brand guideline.</p>
  <p>Tạm dừng, thay đổi, bổ sung yêu cầu công việc; mọi phát sinh ngoài phạm vi Phụ lục sẽ được hai bên thống nhất chi phí và thời hạn bằng văn bản.</p>
  <p>Từ chối nghiệm thu đối với sản phẩm không đáp ứng yêu cầu đã thỏa thuận, kèm nêu rõ nội dung cần khắc phục.</p>
  <p>Quyền sở hữu, khai thác, sử dụng Sản phẩm bàn giao theo điều khoản Sở hữu trí tuệ tại mục này và/hoặc theo từng Phụ lục sau khi đã thanh toán đầy đủ.</p>
  <p>Quyền đơn phương chấm dứt hợp đồng theo điều khoản tại mục V khi Bên B vi phạm nghiêm trọng nghĩa vụ và không khắc phục trong thời hạn hợp lý.</p>
  <p><strong>b, Nghĩa vụ của Bên A</strong></p>
  <p>Cung cấp brief, dữ liệu, tài liệu, guideline, tài khoản truy cập, tài nguyên (nếu có) và phản hồi/duyệt đúng thời hạn quy định trong Phụ lục.</p>
  <p>Thanh toán đúng thời hạn theo mục III và phương thức trong từng Phụ lục; thực hiện kê khai, nộp hộ Thuế TNCN cho Bên B (nếu có) theo quy định.</p>
  <p>Chỉ định đầu mối liên hệ và người có thẩm quyền phê duyệt.</p>
  <p>Bảo đảm các tài nguyên do Bên A cung cấp (như hình ảnh, nhạc, font, nhân vật, thương hiệu) có đầy đủ quyền sử dụng; Bên A chịu trách nhiệm nếu phát sinh tranh chấp từ các tài nguyên do mình cung cấp.</p>
  <p>Giữ bảo mật các thông tin, dữ liệu, quy trình, báo giá và tài liệu nhận được từ Bên B.</p>
</div>

<div class="article">
  <p><strong>2. Quyền và nghĩa vụ của Bên B</strong></p>
  <p><strong>a, Quyền của Bên B</strong></p>
  <p>Chủ động lựa chọn phương tiện, thiết bị, quy trình và nhân sự để hoàn thành công việc, miễn đáp ứng đúng tiêu chuẩn và tiến độ đã cam kết.</p>
  <p>Đề xuất giải pháp kỹ thuật, nghệ thuật nhằm tối ưu chất lượng, chi phí, thời gian.</p>
  <p>Từ chối các yêu cầu vượt phạm vi Phụ lục hoặc vi phạm pháp luật/quy chuẩn; đề xuất điều chỉnh Phụ lục khi có phát sinh.</p>
  <p>Được tạm dừng/giãn tiến độ hợp lý khi Bên A chậm cung cấp thông tin, phản hồi, phê duyệt; thời hạn sẽ được điều chỉnh tương ứng.</p>
  <p>Sau khi được Bên A chấp thuận bằng văn bản, Bên B có thể trích dẫn Sản phẩm trong portfolio với phạm vi không tiết lộ bí mật kinh doanh.</p>
  <p><strong>b, Nghĩa vụ của Bên B</strong></p>
  <p>Thực hiện công việc đúng mô tả, tiêu chuẩn kỹ thuật, mốc tiến độ và quy định về chất lượng trong từng Phụ lục; bảo đảm Sản phẩm có thể vận hành/hiển thị đúng như đã thỏa thuận trên các nền tảng đích.</p>
  <p>Thực hiện chỉnh sửa trong phạm vi hợp lý đã thỏa thuận; trường hợp vượt phạm vi, phải báo giá phát sinh và được Bên A chấp thuận trước khi triển khai.</p>
  <p>Đảm bảo Sản phẩm không vi phạm quyền sở hữu trí tuệ của bên thứ ba đối với các thành phần do Bên B tự tạo hoặc cấp phép; xuất trình chứng từ bản quyền khi được yêu cầu.</p>
  <p>Bảo mật toàn bộ thông tin, dữ liệu, tài liệu nhận từ Bên A; chỉ sử dụng cho mục đích thực hiện Hợp đồng.</p>
  <p>Bàn giao đúng và đủ các hạng mục nêu tại Phụ lục: file xuất, file nguồn/không nguồn, định dạng, độ phân giải, fps, kịch bản, storyboard, thoại, subtitle, audio, project file… theo đúng thỏa thuận.</p>
  <p>Thực hiện bảo hành kỹ thuật trong thời hạn do Phụ lục quy định đối với lỗi do Bên B gây ra (nếu có), không bao gồm yêu cầu thay đổi phạm vi hoặc nội dung sáng tạo.</p>
  <p>Phối hợp nghiệm thu, cung cấp hóa đơn/chứng từ theo quy định để phục vụ thanh toán.</p>
</div>

<div class="article">
  <p><strong>3. Phối hợp, phê duyệt và tiến độ</strong></p>
  <p>Thời hạn phản hồi/duyệt của Bên A cho từng mốc (kịch bản, storyboard, animatic, bản nháp, bản final) sẽ được quy định trong Phụ lục; chậm phản hồi dẫn đến điều chỉnh tương ứng mốc tiến độ.</p>
  <p>Việc nghiệm thu thực hiện theo mục IV; nếu Sản phẩm chưa đạt, Bên B khắc phục theo phản hồi hợp lý của Bên A và bàn giao lại để nghiệm thu.</p>
</div>

<div class="article">
  <div class="article-title">V. QUYỀN SỞ HỮU TRÍ TUỆ</div>
  <p><strong>1. Đối tượng chuyển giao</strong></p>
  <p>Sản phẩm: Thiết kế nhân vật game, bao gồm toàn bộ bản vẽ, tạo hình, ý tưởng, file gốc, bản thảo, tài liệu mô tả, hiệu ứng, câu chuyện, tài sản hình thành trong quá trình làm việc theo yêu cầu của Bên A.</p>
  <p><strong>2. Phạm vi chuyển giao</strong></p>
  <p>Bên B cam kết chuyển giao toàn bộ, vĩnh viễn, không điều kiện và trên phạm vi toàn cầu cho Bên A toàn bộ quyền tài sản đối với sản phẩm thiết kế nhân vật hoạt hình quy định tại Điều 2 của Hợp đồng. Quyền sở hữu trí tuệ được chuyển giao độc lập với việc thanh toán và không phụ thuộc vào việc Bên B còn hoặc không hợp tác với Bên A, kể từ thời điểm sản phẩm được tạo ra theo yêu cầu của bên A.</p>
  <p>Phạm vi chuyển giao bao gồm cả các sản phẩm chưa hoàn thiện, bản nháp, bản thử nghiệm, ý tưởng dang dở, phác thảo, phiên bản trung gian dù đã hoặc chưa được nghiệm thu và mọi cải tiến, chỉnh sửa, nâng cấp tiếp theo của sản phẩm được tạo ra bởi bên B trong thời gian hợp tác, kể cả sau khi cam kết này chấm dứt nếu các cải tiến đó dựa trên hoặc phát sinh từ sản phẩm gốc.</p>
  <p>Quyền tài sản bao gồm nhưng không giới hạn:</p>
  <ul>
    <li>Quyền làm chủ sở hữu tác phẩm;</li>
    <li>Quyền khai thác, sử dụng, sao chép, sửa đổi, cải biên, phát triển, kết hợp, phân phối, truyền đạt, chuyển nhượng, cấp phép lại, thương mại hóa;</li>
    <li>Quyền tạo ra tác phẩm phái sinh, bao gồm nhưng không giới hạn: các phiên bản 2D, 3D, animation, game asset, merchandise, hình ảnh quảng bá, bản mở rộng và các phiên bản phát triển tiếp theo của nhân vật;</li>
    <li>Quyền sử dụng cho mọi mục đích hợp pháp, không giới hạn phương tiện, nền tảng và hình thức khai thác.</li>
    <li>Bên B cam kết không giữ lại bất kỳ quyền, lợi ích hay quyền sử dụng nào đối với sản phẩm; đồng thời từ bỏ và không thực hiện quyền phản đối, khiếu nại hoặc yêu cầu hạn chế đối với việc Bên A sử dụng, sửa đổi, phát triển sản phẩm dưới bất kỳ hình thức nào.</li>
  </ul>
  <p>Đối với quyền nhân thân theo Điều 19 Luật Sở hữu trí tuệ:</p>
  <ul>
    <li>Bên B cam kết không thực hiện các quyền nhân thân theo Điều 19 Luật Sở hữu trí tuệ, trong phạm vi pháp luật cho phép, ngoại trừ quyền được nêu tên (nếu có).</li>
    <li>Bên B uỷ quyền không huỷ ngang và không điều kiện cho Bên A toàn quyền quyết định việc đặt tên tác phẩm, công bố tác phẩm, sửa đổi, cắt xén, phát triển tác phẩm trong phạm vi pháp luật cho phép.</li>
  </ul>
  <p>Bên B cam kết và bảo đảm rằng:</p>
  <ul>
    <li>Sản phẩm là tác phẩm do chính Bên B trực tiếp sáng tạo, không sao chép, không vi phạm quyền sở hữu trí tuệ của bất kỳ bên thứ ba nào;</li>
    <li>Mọi tài nguyên, asset, công cụ, phần mềm, dữ liệu sử dụng (nếu có) đều hợp pháp và cho phép chuyển giao quyền sử dụng thương mại;</li>
    <li>Bên B chịu hoàn toàn trách nhiệm và bồi thường cho Bên A nếu phát sinh bất kỳ khiếu nại, tranh chấp nào liên quan đến quyền sở hữu trí tuệ của sản phẩm.</li>
    <li>Trừ khi có thoả thuận bằng văn bản của Bên A, Bên B không được phép sử dụng sản phẩm cho mục đích portfolio, quảng bá, trưng bày, đào tạo AI, phát hành NFT, hoặc cung cấp cho bất kỳ bên thứ ba nào.</li>
  </ul>
  <p><strong>3. Cam kết về tính hợp pháp</strong></p>
  <p>Bên B cam kết mọi sản phẩm bàn giao là do chính mình sáng tạo, không sao chép hoặc vi phạm quyền sở hữu trí tuệ của bất kỳ tổ chức, cá nhân nào khác.</p>
  <p>Trường hợp Bên A bị khiếu kiện, tranh chấp liên quan đến quyền sở hữu trí tuệ với sản phẩm do Bên B bàn giao, Bên B chịu hoàn toàn trách nhiệm và bồi thường mọi thiệt hại phát sinh.</p>
  <p><strong>4. Bảo mật & hạn chế sử dụng</strong></p>
  <p>Bên B cam kết không được tiết lộ, sử dụng, chuyển giao, phát triển riêng sản phẩm cho bên thứ ba ngoài phạm vi hợp đồng/hướng dẫn của Bên A.</p>
</div>

<div class="article">
  <div class="article-title">VI. HIỆU LỰC HỢP ĐỒNG</div>
  <p>Hợp đồng này có hiệu lực kể từ ngày ký và kéo dài cho đến khi hai bên hoàn thành nghĩa vụ theo các Phụ lục.</p>
  <p>Các Phụ lục được ký sau là bộ phận không tách rời của Hợp đồng này.</p>
  <p>Hai bên có thể chấm dứt hợp đồng trước thời hạn bằng văn bản, với điều kiện hoàn thành mọi nghĩa vụ thanh toán hoặc bàn giao dở dang.</p>
</div>

<div class="article">
  <div class="article-title">VII. GIẢI QUYẾT TRANH CHẤP</div>
  <p>Mọi tranh chấp phát sinh được hai bên ưu tiên giải quyết bằng thương lượng.</p>
  <p>Trường hợp không đạt được thỏa thuận, tranh chấp sẽ được giải quyết tại Tòa án có thẩm quyền nơi Bên A đặt trụ sở.</p>
</div>

<div class="article">
  <div class="article-title">VIII. ĐIỀU KHOẢN CHUNG</div>
  <p>Hai bên cam kết đã đọc kỹ, hiểu rõ nội dung và tự nguyện ký kết hợp đồng.</p>
  <p>Hợp đồng này có hiệu lực từ ngày ký, ràng buộc nghĩa vụ đối với các bên theo quy định pháp luật.</p>
  <p>Hợp đồng có thể được sửa đổi, bổ sung bằng văn bản có sự nhất trí của cả hai bên.</p>
  <p>Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
</div>

${signatureBlock('ĐẠI DIỆN BÊN A', '(Ký, ghi rõ họ tên, đóng dấu)', 'ĐẠI DIỆN BÊN B', '(Ký, ghi rõ họ tên)')}

</body></html>`;
}

// ══════════════════════════════════════════════════════════════
// ── 5. NDA CTV – Thỏa thuận bảo mật (Freelancer) ────────────
// ══════════════════════════════════════════════════════════════

export function generateNDA_CTV(
  employee: HrEmployee,
  signingDate: string,
  companyKey: CompanyKey = 'tdgames',
): string {
  const d = fmtDateParts(signingDate);
  const c = COMPANY_OPTIONS[companyKey];

  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>NDA CTV - ${employee.full_name}</title>
<style>${PRINT_CSS}</style></head><body>

${nationalHeader()}
<div class="contract-title">THỎA THUẬN BẢO MẬT THÔNG TIN</div>

<p class="intro-text">THỎA THUẬN BẢO MẬT THÔNG TIN này ("Thỏa thuận") được lập vào ngày ${d.day} tháng ${d.month} năm ${d.year}, GIỮA:</p>

<div class="party-header">BÊN A: ${c.name}</div>
<table class="info-table">
  <tr><td class="label">Địa chỉ</td><td class="colon">:</td><td class="value">${c.address}</td></tr>
  <tr><td class="label">Mã số thuế</td><td class="colon">:</td><td class="value">${c.taxCode}</td></tr>
  <tr><td class="label">Đại diện bởi</td><td class="colon">:</td><td class="value">${c.gender} ${c.representative}</td></tr>
  <tr><td class="label">Chức vụ</td><td class="colon">:</td><td class="value">${c.representativeTitle}</td></tr>
</table>
<p class="called-as">(Sau đây gọi tắt là "Bên A")</p>

<div class="party-header">BÊN B:</div>
<table class="info-table">
  <tr><td class="label">Họ và tên</td><td class="colon">:</td><td class="value"><strong>${blank(employee.full_name)}</strong></td></tr>
  <tr><td class="label">Ngày tháng năm sinh</td><td class="colon">:</td><td class="value">${fmtDate(employee.date_of_birth)}</td></tr>
  <tr><td class="label">Giới tính</td><td class="colon">:</td><td class="value">${genderVi(employee.gender)}</td></tr>
  <tr><td class="label">Địa chỉ</td><td class="colon">:</td><td class="value">${blank(employee.address)}</td></tr>
  <tr><td class="label">Điện thoại</td><td class="colon">:</td><td class="value">${blank(employee.phone)}</td></tr>
  <tr><td class="label">Số CCCD/CMT/Passport</td><td class="colon">:</td><td class="value">${blank(employee.id_number)}</td></tr>
</table>
<p class="called-as">(Sau đây gọi tắt là "Bên B")</p>

<div class="article">
  <p><strong>XÉT VÌ:</strong></p>
  <p>Các Bên dự định thiết lập và duy trì quan hệ hợp tác lâu dài, bao gồm toàn bộ các dự án, hạng mục công việc phát sinh trong quá trình hợp tác giữa hai bên ("Dự án").</p>
  <p>Để thực hiện mục tiêu của Dự án, Các Bên đồng ý tiết lộ một số Thông tin mật (như định nghĩa dưới đây) liên quan đến Dự án kèm theo yêu cầu bảo mật tuyệt đối và trên cơ sở các điều khoản và điều kiện sau.</p>
  <p>Các Bên thống nhất Thỏa thuận này với điều khoản và điều kiện như sau:</p>
</div>

<div class="article">
  <div class="article-title">Điều 1. BÊN CUNG CẤP THÔNG TIN VÀ BÊN NHẬN THÔNG TIN</div>
  <p>Liên quan đến mục đích của Thỏa thuận này, các bên cung cấp tất cả thông tin liên quan đến Thỏa thuận sẽ được gọi là "Bên cung cấp thông tin/ Bên Tiết Lộ" và bên nhận tất cả những thông tin đó sẽ được gọi là "Bên nhận thông tin/Bên Nhận".</p>
</div>

<div class="article">
  <div class="article-title">Điều 2. XÁC NHẬN THÔNG TIN</div>
  <p>Định nghĩa: Thuật ngữ "Thông tin mật" được dùng trong Thỏa thuận này được hiểu là bất kỳ hoặc tất cả mọi thông tin và các tài liệu khác do Bên cung cấp thông tin cung cấp và truyền đạt cho Bên nhận thông tin và giám đốc, cán bộ, nhân viên, đại diện hoặc đại lý của Bên nhận thông tin (sau đây gọi chung là "Người đại diện"), được quy định, chỉ rõ hoặc ghi chú "mật" hoặc những thông tin mà mục đích của nó chỉ dành cho Bên nhận thông tin. Để tránh hiểu nhầm, Thông tin mật được xem như bao gồm (nhưng không giới hạn) (a) các loại thông tin sau, hoặc các thông tin khác có bản chất tương tự, được trình bày hoặc không được trình bày dưới dạng văn bản: phát kiến, ý tưởng, khái niệm, giấy tờ, phần mềm tại mọi giai đoạn phát triển, thiết kế, bản vẽ, thông số kỹ thuật, quy cách kỹ thuật, kiểu dáng, nguyên mẫu, dữ liệu, mã nguồn, mã đối tượng, tài liệu, sách hướng dẫn, sơ đồ, biểu đồ phát triển, lược đồ, nghiên cứu, quy trình, thủ tục, chức năng, "bí quyết", kỹ thuật và tài liệu marketing, kế hoạch marketing và phát triển, tên khách hàng và các thông tin liên quan đến khách hàng, báo giá, chính sách giá và các thông tin tài chính; (b) bất kỳ thông tin nào do bên thứ ba tiết lộ cho Bên cung cấp thông tin có ràng buộc bởi nghĩa vụ bảo mật; cũng như (c) các thông tin do Bên nhận thông tin và/hoặc Người đại diện soạn thảo và phát triển có sử dụng bất kỳ phần nào của Thông tin mật.</p>
  <p>Định nghĩa trên không bao gồm: Ngay cả trong trường hợp Thỏa thuận này có quy định khác đi, các Bên thừa nhận rằng Thông tin bí mật không bao gồm các thông tin:</p>
  <p>Đã hoặc sẽ được phổ biến rộng rãi không do vi phạm Thỏa thuận này;</p>
  <p>Không kèm theo nghĩa vụ bảo mật, đã thuộc sở hữu của Bên nhận thông tin từ trước đó, không phải do Bên cung cấp thông tin trao, cung cấp, chuyển giao, bán hoặc tiết lộ bằng cách khác (trực tiếp hoặc gián tiếp), mà Bên nhận thông tin có thể chứng minh bằng các tài liệu văn bản;</p>
  <p>Do Bên nhận thông tin nhận được một cách hợp pháp không kèm theo nghĩa vụ bảo mật từ bên thứ ba – thông tin mà trước đó cũng được cung cấp cho bên thứ ba không đòi hỏi nghĩa vụ bảo mật; hoặc phải được công khai theo quy định của pháp luật.</p>
</div>

<div class="article">
  <div class="article-title">Điều 3. NGHĨA VỤ BẢO MẬT</div>
  <p><strong>Nghĩa vụ chung:</strong> Trên cơ sở xem xét việc tiết lộ Thông tin mật của Bên cung cấp thông tin, Bên nhận thông tin cam kết và đảm bảo rằng Người đại diện của mình sẽ tuyệt đối giữ bí mật đối với các Thông tin mật đó và tuân thủ nghiêm ngặt những quy định của Thỏa thuận này.</p>
  <p><strong>Mục đích:</strong> Bên nhận thông tin cam kết rằng bản thân Bên nhận thông tin và Người đại diện của Bên nhận thông tin chỉ sử dụng Thông tin mật cho mục đích thực hiện Dự án.</p>
  <p><strong>Người đại diện:</strong> Bên nhận thông tin sẽ áp dụng mọi biện pháp và cách thức để hạn chế đến mức thấp nhất rủi ro đối với việc bị lộ Thông tin mật bằng cách đảm bảo rằng chỉ duy nhất Người đại diện – người trực tiếp liên quan đến Dự án và có nghĩa vụ nắm bắt toàn bộ hoặc một phần Thông tin mật - được tiếp cận phần Thông tin mật liên quan phù hợp với yêu cầu công việc.</p>
  <p><strong>Quản lý, Lưu giữ và Hoàn trả:</strong> Bên nhận thông tin phải lưu giữ các Thông tin mật riêng rẽ với các tài liệu và sổ sách khác của mình. Đồng thời, Bên nhận thông tin phải bảo đảm an toàn và kiểm soát Thông tin mật được lưu giữ dưới dạng tài liệu hoặc hình thức hữu hình khác. Theo yêu cầu của Bên cung cấp thông tin vào bất kỳ thời điểm nào, hoặc khi Hai Bên quyết định không tham gia dự án, hoặc khi chấm dứt dự án, tùy theo điều kiện nào xảy ra trước, Bên nhận thông tin phải nhanh chóng hoàn trả cho Bên cung cấp thông tin (đồng thời ngừng sử dụng) toàn bộ Thông tin mật và toàn bộ các tài liệu, giấy tờ chứa hoặc tạo thành Thông tin mật, bao gồm các bản sao hoặc mô phỏng của các tài liệu đó.</p>
  <p><strong>Không tiết lộ thông tin cho bên thứ ba:</strong> Bên nhận thông tin cam kết không được tiết lộ, cung cấp, chuyển giao, công bố hoặc làm lộ trực tiếp hay gián tiếp toàn bộ hoặc một phần Thông tin mật cho bất kỳ bên thứ ba nào dưới bất kỳ hình thức nào nếu không có sự chấp thuận trước bằng văn bản của Bên cung cấp thông tin, trừ các trường hợp theo Điều 6.</p>
  <p>Trong thời hạn hiệu lực của Thỏa thuận và trong vòng 24 tháng kể từ ngày chấm dứt Thỏa thuận hợp tác, Bên nhận thông tin cam kết không trực tiếp hoặc gián tiếp, tự mình hoặc thông qua bất kỳ bên thứ ba nào, tiếp cận, liên hệ, chào mời, thiết lập quan hệ hợp tác, ký kết hợp đồng, tuyển dụng, lôi kéo hoặc có bất kỳ hành vi nào nhằm thiết lập quan hệ kinh doanh hoặc quan hệ lao động với khách hàng, đối tác hoặc nhân sự của Bên cung cấp thông tin mà Bên nhận biết được thông qua Thỏa thuận này.</p>
  <p><strong>Không cạnh tranh và không sử dụng Thông tin mật gây bất lợi cho Bên cung cấp thông tin:</strong> Bên nhận thông tin không được sử dụng Thông tin mật, danh sách khách hàng, thông tin dự án, đơn giá, mô hình kinh doanh hoặc bất kỳ thông tin kinh doanh nào của Bên cung cấp thông tin nhằm mục đích cạnh tranh hoặc gây ảnh hưởng bất lợi đến hoạt động kinh doanh của Bên cung cấp thông tin.</p>
</div>

<div class="article">
  <div class="article-title">Điều 4. TÀI SẢN CỦA CÁC BÊN</div>
  <p>Toàn bộ Thông tin mật được tiết lộ theo Thỏa thuận này vẫn thuộc sở hữu của Bên cung cấp thông tin. Dù được quy định rõ ràng, ngụ ý hoặc bằng cách khác, không điều khoản nào trong Thỏa thuận này được hiểu là việc trao quyền hoặc cấp giấy phép của Bên cung cấp thông tin đối với việc sử dụng bất cứ Thông tin mật nào (bao gồm nhưng không giới hạn tới quyền sở hữu trí tuệ) cho Bên nhận thông tin.</p>
</div>

<div class="article">
  <div class="article-title">Điều 5. TIẾT LỘ THEO Ý MUỐN CỦA BÊN CUNG CẤP THÔNG TIN</div>
  <p>Không điều khoản nào trong Thỏa thuận này được hiểu là có quy định buộc Bên cung cấp thông tin phải tiết lộ bất kỳ Thông tin mật nào cho Bên nhận thông tin hoặc Người đại diện.</p>
</div>

<div class="article">
  <div class="article-title">Điều 6. TIẾT LỘ THEO LỆNH CỦA TÒA ÁN/YÊU CẦU CỦA CƠ QUAN CÓ THẨM QUYỀN</div>
  <p>Trong trường hợp Bên nhận thông tin hoặc Người đại diện của Bên nhận thông tin buộc phải tiết lộ Thông tin mật theo lệnh của tòa án hoặc yêu cầu của cơ quan nhà nước có thẩm quyền hoặc quy định khác của pháp luật, Bên nhận thông tin phải thông báo ngay cho Bên cung cấp thông tin để Bên cung cấp thông tin có cơ hội bác bỏ việc tiết lộ thông tin đó. Nếu không thể bác bỏ được, Bên nhận thông tin và/hoặc Người đại diện chỉ được tiết lộ Thông tin mật trong phạm vi cần thiết theo lệnh của tòa án và yêu cầu của chính phủ.</p>
</div>

<div class="article">
  <div class="article-title">Điều 7. THÔNG BÁO VỀ VIỆC CÔNG BỐ TRÁI PHÉP, LẠM DỤNG HOẶC SỬ DỤNG SAI MỤC ĐÍCH ĐỐI VỚI THÔNG TIN MẬT</div>
  <p>Khi được thông báo hoặc được biết về việc sử dụng trái phép hoặc tiết lộ, lạm dụng và sử dụng sai mục đích đối với Thông tin mật, Bên nhận thông tin và Người đại diện phải thông báo ngay cho Bên cung cấp thông tin.</p>
</div>

<div class="article">
  <div class="article-title">Điều 8. KHÔNG CAM KẾT, BẢO ĐẢM HOẶC BẢO LÃNH</div>
  <p>Bất kỳ Thông tin mật nào được Bên cung cấp thông tin tiết lộ cũng không tạo thành cam kết, bảo đảm hoặc bảo lãnh cho Bên nhận thông tin; đồng thời, Bên cung cấp thông tin không có trách nhiệm hay nghĩa vụ về việc bảo đảm hoặc bảo lãnh nào đối với Bên nhận thông tin.</p>
</div>

<div class="article">
  <div class="article-title">Điều 9. CHUYỂN NHƯỢNG</div>
  <p>Bên nhận thông tin không được phép chuyển nhượng Thỏa thuận này (hoặc một phần của Thỏa thuận) mà không được Bên cung cấp thông tin chấp thuận trước bằng văn bản.</p>
</div>

<div class="article">
  <div class="article-title">Điều 10. BỒI THƯỜNG THIỆT HẠI</div>
  <p>Trong bất kỳ trường hợp nào, nếu Bên Tiết Lộ và/hoặc khách hàng của Bên Tiết Lộ phát hiện ra Thông tin mật bị tiết lộ ra bên ngoài hoặc sử dụng sai mục đích bởi Bên Nhận hoặc bất kỳ nhân viên hiện thời hay nhân viên cũ của Bên Nhận, gây thiệt hại lập tức hoặc có thể xảy ra trong tương lai mà thiệt hại đó có thể xác định được, thì Bên Nhận phải bồi thường thiệt hại cũng như chịu các trách nhiệm pháp lý có liên quan. Cụ thể như sau: Tùy vào tính chất và mức độ vi phạm, Bên vi phạm còn phải chịu trách nhiệm bồi thường toàn bộ thiệt hại cho Bên Tiết Lộ, bao gồm nhưng không giới hạn các thiệt hại về chi phí đầu tư, doanh thu, uy tín, chi phí cho việc khắc phục hậu quả và những thiệt hại mà lẽ ra Bên Tiết Lộ sẽ có được nếu như Thông tin mật không bị tiết lộ.</p>
  <p>Trong trường hợp vi phạm nghĩa vụ bảo mật, Bên vi phạm phải chịu mức phạt vi phạm là <strong>8% (tám phần trăm)</strong> tổng giá trị các Hợp đồng Khoán việc đã ký giữa hai bên, đồng thời bồi thường toàn bộ thiệt hại thực tế phát sinh (nếu có).</p>
  <p>Các bên đồng ý rằng nếu bất cứ bên nào vi phạm bất cứ nghĩa vụ nào trong Thỏa thuận này, ngoài chế tài phạt vi phạm, bồi thường thiệt hại trên đây, Bên vi phạm còn phải chịu các chế tài về việc xử lý hành vi cạnh tranh không lành mạnh theo quy định của pháp luật cạnh tranh.</p>
</div>

<div class="article">
  <div class="article-title">Điều 11. KHẮC PHỤC VI PHẠM</div>
  <p>Bên nhận thông tin hiểu rằng bất kỳ vi phạm nào đối với nghĩa vụ bảo mật quy định trong Thỏa thuận này cũng có thể gây ra những thiệt hại và mất mát không thể bù đắp cho Bên cung cấp thông tin – những thiệt hại khó có thể tính toán được và không thể bù đắp bằng tiền. Theo đó, ngoài những biện pháp khắc phục mà Bên cung cấp thông tin có thể yêu cầu thực hiện theo pháp luật, Bên cung cấp thông tin được phép thực hiện các biện pháp phù hợp khác để ngăn chặn việc Bên nhận thông tin tiếp tục vi phạm các nghĩa vụ của mình.</p>
</div>

<div class="article">
  <div class="article-title">Điều 12. THỜI HẠN THỎA THUẬN</div>
  <p>Thỏa thuận này có hiệu lực kể từ ngày ký và được duy trì trong suốt thời gian hợp tác giữa hai bên, và tiếp tục có hiệu lực trong vòng <strong>03 (ba) năm</strong> kể từ ngày chấm dứt quan hệ hợp tác cuối cùng giữa hai bên.</p>
</div>

<div class="article">
  <div class="article-title">Điều 13. THÔNG BÁO</div>
  <p>Các thư tín gửi theo Thỏa thuận này sẽ được lập thành văn bản và được gửi đến trực tiếp, hoặc qua thư bảo đảm có xác nhận của người nhận, fax hoặc thư điện tử (việc nhận thông báo qua fax hoặc thư điện tử phải được xác nhận bằng điện thoại hay hình thức khác theo thỏa thuận giữa các bên) đến địa chỉ ghi ở phần đầu Thỏa thuận.</p>
</div>

<div class="article">
  <div class="article-title">Điều 14. TỪ BỎ QUYỀN</div>
  <p>Việc Bên cung cấp thông tin không thực hiện, trì hoãn hoặc bỏ qua bất kỳ điều khoản nào của Thỏa thuận này không được hiểu hoặc được xem là việc Bên cung cấp thông tin từ bỏ bất kỳ quyền nào của mình theo Thỏa thuận này, cũng không ảnh hưởng đến hiệu lực của toàn bộ hay một phần nào của Thỏa thuận.</p>
</div>

<div class="article">
  <div class="article-title">Điều 15. HIỆU LỰC TỪNG PHẦN</div>
  <p>Nếu một điều khoản (hoặc một phần) của Thỏa thuận này bị xem là vi phạm pháp luật hiện hành, điều khoản (hoặc phần) đó sẽ bị xóa bỏ khỏi Thỏa thuận (không có hiệu lực áp dụng đối với các Bên). Từ thời điểm đó, Thỏa thuận này vẫn có hiệu lực đầy đủ và xem như điều khoản (hoặc phần) đó chưa từng được quy định trong Thỏa thuận.</p>
</div>

<div class="article">
  <div class="article-title">Điều 16. TOÀN BỘ THỎA THUẬN VÀ KHÔNG HỦY NGANG</div>
  <p>Thỏa thuận này (bao gồm các Phụ lục) tạo thành Toàn bộ thỏa thuận giữa các Bên liên quan đến đối tượng của Thỏa thuận, đồng thời thay thế toàn bộ các thỏa thuận, cam kết và biên bản (bằng văn bản hoặc bằng lời nói) trước đây giữa các bên về vấn đề liên quan. Thỏa thuận này (bao gồm các Phụ lục) có thể được sửa đổi và các quyền quy định tại Thỏa thuận có thể bị từ bỏ theo văn bản ký kết giữa các Bên. Thỏa thuận này là một giao dịch dân sự độc lập với các Hợp đồng, phụ lục hoặc thỏa thuận khác mà Các Bên đã và sẽ ký kết với nhau. Thỏa thuận này không hủy ngang, trừ khi được người có thẩm quyền ký Thỏa thuận của Hai Bên thống nhất bằng văn bản.</p>
</div>

<div class="article">
  <div class="article-title">Điều 17. LUẬT ĐIỀU CHỈNH VÀ THẨM QUYỀN XÉT XỬ</div>
  <p>Thỏa thuận này được điều chỉnh và hiểu theo quy định của pháp luật Việt Nam, bao gồm: Bộ Luật dân sự 2015, Luật Cạnh tranh 2018, pháp luật sở hữu trí tuệ và pháp luật có liên quan hiện hành. Nếu có tranh chấp phát sinh Tòa án có thẩm quyền của Việt Nam giải quyết theo quy định.</p>
  <p>Thỏa thuận này được lập thành 02 bản, mỗi bên giữ 01 bản.</p>
</div>

${signatureBlock('ĐẠI DIỆN BÊN A', '(Ký, ghi rõ họ tên, đóng dấu)', 'ĐẠI DIỆN BÊN B', '(Ký, ghi rõ họ tên)')}

</body></html>`;
}

// ══════════════════════════════════════════════════════════════
// ── 6. HĐCTV – Hợp đồng Cộng tác viên Thiết kế (Intern) ────
// ══════════════════════════════════════════════════════════════

export function generateHDCTV(
  employee: HrEmployee,
  signingDate: string,
  contractNumber: string,
  workScope: string,
  companyKey: CompanyKey = 'tdgames',
  rateOverride?: { amount: number; type: string; currency: string },
): string {
  const d = fmtDateParts(signingDate);
  const c = COMPANY_OPTIONS[companyKey];

  const rateAmount = rateOverride?.amount ?? employee.rate_amount;
  const rateType = rateOverride?.type ?? employee.rate_type;
  const rateCurrency = rateOverride?.currency ?? employee.rate_currency;

  const rateDisplay = rateAmount > 0
    ? `${fmt(rateAmount)} ${rateCurrency || 'VNĐ'}/${rateType === 'hourly' ? 'giờ' : rateType === 'monthly' ? 'tháng' : 'gói'}`
    : '……………………… đồng/gói';

  // Derive position: prefer employee.position, fallback to first specialization, then generic
  const positionDisplay = employee.position || (employee as any).specializations?.[0] || 'Thiết kế';

  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>HĐCTV - ${employee.full_name}</title>
<style>${PRINT_CSS}</style></head><body>

${nationalHeader()}
<div class="contract-title">HỢP ĐỒNG CỘNG TÁC VIÊN ${positionDisplay.toUpperCase()}</div>
<div class="contract-number">(Hợp đồng dịch vụ theo Bộ luật Dân sự 2015)</div>
<div class="contract-number">Số: ${contractNumber || '……'}/HĐCTV/${d.year}</div>

<div class="article">
  <p><strong>Căn cứ:</strong></p>
  <ul>
    <li>Bộ luật Dân sự nước CHXHCN Việt Nam số 91/2015/QH13 ngày 24/11/2015;</li>
    <li>Luật Sở hữu trí tuệ số 50/2005/QH11 và các văn bản sửa đổi, bổ sung;</li>
    <li>Luật Thuế thu nhập cá nhân số 04/2007/QH12 và Thông tư 111/2013/TT-BTC;</li>
    <li>Thông tư 40/2021/TT-BTC về thuế đối với cá nhân kinh doanh, cộng tác viên;</li>
    <li>Nhu cầu và năng lực thực tế của hai bên.</li>
  </ul>
  <p>Hôm nay, ngày ${d.day} tháng ${d.month} năm ${d.year}, hợp đồng cộng tác viên này (sau đây gọi là "Hợp đồng") được ký kết bởi các bên:</p>
</div>

<div class="party-header">BÊN SỬ DỤNG DỊCH VỤ (BÊN A):</div>
<table class="info-table">
  <tr><td class="label">Tên công ty</td><td class="colon">:</td><td class="value">${c.nameShort}</td></tr>
  <tr><td class="label">Đại diện</td><td class="colon">:</td><td class="value">${c.gender} ${c.representative}</td></tr>
  <tr><td class="label">Chức vụ</td><td class="colon">:</td><td class="value">${c.representativeTitle}</td></tr>
  <tr><td class="label">Địa chỉ</td><td class="colon">:</td><td class="value">${c.address}</td></tr>
  <tr><td class="label">Mã số thuế</td><td class="colon">:</td><td class="value">${c.taxCode}</td></tr>
  <tr><td class="label">Email</td><td class="colon">:</td><td class="value">tdgames.vn@gmail.com</td></tr>
</table>

<div class="party-header">CỘNG TÁC VIÊN (BÊN B):</div>
<table class="info-table">
  <tr><td class="label">Họ và tên</td><td class="colon">:</td><td class="value"><strong>${blank(employee.full_name)}</strong></td></tr>
  <tr><td class="label">Ngày tháng năm sinh</td><td class="colon">:</td><td class="value">${fmtDate(employee.date_of_birth)}</td></tr>
  <tr><td class="label">Giới tính</td><td class="colon">:</td><td class="value">${genderVi(employee.gender)}</td></tr>
  <tr><td class="label">Địa chỉ thường trú</td><td class="colon">:</td><td class="value">${blank(employee.address)}</td></tr>
  <tr><td class="label">Số CCCD/CMND</td><td class="colon">:</td><td class="value">${blank(employee.id_number)}</td></tr>
  <tr><td class="label">Điện thoại</td><td class="colon">:</td><td class="value">${blank(employee.phone)}</td></tr>
  <tr><td class="label">Email</td><td class="colon">:</td><td class="value">${blank(employee.email)}</td></tr>
  <tr><td class="label">Số tài khoản</td><td class="colon">:</td><td class="value">${blank(employee.bank_account)}</td></tr>
  <tr><td class="label">Ngân hàng</td><td class="colon">:</td><td class="value">${blank(employee.bank_name)}</td></tr>
</table>

<p class="called-as">Sau khi thỏa thuận, hai bên nhất trí ký kết hợp đồng với các điều khoản như sau:</p>

<div class="article">
  <div class="article-title">ĐIỀU 1: PHẠM VI CÔNG VIỆC VÀ THỜI HẠN HỢP ĐỒNG</div>
  <p>1.1. Loại hợp đồng: Hợp đồng cộng tác viên ${positionDisplay.toLowerCase()} (Hợp đồng dịch vụ).</p>
  <p>1.2. Thời hạn hợp đồng: 03 (ba) tháng kể từ ngày ký. Hợp đồng có thể được gia hạn bằng văn bản thỏa thuận của hai bên trước khi hết hạn.</p>
  <p>1.3. Địa điểm thực hiện: Làm việc từ xa (remote) hoặc tại văn phòng công ty.</p>
  <p>1.4. Vị trí công việc: Cộng tác viên ${positionDisplay}.</p>
  <p>1.5. Phạm vi công việc cụ thể: ${workScope || '...................................................'}</p>
  <p>1.6. Sản phẩm bàn giao, tiến độ và tiêu chuẩn chất lượng sẽ được chi tiết hóa tại Phụ lục đính kèm hoặc trong các trao đổi bằng văn bản được hai bên xác nhận.</p>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 2: THỜI GIỜ VÀ PHƯƠNG THỨC LÀM VIỆC</div>
  <p>2.1. Bên B được phép áp dụng thời gian làm việc linh hoạt, không bị ràng buộc theo giờ hành chính của Bên A.</p>
  <p>2.2. Bên B sử dụng công cụ, thiết bị của chính mình. Trường hợp Bên A cấp phát thêm, hai bên lập biên bản bàn giao riêng.</p>
  <p>2.3. Phương thức phối hợp: qua email, phần mềm quản lý dự án hoặc kênh liên lạc do hai bên thỏa thuận.</p>
  <p>2.4. Bên B phản hồi yêu cầu trong vòng 01 ngày làm việc, trừ trường hợp bất khả kháng.</p>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 3: PHÍ CỘNG TÁC VÀ PHƯƠNG THỨC THANH TOÁN</div>
  <p>3.1. Mức phí cộng tác: ${rateDisplay}. Phí được tính dựa trên kết quả và chất lượng sản phẩm bàn giao được Bên A nghiệm thu.</p>
  <p>3.2. Bên B có thể nhận thưởng khi sản phẩm vượt kỳ vọng. Mức thưởng do Bên A quyết định.</p>
  <p>3.3. Phương thức: Chuyển khoản ngân hàng vào tài khoản Bên B đã đăng ký.</p>
  <p>3.4. Chu kỳ: Trong vòng 07 ngày làm việc kể từ khi nghiệm thu.</p>
  <p>3.5. Bên A chỉ thanh toán sau khi Bên B bàn giao đầy đủ sản phẩm/file nguồn đạt yêu cầu.</p>
  <p>3.6. Thông tin tài khoản:</p>
  <table class="info-table">
    <tr><td class="label">Tên người thụ hưởng</td><td class="colon">:</td><td class="value">${blank(employee.bank_branch || employee.full_name)}</td></tr>
    <tr><td class="label">Số tài khoản</td><td class="colon">:</td><td class="value">${blank(employee.bank_account)}</td></tr>
    <tr><td class="label">Ngân hàng</td><td class="colon">:</td><td class="value">${blank(employee.bank_name)}</td></tr>
  </table>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 4: QUYỀN SỞ HỮU TRÍ TUỆ</div>
  <p>4.1. Toàn bộ sản phẩm do Bên B tạo ra thuộc quyền sở hữu hoàn toàn của Bên A kể từ thời điểm nghiệm thu.</p>
  <p>4.2. Bên B chuyển nhượng toàn bộ quyền tài sản: sao chép, phân phối, chỉnh sửa, thương mại hóa trên toàn thế giới, không giới hạn thời gian.</p>
  <p>4.3. Sau khi phát hành chính thức, Bên B được trưng bày trong portfolio cá nhân với ghi chú "Thực hiện cho ${c.nameShort}", trừ khi Bên A yêu cầu bảo mật.</p>
  <p>4.4. Bên B đảm bảo Tác phẩm là nguyên gốc, không vi phạm bản quyền bên thứ ba.</p>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 5: BẢO MẬT THÔNG TIN</div>
  <p>5.1. Bên B bảo mật tuyệt đối mọi thông tin dự án, công nghệ, khách hàng, chiến lược, mã nguồn, dữ liệu nội bộ của Bên A.</p>
  <p>5.2. Nghĩa vụ bảo mật duy trì trong 03 năm sau khi Hợp đồng chấm dứt.</p>
  <p>5.3. Vi phạm bảo mật → Bên A được đơn phương chấm dứt và yêu cầu bồi thường.</p>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 6: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B</div>
  <p><strong>6.1. Quyền:</strong> Nhận phí đúng hạn; yêu cầu brief và tài liệu; chủ động phương pháp; làm việc với đối tác không cạnh tranh.</p>
  <p><strong>6.2. Nghĩa vụ:</strong> Đúng chất lượng và tiến độ; không giao người khác thực hiện; bàn giao đầy đủ file nguồn; hoàn trả thiết bị; chấp hành thuế.</p>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 7: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A</div>
  <p><strong>7.1. Quyền:</strong> Yêu cầu đúng tiến độ; chấm dứt khi vi phạm nghiêm trọng; tạm hoãn thanh toán; yêu cầu sửa tối đa 02 lần miễn phí.</p>
  <p><strong>7.2. Nghĩa vụ:</strong> Cung cấp brief, tài liệu, phần mềm; thanh toán đúng hạn; phản hồi nghiệm thu trong 05 ngày; khấu trừ thuế TNCN.</p>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 8: KỸ THUẬT</div>
  <p>8.1. Sản phẩm tuân thủ Style Guide và kỹ thuật số do Bên A quy định.</p>
  <p>8.2. Công cụ: theo thỏa thuận (Figma, Adobe, Blender, Unity, Spine, v.v.).</p>
  <p>8.3. Bên B không nhận việc cho đối thủ cạnh tranh trực tiếp mà không thông báo trước.</p>
  <p>8.4. Sửa chữa ngoài brief ban đầu là phát sinh, có thể tính phí bổ sung.</p>
  <p>8.5. Bảo hành lỗi kỹ thuật: 14 ngày sau nghiệm thu, miễn phí.</p>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 9: CHẤM DỨT HỢP ĐỒNG</div>
  <p>9.1. Chấm dứt khi: hoàn thành nghiệm thu; hết hạn không gia hạn; thỏa thuận văn bản; đơn phương theo 9.2.</p>
  <p>9.2. Đơn phương: thông báo trước tối thiểu 07 ngày làm việc. Bên B bàn giao đầy đủ file nguồn, tài sản.</p>
  <p>9.3. Chế tài: Bên B vi phạm báo trước → không nhận phí chưa thanh toán. Bên A vi phạm → thanh toán phần hoàn thành + bồi thường 07 ngày thù lao.</p>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 10: GIẢI QUYẾT TRANH CHẤP</div>
  <p>Ưu tiên thương lượng trong 15 ngày. Nếu không giải quyết được → Tòa án nhân dân có thẩm quyền tại nơi Bên A đặt trụ sở.</p>
</div>

<div class="article">
  <div class="article-title">ĐIỀU 11: ĐIỀU KHOẢN CHUNG</div>
  <p>11.1. Đây là Hợp đồng dịch vụ theo BLDS 2015, không hình thành quan hệ lao động.</p>
  <p>11.2. Mọi thay đổi phải bằng văn bản có chữ ký hai bên.</p>
  <p>11.3. Điều khoản vô hiệu không ảnh hưởng các điều khoản còn lại.</p>
  <p>11.4. Phụ lục là bộ phận không tách rời.</p>
  <p>11.5. Hợp đồng lập thành 02 bản, mỗi bên giữ 01 bản.</p>
</div>

${signatureBlock('CỘNG TÁC VIÊN (BÊN B)', '(Ký, ghi rõ họ và tên)', 'ĐẠI DIỆN BÊN A', '(Ký, đóng dấu, ghi rõ họ và tên)')}

</body></html>`;
}

