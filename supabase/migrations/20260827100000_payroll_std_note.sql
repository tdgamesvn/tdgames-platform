-- Lý do đổi công chuẩn của bảng lương. Bắt buộc nhập ở UI (kế toán phải giải trình
-- vì đổi số này là tính lại tiền cả bảng) — cột để null cho các bảng lương cũ.
alter table public.pay_payroll_sheets
  add column if not exists standard_work_days_note text;

comment on column public.pay_payroll_sheets.standard_work_days_note is
  'Lý do kế toán sửa công chuẩn (VD: "T9 có lễ 2/9 + nửa ngày T7"). Null = chưa từng sửa tay.';
