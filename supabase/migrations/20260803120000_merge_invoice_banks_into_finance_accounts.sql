-- Gộp invoice_banks vào finance_bank_accounts.
--
-- Trước: 2 bảng song song tả cùng một tài khoản thật.
--   invoice_banks         -> bankingInfo (snapshot text in lên hoá đơn)
--   finance_bank_accounts -> receiving_account_id (kế toán)
-- Không có ràng buộc nào giữa hai bên => hoá đơn in TK này, kế toán ghi TK khác.
--
-- Sau: finance_bank_accounts là nguồn duy nhất. Thiếu đúng 2 cột để in được hoá đơn.

alter table public.finance_bank_accounts
  add column if not exists account_name text,
  add column if not exists branch_name  text;

comment on column public.finance_bank_accounts.account_name is 'Tên chủ tài khoản (beneficiary) — in trên hoá đơn';
comment on column public.finance_bank_accounts.branch_name  is 'Chi nhánh ngân hàng — in trên hoá đơn';

-- Backfill từ invoice_banks theo số tài khoản (3/6 TK khớp).
-- swift/citad/address: chỉ điền khi finance đang trống, không đè dữ liệu đã có.
update public.finance_bank_accounts f
set account_name = nullif(btrim(b.account_name), ''),
    branch_name  = nullif(btrim(b.branch_name), ''),
    swift_code   = coalesce(f.swift_code,   nullif(btrim(b.swift_code), '')),
    citad_code   = coalesce(f.citad_code,   nullif(btrim(b.citad_code), '')),
    bank_address = coalesce(f.bank_address, nullif(btrim(b.bank_address), ''))
from public.invoice_banks b
where regexp_replace(f.account_number, '\s', '', 'g') = regexp_replace(b.account_number, '\s', '', 'g');

-- 2 TK công ty chưa từng có trong invoice_banks — điền chủ TK theo TK cùng ngân hàng.
update public.finance_bank_accounts
   set account_name = 'CONG TY TNHH TD GAMES',
       branch_name  = 'BIDV Tower, 194 Tran Quang Khai, Hoan Kiem, Ha Noi'
 where account_number = '8610104092' and account_name is null;

update public.finance_bank_accounts
   set account_name = 'TD GAMES COMPANY LIMITED'
 where account_number = '656898888' and account_name is null;

-- TK cá nhân (9404072023) cố ý để trống — không dùng in hoá đơn công ty.

comment on table public.invoice_banks is
  'DEPRECATED 2026-08-03 — đã gộp vào finance_bank_accounts. Giữ lại làm bản lưu, không còn code nào đọc.';
