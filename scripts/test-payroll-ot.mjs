// Kiem tra calculatePayroll tinh dung tien tang ca theo LOAI NGAY.
// Chay: node scripts/test-payroll-ot.mjs
// FAIL neu ai do gop lai 1 he so, doi thu tu he so, hoac lam vo tuong thich nguoc
// (ban ghi cu khong co gio T7/CN + le phai ra y het ket qua truoc migration).
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ── Trich nguyen ham thuan calculatePayroll tu source TS roi bo type annotation ──
const src = fs.readFileSync('apps/payroll/services/payrollService.ts', 'utf8');
const start = src.indexOf('export function calculatePayroll(');
const body = src.slice(start, src.indexOf('\n// ═', start));
const js = body
  .replace('export function calculatePayroll(', 'function (')
  .replace(' = FALLBACK_PAYROLL_FORMULA', '')
  .replace('): PayrollOutput {', ') {')
  .replace(/: (PayrollInput|PayrollFormulaConfig|number)/g, '')
  .replace(/standardWorkDays\?/, 'standardWorkDays')
  .replace(/!\s\*/g, ' *');
const calculatePayroll = new Function('return ' + js)();

const FORMULA = {
  standardWorkDays: 22, hoursPerDay: 8,
  bhEmployeeRate: 0.105, bhCompanyRate: 0.215,
  personalDeduction: 15_500_000, dependentDeduction: 6_200_000,
  otRateWeekday: 1.5, otRateWeekend: 2.0, otRateHoliday: 3.0,
  otRateNightWeekday: 2.0, otRateNightWeekend: 2.7, otRateNightHoliday: 3.9,
  probationPitRate: 0.1,
  taxBrackets: [
    { limit: 10_000_000, rate: 0.05, deduction: 0 },
    { limit: 30_000_000, rate: 0.10, deduction: 500_000 },
    { limit: 60_000_000, rate: 0.20, deduction: 3_500_000 },
    { limit: 100_000_000, rate: 0.30, deduction: 9_500_000 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.35, deduction: 14_500_000 },
  ],
};

// Luong CB 22tr / 22 ngay / 8h => 125.000d mot gio. So tron de doi chieu bang tay.
const base = {
  workDays: 22, baseSalary: 22_000_000,
  lunchAllowance: 0, transportAllowance: 0, phoneAllowance: 0,
  clothingAllowance: 0, kpiAllowance: 0, defaultOt: 0,
  extraOtHours: 0, dependentsCount: 0, isProbation: false, probationRatio: 0,
};
const HOURLY = 125_000;
const ot = (patch) => calculatePayroll({ ...base, ...patch }, FORMULA, 22).extraOt;

const cases = [
  ['ngay thuong 8h = 150%', { extraOtHours: 8 }, HOURLY * 1.5 * 8],
  ['T7/CN 8h = 200%', { extraOtHoursWeekend: 8 }, HOURLY * 2.0 * 8],
  ['le/Tet 8h = 300%', { extraOtHoursHoliday: 8 }, HOURLY * 3.0 * 8],
  ['tron 2h moi loai', { extraOtHours: 2, extraOtHoursWeekend: 2, extraOtHoursHoliday: 2 },
    HOURLY * (1.5 * 2 + 2.0 * 2 + 3.0 * 2)],
  ['khong tang ca', {}, 0],
  // OT ban dem — ND 145/2020 D.57 k.3
  ['dem ngay thuong 8h = 200%', { extraOtHoursNight: 8 }, HOURLY * 2.0 * 8],
  ['dem T7/CN 8h = 270%', { extraOtHoursNightWeekend: 8 }, HOURLY * 2.7 * 8],
  ['dem le/Tet 8h = 390%', { extraOtHoursNightHoliday: 8 }, HOURLY * 3.9 * 8],
  ['tron ca 6 loai 2h', {
    extraOtHours: 2, extraOtHoursWeekend: 2, extraOtHoursHoliday: 2,
    extraOtHoursNight: 2, extraOtHoursNightWeekend: 2, extraOtHoursNightHoliday: 2,
  }, HOURLY * (1.5 + 2.0 + 3.0 + 2.0 + 2.7 + 3.9) * 2],
  // Don gia gio OT = TRON goi luong tham chieu (chinh sach cong ty 2026-08-27, cao hon san ND 145).
  // CB 22tr + KPI 4.4tr = 26.4tr / 22 / 8 = 150.000d/h
  ['don gia gio gom phu cap KPI', { kpiAllowance: 4_400_000, extraOtHours: 8 }, 150_000 * 1.5 * 8],
  // ...VA gom ca an trua / trang phuc / xang xe / dien thoai / tang ca mac dinh
  // CB 22tr + 5 khoan x 1tr = 27tr / 22 / 8 = 153.409,09d/h
  ['don gia gio gom an trua-xang-DT-trang phuc-OT mac dinh', {
    lunchAllowance: 1_000_000, transportAllowance: 1_000_000, phoneAllowance: 1_000_000,
    clothingAllowance: 1_000_000, defaultOt: 1_000_000, extraOtHours: 8,
  }, Math.round((27_000_000 / 22 / 8) * 1.5 * 8)],
];

let failed = 0;
for (const [name, patch, expected] of cases) {
  try {
    assert.equal(ot(patch), expected);
    console.log(`  ok   ${name} -> ${expected.toLocaleString('vi-VN')}d`);
  } catch (e) {
    console.error(`  FAIL ${name}: nhan ${ot(patch)}, mong doi ${expected}`);
    failed++;
  }
}

// Tuong thich nguoc: ban ghi cu (undefined 2 truong moi) = ban ghi moi voi 0 gio.
try {
  assert.equal(ot({ extraOtHours: 5 }), ot({ extraOtHours: 5, extraOtHoursWeekend: 0, extraOtHoursHoliday: 0 }));
  console.log('  ok   ban ghi cu (thieu 2 truong) khong doi ket qua');
} catch {
  console.error('  FAIL ban ghi cu bi doi ket qua sau migration');
  failed++;
}

// Thang chuyen giao thu viec -> chinh thuc: don gia gio OT phai theo muc luong BLEND
// (cu x %TV + moi x %CT), khong duoc lay muc chinh thuc cho ca thang.
try {
  const got = ot({
    preOfficialBaseSalary: 11_000_000, probationRatio: 0.5, extraOtHours: 8,
  });
  // effectiveBase = 11tr*0.5 + 22tr*0.5 = 16.5tr => 16.5tr/22/8 = 93.750d/h
  assert.equal(got, 93_750 * 1.5 * 8);
  console.log('  ok   thang chuyen giao dung don gia blend (khong lay muc chinh thuc)');
} catch (e) {
  console.error('  FAIL thang chuyen giao: OT tinh theo muc luong chinh thuc cho ca thang');
  failed++;
}

// He so phai lay tu bang cong thuc, khong hardcode trong engine.
try {
  const custom = { ...FORMULA, otRateWeekend: 2.5 };
  assert.equal(calculatePayroll({ ...base, extraOtHoursWeekend: 4 }, custom, 22).extraOt, HOURLY * 2.5 * 4);
  console.log('  ok   he so T7/CN doc tu bang cong thuc (chinh duoc)');
} catch {
  console.error('  FAIL he so T7/CN bi hardcode trong engine');
  failed++;
}

if (failed) {
  console.error(`\n${failed} test FAIL`);
  process.exitCode = 1;
} else {
  console.log('\nTat ca test tang ca PASS');
}
