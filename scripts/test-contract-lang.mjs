// Kiem tra template hop dong khach hang sinh dung 3 ngon ngu.
// Chay: node scripts/test-contract-lang.mjs
// FAIL neu ai do them chuoi gop "English / Tieng Viet" ma quen dung helper t()
// -> ban Thuan Viet se lo tieng Anh (va nguoc lai).
import fs from 'fs';

const src = fs.readFileSync('apps/crm/services/clientContractService.ts', 'utf8');
const start = src.indexOf('export function generateClientContract');
const body = src.slice(start, src.indexOf('\n// ═', start));
const fn = body
  .replace(/^export function generateClientContract\(data: ClientContractData\): string \{/,
           'function (data, COMPANY_OPTIONS, fmt, fmtDate, blank, numberToWords, PRINT_CSS) {')
  .replace(/: string/g, '');
const gen = new Function('return ' + fn)();

const CO = { tdgames: { name: 'TD GAMES', address: 'HN', taxCode: '0111386856',
                        representative: 'R', representativeTitle: 'GD' } };
const f = n => n.toLocaleString('vi-VN');
const base = {
  contractNumber: 'X', signingDate: '2026-08-19', companyKey: 'tdgames', clientName: 'KH',
  clientAddress: 'A', clientTaxCode: '0101', clientRepresentative: 'R', clientRepresentativeTitle: 'T',
  projectName: 'P', scopeContent: '<p>scope</p>', startDate: '', estimatedDuration: '',
  estimatedCompletion: '', contractType: 'domestic', totalValue: 1000, currency: 'VND',
  phases: [{ label: 'P1', percentage: 100, amount: 1000, description: 'd' }],
};
const render = lang => gen({ ...base, lang }, CO, f, () => '01/01/2026',
  (v, p = '..') => v || p, (n, c) => f(n) + ' ' + c, '').replace(/<[^>]+>/g, ' ');

// Tu khoa dac trung tung ngon ngu - xuat hien o tieu de dieu/muc, la cho hay quen t()
const EN = ['ARTICLE', 'PAYMENT TERMS', 'Limitation of Liability', 'Working Days'];
const VI = ['ĐIỀU', 'ĐIỀU KHOẢN THANH TOÁN', 'Giới hạn trách nhiệm', 'Ngày làm việc'];
const has = (txt, list) => list.filter(k => txt.includes(k));

let fail = 0;
const check = (name, cond, detail) => {
  if (!cond) { console.error('FAIL:', name, detail || ''); fail++; }
};

const both = render('both'), vi = render('vi'), en = render('en');
check('both co ca EN va VI', has(both, EN).length === EN.length && has(both, VI).length === VI.length);
check('thuan Viet khong con tieng Anh', has(vi, EN).length === 0, '-> con: ' + has(vi, EN).join(', '));
check('thuan Anh khong con tieng Viet', has(en, VI).length === 0, '-> con: ' + has(en, VI).join(', '));
check('thuan Viet van du noi dung', has(vi, VI).length === VI.length);
check('thuan Anh van du noi dung', has(en, EN).length === EN.length);
// Dieu khoan phap ly then chot phai co o ca 3 ban
for (const [n, t] of [['both', both], ['vi', vi], ['en', en]]) {
  check(`ban ${n} co dieu khoan thue`, /thuế giá trị gia tăng|[Vv]alue [Aa]dded [Tt]ax/.test(t));
  check(`ban ${n} co han thanh toan`, /15 ngày|fifteen \(15\)/.test(t));
}

if (fail) { console.error(`\n${fail} kiem tra that bai`); process.exit(1); }
console.log('contract-lang OK (both / vi / en)');
