-- Tách 2 sổ: entity trên bảng gốc mỗi module. Bảng con kế thừa qua FK.
-- CHỈ add column + default — không UPDATE/DROP, dữ liệu cũ = TD GAMES (sổ gốc).
-- Tên bảng đã verify qua to_regclass trên prod 2026-07-12 (wf_workers, không phải workforce_workers).
do $$
declare t text;
begin
  foreach t in array array[
    'hr_employees', 'hr_departments', 'hr_evaluation_cycles',
    'att_monthly_sheets', 'att_shifts',
    'pay_payroll_sheets',
    'crm_clients', 'crm_studios', 'crm_outreach_leads', 'crm_email_templates',
    'wf_workers',
    'acc_savings', 'acc_loans', 'acc_fixed_assets', 'acc_advances', 'acc_bhxh_payments',
    'expense_recurring'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'alter table public.%I add column if not exists entity text not null default ''TD GAMES'' '
        || 'check (entity in (''TD GAMES'', ''TD CONSULTING''))', t);
    else
      raise notice 'skip: bảng % không tồn tại', t;
    end if;
  end loop;
end $$;
