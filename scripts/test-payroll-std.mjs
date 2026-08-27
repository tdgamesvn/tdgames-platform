// Kiem tra cong chuan (standardWorkDays) cua BANG LUONG duoc ton trong.
// Chay: node scripts/test-payroll-std.mjs
// FAIL neu ai do quay lai dung hang so 22 trong config thay vi so cua sheet.
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Trich nguyen ham thuan calculatePayroll tu source TS (cung cach test-payroll-ot.mjs).
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

const emp = (workDays) => ({
  workDays, baseSalary: 22_000_000,
  lunchAllowance: 0, transportAllowance: 0, phoneAllowance: 0,
  clothingAllowance: 0, kpiAllowance: 0, defaultOt: 0,
  extraOtHours: 0, dependentsCount: 0, isProbation: false, probationRatio: 0,
});
const gross = (workDays, std) => calculatePayroll(emp(workDays), FORMULA, std).grossActual;

// 1. Di lam DU thi nhan DU, bat ke cong chuan la bao nhieu.
//    Day la ly do T8/2026 = 20 ngay van an toan: tu so va mau so cung ve 20.
for (const std of [20, 22, 23]) {
  assert.equal(gross(std, std), 22_000_000, `std=${std}: di lam du phai nhan du luong`);
}

// 2. Thieu 1 ngay thi bi tru dung 1/std, khong phai 1/22.
assert.equal(gross(22, 23), Math.round(22_000_000 * 22 / 23));

// 3. Chinh cai bug phieu luong Excel: thang 23 ngay ma van lay 22 cua config
//    => ratio > 1 => tra DU luong. Assert cho thay huong sai va do lech.
const dung = gross(23, 23);                 // 22.000.000
const sai  = gross(23, FORMULA.standardWorkDays); // lay nham 22 => 23.000.000
assert.ok(sai > dung, 'dung nham cong chuan 22 cho thang 23 ngay phai ra tra du');
assert.equal(sai - dung, 1_000_000, 'do lech dung bang 1 ngay luong');

// 4. Nguoc lai: thang 20 ngay ma lay 22 => tra THIEU.
assert.ok(gross(20, 20) > gross(20, FORMULA.standardWorkDays));

console.log('OK — cong chuan cua bang luong duoc ton trong (4 nhom assert)');
