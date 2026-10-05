-- Phiếu nghiệm thu khách: tạm ứng (khách đã trả trước) + TK ngân hàng nhận tiền.
-- advance_type 'percent' → advance_value là % của net total; 'amount' → số tiền tuyệt đối (theo currency phiếu).
-- bank_info = snapshot TK lúc chọn (giống hoá đơn): phiếu đã gửi phải giữ nguyên thông tin TK
-- kể cả khi finance_bank_accounts bị sửa/ẩn sau này. bank_account_id chỉ để UI biết đang chọn TK nào.
alter table public.wf_project_acceptances
  add column if not exists advance_type text not null default 'percent'
    check (advance_type in ('percent', 'amount')),
  add column if not exists advance_value numeric not null default 0
    check (advance_value >= 0),
  add column if not exists bank_account_id uuid
    references public.finance_bank_accounts(id) on delete set null,
  add column if not exists bank_info jsonb;

create index if not exists wf_project_acceptances_bank_account_id_idx
  on public.wf_project_acceptances (bank_account_id);
