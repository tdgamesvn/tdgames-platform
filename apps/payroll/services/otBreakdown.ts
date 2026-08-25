import { PayPayrollRecord, PayrollFormulaConfig } from '@/types';

/** Chỉ cần 6 hệ số OT — nhận Pick để cả phiếu lương HR (config thật) lẫn Portal (mức luật) dùng chung. */
export type OtRates = Pick<PayrollFormulaConfig,
  'otRateWeekday' | 'otRateWeekend' | 'otRateHoliday'
  | 'otRateNightWeekday' | 'otRateNightWeekend' | 'otRateNightHoliday'>;

/**
 * Tách OT phát sinh theo loại ngày/ca: giờ, hệ số, và tiền của TỪNG loại.
 *
 * Tiền từng loại suy ngược từ tổng `extra_ot` đã lưu (chia theo trọng số giờ × hệ số)
 * chứ không tính lại đơn giá giờ — nên tổng các dòng con LUÔN khớp tuyệt đối với con số
 * trên bảng lương, và công thức lương không bị nhân đôi ở client.
 */
export const otBreakdown = (ps: PayPayrollRecord, rates: OtRates) => {
  const rows = ([
    [ps.extra_ot_hours, rates.otRateWeekday, 'Ngày thường'],
    [ps.extra_ot_hours_weekend, rates.otRateWeekend, 'Thứ 7 / Chủ nhật'],
    [ps.extra_ot_hours_holiday, rates.otRateHoliday, 'Ngày lễ / Tết'],
    [ps.extra_ot_hours_night, rates.otRateNightWeekday, 'Ban đêm — ngày thường'],
    [ps.extra_ot_hours_night_weekend, rates.otRateNightWeekend, 'Ban đêm — T7 / CN'],
    [ps.extra_ot_hours_night_holiday, rates.otRateNightHoliday, 'Ban đêm — lễ / Tết'],
  ] as const)
    .map(([h, rate, label]) => ({ hours: h || 0, rate, label, weight: (h || 0) * rate }))
    .filter(r => r.hours > 0);

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const totalPay = ps.extra_ot || 0;
  // Dòng cuối ăn phần dư làm tròn ⇒ cộng các dòng con luôn ra đúng totalPay.
  let left = totalPay;
  const items = rows.map((r, i) => {
    const pay = i === rows.length - 1 ? left : Math.round(totalPay * (r.weight / totalWeight));
    left -= pay;
    return { ...r, pay };
  });
  return { items, totalHours, totalPay };
};
