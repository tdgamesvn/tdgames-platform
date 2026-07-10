-- Thêm entity cho expense, cùng convention với invoice_invoices.billing_entity
-- và finance_bank_accounts.entity. Default 'TD GAMES' = backfill toàn bộ record cũ.
alter table public.expense_expenses
  add column if not exists entity text not null default 'TD GAMES'
  check (entity in ('TD GAMES', 'TD CONSULTING', 'Cá nhân'));

comment on column public.expense_expenses.entity is
  'Sổ sách: TD GAMES (sổ thực tế/thuế), TD CONSULTING (nội bộ), Cá nhân';
