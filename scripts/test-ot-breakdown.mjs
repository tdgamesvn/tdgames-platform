// Kiem tra otBreakdown (dung chung: phieu luong HR + Portal) tach tien OT dung tung loai.
// Chay: node scripts/test-ot-breakdown.mjs
// FAIL neu: tong cac dong con khong khop extra_ot (nhan vien doi chieu ra so khac bang luong),
// hoac tien tung dong lech so voi don gia that trong calculatePayroll.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const LEGAL = {
  otRateWeekday: 1.5, otRateWeekend: 2.0, otRateHoliday: 3.0,
  otRateNightWeekday: 2.0, otRateNightWeekend: 2.7, otRateNightHoliday: 3.9,
};

// ── Trich otBreakdown tu source TSX roi bo type annotation ──
const src = fs.readFileSync('apps/payroll/services/otBreakdown.ts', 'utf8');
const start = src.indexOf('export const otBreakdown = (');
const end = src.indexOf('\n};', start);
assert.ok(start > 0 && end > start, 'Khong tim thay otBreakdown trong otBreakdown.ts');
const js = src.slice(start, end + 3)
  .replace('export const otBreakdown = (ps: PayPayrollRecord, rates: OtRates) =>', 'return (ps, rates) =>')
  .replace(/ as const/g, '')
  .replace(/\.map\(\(\[h, rate, label\]\)/, '.map(([h, rate, label])');
const otBreakdownFn = new Function(js)();
const otBreakdown = (ps) => otBreakdownFn(ps, LEGAL);

// Don gia gio OT theo ND 145/2020 D.55 — phai khop payrollService.calculatePayroll
const BASE = 20_000_000, KPI = 3_000_000, STD = 22, HPD = 8;
const hourly = (BASE + KPI) / STD / HPD;

const hours = {
  extra_ot_hours: 2,
  extra_ot_hours_weekend: 4,
  extra_ot_hours_holiday: 1,
  extra_ot_hours_night: 3,
  extra_ot_hours_night_weekend: 1.5,
  extra_ot_hours_night_holiday: 0,
};
const RATE_OF = {
  extra_ot_hours: LEGAL.otRateWeekday,
  extra_ot_hours_weekend: LEGAL.otRateWeekend,
  extra_ot_hours_holiday: LEGAL.otRateHoliday,
  extra_ot_hours_night: LEGAL.otRateNightWeekday,
  extra_ot_hours_night_weekend: LEGAL.otRateNightWeekend,
  extra_ot_hours_night_holiday: LEGAL.otRateNightHoliday,
};
// extra_ot nhu calculatePayroll ghi vao DB
const extra_ot = Math.round(
  hourly * Object.entries(hours).reduce((s, [k, h]) => s + RATE_OF[k] * h, 0)
);
const ps = { ...hours, extra_ot };

const ot = otBreakdown(ps);

// 1. Chi liet ke loai co gio > 0
assert.equal(ot.items.length, 5, 'Phai bo loai 0h (dem le/Tet)');
assert.ok(!ot.items.some(i => i.hours === 0), 'Khong duoc hien dong 0h');

// 2. Tong gio dung
assert.equal(ot.totalHours, 11.5, `totalHours sai: ${ot.totalHours}`);

// 3. Tong tien cac dong con KHOP TUYET DOI voi extra_ot tren bang luong
const sum = ot.items.reduce((s, i) => s + i.pay, 0);
assert.equal(sum, extra_ot, `Tong dong con ${sum} != extra_ot ${extra_ot}`);
assert.equal(ot.totalPay, extra_ot);

// 4. Tien tung dong khop don gia that (lech <= 1d do lam tron + phan du)
for (const it of ot.items) {
  const expected = hourly * it.rate * it.hours;
  assert.ok(Math.abs(it.pay - expected) <= 1,
    `${it.label}: ${it.pay} lech qua 1d so voi ${Math.round(expected)}`);
}

// 5. He so hien thi dung luat (150/200/300 · dem 200/270/390)
assert.deepEqual(ot.items.map(i => Math.round(i.rate * 100)), [150, 200, 300, 200, 270]);

// 6. Khong co OT -> khong render gi
const empty = otBreakdown({ extra_ot: 0 });
assert.equal(empty.totalHours, 0);
assert.equal(empty.items.length, 0, 'Khong OT thi khong co dong nao');

// 7. Chi 1 loai OT -> van tach dong con (nhan vien phai thay he so)
const one = otBreakdown({ extra_ot_hours_weekend: 6, extra_ot: Math.round(hourly * 2 * 6) });
assert.equal(one.items.length, 1);
assert.equal(one.items[0].pay, one.totalPay, 'Mot loai thi dong con = tong');

console.log('OK — otBreakdown tach dung 6 loai OT, tong khop extra_ot.');
