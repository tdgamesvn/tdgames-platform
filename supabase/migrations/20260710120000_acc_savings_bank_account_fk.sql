-- Liên kết khoản gửi tiết kiệm với tài khoản ngân hàng công ty
-- Trước đây form "Thêm khoản gửi" cho gõ tay bank_name tự do → không đối chiếu được
-- với finance_bank_accounts. Thêm FK, record cũ để null (không backfill).
alter table public.acc_savings
  add column if not exists bank_account_id uuid references public.finance_bank_accounts(id);

comment on column public.acc_savings.bank_account_id is 'FK tới finance_bank_accounts — tài khoản ngân hàng công ty dùng để gửi tiết kiệm. Null cho record cũ trước khi có dropdown.';
